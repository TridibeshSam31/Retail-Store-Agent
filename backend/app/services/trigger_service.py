"""
Threshold trigger logic. Called whenever current_inventory changes
(via PUT /inventory/{store_id}/{item_id} or POST /transactions).

Real logic (reading daily_predictions for ROP, deciding
might_be_low vs immediately_low, creating a Negotiation row, and
skipping that cycle's batch run per the PRD) goes here. Left as a
stub — Agents group owns what happens once a negotiation is opened;
this just decides WHEN to open one.
"""
from sqlalchemy.orm import Session


def check_immediately_low(db: Session, store_id: int, item_id: int, qty_on_hand: int) -> bool:
    """
    Cheap, real-time check run on every stock change. Should compare
    qty_on_hand against a critical threshold (e.g. derived from ROP
    in daily_predictions) and return True if it trips.

    TODO: implement threshold read + Negotiation creation.
    """
    return False
