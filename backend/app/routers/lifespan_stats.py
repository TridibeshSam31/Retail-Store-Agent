from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import ItemLifespanStats
from app.schemas.predictions import LifespanStatsOut

router = APIRouter(prefix="/lifespan-stats", tags=["lifespan-stats"])


@router.get("", response_model=list[LifespanStatsOut])
def list_stats(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    return db.query(ItemLifespanStats).all()


@router.get("/store/{store_id}", response_model=list[LifespanStatsOut])
def list_stats_for_store(store_id: int, db: Session = Depends(get_db),
                          org_id: int = Depends(get_current_org_id)):
    return db.query(ItemLifespanStats).filter(ItemLifespanStats.store_id == store_id).all()


@router.get("/{store_id}/{item_id}", response_model=LifespanStatsOut)
def get_stats(store_id: int, item_id: int, db: Session = Depends(get_db),
              org_id: int = Depends(get_current_org_id)):
    row = db.get(ItemLifespanStats, (store_id, item_id))
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row
