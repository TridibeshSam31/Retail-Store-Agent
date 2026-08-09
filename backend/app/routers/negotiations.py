from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import Negotiation, NegotiationTurn
from app.schemas.negotiations import (
    NegotiationCreate, NegotiationOut, NegotiationDetailOut,
    NegotiationTurnCreate, NegotiationTurnOut, NegotiationResolve,
)

router = APIRouter(prefix="/negotiations", tags=["negotiations"])


@router.post("", response_model=NegotiationOut)  # For Agents
def create_negotiation(payload: NegotiationCreate, db: Session = Depends(get_db),
                        org_id: int = Depends(get_current_org_id)):
    neg = Negotiation(**payload.model_dump(), status="proposed")
    db.add(neg)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create negotiation")
    db.refresh(neg)
    return neg


@router.get("", response_model=list[NegotiationOut])  # For Both
def list_negotiations(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    return db.query(Negotiation).filter(Negotiation.org_id == org_id) \
        .order_by(Negotiation.negotiation_id.desc()).all()


@router.get("/store/{store_id}", response_model=list[NegotiationOut])  # For Both
def list_negotiations_for_store(store_id: int, db: Session = Depends(get_db),
                                 org_id: int = Depends(get_current_org_id)):
    turn_store_ids = db.query(NegotiationTurn.negotiation_id).filter(
        NegotiationTurn.store_id == store_id
    ).scalar_subquery()
    return db.query(Negotiation).filter(
        (Negotiation.initiator_store_id == store_id) |
        (Negotiation.negotiation_id.in_(turn_store_ids))
    ).order_by(Negotiation.negotiation_id.desc()).all()


@router.get("/{negotiation_id}", response_model=NegotiationDetailOut)  # For Both
def get_negotiation(negotiation_id: int, db: Session = Depends(get_db),
                     org_id: int = Depends(get_current_org_id)):
    neg = db.get(Negotiation, negotiation_id)
    if not neg:
        raise HTTPException(status_code=404, detail="Not found")
    turns = db.query(NegotiationTurn).filter(
        NegotiationTurn.negotiation_id == negotiation_id
    ).order_by(NegotiationTurn.turn_number).all()
    out = NegotiationDetailOut.model_validate(neg)
    out.turns = [NegotiationTurnOut.model_validate(t) for t in turns]
    return out


@router.post("/{negotiation_id}/turns", response_model=NegotiationTurnOut)  # For Agents
def add_turn(negotiation_id: int, payload: NegotiationTurnCreate, db: Session = Depends(get_db),
             org_id: int = Depends(get_current_org_id)):
    neg = db.get(Negotiation, negotiation_id)
    if not neg:
        raise HTTPException(status_code=404, detail="Negotiation not found")
    turn = NegotiationTurn(negotiation_id=negotiation_id, **payload.model_dump())
    db.add(turn)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not add turn")
    db.refresh(turn)
    return turn


@router.post("/{negotiation_id}/resolve", response_model=NegotiationOut)  # For Agents
def resolve_negotiation(negotiation_id: int, payload: NegotiationResolve,
                         db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    neg = db.get(Negotiation, negotiation_id)
    if not neg:
        raise HTTPException(status_code=404, detail="Not found")
    neg.resolution_type = payload.resolution_type
    neg.status = payload.status
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not resolve negotiation")
    db.refresh(neg)
    return neg


@router.post("/{negotiation_id}/approve", response_model=NegotiationOut)  # human touchpoint 2
def approve_negotiation(negotiation_id: int, db: Session = Depends(get_db),
                         org_id: int = Depends(get_current_org_id)):
    neg = db.get(Negotiation, negotiation_id)
    if not neg:
        raise HTTPException(status_code=404, detail="Not found")
    neg.status = "approved"
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not approve negotiation")
    db.refresh(neg)
    return neg


@router.post("/{negotiation_id}/reject", response_model=NegotiationOut)  # human touchpoint 2
def reject_negotiation(negotiation_id: int, db: Session = Depends(get_db),
                        org_id: int = Depends(get_current_org_id)):
    neg = db.get(Negotiation, negotiation_id)
    if not neg:
        raise HTTPException(status_code=404, detail="Not found")
    neg.status = "rejected"
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not reject negotiation")
    db.refresh(neg)
    return neg


@router.post("/{negotiation_id}/cancel", response_model=NegotiationOut)  # human touchpoint 1
def cancel_negotiation(negotiation_id: int, db: Session = Depends(get_db),
                        org_id: int = Depends(get_current_org_id)):
    neg = db.get(Negotiation, negotiation_id)
    if not neg:
        raise HTTPException(status_code=404, detail="Not found")
    neg.status = "aborted"
    neg.resolution_type = "cancelled"
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not cancel negotiation")
    db.refresh(neg)
    return neg
