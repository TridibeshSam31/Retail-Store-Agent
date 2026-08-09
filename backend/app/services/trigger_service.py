"""
Threshold trigger logic. Called whenever current_inventory changes
(via PUT /inventory/{store_id}/{item_id} or POST /transactions).

Two paths, matching the PRD:
  - check_immediately_low: cheap real-time check on every stock change.
  - maybe_recompute_batch: fires every X transactions (config.batch_x),
    checks "might be low", and is SKIPPED for an item/store that just
    tripped immediately-low in the same cycle (PRD's interaction rule).

Both only decide WHEN to open a negotiation and create the
Negotiation row itself — the actual negotiation (turns, arbitration,
resolution) is owned by the Agents group from that point on.
"""
from sqlalchemy.orm import Session

from app.models import Config, DailyPrediction, Negotiation, RawTransaction, Store
from app.services.prediction_service import get_latest_prediction

IMMEDIATE_LOW_RATIO = 0.20  # qty_on_hand <= 20% of ROP triggers immediately-low


def _has_open_negotiation(db: Session, store_id: int, item_id: int) -> bool:
    return (
        db.query(Negotiation)
        .filter(
            Negotiation.initiator_store_id == store_id,
            Negotiation.item_id == item_id,
            Negotiation.status.in_(["proposed", "approved"]),
        )
        .first()
        is not None
    )


def _create_negotiation(db: Session, store_id: int, item_id: int, trigger_type: str) -> Negotiation:
    store = db.get(Store, store_id)
    neg = Negotiation(
        org_id=store.org_id,
        item_id=item_id,
        initiator_store_id=store_id,
        trigger_type=trigger_type,
        status="proposed",
    )
    db.add(neg)
    db.flush()  # so callers/tests can see negotiation_id without a separate commit
    return neg


def check_immediately_low(db: Session, store_id: int, item_id: int, qty_on_hand: int) -> bool:
    """
    Real-time check, run inline on every stock write (same transaction
    as the write itself — see inventory.py / transactions.py). Returns
    True if immediately-low tripped (whether or not a NEW negotiation
    was created — an existing open one counts as already handled, per
    the PRD's "avoid re-flagging" rule).
    """
    prediction = get_latest_prediction(db, store_id, item_id)
    if not prediction:
        return False  # no ROP to compare against yet

    threshold = float(prediction.rop) * IMMEDIATE_LOW_RATIO
    if qty_on_hand > threshold:
        return False

    if _has_open_negotiation(db, store_id, item_id):
        return True  # already flagged this cycle, don't duplicate

    _create_negotiation(db, store_id, item_id, trigger_type="immediately_low")
    return True


def maybe_recompute_batch(db: Session, org_id: int, store_id: int, item_id: int) -> None:
    """
    Called after every transaction insert. Counts transactions for
    this store+item since the last daily_predictions row, and once
    config.batch_x is reached, runs the "might be low" check.

    Interaction rule: if this store+item already has an
    immediately-low negotiation open, the batch check is skipped
    entirely for it this cycle (the immediately-low path already
    covered it) - this is what stops the same shortage being flagged
    twice, per the PRD.
    """
    if _has_open_negotiation(db, store_id, item_id):
        return  # skipped — immediately-low already handled this cycle

    cfg = db.get(Config, org_id)
    if not cfg:
        return  # no batch_x configured for this org yet

    latest_prediction = get_latest_prediction(db, store_id, item_id)
    since = latest_prediction.created_at if latest_prediction else None

    q = db.query(RawTransaction).filter(
        RawTransaction.store_id == store_id, RawTransaction.item_id == item_id
    )
    if since is not None:
        q = q.filter(RawTransaction.date >= since.date())
    txn_count = q.count()

    if txn_count < cfg.batch_x:
        return  # not enough transactions yet to trigger a recompute

    # NOTE: this does not re-run the ML prediction itself (that's the
    # ML pipeline's job) - it only checks "might be low" against the
    # most recent prediction already on file, since that's what
    # decides whether a negotiation opens.
    if not latest_prediction:
        return

    from app.models import CurrentInventory
    inv = db.get(CurrentInventory, (store_id, item_id))
    if not inv:
        return

    if inv.qty_on_hand <= latest_prediction.rop:
        _create_negotiation(db, store_id, item_id, trigger_type="might_be_low")
