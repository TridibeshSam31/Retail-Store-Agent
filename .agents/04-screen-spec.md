# Screen Specification

## 1. Overview / Operations Home
Purpose: immediate operational awareness.

Include:
- active shortages
- immediate-low alerts
- pending approvals
- transfers awaiting physical confirmation
- expiry alerts
- recent agent activity
- compact store/org context

Do not make this a generic analytics dashboard. Prioritize actions and current operational state.

## 2. Inventory
Capabilities:
- browse inventory
- search/filter if supported
- item detail
- current quantity
- unit
- prediction context where available
- expiry/batch information
- shortage state
- supplier association

## 3. Items
CRUD UI backed by actual API contracts.

## 4. Suppliers
CRUD UI.
Show preferred channel.
Show missing supplier state.
Show draft/contact action only where contract supports it.

## 5. Predictions / Stock Risk
Show:
- item
- store
- predicted demand
- reorder point
- EOQ where exposed
- current stock
- trigger state
- estimated time to stockout where exposed

## 6. Negotiations
List:
- negotiation ID
- item
- initiator
- trigger
- status
- resolution
- created time

Filters should use API-supported fields.

## 7. Negotiation Detail
This is the flagship screen.

Layout:
- header: item + trigger + status
- context strip: stores, stock, usable surplus, urgency
- transcript timeline
- store-agent messages
- arbitrator messages
- skipped/timeout indicators
- resolution panel
- transfer allocation
- action area

## 8. Transfer Confirmation
Show each party's confirmation state:
- Store A: pending/confirmed
- Store B: pending/confirmed
- etc.

Prominently explain:
inventory updates only after every party confirms.

## 9. Supplier Draft
Show:
- supplier
- channel
- draft
- item
- quantity
- destination store
- Send
- fallback if no supplier

## 10. Expiry Alerts
Show near-expiry inventory separately from shortage logic.

Do not imply expiry caused a negotiation unless the API explicitly says so.

## 11. Configuration
Show org-level demo configuration:
- batch X
- max negotiation turns
- distance tiers/hours if exposed by backend

No autonomy toggle.
