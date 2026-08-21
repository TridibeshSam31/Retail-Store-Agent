from langchain_core.tools import tool
from app.core.db import SessionLocal
from sqlalchemy import text
from app.services.transfer_constraints import calculate_safe_surplus, calculate_time_to_stockout

@tool
def get_inventory(store_id: int, item_id: int) -> dict:
    """Get the current physical on-hand inventory for a store."""
    db = SessionLocal()
    try:
        qty = db.execute(text("SELECT qty_on_hand FROM current_inventory WHERE store_id = :s AND item_id = :i"), {"s": store_id, "i": item_id}).scalar()
        return {"store_id": store_id, "item_id": item_id, "on_hand": qty or 0}
    finally:
        db.close()

@tool
def get_forecast(store_id: int, item_id: int) -> dict:
    """Get the predicted daily demand and safety reorder point (ROP) for a store."""
    db = SessionLocal()
    try:
        res = db.execute(text("""
            SELECT predicted_demand, rop FROM daily_predictions 
            WHERE store_id = :s AND item_id = :i ORDER BY prediction_date DESC LIMIT 1
        """), {"s": store_id, "i": item_id}).fetchone()
        return {"predicted_demand": float(res[0]) if res else 0.0, "rop": int(res[1]) if res else 0}
    finally:
        db.close()

@tool
def get_safe_surplus(store_id: int, item_id: int) -> dict:
    """CRITICAL: Get the exact quantity of inventory this store can safely give away."""
    db = SessionLocal()
    try:
        # 1. Fetch total inventory
        qty = db.execute(text("SELECT qty_on_hand FROM current_inventory WHERE store_id = :s AND item_id = :i"), {"s": store_id, "i": item_id}).scalar() or 0
        
        # 2. Fetch ROP
        res = db.execute(text("SELECT rop FROM daily_predictions WHERE store_id = :s AND item_id = :i ORDER BY prediction_date DESC LIMIT 1"), {"s": store_id, "i": item_id}).fetchone()
        rop = int(res[0]) if res else 0
        
        # 3. Calculate Expired (Assuming 0 for demo unless you have an item_batches table)
        expired_qty = db.execute(
            text("""
                SELECT COALESCE(SUM(quantity), 0) 
                FROM item_batches 
                WHERE store_id = :s 
                  AND item_id = :i 
                  AND expiry_date < CURRENT_DATE
            """), 
            {"s": store_id, "i": item_id}
        ).scalar() or 0
        
        # 4. Call the math function using EXPLICIT keyword arguments so they can't get mixed up
        safe_qty = calculate_safe_surplus(
            total_inventory=qty, 
            expired_inventory=expired_qty, 
            rop=rop
        )
        
        return {"safe_surplus": safe_qty, "reason": f"Calculated from {qty} total minus {expired_qty} expired, reserving {rop} for ROP."}
    finally:
        db.close()

@tool
def get_transfer_eta(source_store_id: int, destination_store_id: int) -> dict:
    """Get the estimated transfer time in hours between two stores."""
    db = SessionLocal()
    try:
        eta = db.execute(text("SELECT est_hours FROM store_distances WHERE store_id_a = :d AND store_id_b = :s"), {"d": destination_store_id, "s": source_store_id}).scalar()
        return {"eta_hours": float(eta) if eta else 99.0}
    finally:
        db.close()

@tool
def get_stockout_time(store_id: int, item_id: int) -> dict:
    """Based on current inventory and demand, how long until this store reaches shortage?"""
    db = SessionLocal()
    try:
        # Get current qty
        qty = db.execute(text("SELECT qty_on_hand FROM current_inventory WHERE store_id = :s AND item_id = :i"), {"s": store_id, "i": item_id}).scalar() or 0
        
        # Get predicted demand
        res = db.execute(text("""
            SELECT predicted_demand FROM daily_predictions 
            WHERE store_id = :s AND item_id = :i ORDER BY prediction_date DESC LIMIT 1
        """), {"s": store_id, "i": item_id}).fetchone()
        demand = float(res[0]) if res else 0.0
        
        # Calculate hours using your business engine
        stockout_hours = calculate_time_to_stockout(qty, demand)
        
        return {
            "store_id": store_id,
            "current_inventory": qty, 
            "daily_demand": demand, 
            "estimated_hours_to_stockout": stockout_hours
        }
    finally:
        db.close()

@tool
def get_expiry_status(store_id: int, item_id: int) -> dict:
    """How much inventory is usable and how much is at expiry risk or already expired?"""
    db = SessionLocal()
    try:
        # Example query assuming an item_batches table with an expiry_date column
        # Fallback to total inventory if you don't have batch-level tracking yet
        total_qty = db.execute(text("SELECT qty_on_hand FROM current_inventory WHERE store_id = :s AND item_id = :i"), {"s": store_id, "i": item_id}).scalar() or 0
        
        # Replace this specific query with your actual expiry tracking logic if different
        expired_qty = db.execute(text("""
            SELECT COALESCE(SUM(qty), 0) FROM item_batches 
            WHERE store_id = :s AND item_id = :i AND expiry_date < CURRENT_DATE
        """), {"s": store_id, "i": item_id}).scalar() or 0
        
        usable_qty = max(0, total_qty - expired_qty)

        return {
            "store_id": store_id,
            "total_physical_units": total_qty,
            "usable_units": usable_qty,
            "expired_units": expired_qty
        }
    finally:
        db.close()  

# List of tools to bind to the agent
ALL_TOOLS = [get_inventory, 
    get_forecast, 
    get_expiry_status, 
    get_stockout_time, 
    get_transfer_eta, 
    get_safe_surplus]   