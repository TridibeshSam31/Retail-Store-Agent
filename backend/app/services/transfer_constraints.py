def calculate_time_to_stockout(qty_on_hand: int, daily_demand: float) -> float:
    """Calculates how many hours until inventory hits zero."""
    if daily_demand <= 0:
        return 9999.0
    return (qty_on_hand / daily_demand) * 24.0

def calculate_safe_surplus(
    total_inventory: int, 
    expired_inventory: int, 
    rop: int
) -> int:
    """
    Calculates safe surplus.
    ROP already internally contains the forecast demand and safety stock buffer.
    """
    usable_inventory = total_inventory - expired_inventory
    safe_qty = usable_inventory - rop
    
    return max(0, safe_qty)

def evaluate_transfer_candidate(
    source_store_id: int,
    deficit_qty: int,
    deficit_demand: float,
    candidate_usable_qty: int,
    candidate_rop: int,
    candidate_demand: float,
    est_hours: float
) -> dict:
    """The master constraint function. Validates ETA and Safe Surplus."""
    
    safe_surplus = calculate_safe_surplus(candidate_usable_qty, candidate_usable_qty, candidate_rop, candidate_demand)
    stockout_hours = calculate_time_to_stockout(deficit_qty, deficit_demand)
    transfer_eta_hours = float(est_hours) + 0.5
    
    if safe_surplus <= 0:
        return {
            "store_id": source_store_id,
            "eligible": False, 
            "safe_surplus": 0, 
            "eta": transfer_eta_hours, 
            "stockout": stockout_hours, 
            "reason": "Insufficient safe surplus."
        }
        
    if transfer_eta_hours >= stockout_hours:
        return {
            "store_id": source_store_id,
            "eligible": False, 
            "safe_surplus": safe_surplus, 
            "eta": transfer_eta_hours, 
            "stockout": stockout_hours, 
            "reason": "Transfer arrives after stockout."
        }
        
    return {
        "store_id": source_store_id,
        "eligible": True, 
        "safe_surplus": safe_surplus, 
        "eta": transfer_eta_hours, 
        "stockout": stockout_hours, 
        "reason": "Transfer valid."
    }