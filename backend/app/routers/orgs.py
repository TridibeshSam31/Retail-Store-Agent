from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Org, Store
from app.schemas.org_store import OrgCreate, OrgUpdate, OrgOut

router = APIRouter(prefix="/orgs", tags=["config-panel:orgs"])


@router.post("", response_model=OrgOut)
def create_org(payload: OrgCreate, db: Session = Depends(get_db)):
    org = Org(org_name=payload.org_name)
    db.add(org)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create org")
    db.refresh(org)
    return org


@router.get("", response_model=list[OrgOut])
def list_orgs(db: Session = Depends(get_db)):
    return db.query(Org).order_by(Org.org_id).all()


@router.get("/{org_id}", response_model=OrgOut)
def get_org(org_id: int, db: Session = Depends(get_db)):
    org = db.get(Org, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    return org


@router.put("/{org_id}", response_model=OrgOut)
def update_org(org_id: int, payload: OrgUpdate, db: Session = Depends(get_db)):
    org = db.get(Org, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    org.org_name = payload.org_name
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update org")
    db.refresh(org)
    return org


@router.delete("/{org_id}")
def delete_org(org_id: int, db: Session = Depends(get_db)):
    org = db.get(Org, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")

    has_stores = db.query(Store).filter(Store.org_id == org_id).first() is not None
    if has_stores:
        raise HTTPException(
            status_code=409,
            detail="Org has stores/child data — remove them first",
        )

    try:
        db.delete(org)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not delete org")
    return {"deleted": True}
