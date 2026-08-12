"""
In-process prediction pipeline.

This module is the bridge between the ML artifact and the backend's
SQLAlchemy session. It deliberately does not create its own database
engine, read environment variables, or write CSV files: Render runs the
FastAPI app and this pipeline in the same process.

The trained model predicts next-day demand. Results are upserted into
daily_predictions using the caller's transaction, so a prediction batch
can be committed atomically with the stock/transaction event that caused
it.
"""
from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.models import (
    DailyPrediction,
    InventoryMetadata,
    ItemLifespanStats,
    RawTransaction,
    Store,
)

Z_SCORE = 1.65
DEFAULT_ORDER_COST = 50.0
DEFAULT_HOLDING_COST = 12.5
DEFAULT_LEAD_TIME_DAYS = 3

FEATURE_COLS = [
    "price", "promo", "weekday", "month", "lag_1", "lag_2", "lag_7",
    "rolling_mean_7d", "rolling_std_7d", "rolling_max_14d",
    "rolling_min_14d", "expanding_sum", "expanding_mean", "month_sin",
    "month_cos", "weekday_sin", "weekday_cos", "rolling_price_mean_30d",
    "price_ratio", "promo_density_7d",
]

_MODEL = None


def _model():
    global _MODEL
    if _MODEL is None:
        artifact = Path(__file__).resolve().parent / "demand-forecasting-01.pkl"
        if not artifact.exists():
            raise FileNotFoundError(f"ML model artifact not found: {artifact}")
        _MODEL = joblib.load(artifact)
    return _MODEL


def _historical_frame(db: Session, org_id: int) -> pd.DataFrame:
    """Return the same basic source columns used by the offline pipeline."""
    conn = db.connection()
    query = """
        SELECT rt.date, rt.store_id, rt.item_id, rt.sales, rt.price, rt.promo
        FROM raw_transactions rt
        JOIN stores s ON s.store_id = rt.store_id
        WHERE s.org_id = :org_id
          AND rt.date >= CURRENT_DATE - INTERVAL '1 year'
        ORDER BY rt.store_id, rt.item_id, rt.date, rt.transaction_id
    """
    df = pd.read_sql(query, conn, params={"org_id": org_id})
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"])
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["sales"] = pd.to_numeric(df["sales"], errors="coerce")
    df["promo"] = pd.to_numeric(df["promo"], errors="coerce").fillna(0)
    return df


def _add_features(db: Session, org_id: int, df: pd.DataFrame) -> pd.DataFrame:
    """Apply the feature engineering used by the checked-in model."""
    if df.empty:
        return df

    stores = db.query(Store.store_id).filter(Store.org_id == org_id).all()
    store_ids = [x.store_id for x in stores]
    if not store_ids:
        return pd.DataFrame()

    stats = (
        db.query(
            ItemLifespanStats.store_id,
            ItemLifespanStats.item_id,
            ItemLifespanStats.all_time_sales_total.label("expanding_sum"),
            ItemLifespanStats.all_time_sales_avg.label("expanding_mean"),
        )
        .filter(ItemLifespanStats.store_id.in_(store_ids))
        .all()
    )
    stats_df = pd.DataFrame(
        stats,
        columns=["store_id", "item_id", "expanding_sum", "expanding_mean"],
    )
    if not stats_df.empty:
        df = df.merge(stats_df, on=["store_id", "item_id"], how="left")
    else:
        df["expanding_sum"] = 0.0
        df["expanding_mean"] = 0.0

    df["expanding_sum"] = df["expanding_sum"].fillna(0)
    df["expanding_mean"] = df["expanding_mean"].fillna(0)
    df["weekday"] = df["date"].dt.weekday
    df["month"] = df["date"].dt.month
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    df["weekday_sin"] = np.sin(2 * np.pi * df["weekday"] / 7)
    df["weekday_cos"] = np.cos(2 * np.pi * df["weekday"] / 7)

    grouped = df.groupby(["store_id", "item_id"], sort=False)
    df["lag_1"] = grouped["sales"].shift(1)
    df["lag_2"] = grouped["sales"].shift(2)
    df["lag_7"] = grouped["sales"].shift(7)
    df["rolling_mean_7d"] = grouped["sales"].transform(
        lambda x: x.shift(1).rolling(7).mean()
    )
    df["rolling_std_7d"] = grouped["sales"].transform(
        lambda x: x.shift(1).rolling(7).std()
    )
    df["rolling_max_14d"] = grouped["sales"].transform(
        lambda x: x.shift(1).rolling(14).max()
    )
    df["rolling_min_14d"] = grouped["sales"].transform(
        lambda x: x.shift(1).rolling(14).min()
    )
    df["rolling_price_mean_30d"] = grouped["price"].transform(
        lambda x: x.shift(1).rolling(30).mean()
    )
    df["promo_density_7d"] = grouped["promo"].transform(
        lambda x: x.shift(1).rolling(7).mean()
    )
    df["price_ratio"] = (
        df["price"] / df["rolling_price_mean_30d"].replace(0, np.nan)
    ).fillna(1.0)

    bfill_cols = [
        "lag_1", "lag_2", "lag_7", "rolling_mean_7d", "rolling_std_7d",
        "rolling_max_14d", "rolling_min_14d", "rolling_price_mean_30d",
        "promo_density_7d",
    ]
    for col in bfill_cols:
        df[col] = grouped[col].bfill()
    return df.fillna(0)


