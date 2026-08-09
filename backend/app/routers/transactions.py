from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import RawTransaction, CurrentInventory
from app.schemas.predictions import TransactionCreate, TransactionOut
from app.services.trigger_service import check_immediately_low

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionOut)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db),
                        org_id: int = Depends(get_current_org_id)):
    txn = RawTransaction(**payload.model_dump())
    try:
        db.add(txn)
        db.flush()  # get transaction_id, still inside the same transaction

        # Decrement current stock and run the real-time immediately-low
        # check as part of the same commit as the sale itself.
        inv = db.get(CurrentInventory, (payload.store_id, payload.item_id))
        if inv:
            inv.qty_on_hand -= payload.sales
            check_immediately_low(db, payload.store_id, payload.item_id, inv.qty_on_hand)

        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not record transaction")
    db.refresh(txn)
    return txn


@router.get("", response_model=list[TransactionOut])
def list_transactions(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    return db.query(RawTransaction).order_by(RawTransaction.transaction_id.desc()).limit(500).all()


@router.get("/store/{store_id}", response_model=list[TransactionOut])
def list_transactions_for_store(store_id: int, db: Session = Depends(get_db),
                                 org_id: int = Depends(get_current_org_id)):
    return db.query(RawTransaction).filter(RawTransaction.store_id == store_id) \
        .order_by(RawTransaction.transaction_id.desc()).limit(500).all()


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id: int, db: Session = Depends(get_db),
                     org_id: int = Depends(get_current_org_id)):
    txn = db.get(RawTransaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Not found")
    return txn
