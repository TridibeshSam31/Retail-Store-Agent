# Multi-Store Agentic AI — Master Doc

This document is self-contained. It assumes the reader knows nothing else about the project going in.

---

# Section 1: Final PRD

## 1. What This Is

A retail chain (multiple stores under one owner) currently manages stock manually — a manager notices something is running low, calls another store or a supplier, decides how much to reorder mostly on gut feel, and separately keeps an eye on expiry dates. This is slow, reactive, and depends entirely on one person's attention and experience.

This product replaces that manual loop with two things working together:

1. **A prediction engine** that watches sales data and tells you, per item per store, when you're likely to run out and how much to reorder — instead of a manager guessing.
2. **A team of AI agents** — one per store, plus a neutral "arbitrator" agent — that activate automatically when a shortage is detected. If another store in the same chain has surplus of that item, the agents negotiate among themselves (each arguing its own store's case) and arrive at a decision: transfer stock from the surplus store, or escalate to the supplier if no transfer makes sense.

The manager's job shrinks to: approve what the agents propose, and physically confirm stock movement. Everything else — noticing the problem, deciding what to do, and justifying the decision — is handled by the system.

## 2. What This Is NOT

- Not a dashboard that just shows "stock is low" and leaves the decision to a human.
- Not a single-store reorder bot — the differentiator is that stores in a chain actively negotiate with each other over scarce stock.
- Not a fully autonomous system with no human checkpoint — every stock-moving decision still requires a human tap.

## 3. Core Concepts

- **Org**: one chain — a single owner, multiple stores. All negotiation happens *within* an org. Stores in different orgs never see or interact with each other's agents or data.
- **Store agent**: one per store. Represents that store's interest when there's a shortage — either as the *initiator* (the store that's short) or a *responder* (a store being asked if it has surplus).
- **Arbitrator agent**: a neutral agent that runs the negotiation between store agents and issues the final decision when stores disagree.
- **Two trigger thresholds**:
  - **"Might be low"** — the prediction engine's forecast crosses a reorder point. Normal, expected path.
  - **"Immediately low"** — actual current stock crosses a critical level *right now*, independent of what the prediction said. Safety net for when prediction was wrong or something sudden happened (e.g. one unusually large sale).
- **Usable surplus**: at a responding store, this is whatever stock they hold *above* what the prediction engine forecasts that store itself will need — not a fixed margin, not their reorder point. Items nearing expiry are excluded from usable surplus.
- **No auto/confirm mode toggle.** Every stock-moving decision requires an explicit human tap — see Section 7. There is no per-store autonomy setting.

## 4. The Prediction Engine (Background Processes)

- Every time stock changes by a meaningful amount (a batch of X transactions — X is an org-wide config value, fixed for demo), the prediction engine recalculates: expected demand, reorder point, and how much to reorder, based on sales history for that item at that store.
- **Usable surplus is recalculated whenever this batch pipeline runs** — not live per-sale, and not snapshotted once at negotiation start.
- Separately, every single sale is checked cheaply against the current "immediately low" threshold, in real time — this doesn't wait for the batch recalculation. This catches a sudden shock (e.g. an unusually large single purchase) immediately instead of waiting for the next scheduled check.
- **Interaction rule**: if a stock change trips "immediately low" directly, the prediction engine's batch run for that same cycle is skipped, and the system goes straight to the agents. This avoids the prediction engine re-flagging the same shortage a second time while the first negotiation is already in progress. The batch pipeline resumes on the next cycle, and will trigger agents again only if that next cycle independently crosses "might be low" or "immediately low."
- **Expiry** is checked daily (e.g. at login). Near-expiry items are: (a) excluded from usable surplus at that store, and (b) flagged directly to that store so the manager knows to move/discount/discard them. Expiry flagging is otherwise independent of the shortage/negotiation logic.

## 5. Case-by-Case Flow

### Case A — Normal shortage, one store, no contest
1. Prediction engine flags "might be low" for an item at Store 1.
2. Store 1's agent checks other stores in the org for usable surplus of that item.
3. Exactly one store has usable surplus, no competing claim.
4. Agent proposes a transfer.
5. Manager approves before it proceeds (see Section 7).

### Case B — Sudden shortage (immediate-low path)
1. A large/unexpected sale drops stock below the critical threshold right now (not caught by the last prediction).
2. Detected immediately via the real-time check — no waiting for the next batch cycle.
3. That cycle's prediction engine batch run is skipped; system goes straight to Store 1's agent.
4. From here, proceeds identically to Case A or Case C depending on whether other stores contest the surplus.

### Case C — Multiple stores need the same surplus (the negotiation case)
1. Store 1 and Store 2 both need stock that only Store 3 has usable surplus of.
2. Store 1's agent (or whichever initiated) wakes the arbitrator and the other relevant store agents.
3. Agents go back and forth, each stating their store's case (urgency, sales velocity, context), with a fixed maximum number of turns (config value). Each turn takes prior arguments into account.
4. If an agent doesn't respond in time, the system retries with exponential backoff and jitter — the previous pending response is explicitly cancelled before a retry is issued, so a late-arriving original response can't be double-counted. If the agent still doesn't respond, its turn is skipped for that round, but its **last-known stock data is still used** in the split calculation (it just doesn't get a live argument). The initiator agent and the arbitrator must still respond regardless.
5. **If retries keep failing beyond a limit due to infrastructure failure** (e.g. LLM API unavailable — distinct from Case D's "no viable transfer" logic): the negotiation surfaces a failure screen with three options: **renegotiate** (retry, optionally with a starting argument from whichever party is affected), **contact supplier**, or **cancel** (closes with no action; shortage re-flags on the next prediction cycle if still valid).
6. If agents reach the maximum number of turns without agreement, the arbitrator defaults to a **strict even split** of the available surplus between the contesting stores, regardless of who argued more urgency and regardless of each store's actual need — split in whatever unit the item is tracked in, rounded down; any remainder is left unallocated. *(Known limitation: a store can receive more than it needs while another remains short — accepted tradeoff for simplicity.)*
7. Once a decision is reached, it's proposed as a transfer (or split of transfers) the same way as Case A.

### Case D — No viable transfer (contact supplier)
A transfer is considered **not workable**, and the system automatically escalates to supplier contact — no human decision needed at this step — when:
- No store in the org has usable surplus, **or**
- The estimated transfer time is slower than the time remaining until stockout, computed as:
  - **Transfer time**: looked up from a static distance-tier → hours table (near / medium / far), based on each store's approximate distance to every other store.
  - **Time to stockout**: `current_stock ÷ average_daily_sales_rate` (from the prediction engine).
  - Checked once at negotiation start; no re-check mid-negotiation, no buffer margin, for simplicity.

When this happens:
1. The initiator store is told to contact its supplier.
2. The agent drafts an order/message using the store's saved supplier info. **If no supplier is on file, the UI shows a plain "Contact Supplier" instruction instead of a draft — this is not an error state.**
3. A human must tap "Send" — the agent never contacts the supplier on its own. Tapping Send opens `wa.me/{supplier_number}/{message}` (WhatsApp deep link) if the supplier's preferred channel is WhatsApp, or opens a mail draft if the preferred channel is email. No live send API — this is a hackathon-scope simplification.

### Case E — Manager rejects a proposed decision
1. Arbitrator proposes a split or transfer.
2. The relevant manager rejects it.
3. Whichever party is affected by that specific rejection is asked to choose: **renegotiate** (with an optional text box to submit a starting argument) or **contact the supplier instead**.
4. If the manager renegotiates and rejects again, this can repeat — there's no cap on this loop for the current scope. (Known risk, explicitly out of scope to fix now.)

### Case F — Simultaneous or overlapping shortages on the same item
- If two (or more) stores independently trigger "immediately low" on the same item at the same time, each gets its own negotiation — they are not merged into one. The arbitrator processes them sequentially, in the order they were triggered (first-come-first-served).
- Same rule if "immediately low" fires for an item/store that already has a "might be low" negotiation in flight for that same item: treated as a separate, parallel negotiation rather than merged into the existing one.

## 6. Visibility Rules

- All agent activity — every negotiation, argument, and decision, **including negotiations that were rejected, failed, or aborted** — is visible in the side panel to **every store in the org**, so the whole chain can see what's happening across the network.
- **Confirmation requests and action-required prompts** go only to the store(s) directly party to that action — other stores can watch, but aren't asked to approve something that isn't theirs to approve.

## 7. What the Human Actually Does

The system cannot physically move stock — a person still has to move boxes. What it removes is the *thinking*. There are exactly four points where a human must tap a button:

1. **Negotiation failure (infra failure only)** — choose renegotiate / contact supplier / cancel.
2. **Approve a proposed transfer or split** — or reject and choose renegotiate (with optional argument text) vs. contact supplier.
3. **Mark transfer physically done** — every store party to a given transfer must individually mark it done (a 2-store transfer needs 2 confirmations; an N-way split needs N). Inventory only updates, for all parties at once, once every party has marked done.
4. **Tap "Send" on a supplier draft** — opens the WhatsApp/email deep link; the agent never sends on its own.

Nothing else requires human input — prediction, negotiation, and decision-making all run automatically between these checkpoints.

## 8. Why This Is Different From Existing Inventory Software

Most inventory software tells you *what happened* ("stock is low") and leaves the decision to a person. This system tells you *what should happen next*, and — uniquely — handles situations where multiple stores in the same chain want the same limited stock, by having the stores' own agents argue it out and reach a resolution, instead of one person guessing or first-come-first-served on human response time.

## 9. Explicitly Out of Scope (For Now)

- Agents autonomously contacting suppliers without a human tap
- Live supplier send integration (real WhatsApp Business API / email send) — deep-link only for demo
- Pricing, staffing, or promotion decisions
- Cross-chain (cross-org) coordination
- Natural-language database querying
- A hard cap on the reject → renegotiate loop (Case E)
- Need-proportional splitting in the even-split fallback (Case C step 6) — strict even split only
- Live/mid-negotiation re-check of the transfer-time-vs-stockout-time comparison (Case D)

## 10. Config Values (Fixed for Demo, Tunable Later)

- **X**: number of transactions that triggers a prediction engine batch recalculation
- **Max negotiation turns** before arbitrator defaults to even split
- **Distance-tier → hours table** (near/medium/far) for Case D transfer-time estimation

## 11. Supplier Record Schema (conceptual)

| Field | Description |
|---|---|
| `id` | Unique supplier identifier |
| `name` | Supplier name |
| `phone` | Phone number (used for WhatsApp deep link) |
| `email` | Email address |
| `pref` | Preferred contact channel: `whatsapp` or `email` |

If a store has no supplier record for an item, the UI shows a plain "Contact Supplier" instruction with no draft or send button — this is expected behavior, not an error state.

---

# Section 2: Work Division — Four Groups

Work is split into four strict groups. Each group's list is self-contained; cross-group dependencies (what one group needs from another to unblock) are noted inline.

## Group 1: DB

Full schema is in Section 3. Responsibilities:
- Stand up Postgres with the full schema (org/store/item/inventory/prediction/negotiation/transfer/supplier/config tables)
- Seed synthetic data: multiple orgs, stores, items, transaction history, store distances, sample suppliers
- Own migrations and any schema changes needed as other groups discover gaps
- Provide seed data that supports demoing every case (A–F) reliably

## Group 2: Backend

- `org_id`-scoped auth/data access enforced on every query — hard boundary, not just a filter
- CRUD APIs: inventory, items, suppliers, config
- Trigger listener: watches stock/prediction changes for threshold crossings, decides might-be-low vs. immediately-low, applies the skip-batch-if-immediately-low rule
- Prediction pipeline hookup: batch recompute on X transactions, real-time per-sale immediately-low check, usable-surplus calc, time-to-stockout calc, daily expiry job
- Transfer confirmation logic: N-of-N confirm before inventory updates atomically across all parties
- Supplier draft generation + WhatsApp/email deep link builder
- Negotiation/activity log API (org-wide visibility, including failed/aborted negotiations)
- **Depends on**: DB schema being stable early; Agents group for negotiation state read/write contract

## Group 3: Agents

- Store agent (initiator + responder roles)
- Arbitrator agent
- Fixed-max-turns negotiation loop; each turn considers prior arguments
- Timeout handling: exponential backoff + jitter, explicit cancel-before-retry
- Skipped-responder handling: use last-known stock data, no live argument
- Even-split fallback logic at max turns (rounded down, remainder unallocated)
- Workability check (Case D): distance-tier lookup vs. time-to-stockout, routes to transfer or supplier path
- Infra-failure path: renegotiate / contact supplier / cancel
- Case F concurrency handling: sequential negotiation processing per item/org, no merging
- Negotiation logging: full transcript + resolution written for every negotiation, including rejected/failed ones
- **Depends on**: Backend for trigger events in, DB for reading current inventory/predictions/distances, Backend for writing negotiation/transfer records out

## Group 4: Frontend

- Inventory CRUD screens (items, stock, suppliers, config)
- Org-wide side panel: live agent activity feed, all negotiations including rejected/failed ones
- Negotiation transcript view — the core demo visual, turn-by-turn argument log + resolution
- Approve/reject UI for proposed transfers/splits
- Renegotiate (with optional argument text box) vs. contact-supplier choice UI
- Transfer "mark done" confirmation UI (per-party)
- Supplier draft screen with Send button (triggers deep link)
- Expiry alert UI (daily)
- Negotiation failure screen (infra failure path): renegotiate / contact supplier / cancel
- **Depends on**: Backend API contracts for all of the above

---

# Section 3: DB — Full Final Schema

Steps before running the schema:
1. Provision a Postgres instance (local or hosted) accessible to all four groups.
2. Run the schema below in order — tables reference earlier tables via foreign keys, so order matters.
3. Seed `orgs`, `stores`, `items` first, then `store_distances` and `suppliers`, then `raw_transactions` (synthetic history), then run the prediction pipeline once to populate `daily_predictions` and `current_inventory` before any negotiation logic is tested against it.
4. Insert one `config` row per org (batch_x, max_negotiation_turns) before triggering any negotiation flow — negotiation logic reads this at runtime.

```sql
-- ==========================================
-- 1. Org & Store Layer
-- ==========================================

CREATE TABLE orgs (
    org_id SERIAL PRIMARY KEY,
    org_name VARCHAR(100) NOT NULL
);

CREATE TABLE stores (
    store_id SERIAL PRIMARY KEY,
    org_id INT REFERENCES orgs(org_id) NOT NULL,
    location_name VARCHAR(100) NOT NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6)
);

CREATE TABLE store_distances (
    store_id_a INT REFERENCES stores(store_id),
    store_id_b INT REFERENCES stores(store_id),
    tier VARCHAR(10) NOT NULL,      -- 'near' | 'medium' | 'far'
    est_hours DECIMAL(5,2) NOT NULL,
    PRIMARY KEY (store_id_a, store_id_b)
);

-- ==========================================
-- 2. Items & Inventory
-- ==========================================

CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    unit VARCHAR(20) NOT NULL       -- e.g. 'kg','units','cases'
);

CREATE TABLE inventory_metadata (
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    order_cost DECIMAL(10,2) NOT NULL,
    annual_holding_cost DECIMAL(10,2) NOT NULL,
    lead_time_days INT DEFAULT 3,
    PRIMARY KEY (store_id, item_id)
);

CREATE TABLE current_inventory (
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    qty_on_hand INT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (store_id, item_id)
);

CREATE TABLE item_batches (
    batch_id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    qty INT NOT NULL,
    expiry_date DATE
);

-- ==========================================
-- 3. Sales & Predictions
-- ==========================================

CREATE TABLE raw_transactions (
    transaction_id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    sales INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    promo INT DEFAULT 0
);

CREATE INDEX idx_raw_transactions_date_store_item
ON raw_transactions (date, store_id, item_id);

CREATE TABLE item_lifespan_stats (
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    all_time_sales_total BIGINT DEFAULT 0,
    total_days_active INT DEFAULT 0,
    all_time_sales_avg DECIMAL(10,2) DEFAULT 0.00,
    PRIMARY KEY (store_id, item_id)
);

CREATE OR REPLACE FUNCTION update_item_lifespan_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO item_lifespan_stats (store_id, item_id, all_time_sales_total, total_days_active, all_time_sales_avg)
    VALUES (NEW.store_id, NEW.item_id, NEW.sales, 1, NEW.sales)
    ON CONFLICT (store_id, item_id)
    DO UPDATE SET
        all_time_sales_total = item_lifespan_stats.all_time_sales_total + NEW.sales,
        total_days_active = item_lifespan_stats.total_days_active + 1,
        all_time_sales_avg = (item_lifespan_stats.all_time_sales_total + NEW.sales)::DECIMAL
                              / (item_lifespan_stats.total_days_active + 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_raw_transaction_insert
AFTER INSERT ON raw_transactions
FOR EACH ROW
EXECUTE FUNCTION update_item_lifespan_stats();

CREATE TABLE daily_predictions (
    prediction_date DATE,
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    predicted_demand DECIMAL(10,2) NOT NULL,
    rop INT NOT NULL,
    eoq INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (prediction_date, store_id, item_id)
);

-- ==========================================
-- 4. Suppliers
-- ==========================================

CREATE TABLE suppliers (
    supplier_id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    name VARCHAR(150),
    phone VARCHAR(20),
    email VARCHAR(150),
    pref VARCHAR(10)                -- 'whatsapp' | 'email'
);

-- ==========================================
-- 5. Negotiations & Transfers
-- ==========================================

CREATE TABLE negotiations (
    negotiation_id SERIAL PRIMARY KEY,
    org_id INT REFERENCES orgs(org_id),
    item_id INT REFERENCES items(item_id),
    initiator_store_id INT REFERENCES stores(store_id),
    trigger_type VARCHAR(20) NOT NULL,   -- 'might_be_low' | 'immediately_low'
    status VARCHAR(20) NOT NULL,         -- 'proposed'|'approved'|'rejected'|'aborted'|'completed'
    resolution_type VARCHAR(20),         -- 'transfer'|'even_split'|'supplier'|'cancelled'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE negotiation_turns (
    turn_id SERIAL PRIMARY KEY,
    negotiation_id INT REFERENCES negotiations(negotiation_id),
    store_id INT REFERENCES stores(store_id),
    turn_number INT NOT NULL,
    argument_text TEXT,
    responded BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transfers (
    transfer_id SERIAL PRIMARY KEY,
    negotiation_id INT REFERENCES negotiations(negotiation_id),
    from_store_id INT REFERENCES stores(store_id),
    to_store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    qty INT NOT NULL,
    confirmed_from BOOLEAN DEFAULT FALSE,
    confirmed_to BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP
);

-- ==========================================
-- 6. Config
-- ==========================================

CREATE TABLE config (
    org_id INT REFERENCES orgs(org_id) PRIMARY KEY,
    batch_x INT NOT NULL,
    max_negotiation_turns INT NOT NULL
);
```

