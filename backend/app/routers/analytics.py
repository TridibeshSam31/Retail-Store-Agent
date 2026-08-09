from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import CurrentInventory
from app.services.prediction_service import get_usable_surplus, get_time_to_stockout

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/usable-surplus/{store_id}/{item_id}")  # For Agents
def usable_surplus(store_id: int, item_id: int, db: Session = Depends(get_db),
                    org_id: int = Depends(get_current_org_id)):
    return {"store_id": store_id, "item_id": item_id, "usable_surplus": get_usable_surplus(db, store_id, item_id)}


@router.get("/usable-surplus/store/{store_id}")  # For Agents — every item at one store
def usable_surplus_for_store(store_id: int, db: Session = Depends(get_db),
                              org_id: int = Depends(get_current_org_id)):
    item_ids = [row.item_id for row in db.query(CurrentInventory.item_id).filter(
        CurrentInventory.store_id == store_id
    ).all()]
    return [
        {"item_id": item_id, "usable_surplus": get_usable_surplus(db, store_id, item_id)}
        for item_id in item_ids
    ]


@router.get("/usable-surplus/item/{item_id}")  # For Agents — one item across every store in org
def usable_surplus_for_item(item_id: int, db: Session = Depends(get_db),
                             org_id: int = Depends(get_current_org_id)):
    store_ids = [row.store_id for row in db.query(CurrentInventory.store_id).filter(
        CurrentInventory.item_id == item_id
    ).all()]
    return [
        {"store_id": store_id, "usable_surplus": get_usable_surplus(db, store_id, item_id)}
        for store_id in store_ids
    ]


@router.get("/time-to-stockout/{store_id}/{item_id}")  # For Agents
def time_to_stockout(store_id: int, item_id: int, db: Session = Depends(get_db),
                      org_id: int = Depends(get_current_org_id)):
    days = get_time_to_stockout(db, store_id, item_id)
    return {"store_id": store_id, "item_id": item_id, "days_to_stockout": days}
