"""
Backend-owned calculations from the PRD (Section 4): usable surplus
and time-to-stockout. These are pure reads/math over existing tables
- no writes here. Used by the analytics router (for Agents/Frontend
to query directly) and by trigger_service (to decide thresholds).
"""
from sqlalchemy.orm import Session

from app.models import CurrentInventory, DailyPrediction, ItemBatch, ItemLifespanStats

NEAR_EXPIRY_DAYS = 7  # matches item_batches.py — fixed for demo, move to config later


def get_latest_prediction(db: Session, store_id: int, item_id: int) -> DailyPrediction | None:
    return (
        db.query(DailyPrediction)
        .filter(DailyPrediction.store_id == store_id, DailyPrediction.item_id == item_id)
        .order_by(DailyPrediction.prediction_date.desc())
        .first()
    )


def get_near_expiry_qty(db: Session, store_id: int, item_id: int) -> int:
    from datetime import date, timedelta
    cutoff = date.today() + timedelta(days=NEAR_EXPIRY_DAYS)
    batches = (
        db.query(ItemBatch)
        .filter(
            ItemBatch.store_id == store_id,
            ItemBatch.item_id == item_id,
            ItemBatch.expiry_date.isnot(None),
            ItemBatch.expiry_date <= cutoff,
        )
        .all()
    )
    return sum(b.qty for b in batches)


def get_usable_surplus(db: Session, store_id: int, item_id: int) -> int:
    """
    Usable surplus = stock above what the prediction engine forecasts
    this store needs, excluding stock nearing expiry. Recalculated
    live from current_inventory + latest daily_predictions +
    item_batches — never stored/snapshotted, per the PRD.
    """
    inv = db.get(CurrentInventory, (store_id, item_id))
    if not inv:
        return 0

    prediction = get_latest_prediction(db, store_id, item_id)
    forecast_need = float(prediction.predicted_demand) if prediction else 0.0
    near_expiry_qty = get_near_expiry_qty(db, store_id, item_id)

    available = inv.qty_on_hand - near_expiry_qty
    surplus = available - forecast_need
    return max(0, int(surplus))


def get_daily_sales_rate(db: Session, store_id: int, item_id: int) -> float | None:
    """
    Prefers today's ML forecast (daily_predictions.predicted_demand);
    falls back to all-time average (item_lifespan_stats) if no
    prediction exists yet for this store+item.
    """
    prediction = get_latest_prediction(db, store_id, item_id)
    if prediction:
        return float(prediction.predicted_demand)

    stats = db.get(ItemLifespanStats, (store_id, item_id))
    if stats and stats.all_time_sales_avg:
        return float(stats.all_time_sales_avg)

    return None


def get_time_to_stockout(db: Session, store_id: int, item_id: int) -> float | None:
    """
    Days until stockout at current sales rate. None if there's no
    sales-rate data to compute it from (distinguish from 0, which
    means already out of stock).
    """
    inv = db.get(CurrentInventory, (store_id, item_id))
    if not inv:
        return 0.0
    if inv.qty_on_hand <= 0:
        return 0.0

    rate = get_daily_sales_rate(db, store_id, item_id)
    if not rate or rate <= 0:
        return None

    return inv.qty_on_hand / rate
