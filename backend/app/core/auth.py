"""
Org-scoping dependency. Every data-access endpoint must depend on this
and filter its query by the returned org_id — this is the hard
boundary between orgs, not just a convenience filter.

Placeholder: currently reads org_id from a header. Replace with real
auth (JWT/session) before this goes anywhere near production.
"""
from fastapi import Header, HTTPException


def get_current_org_id(x_org_id: int = Header(...)) -> int:
    if x_org_id <= 0:
        raise HTTPException(status_code=401, detail="Invalid org")
    return x_org_id
