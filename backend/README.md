# Backend (FastAPI + in-process ML)

This folder is a **single Render service**. The ML pipeline under `ml/` is not
a second server and does not open its own database connection at runtime.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# set DATABASE_URL (Postgres)
```

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Health check: `GET /health`

## ML integration

- `ml/pipeline/demand-forecasting-01.pkl` is the checked-in inference artifact.
- `ml/pipeline/service.py` is the runtime adapter. It receives the existing
  SQLAlchemy `Session`, performs feature engineering/inference in-process, and
  upserts `daily_predictions`.
- Every `batch_x` transaction boundary calls that service before the transaction
  commits. The prediction and triggering negotiation are therefore part of the
  same DB transaction.
- `POST /internal/predictions/recompute` runs the same service for the whole
  current org and commits the results.
- The runtime pipeline does **not** create CSV files or a second SQLAlchemy
  engine.
- The older `data-collection.py`, `data-engineering.py`, `model.py`, and
  `evaluation.py` files remain maintenance/training scripts. They now use the
  backend's `DATABASE_URL` setting and resolve their files relative to
  `ml/pipeline/`.

## Render

Configure the Render service with:

- **Root directory:** `backend`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment:** `DATABASE_URL=...` and the existing application secrets.

No separate ML service, worker, HTTP endpoint, or `DB_URL` variable is needed
for prediction inference.

## Structure

- `app/core/` — settings, DB session, org-scoping identity dependency
- `app/models/` — SQLAlchemy models
- `app/schemas/` — Pydantic request/response schemas
- `app/routers/` — API routes
- `app/services/` — backend business logic and trigger integration
- `ml/pipeline/` — integrated inference service, model artifact, and offline
  training/evaluation utilities
- `lang/` — existing in-process agent bridge
