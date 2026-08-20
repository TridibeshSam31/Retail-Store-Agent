from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import ItemBatch
from app.schemas.inventory import ItemBatchCreate, ItemBatchUpdate, ItemBatchOut

router = APIRouter(prefix="/item-batches", tags=["item-batches"])

NEAR_EXPIRY_DAYS = 7  # config value candidate — fixed for demo


from sqlalchemy import func, text


@router.post("", response_model=ItemBatchOut)
def create_batch(payload: ItemBatchCreate, db: Session = Depends(get_db),
                  org_id: int = Depends(get_current_org_id)):
    # 1. Sync Postgres sequence if behind seeded records
    try:
        db.execute(text("SELECT setval(pg_get_serial_sequence('item_batches', 'batch_id'), coalesce(max(batch_id), 0) + 1, false) FROM item_batches;"))
        db.commit()
    except Exception:
        db.rollback()

    batch = ItemBatch(**payload.model_dump())
    db.add(batch)
    try:
        db.commit()
    except Exception:
        db.rollback()
        # Fallback to max(batch_id) + 1
        max_id = db.query(func.max(ItemBatch.batch_id)).scalar() or 0
        batch = ItemBatch(batch_id=max_id + 1, **payload.model_dump())
        db.add(batch)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Could not create batch: {str(e)}")

    db.refresh(batch)
    return batch


@router.get("", response_model=list[ItemBatchOut])
def list_batches(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    from app.models.org_store import Store
    org_store_ids = [s.store_id for s in db.query(Store).filter(Store.org_id == org_id).all()]
    return db.query(ItemBatch).filter(ItemBatch.store_id.in_(org_store_ids)).all()


@router.get("/expiring", response_model=list[ItemBatchOut])
def list_expiring(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    from app.models.org_store import Store
    org_store_ids = [s.store_id for s in db.query(Store).filter(Store.org_id == org_id).all()]
    cutoff = date.today() + timedelta(days=NEAR_EXPIRY_DAYS)
    return db.query(ItemBatch).filter(
        ItemBatch.store_id.in_(org_store_ids),
        ItemBatch.expiry_date <= cutoff
    ).all()


@router.get("/expiring/store/{store_id}", response_model=list[ItemBatchOut])
def list_expiring_for_store(store_id: int, db: Session = Depends(get_db),
                             org_id: int = Depends(get_current_org_id)):
    cutoff = date.today() + timedelta(days=NEAR_EXPIRY_DAYS)
    return db.query(ItemBatch).filter(
        ItemBatch.store_id == store_id, ItemBatch.expiry_date <= cutoff
    ).all()


@router.get("/store/{store_id}", response_model=list[ItemBatchOut])
def list_batches_for_store(store_id: int, db: Session = Depends(get_db),
                            org_id: int = Depends(get_current_org_id)):
    return db.query(ItemBatch).filter(ItemBatch.store_id == store_id).all()


@router.get("/{batch_id}", response_model=ItemBatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    batch = db.get(ItemBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Not found")
    return batch


@router.put("/{batch_id}", response_model=ItemBatchOut)
def update_batch(batch_id: int, payload: ItemBatchUpdate, db: Session = Depends(get_db),
                  org_id: int = Depends(get_current_org_id)):
    batch = db.get(ItemBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Not found")
    batch.qty = payload.qty
    batch.expiry_date = payload.expiry_date
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update batch")
    db.refresh(batch)
    return batch


@router.delete("/{batch_id}")
def delete_batch(batch_id: int, db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    batch = db.get(ItemBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        db.delete(batch)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not delete batch")
    return {"deleted": True}
