from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import StoreDistance
from app.schemas.org_store import StoreDistanceCreate, StoreDistanceOut

router = APIRouter(prefix="/store-distances", tags=["store-distances"])


@router.post("", response_model=StoreDistanceOut)
def create_distance(payload: StoreDistanceCreate, db: Session = Depends(get_db),
                     org_id: int = Depends(get_current_org_id)):
    dist = StoreDistance(**payload.model_dump())
    db.add(dist)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create distance")
    db.refresh(dist)
    return dist


@router.get("", response_model=list[StoreDistanceOut])
def list_distances(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    return db.query(StoreDistance).all()


@router.get("/{store_id_a}/{store_id_b}", response_model=StoreDistanceOut)
def get_distance(store_id_a: int, store_id_b: int, db: Session = Depends(get_db),
                  org_id: int = Depends(get_current_org_id)):
    dist = db.get(StoreDistance, (store_id_a, store_id_b))
    if not dist:
        raise HTTPException(status_code=404, detail="Distance not found")
    return dist


@router.put("/{store_id_a}/{store_id_b}", response_model=StoreDistanceOut)
def update_distance(store_id_a: int, store_id_b: int, payload: StoreDistanceCreate,
                     db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    dist = db.get(StoreDistance, (store_id_a, store_id_b))
    if not dist:
        raise HTTPException(status_code=404, detail="Distance not found")
    dist.tier = payload.tier
    dist.est_hours = payload.est_hours
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update distance")
    db.refresh(dist)
    return dist


@router.delete("/{store_id_a}/{store_id_b}")
def delete_distance(store_id_a: int, store_id_b: int, db: Session = Depends(get_db),
                     org_id: int = Depends(get_current_org_id)):
    dist = db.get(StoreDistance, (store_id_a, store_id_b))
    if not dist:
        raise HTTPException(status_code=404, detail="Distance not found")
    try:
        db.delete(dist)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not delete distance")
    return {"deleted": True}