def _target_rows(df: pd.DataFrame, prediction_date: date) -> pd.DataFrame:
    """Append one next-day row per store/item using the latest known price."""
    if df.empty:
        return df

    latest = (
        df.sort_values("date")
        .groupby(["store_id", "item_id"], as_index=False)
        .tail(1)[["store_id", "item_id", "price", "promo"]]
        .copy()
    )
    latest["date"] = pd.Timestamp(prediction_date)
    latest["sales"] = np.nan
    return pd.concat([df, latest], ignore_index=True, sort=False)


def _metadata_map(db: Session, store_ids: Iterable[int], item_ids: Iterable[int]):
    rows = (
        db.query(InventoryMetadata)
        .filter(
            InventoryMetadata.store_id.in_(list(store_ids)),
            InventoryMetadata.item_id.in_(list(item_ids)),
        )
        .all()
    )
    return {
        (r.store_id, r.item_id): (
            float(r.order_cost),
            float(r.annual_holding_cost),
            int(r.lead_time_days or DEFAULT_LEAD_TIME_DAYS),
        )
        for r in rows
    }


def recompute_predictions(
    db: Session,
    org_id: int,
    store_id: int | None = None,
    item_id: int | None = None,
) -> list[DailyPrediction]:
    """
    Recompute next-day predictions for an org, optionally narrowed to a
    store/item. No commit is performed; the caller owns the transaction.
    """
    allowed_stores = db.query(Store.store_id).filter(Store.org_id == org_id)
    if store_id is not None:
        allowed_stores = allowed_stores.filter(Store.store_id == store_id)
    store_ids = [row.store_id for row in allowed_stores.all()]
    if not store_ids:
        return []

    df = _historical_frame(db, org_id)
    df = df[df["store_id"].isin(store_ids)] if not df.empty else df
    if item_id is not None and not df.empty:
        df = df[df["item_id"] == item_id]
    if df.empty:
        return []

    prediction_date = date.today() + timedelta(days=1)
    df = _target_rows(df, prediction_date)
    df = _add_features(db, org_id, df)
    targets = df[df["date"] == pd.Timestamp(prediction_date)].copy()
    if targets.empty:
        return []

    model = _model()
    metadata = _metadata_map(
        db,
        targets["store_id"].unique().tolist(),
        targets["item_id"].unique().tolist(),
    )

    results: list[DailyPrediction] = []
    for _, row in targets.iterrows():
        sid, iid = int(row.store_id), int(row.item_id)
        historical = df[
            (df.store_id == sid)
            & (df.item_id == iid)
            & (df.date < pd.Timestamp(prediction_date))
        ]
        demand_std = float(historical["sales"].tail(30).std()) if not historical.empty else 0.0
        if np.isnan(demand_std):
            demand_std = 0.0

        X = row[FEATURE_COLS].to_frame().T.astype(float)
        pred_demand = max(0.0, float(model.predict(X)[0]))

        order_cost, holding_cost, lead_time = metadata.get(
            (sid, iid),
            (DEFAULT_ORDER_COST, DEFAULT_HOLDING_COST, DEFAULT_LEAD_TIME_DAYS),
        )
        safety_stock = Z_SCORE * demand_std * np.sqrt(lead_time)
        rop = int(np.ceil(pred_demand * lead_time + safety_stock))
        annual_demand = pred_demand * 365
        eoq = int(
            np.ceil(np.sqrt((2 * annual_demand * order_cost) / holding_cost))
        ) if holding_cost > 0 else 0

        row_obj = DailyPrediction(
            prediction_date=prediction_date,
            store_id=sid,
            item_id=iid,
            predicted_demand=round(pred_demand, 2),
            rop=rop,
            eoq=eoq,
        )
        merged = db.merge(row_obj)
        results.append(merged)

    return results
