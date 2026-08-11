from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id
from app.models import Supplier
from app.schemas.suppliers_config import SupplierCreate, SupplierUpdate, SupplierOut

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.post("", response_model=SupplierOut)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db),
                     org_id: int = Depends(get_current_org_id)):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create supplier")
    db.refresh(supplier)
    return supplier


@router.get("", response_model=list[SupplierOut])
def list_suppliers(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    return db.query(Supplier).all()


@router.get("/store/{store_id}", response_model=list[SupplierOut])
def list_suppliers_for_store(store_id: int, db: Session = Depends(get_db),
                              org_id: int = Depends(get_current_org_id)):
    return db.query(Supplier).filter(Supplier.store_id == store_id).all()


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db),
                  org_id: int = Depends(get_current_org_id)):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Not found")
    return supplier


@router.put("/{supplier_id}", response_model=SupplierOut)
def update_supplier(supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db),
                     org_id: int = Depends(get_current_org_id)):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in payload.model_dump().items():
        setattr(supplier, field, value)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update supplier")
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db),
                     org_id: int = Depends(get_current_org_id)):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        db.delete(supplier)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not delete supplier")
    return {"deleted": True}
