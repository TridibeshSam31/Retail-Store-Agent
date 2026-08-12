"""
Manual demo controls.

These routes call the same in-process ML code used by the transaction
batch trigger. No second service, HTTP hop, worker, or external DB
connection is required on Render.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_org_id
from app.core.db import get_db

router = APIRouter(prefix="/internal", tags=["internal-demo-controls"])


@router.post("/predictions/recompute")  # For Both
def force_recompute(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    try:
        from ml.pipeline.service import recompute_predictions
        rows = recompute_predictions(db, org_id)
        db.commit()
        return {
            "triggered": "predictions.recompute",
            "org_id": org_id,
            "prediction_date": rows[0].prediction_date.isoformat() if rows else None,
            "count": len(rows),
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Prediction recompute failed: {exc}")


@router.post("/expiry-check")  # For Both
def force_expiry_check(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    # Expiry visibility is already computed live by /item-batches/expiring.
    # Keep this control side-effect free; it is the manual "daily check"
    # button described by the API contract.
    return {"triggered": "expiry-check", "org_id": org_id}
