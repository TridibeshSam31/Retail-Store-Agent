from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func

from app.core.db import Base


class Negotiation(Base):
    __tablename__ = "negotiations"

    negotiation_id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("orgs.org_id"))
    item_id = Column(Integer, ForeignKey("items.item_id"))
    initiator_store_id = Column(Integer, ForeignKey("stores.store_id"))
    trigger_type = Column(String(20), nullable=False)  # might_be_low | immediately_low
    status = Column(String(20), nullable=False)  # proposed|approved|rejected|aborted|completed
    resolution_type = Column(String(20))  # transfer|even_split|supplier|cancelled
    created_at = Column(TIMESTAMP, server_default=func.now())


class NegotiationTurn(Base):
    __tablename__ = "negotiation_turns"

    turn_id = Column(Integer, primary_key=True)
    negotiation_id = Column(Integer, ForeignKey("negotiations.negotiation_id"))
    store_id = Column(Integer, ForeignKey("stores.store_id"))
    turn_number = Column(Integer, nullable=False)
    argument_text = Column(Text)
    responded = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class Transfer(Base):
    __tablename__ = "transfers"

    transfer_id = Column(Integer, primary_key=True)
    negotiation_id = Column(Integer, ForeignKey("negotiations.negotiation_id"))
    from_store_id = Column(Integer, ForeignKey("stores.store_id"))
    to_store_id = Column(Integer, ForeignKey("stores.store_id"))
    item_id = Column(Integer, ForeignKey("items.item_id"))
    qty = Column(Integer, nullable=False)
    confirmed_from = Column(Boolean, default=False)
    confirmed_to = Column(Boolean, default=False)
    completed_at = Column(TIMESTAMP)
