# Backend (FastAPI)

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL
```

## Run

```bash
uvicorn app.main:app --reload
```

Health check: `GET /health`

## Structure

- `app/core/` — settings, DB session, org-scoping auth dependency
- `app/models/` — SQLAlchemy models (mirrors the finalized DB schema)
- `app/schemas/` — Pydantic request/response schemas
- `app/routers/` — API route modules
- `app/services/` — business logic (prediction hookup, trigger listener, transfer confirmation, supplier drafts)