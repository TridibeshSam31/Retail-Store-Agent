# Frontend Architecture

## Recommended structure
Use the project's existing framework conventions. If no structure exists, prefer:

src/
  app/
  components/
    ui/
    layout/
    activity/
    inventory/
    negotiations/
    transfers/
    suppliers/
    predictions/
  features/
    inventory/
    negotiations/
    suppliers/
    predictions/
    transfers/
  lib/
    api/
    auth/
    formatting/
  types/
  hooks/

## Rules
- Components should be composable.
- Feature modules own feature-specific UI and data hooks.
- API client is centralized.
- API schemas/types are centralized.
- Presentation mapping is separate from transport types.
- Avoid giant page components.
- Avoid duplicated status mapping.
- Keep business rules in backend; frontend presents and confirms them.
- The frontend must never calculate a new transfer allocation or invent a negotiation result.
