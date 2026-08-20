from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_org_id, get_current_store
from app.models import Transfer, CurrentInventory
from app.schemas.negotiations import TransferCreate, TransferOut

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.post("", response_model=TransferOut)  # For Agents — created as a negotiation's outcome
def create_transfer(payload: TransferCreate, db: Session = Depends(get_db),
                     org_id: int = Depends(get_current_org_id)):
    transfer = Transfer(**payload.model_dump())
    db.add(transfer)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create transfer")
    db.refresh(transfer)
    return transfer


@router.get("", response_model=list[TransferOut])
def list_transfers(db: Session = Depends(get_db), org_id: int = Depends(get_current_org_id)):
    from app.models.org_store import Store
    org_store_ids = [s.store_id for s in db.query(Store).filter(Store.org_id == org_id).all()]
    return db.query(Transfer).filter(
        (Transfer.from_store_id.in_(org_store_ids)) | (Transfer.to_store_id.in_(org_store_ids))
    ).order_by(Transfer.transfer_id.desc()).all()


@router.get("/store/{store_id}", response_model=list[TransferOut])
def list_transfers_for_store(store_id: int, db: Session = Depends(get_db),
                              org_id: int = Depends(get_current_org_id)):
    return db.query(Transfer).filter(
        (Transfer.from_store_id == store_id) | (Transfer.to_store_id == store_id)
    ).order_by(Transfer.transfer_id.desc()).all()


@router.get("/{transfer_id}", response_model=TransferOut)
def get_transfer(transfer_id: int, db: Session = Depends(get_db),
                  org_id: int = Depends(get_current_org_id)):
    transfer = db.get(Transfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Not found")
    return transfer


@router.post("/{transfer_id}/confirm", response_model=TransferOut)  # human touchpoint 3
def confirm_transfer(transfer_id: int, db: Session = Depends(get_db),
                      identity=Depends(get_current_store)):
    transfer = db.get(Transfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Not found")

    if identity.store_id == transfer.from_store_id:
        transfer.confirmed_from = True
    elif identity.store_id == transfer.to_store_id:
        transfer.confirmed_to = True
    else:
        raise HTTPException(status_code=403, detail="This store is not party to this transfer")

    try:
        # Everything below happens in one transaction: flipping this
        # party's confirmation flag, and — only if BOTH parties are now
        # confirmed — moving the stock. Either both changes land or
        # neither does; inventory can never end up updated without both
        # confirmations recorded, or vice versa.
        if transfer.confirmed_from and transfer.confirmed_to and transfer.completed_at is None:
            from_inv = db.get(CurrentInventory, (transfer.from_store_id, transfer.item_id))
            to_inv = db.get(CurrentInventory, (transfer.to_store_id, transfer.item_id))
            if not from_inv or from_inv.qty_on_hand < transfer.qty:
                raise ValueError("Source store does not have enough stock to complete transfer")
            from_inv.qty_on_hand -= transfer.qty
            if to_inv:
                to_inv.qty_on_hand += transfer.qty
            else:
                to_inv = CurrentInventory(
                    store_id=transfer.to_store_id, item_id=transfer.item_id,
                    qty_on_hand=transfer.qty,
                )
                db.add(to_inv)
            transfer.completed_at = datetime.utcnow()

        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e))
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not confirm transfer")

    db.refresh(transfer)
    return transfer
