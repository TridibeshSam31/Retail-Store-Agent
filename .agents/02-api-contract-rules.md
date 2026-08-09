# API Contract Rules

## Critical instruction
The master product document defines frontend responsibilities but does not itself list concrete HTTP endpoints, request schemas, response schemas, or authentication payloads.

Therefore:

1. Inspect the actual backend/API contract files in the repository before implementing integration.
2. Use those contracts as the sole source of truth for frontend data shapes.
3. Do not invent `/api/...` routes just because a screen needs data.
4. Do not rename backend fields in API-layer types unless an explicit adapter is intentionally introduced.
5. Do not fabricate response data to make the UI appear complete.
6. If a contract is genuinely missing, create a typed integration boundary/TODO and continue with UI states using explicit local fixtures only if the project already permits fixtures.
7. Keep fixtures visually distinguishable from production API responses.
8. Every mutation must have loading, success, failure, and retry behavior.
9. Do not show inventory as updated until the backend confirms the required transfer state.
10. Preserve backend status values; map them to UI labels in a presentation layer.

## Required frontend API surfaces from the product requirements
The frontend needs contract-backed support for:
- org/store context
- inventory CRUD
- item CRUD
- supplier CRUD
- config
- predictions / shortage triggers
- negotiation/activity feed
- negotiation transcript
- proposed transfer/split
- approve/reject
- renegotiate with optional argument
- contact supplier
- transfer confirmation per party
- supplier draft/deep-link generation
- expiry alerts
- negotiation infrastructure failure actions

These are product capabilities, NOT invented endpoint names.

## API error handling
Display:
- actionable error message
- affected resource/action
- retry where safe
- fallback action where the product specifies one

Never turn a business state into a generic "Something went wrong."
