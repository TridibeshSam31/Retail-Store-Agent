from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import Config
from app.schemas.suppliers_config import ConfigCreate, ConfigUpdate, ConfigOut

router = APIRouter(prefix="/config", tags=["config"])


@router.post("", response_model=ConfigOut)
def create_config(payload: ConfigCreate, db: Session = Depends(get_db),
                   org_id: int = Depends(get_current_org_id)):
    existing = db.get(Config, payload.org_id)
    if existing:
        raise HTTPException(status_code=409, detail="Config already exists for this org")
    cfg = Config(**payload.model_dump())
    db.add(cfg)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create config")
    db.refresh(cfg)
    return cfg


@router.get("", response_model=ConfigOut)
def get_config(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    cfg = db.get(Config, org_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not set for this org")
    return cfg


@router.put("", response_model=ConfigOut)
def update_config(payload: ConfigUpdate, db: Session = Depends(get_db),
                   org_id: int = Depends(get_current_org_id)):
    cfg = db.get(Config, org_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not set for this org")
    cfg.batch_x = payload.batch_x
    cfg.max_negotiation_turns = payload.max_negotiation_turns
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update config")
    db.refresh(cfg)
    return cfg
