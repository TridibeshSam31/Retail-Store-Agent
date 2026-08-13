from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import CurrentInventory
from app.schemas.inventory import CurrentInventoryCreate, CurrentInventoryUpdate, CurrentInventoryOut
from app.services.trigger_service import check_immediately_low

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("", response_model=CurrentInventoryOut)
def create_inventory(payload: CurrentInventoryCreate, db: Session = Depends(get_db),
                      org_id: int = Depends(get_current_org_id)):
    row = CurrentInventory(**payload.model_dump())
    db.add(row)
    try:
        db.flush()  # row visible in this session, not yet committed
        negotiation_id = check_immediately_low(db, row.store_id, row.item_id, row.qty_on_hand)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create inventory record")
    db.refresh(row)

    if negotiation_id is not None:
        from lang.bridge import start_negotiation
        start_negotiation(negotiation_id)

    return row


@router.get("", response_model=list[CurrentInventoryOut])
def list_inventory(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    return db.query(CurrentInventory).all()


@router.get("/store/{store_id}", response_model=list[CurrentInventoryOut])
def list_inventory_for_store(store_id: int, db: Session = Depends(get_db),
                              org_id: int = Depends(get_current_org_id)):
    return db.query(CurrentInventory).filter(CurrentInventory.store_id == store_id).all()


@router.get("/{store_id}/{item_id}", response_model=CurrentInventoryOut)
def get_inventory(store_id: int, item_id: int, db: Session = Depends(get_db),
                   org_id: int = Depends(get_current_org_id)):
    row = db.get(CurrentInventory, (store_id, item_id))
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row


@router.put("/{store_id}/{item_id}", response_model=CurrentInventoryOut)
def update_inventory(store_id: int, item_id: int, payload: CurrentInventoryUpdate,
                      db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    row = db.get(CurrentInventory, (store_id, item_id))
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    # Single transaction: qty update + threshold check happen together,
    # so a crash mid-way never leaves stock updated without the check
    # having run (or vice versa). The agent is only started AFTER
    # commit — its own DB session can't see an uncommitted negotiation row.
    try:
        row.qty_on_hand = payload.qty_on_hand
        negotiation_id = check_immediately_low(db, store_id, item_id, payload.qty_on_hand)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update inventory")
    db.refresh(row)

    if negotiation_id is not None:
        from lang.bridge import start_negotiation
        start_negotiation(negotiation_id)

    return row


@router.delete("/{store_id}/{item_id}")
def delete_inventory(store_id: int, item_id: int, db: Session = Depends(get_db),
                      org_id: int = Depends(get_current_org_id)):
    row = db.get(CurrentInventory, (store_id, item_id))
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        db.delete(row)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not delete inventory")
    return {"deleted": True}
