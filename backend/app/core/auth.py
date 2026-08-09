"""
Demo-mode identity resolution. No real auth: the frontend's org/store
picker sets these headers after selection. Every data-scoped route
depends on get_current_store to get (org_id, store_id).

Config-panel routes (org/store create/edit/delete) do NOT depend on
this - they're intentionally open for the demo.
"""
from fastapi import Header


class Identity:
    def __init__(self, org_id: int, store_id: int | None):
        self.org_id = org_id
        self.store_id = store_id


def get_current_org_id(x_org_id: int = Header(...)) -> int:
    return x_org_id


def get_current_store(
    x_org_id: int = Header(...),
    x_store_id: int = Header(...),
) -> Identity:
    return Identity(org_id=x_org_id, store_id=x_store_id)
