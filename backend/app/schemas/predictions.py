from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel

from app.schemas.common import ORMBase


class TransactionCreate(BaseModel):
    date: date
    store_id: int
    item_id: int
    sales: int
    price: Decimal
    promo: int = 0


class TransactionOut(ORMBase):
    transaction_id: int
    date: date
    store_id: int
    item_id: int
    sales: int
    price: Decimal
    promo: int


class LifespanStatsOut(ORMBase):
    store_id: int
    item_id: int
    all_time_sales_total: int
    total_days_active: int
    all_time_sales_avg: Decimal


class DailyPredictionOut(ORMBase):
    prediction_date: date
    store_id: int
    item_id: int
    predicted_demand: Decimal
    rop: int
    eoq: int
    created_at: datetime
