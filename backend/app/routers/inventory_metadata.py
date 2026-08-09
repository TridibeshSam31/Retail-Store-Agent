from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import InventoryMetadata
from app.schemas.inventory import InventoryMetadataCreate, InventoryMetadataUpdate, InventoryMetadataOut

router = APIRouter(prefix="/inventory-metadata", tags=["inventory-metadata"])


@router.post("", response_model=InventoryMetadataOut)
def create_meta(payload: InventoryMetadataCreate, db: Session = Depends(get_db),
                 org_id: int = Depends(get_current_org_id)):
    meta = InventoryMetadata(**payload.model_dump())
    db.add(meta)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create record")
    db.refresh(meta)
    return meta


@router.get("", response_model=list[InventoryMetadataOut])
def list_meta(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    return db.query(InventoryMetadata).all()


@router.get("/store/{store_id}", response_model=list[InventoryMetadataOut])
def list_meta_for_store(store_id: int, db: Session = Depends(get_db),
                         org_id: int = Depends(get_current_org_id)):
    return db.query(InventoryMetadata).filter(InventoryMetadata.store_id == store_id).all()


@router.get("/{store_id}/{item_id}", response_model=InventoryMetadataOut)
def get_meta(store_id: int, item_id: int, db: Session = Depends(get_db),
             org_id: int = Depends(get_current_org_id)):
    meta = db.get(InventoryMetadata, (store_id, item_id))
    if not meta:
        raise HTTPException(status_code=404, detail="Not found")
    return meta


@router.put("/{store_id}/{item_id}", response_model=InventoryMetadataOut)
def update_meta(store_id: int, item_id: int, payload: InventoryMetadataUpdate,
                 db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    meta = db.get(InventoryMetadata, (store_id, item_id))
    if not meta:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in payload.model_dump().items():
        setattr(meta, field, value)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update record")
    db.refresh(meta)
    return meta


@router.delete("/{store_id}/{item_id}")
def delete_meta(store_id: int, item_id: int, db: Session = Depends(get_db),
                 org_id: int = Depends(get_current_org_id)):
    meta = db.get(InventoryMetadata, (store_id, item_id))
    if not meta:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        db.delete(meta)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not delete record")
    return {"deleted": True}
