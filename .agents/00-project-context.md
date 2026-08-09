# Project Context

## Product
A multi-store retail inventory platform where prediction and AI agents decide what should happen next when stock becomes constrained.

A store has a store agent. A neutral arbitrator handles contested negotiations. Managers approve or reject decisions and confirm physical stock movement.

## Core value proposition
The system replaces the manual loop of:
low stock noticed → call another store/supplier → guess quantity → decide → track expiry

with:
prediction → agent negotiation → proposed action → human approval → physical confirmation.

## Product is NOT
- A passive low-stock dashboard.
- A single-store reorder bot.
- A fully autonomous stock-moving system.

## Main entities
Org
Store
Item
Inventory metadata
Current inventory
Item batches / expiry
Raw transactions
Prediction
Supplier
Negotiation
Negotiation turn
Transfer
Config

## Main statuses and concepts
Trigger:
- might_be_low
- immediately_low

Negotiation:
- proposed
- approved
- rejected
- aborted
- completed

Resolution:
- transfer
- even_split
- supplier
- cancelled

Transfer:
- per-party confirmation
- completed only after all parties confirm

## Important product behavior
Usable surplus is stock above the responding store's predicted own requirement and excludes near-expiry stock.

Transfer workability is checked at negotiation start using transfer time versus estimated time to stockout.

The arbitrator can fall back to an even split after the maximum negotiation turns. Split quantities are rounded down and remainders stay unallocated.

All negotiation transcripts and outcomes remain visible to the org.
