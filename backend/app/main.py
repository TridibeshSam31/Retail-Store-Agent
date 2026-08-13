from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    health, orgs, stores, store_distances, items, inventory_metadata,
    inventory, item_batches, transactions, lifespan_stats, predictions,
    suppliers, config, negotiations, transfers, supplier_contact, internal,
    analytics, identity,
)

app = FastAPI(title="Multi-Store Agentic AI - Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.1.6:3000"],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, PUT, etc.)
    allow_headers=["*"],  # Allows all headers
)

app.include_router(health.router)
app.include_router(orgs.router)
app.include_router(stores.router)
app.include_router(store_distances.router)
app.include_router(items.router)
app.include_router(inventory_metadata.router)
app.include_router(inventory.router)
app.include_router(item_batches.router)
app.include_router(transactions.router)
app.include_router(lifespan_stats.router)
app.include_router(predictions.router)
app.include_router(suppliers.router)
app.include_router(config.router)
app.include_router(negotiations.router)
app.include_router(transfers.router)
app.include_router(supplier_contact.router)
app.include_router(internal.router)
app.include_router(analytics.router)
app.include_router(identity.router)
