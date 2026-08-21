from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import Item
from app.schemas.inventory import ItemCreate, ItemUpdate, ItemOut

router = APIRouter(prefix="/items", tags=["items"])


from sqlalchemy import func, text


@router.post("", response_model=ItemOut)
def create_item(payload: ItemCreate, db: Session = Depends(get_db),
                 org_id: int = Depends(get_current_org_id)):
    # 1. Check if item with same name already exists
    existing = db.query(Item).filter(func.lower(Item.item_name) == payload.item_name.strip().lower()).first()
    if existing:
        return existing

    # 2. Sync Postgres sequence if it's behind the current max ID from seed scripts
    try:
        db.execute(text("SELECT setval(pg_get_serial_sequence('items', 'item_id'), coalesce(max(item_id), 0) + 1, false) FROM items;"))
        db.commit()
    except Exception:
        db.rollback()

    # 3. Attempt standard autoincrement insert
    item = Item(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except Exception:
        db.rollback()
        # Fallback: manually assign max(item_id) + 1 if DB sequence is unlinked/static
        max_id = db.query(func.max(Item.item_id)).scalar() or 0
        item = Item(item_id=max_id + 1, **payload.model_dump())
        db.add(item)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Could not create item: {str(e)}")

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
