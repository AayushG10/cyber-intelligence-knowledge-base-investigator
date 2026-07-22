"""
FastAPI entrypoint — modular monolith.

On startup it builds the InvestigationEngine (runs the whole detection pipeline
over ./data once, held in memory) and optionally verifies Neo4j. Serves the API
under /api and the single-page command centre at /.

Run:
    ./.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
Open http://localhost:8000
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.api import router as api_router
from backend.engine import get_engine
from backend.graph.client import close_client

log = logging.getLogger("uvicorn.error")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Building investigation engine from %s ...", settings.data_dir)
    eng = get_engine()
    k = eng.kpis()
    log.info("Engine ready: %d entities, %d rings detected, %d flagged.",
             k["entities"], k["rings_detected"], k["entities_flagged"])
    if settings.neo4j_password_set:
        try:
            from backend.graph.client import get_client
            get_client().verify()
            log.info("Neo4j connected (optional storage/viz).")
        except Exception as e:  # noqa: BLE001
            log.warning("Neo4j not reachable (optional): %s", e)
    yield
    close_client()


app = FastAPI(title="AI Cyber Investigation Platform", lifespan=lifespan)
app.include_router(api_router, prefix="/api")


@app.get("/health")
def health() -> dict:
    return {"status": "up", **get_engine().kpis()}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "dashboard.html"))


if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
