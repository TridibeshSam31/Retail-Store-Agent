from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import Item
from app.schemas.inventory import ItemCreate, ItemUpdate, ItemOut

router = APIRouter(prefix="/items", tags=["items"])


@router.post("", response_model=ItemOut)
def create_item(payload: ItemCreate, db: Session = Depends(get_db),
                 org_id: int = Depends(get_current_org_id)):
    item = Item(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create item")
    db.refresh(item)
    return item


@router.get("", response_model=list[ItemOut])
def list_items(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    return db.query(Item).order_by(Item.item_id).all()


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db),
                 org_id: int = Depends(get_current_org_id)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in payload.model_dump().items():
        setattr(item, field, value)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update item")
    db.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    try:
        db.delete(item)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not delete item")
    return {"deleted": True}
