from pydantic import BaseModel

from app.schemas.common import ORMBase


class SupplierCreate(BaseModel):
    store_id: int
    item_id: int
    name: str
    phone: str | None = None
    email: str | None = None
    pref: str  # whatsapp | email


class SupplierUpdate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    pref: str


class SupplierOut(ORMBase):
    supplier_id: int
    store_id: int
    item_id: int
    name: str
    phone: str | None
    email: str | None
    pref: str


class ConfigCreate(BaseModel):
    org_id: int
    batch_x: int
    max_negotiation_turns: int


class ConfigUpdate(BaseModel):
    batch_x: int
    max_negotiation_turns: int


class ConfigOut(ORMBase):
    org_id: int
    batch_x: int
    max_negotiation_turns: int
