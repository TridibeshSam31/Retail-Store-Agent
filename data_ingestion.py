"""
generate_synthetic_data.py
===========================

Generates synthetic data for the Delhi grocery-chain inventory schema
(orgs, stores, store_distances, items, inventory_metadata, current_inventory,
item_batches, raw_transactions, item_lifespan_stats, daily_predictions,
suppliers, negotiations, negotiation_turns, transfers, config).

This script is a DATA GENERATOR ONLY. It does not train, fit, or evaluate
any model. All CSVs are written ready to be loaded with `COPY ... FROM`
(Postgres) or any bulk-loader, in the same column order as the DDL.

Designed patterns baked into the data (so a downstream model can learn them):
  1. Price elasticity   -> promo=1 forces price *0.8 and sales *1.8 (strict, deterministic).
  2. Cyclical seasonality-> each item is mapped to a sine/cosine/gaussian-spike
                            curve over day-of-year (smooth mid-year peak, edge-of-year
                            peak, or a sharp localized monsoon spike).
  3. Temporal (day-of-week) -> categories 'Grocery' and 'Snacks' get an exact,
                            guaranteed 1.4x multiplier on Sat/Sun, and ONLY those
                            two categories, so weekday-derived features have a
                            clean, learnable signal.
  4. Location bias       -> one flagship Delhi store (Connaught Place) has a
                            hardcoded volume_multiplier of 1.5; every other
                            store has its own fixed multiplier.

Run:
    python3 generate_synthetic_data.py --outdir /path/to/csvs
"""

import argparse
import math
import random
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# Reproducibility
# --------------------------------------------------------------------------
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# --------------------------------------------------------------------------
# Date window: past 365 days, ending yesterday
# --------------------------------------------------------------------------
END_DATE = date.today() - timedelta(days=1)
START_DATE = END_DATE - timedelta(days=364)   # exactly 365 days inclusive
ALL_DATES = [START_DATE + timedelta(days=i) for i in range(365)]

CATEGORIES_WITH_WEEKEND_BOOST = {"Grocery", "Snacks"}
WEEKEND_BOOST_MULTIPLIER = 1.4          # guaranteed, exact
PROMO_PRICE_DROP = 0.20                 # price * (1 - 0.20)
PROMO_SALES_MULTIPLIER = 1.8            # guaranteed, exact


# ==========================================================================
# 1. ORGS
# ==========================================================================
orgs = [
    {"org_id": 1, "org_name": "Delhi Fresh Mart Co-op"},
    {"org_id": 2, "org_name": "Metro Grocers NCR"},
]

