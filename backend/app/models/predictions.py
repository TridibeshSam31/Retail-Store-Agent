from sqlalchemy import Column, Integer, String, Numeric, Date, BigInteger, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func

from app.core.db import Base


class RawTransaction(Base):
    __tablename__ = "raw_transactions"

    transaction_id = Column(BigInteger, primary_key=True)
    date = Column(Date, nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id"))
    item_id = Column(Integer, ForeignKey("items.item_id"))
    sales = Column(Integer, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    promo = Column(Integer, default=0)


class ItemLifespanStats(Base):
    __tablename__ = "item_lifespan_stats"

    store_id = Column(Integer, ForeignKey("stores.store_id"), primary_key=True)
    item_id = Column(Integer, ForeignKey("items.item_id"), primary_key=True)
    all_time_sales_total = Column(BigInteger, default=0)
    total_days_active = Column(Integer, default=0)
    all_time_sales_avg = Column(Numeric(10, 2), default=0.00)


class DailyPrediction(Base):
    __tablename__ = "daily_predictions"

    prediction_date = Column(Date, primary_key=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), primary_key=True)
    item_id = Column(Integer, ForeignKey("items.item_id"), primary_key=True)
    predicted_demand = Column(Numeric(10, 2), nullable=False)
    rop = Column(Integer, nullable=False)
    eoq = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
