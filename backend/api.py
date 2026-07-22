"""REST API for the investigation platform. All read-only except package generation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.engine import get_engine
from backend.ledger import build_package, get_ledger

router = APIRouter()


@router.get("/kpis")
def kpis() -> dict:
    return get_engine().kpis()


@router.get("/rings")
def rings() -> list[dict]:
    return get_engine().list_rings()


@router.get("/rings/{ring_id}")
def ring(ring_id: str) -> dict:
    r = get_engine().get_ring(ring_id)
    if not r:
        raise HTTPException(404, f"ring {ring_id} not found")
    return r


@router.get("/entities/{person_id}")
def entity(person_id: str) -> dict:
    e = get_engine().get_entity(person_id)
    if not e:
        raise HTTPException(404, f"entity {person_id} not found")
    return e


@router.get("/entities/{person_id}/timeline")
def timeline(person_id: str) -> list[dict]:
    return get_engine().get_timeline(person_id)


@router.get("/entities/{person_id}/devices")
def devices(person_id: str) -> list[dict]:
    return get_engine().get_shared_devices(person_id)


@router.get("/geo/hotspots")
def hotspots() -> dict:
    e = get_engine()
    return {"hotspots": e.hotspots, "clusters": e.geo_clusters}


class AskBody(BaseModel):
    question: str


@router.post("/agent/ask")
def agent_ask(body: AskBody) -> dict:
    from backend.agent import ask
    return ask(body.question)


@router.post("/rings/{ring_id}/package")
def generate_package(ring_id: str) -> dict:
    """Generate a tamper-evident intelligence package and append it to the ledger."""
    pkg = build_package(get_engine(), ring_id)
    entry = get_ledger().append(pkg)
    return {"seq": entry["seq"], "this_hash": entry["this_hash"],
            "prev_hash": entry["prev_hash"], "created_at": entry["created_at"],
            "package": pkg}


@router.get("/ledger/verify")
def ledger_verify() -> dict:
    return get_ledger().verify()
