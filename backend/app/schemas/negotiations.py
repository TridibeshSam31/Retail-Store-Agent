from datetime import datetime
from pydantic import BaseModel

from app.schemas.common import ORMBase


class NegotiationCreate(BaseModel):
    org_id: int
    item_id: int
    initiator_store_id: int
    trigger_type: str  # might_be_low | immediately_low


class NegotiationResolve(BaseModel):
    resolution_type: str  # transfer | even_split | supplier | cancelled
    status: str  # proposed | completed | aborted


class NegotiationOut(ORMBase):
    negotiation_id: int
    org_id: int
    item_id: int
    initiator_store_id: int
    trigger_type: str
    status: str
    resolution_type: str | None
    created_at: datetime


class NegotiationTurnCreate(BaseModel):
    store_id: int
    turn_number: int
    argument_text: str | None = None
    responded: bool = True


class NegotiationTurnOut(ORMBase):
    turn_id: int
    negotiation_id: int
    store_id: int
    turn_number: int
    argument_text: str | None
    responded: bool
    created_at: datetime


class NegotiationDetailOut(NegotiationOut):
    turns: list[NegotiationTurnOut] = []


class TransferCreate(BaseModel):
    negotiation_id: int
    from_store_id: int
    to_store_id: int
    item_id: int
    qty: int


class TransferOut(ORMBase):
    transfer_id: int
    negotiation_id: int
    from_store_id: int
    to_store_id: int
    item_id: int
    qty: int
    confirmed_from: bool
    confirmed_to: bool
    completed_at: datetime | None
