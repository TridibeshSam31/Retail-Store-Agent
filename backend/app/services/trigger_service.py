"""
Threshold trigger logic. Called whenever current_inventory changes
(via PUT /inventory/{store_id}/{item_id} or POST /transactions).

Two paths, matching the PRD:
  - check_immediately_low: cheap real-time check on every stock change.
  - maybe_recompute_batch: fires every X transactions (config.batch_x),
    checks "might be low", and is SKIPPED for an item/store that just
    tripped immediately-low in the same cycle (PRD's interaction rule).

Both return the new negotiation_id (or None if nothing tripped, or a
negotiation was already open). They deliberately do NOT kick off the
agent themselves - at this point the Negotiation row is only
flush()'d, not committed, so a second DB session (the agent's) can't
see it yet. The caller (the router) must call
lang.bridge.start_negotiation(negotiation_id) AFTER db.commit()
succeeds - see inventory.py / transactions.py.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Config, Negotiation, RawTransaction, Store
from app.services.prediction_service import get_latest_prediction

IMMEDIATE_LOW_RATIO = 0.20  # qty_on_hand <= 20% of ROP triggers immediately-low


def _open_negotiation_id(db: Session, store_id: int, item_id: int) -> Optional[int]:
    neg = (
        db.query(Negotiation)
        .filter(
            Negotiation.initiator_store_id == store_id,
            Negotiation.item_id == item_id,
            Negotiation.status.in_(["proposed", "approved"]),
        )
        .first()
    )
    return neg.negotiation_id if neg else None


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
    db.flush()  # get negotiation_id without committing — caller commits
    return neg


def check_immediately_low(db: Session, store_id: int, item_id: int, qty_on_hand: int) -> Optional[int]:
    """
    Real-time check, run inline on every stock write (same transaction
    as the write itself). Returns the negotiation_id if a NEW
    negotiation was created this call, else None (nothing tripped, or
    one was already open — no duplicate created either way).
    """
    prediction = get_latest_prediction(db, store_id, item_id)
    if not prediction:
        return None  # no ROP to compare against yet

    threshold = float(prediction.rop) * IMMEDIATE_LOW_RATIO
    if qty_on_hand > threshold:
        return None

    if _open_negotiation_id(db, store_id, item_id) is not None:
        return None  # already flagged this cycle, don't duplicate

    neg = _create_negotiation(db, store_id, item_id, trigger_type="immediately_low")
    return neg.negotiation_id


def maybe_recompute_batch(db: Session, org_id: int, store_id: int, item_id: int) -> Optional[int]:
    """
    Called after every transaction insert. Counts transactions for
    this store+item since the last daily_predictions row, and once
    config.batch_x is reached, runs the "might be low" check.

    Interaction rule: if this store+item already has an
    immediately-low negotiation open, this is skipped entirely (the
    immediately-low path already covered it) — stops the same
    shortage being flagged twice, per the PRD.
    """
    if _open_negotiation_id(db, store_id, item_id) is not None:
        return None  # skipped — already handled this cycle

    cfg = db.get(Config, org_id)
    if not cfg:
        return None  # no batch_x configured for this org yet

    latest_prediction = get_latest_prediction(db, store_id, item_id)
    since = latest_prediction.created_at if latest_prediction else None

    q = db.query(RawTransaction).filter(
        RawTransaction.store_id == store_id, RawTransaction.item_id == item_id
    )
    if since is not None:
        q = q.filter(RawTransaction.date >= since.date())
    txn_count = q.count()

    if txn_count < cfg.batch_x:
        return None  # not enough transactions yet

    # This is the actual ML batch boundary. The pipeline writes the
    # next-day prediction into the same DB transaction as the sale.
    # That keeps the trigger atomic: if the transaction rolls back, so
    # does the prediction generated from it.
    from ml.pipeline.service import recompute_predictions
    predictions = recompute_predictions(
        db, org_id, store_id=store_id, item_id=item_id
    )
    if not predictions:
        return None  # no historical sales/model input yet

    latest_prediction = get_latest_prediction(db, store_id, item_id)
    if not latest_prediction:
        return None

    from app.models import CurrentInventory
    inv = db.get(CurrentInventory, (store_id, item_id))
    if not inv:
        return None

    if inv.qty_on_hand <= latest_prediction.rop:
        neg = _create_negotiation(db, store_id, item_id, trigger_type="might_be_low")
        return neg.negotiation_id

    return None
