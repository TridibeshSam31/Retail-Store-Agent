# UX Workflows & State Requirements

## A. Normal shortage — one store, one viable transfer
Screen behavior:
1. Surface shortage.
2. Show why it triggered: might-be-low.
3. Show prediction context available from API.
4. Show proposed transfer.
5. Show source store, destination store, item, quantity, and relevant timing data.
6. Require Approve.
7. After approval, show physical confirmation state.
8. Each involved store confirms.
9. Only after all confirmations does inventory become updated.

## B. Immediate-low
Visually distinguish this from might-be-low.
Show that it was detected immediately from current stock.
Do not imply that the prediction batch produced the trigger.

## C. Contested surplus negotiation
The core demo screen.

Show:
- item
- initiating store
- stores competing for the surplus
- available usable surplus
- negotiation status
- current turn
- turn-by-turn agent arguments
- each store agent's identity
- arbitrator messages distinctly
- responded/skipped state where supported
- final resolution
- transfer split if applicable

If max turns are reached:
- clearly label even-split fallback
- show rounded-down allocation
- show any unallocated remainder if provided

## D. No viable transfer / supplier
Show:
- no usable surplus OR transfer slower than stockout
- reason
- estimated transfer time if provided
- estimated time to stockout if provided
- supplier information if available
- generated draft if supplier exists
- Send button
- if no supplier exists: plain Contact Supplier instruction

Send must launch the backend-provided WhatsApp/email deep link. Never simulate a successful send.

## E. Manager rejects proposal
Show a deliberate rejection flow:
- Reject
- Renegotiate
- optional starting argument
- Contact Supplier

Do not bury these choices in a generic confirmation modal.

## F. Infrastructure failure
Dedicated failure state:
- what failed
- whether retry is safe
- Renegotiate
- Contact Supplier
- Cancel

Do not label infrastructure failure as "no viable transfer."

## G. Simultaneous shortages
Show separate negotiation records.
Do not merge them into a single combined conversation.

## Org-wide activity
Every store can view:
- active negotiations
- completed negotiations
- rejected negotiations
- failed negotiations
- aborted negotiations
- decisions/resolutions

Only directly affected stores see actionable approval/confirmation prompts.