# ==========================================================================
# 2. STORES  (all Delhi NCR neighbourhoods, real approximate coordinates)
# ==========================================================================
stores_raw = [
    # store_id, org_id, location_name,              lat,      lon,      volume_multiplier
    (1, 1, "Connaught Place Central",  28.6315, 77.2167, 1.50),   # flagship / "downtown"
    (2, 1, "Karol Bagh",               28.6519, 77.1909, 1.05),
    (3, 1, "Lajpat Nagar",             28.5677, 77.2433, 1.00),
    (4, 1, "Rohini Sector 7",          28.7495, 77.0565, 0.95),
    (5, 1, "Dwarka Sector 21",         28.5921, 77.0460, 0.90),
    (6, 2, "Saket",                    28.5245, 77.2066, 1.10),
    (7, 2, "Janakpuri",                28.6219, 77.0878, 0.90),
    (8, 2, "Vasant Kunj",              28.5200, 77.1591, 1.00),
]
stores = [
    {
        "store_id": s[0], "org_id": s[1], "location_name": s[2],
        "latitude": s[3], "longitude": s[4],
    }
    for s in stores_raw
]
STORE_VOLUME_MULT = {s[0]: s[5] for s in stores_raw}
STORE_ORG = {s[0]: s[1] for s in stores_raw}
STORE_LATLON = {s[0]: (s[3], s[4]) for s in stores_raw}


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ==========================================================================
# 3. STORE_DISTANCES  (directed pairs, both directions, same-org relevance)
# ==========================================================================
store_distances = []
AVG_CITY_SPEED_KMH = 22.0  # Delhi traffic-adjusted average
for a in stores:
    for b in stores:
        if a["store_id"] == b["store_id"]:
            continue
        dist_km = haversine_km(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
        est_hours = round(dist_km / AVG_CITY_SPEED_KMH + 0.15, 2)  # + loading/unloading buffer
        if dist_km < 8:
            tier = "near"
        elif dist_km < 18:
            tier = "mid"
        else:
            tier = "far"
        store_distances.append({
            "store_id_a": a["store_id"],
            "store_id_b": b["store_id"],
            "tier": tier,
            "est_hours": est_hours,
        })

# ==========================================================================
# 4. ITEMS  (perishable grocery-store catalogue with seasonality profiles)
# ==========================================================================
# seasonality types: 'summer_sine', 'winter_sine', 'monsoon_spike', 'flat'
# amplitude: strength of the seasonal swing (0-1 scale, applied around 1.0 baseline)
items_raw = [
    # name,                     category,     unit,     base_price, base_demand, shelf_life_days, seasonality,     amplitude
    ("Full Cream Milk",         "Dairy",      "liter",   60.0,  40, 3,   "flat",          0.10),
    ("Paneer",                  "Dairy",      "kg",     320.0,   8, 5,   "flat",          0.10),
    ("Curd (Yogurt)",           "Dairy",      "kg",      70.0,  15, 4,   "summer_sine",   0.45),
    ("Ice Cream",               "Dairy",      "liter",  250.0,  10, 90,  "summer_sine",   0.85),
    ("Butter",                  "Dairy",      "kg",     480.0,   5, 60,  "flat",          0.08),

    ("Tomato",                  "Produce",    "kg",      40.0,  25, 6,   "monsoon_spike", 0.30),
    ("Onion",                   "Produce",    "kg",      35.0,  20, 20,  "flat",          0.10),
    ("Potato",                  "Produce",    "kg",      25.0,  30, 30,  "flat",          0.08),
    ("Spinach (Palak)",         "Produce",    "kg",      30.0,  12, 4,   "winter_sine",   0.40),
    ("Mustard Greens (Sarson)", "Produce",    "kg",      35.0,   8, 4,   "winter_sine",   0.65),
    ("Mango",                   "Produce",    "kg",      90.0,  15, 7,   "summer_sine",   0.90),
    ("Watermelon",              "Produce",    "kg",      25.0,  18, 6,   "summer_sine",   0.75),
    ("Corn (Bhutta)",           "Produce",    "piece",   30.0,  10, 5,   "monsoon_spike", 0.80),

    ("White Bread",             "Bakery",     "loaf",    45.0,  25, 4,   "flat",          0.08),
    ("Buns",                    "Bakery",     "pack",    40.0,  12, 4,   "flat",          0.08),
    ("Fresh Cake Slice",        "Bakery",     "piece",  350.0,   3, 3,   "flat",          0.10),

    ("Chicken",                 "Meat",       "kg",     220.0,  15, 2,   "flat",          0.12),
    ("Mutton",                  "Meat",       "kg",     650.0,   5, 2,   "flat",          0.12),
    ("Fish (Rohu)",             "Meat",       "kg",     300.0,   6, 2,   "flat",          0.12),

    ("Frozen Green Peas",       "Frozen",     "kg",      90.0,   8, 180, "winter_sine",   0.25),
    ("Frozen Paratha",          "Frozen",     "pack",   120.0,  10, 120, "flat",          0.10),

    ("Eggs (dozen)",            "Grocery",    "dozen",   90.0,  20, 21,  "flat",          0.08),
    ("Wheat Flour (Atta 5kg)",  "Grocery",    "pack",   250.0,   4, 90,  "flat",          0.06),
    ("Cooking Oil (1L)",        "Grocery",    "liter",  150.0,   6, 180, "flat",          0.06),

    ("Potato Chips",            "Snacks",     "pack",    20.0,  35, 90,  "flat",          0.10),
    ("Namkeen Mixture",         "Snacks",     "kg",      60.0,  20, 60,  "flat",          0.10),
    ("Biscuits",                "Snacks",     "pack",    30.0,  30, 120, "flat",          0.08),
    ("Samosa (fresh)",          "Snacks",     "piece",   15.0,  25, 1,   "flat",          0.15),

    ("Buttermilk (Chaas)",      "Beverages",  "liter",   20.0,  15, 3,   "summer_sine",   0.55),
    ("Soft Drinks",             "Beverages",  "bottle",  40.0,  20, 180, "summer_sine",   0.35),
    ("Fresh Juice",             "Beverages",  "liter",   60.0,  10, 3,   "summer_sine",   0.50),
]

items = []
ITEM_META = {}
for i, row in enumerate(items_raw, start=1):
    name, category, unit, base_price, base_demand, shelf_life, seas, amp = row
    items.append({"item_id": i, "item_name": name, "category": category, "unit": unit})
    ITEM_META[i] = {
        "name": name, "category": category, "unit": unit,
        "base_price": base_price, "base_demand": base_demand,
        "shelf_life_days": shelf_life, "seasonality": seas, "amplitude": amp,
    }


def seasonal_factor(seasonality: str, amplitude: float, day_of_year: int) -> float:
    """Deterministic cyclical curve, baseline 1.0."""
    if seasonality == "summer_sine":
        # peaks smoothly mid-year (~day 172, late June)
        return 1.0 + amplitude * math.sin(2 * math.pi * (day_of_year - 81) / 365.0)
    if seasonality == "winter_sine":
        # peaks at the edges of the year (Dec/Jan) via cosine
        return 1.0 + amplitude * math.cos(2 * math.pi * day_of_year / 365.0)
    if seasonality == "monsoon_spike":
        # sharp, localized Delhi monsoon bump centered ~ mid-July, narrow std
        center, std = 200, 16
        return 1.0 + amplitude * math.exp(-((day_of_year - center) ** 2) / (2 * std ** 2))
    # 'flat' -> mild natural wobble, no strong seasonal story
    return 1.0 + amplitude * math.sin(2 * math.pi * day_of_year / 365.0 + (hash(seasonality) % 7))


# ==========================================================================
# 5. INVENTORY_METADATA  (per store-item ordering economics)
# ==========================================================================
inv_metadata = []
for s in stores:
    for it_id, meta in ITEM_META.items():
        order_cost = round(np.random.uniform(50, 400), 2)
        # holding cost scales with item value; perishables carry a higher rate
        holding_rate = np.random.uniform(0.18, 0.30)
        annual_holding_cost = round(meta["base_price"] * holding_rate, 2)
        # perishable/fresh items need short lead times; shelf-stable groceries can wait longer
        if meta["shelf_life_days"] <= 7:
            lead_time_days = random.choice([1, 1, 2])
        elif meta["shelf_life_days"] <= 30:
            lead_time_days = random.choice([2, 3])
        else:
            lead_time_days = random.choice([3, 4, 5])
        inv_metadata.append({
            "store_id": s["store_id"], "item_id": it_id,
            "order_cost": order_cost, "annual_holding_cost": annual_holding_cost,
            "lead_time_days": lead_time_days,
        })
INV_META_LOOKUP = {(m["store_id"], m["item_id"]): m for m in inv_metadata}

# ==========================================================================
# 6. RAW_TRANSACTIONS  (365 days x 8 stores x 30 items, deterministic effects)
# ==========================================================================
print("Generating 365 days of transactions across all stores/items...")
raw_transactions = []
transaction_id = 1

# mild, smooth year-long price drift (inflation), same for every item (~+6%/yr)
def inflation_factor(day_index):
    return 1.0 + 0.06 * (day_index / 364.0)

for day_index, d in enumerate(ALL_DATES):
    day_of_year = d.timetuple().tm_yday
    weekday = d.weekday()  # Monday=0 ... Sunday=6
    is_weekend = weekday in (5, 6)
    infl = inflation_factor(day_index)

    for s in stores:
        store_id = s["store_id"]
        loc_mult = STORE_VOLUME_MULT[store_id]

        for it_id, meta in ITEM_META.items():
            category = meta["category"]

            # -- deterministic weekday effect (ONLY Grocery & Snacks) -----
            weekday_factor = (
                WEEKEND_BOOST_MULTIPLIER
                if (is_weekend and category in CATEGORIES_WITH_WEEKEND_BOOST)
                else 1.0
            )

            # -- deterministic cyclical seasonality ------------------------
            seas_factor = seasonal_factor(meta["seasonality"], meta["amplitude"], day_of_year)

            # -- promo assignment (category-dependent probability) --------
            promo_prob = 0.15 if category in CATEGORIES_WITH_WEEKEND_BOOST else 0.10
            promo = 1 if np.random.random() < promo_prob else 0

            # -- strict price elasticity rule ------------------------------
            base_price_today = meta["base_price"] * infl
            if promo == 1:
                price = round(base_price_today * (1 - PROMO_PRICE_DROP), 2)
                promo_sales_mult = PROMO_SALES_MULTIPLIER
            else:
                # tiny non-promo price noise (+/-2%) for realism, no sales effect
                price = round(base_price_today * np.random.uniform(0.98, 1.02), 2)
                promo_sales_mult = 1.0

            # -- expected demand & stochastic (but bounded) irregularity ---
            expected_sales = (
                meta["base_demand"] * seas_factor * weekday_factor * loc_mult * promo_sales_mult
            )
            noise = np.random.normal(1.0, 0.12)
            sales = max(0, int(round(expected_sales * max(0.3, noise))))

            raw_transactions.append({
                "transaction_id": transaction_id,
                "date": d.isoformat(),
                "store_id": store_id,
                "item_id": it_id,
                "sales": sales,
                "price": price,
                "promo": promo,
            })
            transaction_id += 1

print(f"  -> {len(raw_transactions):,} transaction rows generated")

# ==========================================================================
# 7. ITEM_LIFESPAN_STATS  (mirrors what the DB trigger would compute)
# ==========================================================================
print("Aggregating item_lifespan_stats (mirrors the AFTER INSERT trigger)...")
lifespan_acc = {}
for tx in raw_transactions:
    key = (tx["store_id"], tx["item_id"])
    if key not in lifespan_acc:
        lifespan_acc[key] = {"total_sales": 0, "days_active": 0}
    lifespan_acc[key]["total_sales"] += tx["sales"]
    lifespan_acc[key]["days_active"] += 1

item_lifespan_stats = []
for (store_id, item_id), acc in lifespan_acc.items():
    avg = round(acc["total_sales"] / acc["days_active"], 2) if acc["days_active"] else 0.0
    item_lifespan_stats.append({
        "store_id": store_id, "item_id": item_id,
        "all_time_sales_total": acc["total_sales"],
        "total_days_active": acc["days_active"],
        "all_time_sales_avg": avg,
    })

# ==========================================================================
# 8. CURRENT_INVENTORY & ITEM_BATCHES
# ==========================================================================
print("Deriving current_inventory and item_batches from recent sales velocity...")
# recent 14-day average sales per (store,item), used to size a plausible on-hand qty
recent_cutoff = (END_DATE - timedelta(days=13)).isoformat()
recent_sales_acc = {}
for tx in raw_transactions:
    if tx["date"] >= recent_cutoff:
        key = (tx["store_id"], tx["item_id"])
        recent_sales_acc.setdefault(key, []).append(tx["sales"])

current_inventory = []
item_batches = []
batch_id = 1
updated_at_ts = datetime.combine(END_DATE, datetime.min.time()).replace(hour=21, minute=0)

for s in stores:
    for it_id, meta in ITEM_META.items():
        key = (s["store_id"], it_id)
        recent_avg = np.mean(recent_sales_acc.get(key, [meta["base_demand"]]))
        lead_time = INV_META_LOOKUP[key]["lead_time_days"]
        # on-hand sized around lead-time demand + a safety buffer, with some noise
        qty_on_hand = max(0, int(round(recent_avg * (lead_time + 1) * np.random.uniform(0.8, 1.6))))

        current_inventory.append({
            "store_id": s["store_id"], "item_id": it_id,
            "qty_on_hand": qty_on_hand, "updated_at": updated_at_ts.isoformat(sep=" "),
        })

        # split on-hand qty into 1-3 batches with staggered expiry dates
        n_batches = 1 if qty_on_hand < 5 else random.choice([1, 2, 3])
        remaining = qty_on_hand
        for b in range(n_batches):
            if remaining <= 0:
                break
            qty = remaining if b == n_batches - 1 else max(1, int(remaining * np.random.uniform(0.3, 0.6)))
            qty = min(qty, remaining)
            remaining -= qty
            # stagger: some batches close to expiry, some fresher
            days_until_expiry = int(np.random.uniform(0.15, 1.0) * meta["shelf_life_days"])
            expiry_date = END_DATE + timedelta(days=days_until_expiry)
            item_batches.append({
                "batch_id": batch_id, "store_id": s["store_id"], "item_id": it_id,
                "qty": qty, "expiry_date": expiry_date.isoformat(),
            })
            batch_id += 1

# ==========================================================================
# 9. DAILY_PREDICTIONS  (last 7 days: model-style predictions vs. actual sales)
# ==========================================================================
print("Generating 7-day historical predictions for model evaluation...")
predictions = []
prediction_start_date = (END_DATE - timedelta(days=6)).isoformat()
inv_meta_lookup = INV_META_LOOKUP  # (store_id, item_id) -> metadata dict
pred_created_at = datetime.combine(END_DATE, datetime.min.time()).replace(hour=6, minute=0)

for tx in raw_transactions:
    if tx["date"] >= prediction_start_date:
        # Simulate a realistic model prediction: actual sales +/- error margin.
        # Mostly small error, but occasionally the model misses badly (irregularity),
        # e.g. it under-reacts to a promo/seasonal spike it hasn't fully learned yet.
        if np.random.random() < 0.08:
            # a "rough day" for the model: larger relative miss
            error_margin = int(round(tx["sales"] * np.random.uniform(-0.35, 0.35)))
        else:
            error_margin = np.random.randint(-3, 4)
        predicted_demand = max(0, tx["sales"] + error_margin)

        meta = inv_meta_lookup[(tx["store_id"], tx["item_id"])]

        annual_demand = predicted_demand * 365
        if meta["annual_holding_cost"] > 0:
            eoq = int(np.sqrt((2 * annual_demand * meta["order_cost"]) / meta["annual_holding_cost"]))
        else:
            eoq = 0

        rop = int((predicted_demand * meta["lead_time_days"]) * 1.2)

        predictions.append({
            "prediction_date": tx["date"],
            "store_id": tx["store_id"],
            "item_id": tx["item_id"],
            "predicted_demand": float(predicted_demand),
            "rop": max(1, rop),
            "eoq": max(1, eoq),
            "created_at": pred_created_at.isoformat(sep=" "),
        })

daily_predictions = predictions
print(f"  -> {len(daily_predictions):,} prediction rows generated (last 7 days)")

# ==========================================================================
# 10. SUPPLIERS
# ==========================================================================
print("Generating suppliers...")
SUPPLIER_NAME_POOL = [
    "Azadpur Mandi Traders", "Ghazipur Fresh Supply Co.", "Okhla Cold Chain Pvt Ltd",
    "Najafgarh Farm Direct", "NCR Dairy Distributors", "Keshopur Wholesale Mart",
    "Chattarpur Agro Suppliers", "Tikri Border Produce Co.", "Bawana Frozen Foods",
    "Sarai Kale Khan Bakers Supply", "Delhi Poultry & Meat Co.", "Yamuna Vihar Beverages",
]
suppliers = []
supplier_id = 1
for s in stores:
    for it_id in ITEM_META:
        n_suppliers = random.choice([1, 1, 2])  # most items have 1 supplier, some have a backup
        prefs = ["primary"] if n_suppliers == 1 else ["primary", "backup"]
        for pref in prefs:
            name = random.choice(SUPPLIER_NAME_POOL)
            suppliers.append({
                "supplier_id": supplier_id,
                "store_id": s["store_id"],
                "item_id": it_id,
                "name": name,
                "phone": f"+91-{random.randint(70000,99999)}{random.randint(10000,99999)}",
                "email": f"{name.lower().replace(' ', '.').replace('&','and').replace('.,','')}@suppliers.example.in",
                "pref": pref,
            })
            supplier_id += 1

# ==========================================================================
# 11. CONFIG
# ==========================================================================
config = [
    {"org_id": 1, "batch_x": 50, "max_negotiation_turns": 5},
    {"org_id": 2, "batch_x": 40, "max_negotiation_turns": 4},
]
CONFIG_LOOKUP = {c["org_id"]: c for c in config}

# ==========================================================================
# 12. NEGOTIATIONS, NEGOTIATION_TURNS, TRANSFERS
# ==========================================================================
print("Generating negotiations, negotiation_turns, and transfers...")
TRIGGER_TYPES = ["low_stock", "overstock", "expiry_risk"]
ARGUMENT_TEMPLATES_INITIATOR = [
    "Requesting transfer of {qty} {unit} of {item} — running low, {lead} day(s) lead time is too slow.",
    "We are projected to stock out of {item} within {lead} day(s); can you spare {qty} {unit}?",
    "Batch of {item} nearing expiry here — proposing a {qty} {unit} transfer before it's wasted.",
]
ARGUMENT_TEMPLATES_COUNTER = [
    "We can offer {qty} {unit} of {item}, but need pickup within 24 hours.",
    "Only {qty} {unit} of {item} available after covering our own weekend demand.",
    "Can transfer {qty} {unit} of {item} but request a priority swap next time.",
    "Declining for now — our own {item} stock is also tight this week.",
]

negotiations = []
negotiation_turns = []
transfers = []
neg_id = 1
turn_id = 1
transfer_id = 1

N_NEGOTIATIONS = 180
for _ in range(N_NEGOTIATIONS):
    org_id = random.choice([1, 2])
    org_stores = [s["store_id"] for s in stores if s["org_id"] == org_id]
    if len(org_stores) < 2:
        continue
    item_id = random.choice(list(ITEM_META.keys()))
    meta = ITEM_META[item_id]
    initiator_store_id = random.choice(org_stores)
    counterpart_store_id = random.choice([sid for sid in org_stores if sid != initiator_store_id])
    trigger_type = random.choice(TRIGGER_TYPES)
    max_turns = CONFIG_LOOKUP[org_id]["max_negotiation_turns"]
    n_turns = random.randint(1, max_turns)

    outcome_roll = np.random.random()
    if outcome_roll < 0.60:
        status, resolution_type = "resolved", "transfer"
    elif outcome_roll < 0.80:
        status, resolution_type = "resolved", "reorder"
    elif outcome_roll < 0.93:
        status, resolution_type = "rejected", "declined"
    else:
        status, resolution_type = "pending", None

    created_dt = datetime.combine(
        random.choice(ALL_DATES[-90:]), datetime.min.time()
    ) + timedelta(hours=random.randint(8, 20), minutes=random.randint(0, 59))

    negotiations.append({
        "negotiation_id": neg_id, "org_id": org_id, "item_id": item_id,
        "initiator_store_id": initiator_store_id, "trigger_type": trigger_type,
        "status": status, "resolution_type": resolution_type,
        "created_at": created_dt.isoformat(sep=" "),
    })

    qty_proposed = max(1, int(np.random.uniform(3, 25)))
    for t in range(1, n_turns + 1):
        speaker_store = initiator_store_id if t % 2 == 1 else counterpart_store_id
        if t % 2 == 1:
            text = random.choice(ARGUMENT_TEMPLATES_INITIATOR).format(
                qty=qty_proposed, unit=meta["unit"], item=meta["name"],
                lead=INV_META_LOOKUP[(initiator_store_id, item_id)]["lead_time_days"],
            )
        else:
            text = random.choice(ARGUMENT_TEMPLATES_COUNTER).format(
                qty=max(1, qty_proposed - random.randint(0, 3)), unit=meta["unit"], item=meta["name"],
            )
        responded = True if t < n_turns else (status != "pending")
        negotiation_turns.append({
            "turn_id": turn_id, "negotiation_id": neg_id, "store_id": speaker_store,
            "turn_number": t, "argument_text": text, "responded": responded,
            "created_at": (created_dt + timedelta(minutes=15 * t)).isoformat(sep=" "),
        })
        turn_id += 1

    if resolution_type == "transfer":
        confirmed_from = True
        confirmed_to = True if status == "resolved" else random.choice([True, False])
        completed_at = (
            (created_dt + timedelta(hours=random.randint(2, 30))).isoformat(sep=" ")
            if (confirmed_from and confirmed_to) else None
        )
        transfers.append({
            "transfer_id": transfer_id, "negotiation_id": neg_id,
            "from_store_id": counterpart_store_id, "to_store_id": initiator_store_id,
            "item_id": item_id, "qty": qty_proposed,
            "confirmed_from": confirmed_from, "confirmed_to": confirmed_to,
            "completed_at": completed_at,
        })
        transfer_id += 1

    neg_id += 1

print(f"  -> {len(negotiations)} negotiations, {len(negotiation_turns)} turns, {len(transfers)} transfers")


# ==========================================================================
# WRITE EVERYTHING OUT
# ==========================================================================
def write_csv(records, columns, outdir, filename):
    df = pd.DataFrame(records, columns=columns)
    path = f"{outdir.rstrip('/')}/{filename}"
    df.to_csv(path, index=False)
    print(f"  wrote {path}  ({len(df):,} rows)")
    return df


def main():
    import pandas as pd
    from sqlalchemy import create_engine, MetaData
    from sqlalchemy.dialects.postgresql import insert

    # Database Configuration
    DB_URI = r"postgresql://ml_pipeline:Saki%23%246Nak7S@ep-flat-bread-az634t19-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    engine = create_engine(DB_URI)

    print(f"\nDate window: {START_DATE} -> {END_DATE} (365 days)")
    print(f"Stores: {len(stores)} | Items: {len(items)}\n")

    print("Uploading data to PostgreSQL...")

    metadata = MetaData()
    metadata.reflect(bind=engine)

    datasets = [
        ("orgs", orgs,
         ["org_id", "org_name"],
         ["org_id"]),

        ("stores", stores,
         ["store_id", "org_id", "location_name", "latitude", "longitude"],
         ["store_id"]),

        ("store_distances", store_distances,
         ["store_id_a", "store_id_b", "tier", "est_hours"],
         ["store_id_a", "store_id_b"]),

        ("items", items,
         ["item_id", "item_name", "category", "unit"],
         ["item_id"]),

        ("inventory_metadata", inv_metadata,
         ["store_id", "item_id", "order_cost", "annual_holding_cost", "lead_time_days"],
         ["store_id", "item_id"]),

        ("current_inventory", current_inventory,
         ["store_id", "item_id", "qty_on_hand", "updated_at"],
         ["store_id", "item_id"]),

        ("item_batches", item_batches,
         ["batch_id", "store_id", "item_id", "qty", "expiry_date"],
         ["batch_id"]),

        ("raw_transactions", raw_transactions,
         ["transaction_id", "date", "store_id", "item_id", "sales", "price", "promo"],
         ["transaction_id"]),

        ("item_lifespan_stats", item_lifespan_stats,
         ["store_id", "item_id", "all_time_sales_total", "total_days_active", "all_time_sales_avg"],
         ["store_id", "item_id"]),

        ("daily_predictions", daily_predictions,
         ["prediction_date", "store_id", "item_id", "predicted_demand", "rop", "eoq", "created_at"],
         ["prediction_date", "store_id", "item_id"]),

        ("suppliers", suppliers,
         ["supplier_id", "store_id", "item_id", "name", "phone", "email", "pref"],
         ["supplier_id"]),

        ("config", config,
         ["org_id", "batch_x", "max_negotiation_turns"],
         ["org_id"]),
    ]

    for table_name, data, columns, conflict_cols in datasets:

        df = pd.DataFrame(data, columns=columns)

        table = metadata.tables[table_name]

        stmt = insert(table).values(df.to_dict(orient="records"))

        stmt = stmt.on_conflict_do_nothing(
            index_elements=conflict_cols
        )

        with engine.begin() as conn:
            conn.execute(stmt)

        print(f"✓ Processed {len(df)} rows into {table_name}")

    print("\nAll data uploaded successfully.")


if __name__ == "__main__":
    main()