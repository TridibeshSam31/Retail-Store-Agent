"""
Manual trigger buttons for the demo's config panel — bypass waiting
for X transactions or the daily clock so the batch pipeline / expiry
job can be shown on demand. Real scheduling (cron/background worker)
is separate; these just invoke the same logic on demand.
"""
from fastapi import APIRouter, Depends

from app.core.auth import get_current_org_id

router = APIRouter(prefix="/internal", tags=["internal-demo-controls"])


@router.post("/predictions/recompute")  # For Both
def force_recompute(org_id: int = Depends(get_current_org_id)):
    # TODO: call the actual batch prediction pipeline for this org
    # (owned by the ML/prediction service, not yet wired here).
    return {"triggered": "predictions.recompute", "org_id": org_id}


@router.post("/expiry-check")  # For Both
def force_expiry_check(org_id: int = Depends(get_current_org_id)):
    # TODO: call the actual daily expiry job for this org.
    return {"triggered": "expiry-check", "org_id": org_id}
