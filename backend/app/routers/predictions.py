from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import DailyPrediction
from app.schemas.predictions import DailyPredictionOut

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("", response_model=list[DailyPredictionOut])
def list_predictions(date: date_type | None = None, db: Session = Depends(get_db),
                      org_id: int = Depends(get_current_org_id)):
    q = db.query(DailyPrediction)
    if date is not None:
        q = q.filter(DailyPrediction.prediction_date == date)
    return q.all()


@router.get("/store/{store_id}", response_model=list[DailyPredictionOut])
def list_predictions_for_store(store_id: int, date: date_type | None = None,
                                db: Session = Depends(get_db),
                                org_id: int = Depends(get_current_org_id)):
    q = db.query(DailyPrediction).filter(DailyPrediction.store_id == store_id)
    if date is not None:
        q = q.filter(DailyPrediction.prediction_date == date)
    return q.all()


@router.get("/{store_id}/{item_id}", response_model=DailyPredictionOut)
def get_prediction(store_id: int, item_id: int, date: date_type | None = None,
                    db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    q = db.query(DailyPrediction).filter(
        DailyPrediction.store_id == store_id, DailyPrediction.item_id == item_id
    )
    if date is not None:
        q = q.filter(DailyPrediction.prediction_date == date)
    row = q.order_by(DailyPrediction.prediction_date.desc()).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row
