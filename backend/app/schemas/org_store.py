from decimal import Decimal
from pydantic import BaseModel

from app.schemas.common import ORMBase


class OrgCreate(BaseModel):
    org_name: str


class OrgUpdate(BaseModel):
    org_name: str


class OrgOut(ORMBase):
    org_id: int
    org_name: str


class StoreCreate(BaseModel):
    org_id: int
    location_name: str
    latitude: Decimal | None = None
    longitude: Decimal | None = None


class StoreUpdate(BaseModel):
    location_name: str
    latitude: Decimal | None = None
    longitude: Decimal | None = None


class StoreOut(ORMBase):
    store_id: int
    org_id: int
    location_name: str
    latitude: Decimal | None
    longitude: Decimal | None


class StoreDistanceCreate(BaseModel):
    store_id_a: int
    store_id_b: int
    tier: str
    est_hours: Decimal


class StoreDistanceOut(ORMBase):
    store_id_a: int
    store_id_b: int
    tier: str
    est_hours: Decimal
