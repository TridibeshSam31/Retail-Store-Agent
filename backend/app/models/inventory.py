from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func

from app.core.db import Base


class Item(Base):
    __tablename__ = "items"

    item_id = Column(Integer, primary_key=True, autoincrement=True)
    item_name = Column(String(150), nullable=False)
    category = Column(String(50), nullable=False)
    unit = Column(String(20), nullable=False)


class InventoryMetadata(Base):
    __tablename__ = "inventory_metadata"

    store_id = Column(Integer, ForeignKey("stores.store_id"), primary_key=True)
    item_id = Column(Integer, ForeignKey("items.item_id"), primary_key=True)
    order_cost = Column(Numeric(10, 2), nullable=False)
    annual_holding_cost = Column(Numeric(10, 2), nullable=False)
    lead_time_days = Column(Integer, default=3)


class CurrentInventory(Base):
    __tablename__ = "current_inventory"

    store_id = Column(Integer, ForeignKey("stores.store_id"), primary_key=True)
    item_id = Column(Integer, ForeignKey("items.item_id"), primary_key=True)
    qty_on_hand = Column(Integer, nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now())


class ItemBatch(Base):
    __tablename__ = "item_batches"

    batch_id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"))
    item_id = Column(Integer, ForeignKey("items.item_id"))
    qty = Column(Integer, nullable=False)
    expiry_date = Column(Date)
