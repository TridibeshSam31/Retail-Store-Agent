from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel

from app.schemas.common import ORMBase


class ItemCreate(BaseModel):
    item_name: str
    category: str
    unit: str


class ItemUpdate(BaseModel):
    item_name: str
    category: str
    unit: str


class ItemOut(ORMBase):
    item_id: int
    item_name: str
    category: str
    unit: str


class InventoryMetadataCreate(BaseModel):
    store_id: int
    item_id: int
    order_cost: Decimal
    annual_holding_cost: Decimal
    lead_time_days: int = 3


class InventoryMetadataUpdate(BaseModel):
    order_cost: Decimal
    annual_holding_cost: Decimal
    lead_time_days: int


class InventoryMetadataOut(ORMBase):
    store_id: int
    item_id: int
    order_cost: Decimal
    annual_holding_cost: Decimal
    lead_time_days: int


class CurrentInventoryCreate(BaseModel):
    store_id: int
    item_id: int
    qty_on_hand: int


class CurrentInventoryUpdate(BaseModel):
    qty_on_hand: int


class CurrentInventoryOut(ORMBase):
    store_id: int
    item_id: int
    qty_on_hand: int
    updated_at: datetime


class ItemBatchCreate(BaseModel):
    store_id: int
    item_id: int
    qty: int
    expiry_date: date | None = None


class ItemBatchUpdate(BaseModel):
    qty: int
    expiry_date: date | None = None


class ItemBatchOut(ORMBase):
    batch_id: int
    store_id: int
    item_id: int
    qty: int
    expiry_date: date | None
