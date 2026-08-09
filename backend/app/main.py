from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="Multi-Store Agentic AI — Backend")

app.include_router(health.router)
