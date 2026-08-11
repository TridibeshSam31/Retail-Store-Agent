from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Store, CurrentInventory, Negotiation, Transfer
from app.schemas.org_store import StoreCreate, StoreUpdate, StoreOut

router = APIRouter(prefix="/stores", tags=["config-panel:stores"])


@router.post("", response_model=StoreOut)
def create_store(payload: StoreCreate, db: Session = Depends(get_db)):
    store = Store(**payload.model_dump())
    db.add(store)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create store")
    db.refresh(store)
    return store


@router.get("", response_model=list[StoreOut])
def list_stores(org_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Store)
    if org_id is not None:
        q = q.filter(Store.org_id == org_id)
    return q.order_by(Store.store_id).all()


@router.get("/{store_id}", response_model=StoreOut)
def get_store(store_id: int, db: Session = Depends(get_db)):
    store = db.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@router.put("/{store_id}", response_model=StoreOut)
def update_store(store_id: int, payload: StoreUpdate, db: Session = Depends(get_db)):
    store = db.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    for field, value in payload.model_dump().items():
        setattr(store, field, value)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update store")
    db.refresh(store)
    return store


@router.delete("/{store_id}")
def delete_store(store_id: int, db: Session = Depends(get_db)):
    store = db.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    has_inventory = db.query(CurrentInventory).filter(
        CurrentInventory.store_id == store_id
    ).first() is not None
    has_negotiations = db.query(Negotiation).filter(
        Negotiation.initiator_store_id == store_id
    ).first() is not None
    has_transfers = db.query(Transfer).filter(
        (Transfer.from_store_id == store_id) | (Transfer.to_store_id == store_id)
    ).first() is not None

    if has_inventory or has_negotiations or has_transfers:
        raise HTTPException(
            status_code=409,
            detail="Store has inventory/negotiation/transfer data — remove it first",
        )

    try:
        db.delete(store)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not delete store")
    return {"deleted": True}
