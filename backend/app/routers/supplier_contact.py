"""
NOTE: the PRD schema has no table for storing a generated draft or a
"sent" log entry — /suppliers is a static record. This router
generates the draft on the fly from the negotiation + supplier record
each time it's called, and marks the negotiation as completed on
send. If you want the exact draft text or send timestamp persisted
for the demo transcript, we need to add a small table
(e.g. supplier_contacts: negotiation_id, message, sent_at) — flagging
this rather than silently deciding.
"""
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import Negotiation, Supplier

router = APIRouter(prefix="/supplier-contact", tags=["supplier-contact"])


def _build_draft(negotiation: Negotiation, supplier: Supplier | None) -> dict:
    if not supplier:
        return {"has_supplier": False, "instruction": "Contact Supplier"}

    message = (
        f"Hi {supplier.name}, we need to reorder item #{negotiation.item_id} "
        f"for store #{negotiation.initiator_store_id}. Please advise availability and lead time."
    )
    if supplier.pref == "whatsapp" and supplier.phone:
        link = f"https://wa.me/{supplier.phone}?text={quote(message)}"
    elif supplier.email:
        link = f"mailto:{supplier.email}?subject={quote('Reorder request')}&body={quote(message)}"
    else:
        return {"has_supplier": True, "instruction": "Contact Supplier", "message": message}

    return {"has_supplier": True, "message": message, "channel": supplier.pref, "link": link}


@router.get("/{negotiation_id}")  # For Both
def get_supplier_contact(negotiation_id: int, db: Session = Depends(get_db),
                          org_id: int = Depends(get_current_org_id)):
    neg = db.get(Negotiation, negotiation_id)
    if not neg:
        raise HTTPException(status_code=404, detail="Negotiation not found")
    supplier = db.query(Supplier).filter(
        Supplier.store_id == neg.initiator_store_id, Supplier.item_id == neg.item_id
    ).first()
    return _build_draft(neg, supplier)


@router.post("/{negotiation_id}/draft")  # For Agents
def generate_draft(negotiation_id: int, db: Session = Depends(get_db),
                    org_id: int = Depends(get_current_org_id)):
    return get_supplier_contact(negotiation_id, db, org_id)


@router.post("/{negotiation_id}/sent")  # human touchpoint 4
def mark_sent(negotiation_id: int, db: Session = Depends(get_db),
              org_id: int = Depends(get_current_org_id)):
    neg = db.get(Negotiation, negotiation_id)
    if not neg:
        raise HTTPException(status_code=404, detail="Negotiation not found")
    neg.status = "completed"
    neg.resolution_type = "supplier"
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not mark as sent")
    db.refresh(neg)
    return {"marked_sent": True, "negotiation_id": negotiation_id}
