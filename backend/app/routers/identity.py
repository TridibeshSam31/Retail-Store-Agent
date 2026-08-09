from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Org, Store, ItemBatch
from app.routers.item_batches import NEAR_EXPIRY_DAYS

router = APIRouter(prefix="/identity", tags=["identity"])


@router.get("/orgs")  # populates the org dropdown
def list_orgs_for_picker(db: Session = Depends(get_db)):
    return [{"org_id": o.org_id, "org_name": o.org_name} for o in db.query(Org).all()]


@router.get("/stores")  # populates the store dropdown once an org is picked
def list_stores_for_picker(org_id: int, db: Session = Depends(get_db)):
    stores = db.query(Store).filter(Store.org_id == org_id).all()
    return [{"store_id": s.store_id, "location_name": s.location_name} for s in stores]


@router.post("/select")
def select_identity(org_id: int, store_id: int, db: Session = Depends(get_db)):
    """
    Called when the manager taps OK on the org+store picker. Confirms
    both exist and match, then runs the near-expiry check for that
    store inline — this is the "checked daily, e.g. at login" rule
    from the PRD, implemented as "checked every time this screen is
    used" rather than a separate scheduled job.
    """
    store = db.get(Store, store_id)
    if not store or store.org_id != org_id:
        raise HTTPException(status_code=404, detail="Store not found in this org")

    cutoff = date.today() + timedelta(days=NEAR_EXPIRY_DAYS)
    expiring = db.query(ItemBatch).filter(
        ItemBatch.store_id == store_id,
        ItemBatch.expiry_date.isnot(None),
        ItemBatch.expiry_date <= cutoff,
    ).all()

    return {
        "org_id": org_id,
        "store_id": store_id,
        "location_name": store.location_name,
        "expiry_alerts": [
            {"batch_id": b.batch_id, "item_id": b.item_id, "qty": b.qty, "expiry_date": b.expiry_date}
            for b in expiring
        ],
    }
