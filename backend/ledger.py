"""
Tamper-evident Intelligence Package generator + hash-chained audit ledger.

Each generated evidence package is serialized deterministically, hashed with
SHA-256, and CHAINED to the previous package's hash (blockchain-lite). If any
past package is altered, its hash no longer matches and every subsequent link
breaks — which is our answer to "auditability for legal admissibility".

The chain is persisted to data/ledger.json so it survives restarts.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any

from backend.engine import InvestigationEngine

GENESIS = "0" * 64


def _canonical(obj: Any) -> str:
    """Deterministic JSON (sorted keys, no whitespace drift) so the hash is stable."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class Ledger:
    def __init__(self, path: str) -> None:
        self.path = path
        self.entries: list[dict] = []
        if os.path.exists(path):
            with open(path) as f:
                self.entries = json.load(f)

    def _last_hash(self) -> str:
        return self.entries[-1]["this_hash"] if self.entries else GENESIS

    def append(self, package: dict) -> dict:
        prev = self._last_hash()
        payload = {
            "seq": len(self.entries) + 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "prev_hash": prev,
            "package": package,
        }
        payload["this_hash"] = _sha256(prev + _canonical(package))
        self.entries.append(payload)
        with open(self.path, "w") as f:
            json.dump(self.entries, f, indent=2, default=str)
        return payload

    def verify(self) -> dict:
        """Recompute the whole chain and report the first break, if any."""
        prev = GENESIS
        for e in self.entries:
            expect = _sha256(prev + _canonical(e["package"]))
            if e["prev_hash"] != prev or e["this_hash"] != expect:
                return {"intact": False, "broken_at_seq": e["seq"]}
            prev = e["this_hash"]
        return {"intact": True, "length": len(self.entries)}


def build_package(engine: InvestigationEngine, ring_id: str) -> dict:
    """Assemble a court-ready intelligence package for a detected ring."""
    ring = engine.get_ring(ring_id)
    if not ring:
        raise ValueError(f"ring {ring_id} not found")
    leader = ring["ringleader"]
    # money trail from a victim to the ringleader
    victim = next((n["id"] for n in ring["nodes"]
                   if not n["is_leader"] and n["risk"] < 0.5), None)
    trail = engine.money_trail(victim, leader) if victim else None

    flagged = [n for n in ring["nodes"] if n["risk"] >= 0.5]
    package = {
        "ring_id": ring_id,
        "summary": {
            "size": ring["size"], "n_mules": ring["n_mules"],
            "total_flow_inr": ring["total_flow_inr"],
            "cross_jurisdiction": ring["cross_jurisdiction"],
            "states": ring["states"], "districts": ring["districts"],
            "risk": ring["risk"],
        },
        "lead_time": {
            "first_detectable": ring["first_detectable"],
            "victims_after_detectable": ring["victims_after_detectable"],
            "statement": (
                f"Ring became detectable at {ring['first_detectable']}; "
                f"{ring['victims_after_detectable']} further victim payments occurred afterward."
            ) if ring["first_detectable"] else "insufficient data",
        },
        "ringleader": {
            "person_id": leader, "name": ring["ringleader_name"],
            "basis": "Highest betweenness centrality on the money-flow graph "
                     "(all flows funnel through this entity).",
        },
        "flagged_entities": [
            {"person_id": n["id"], "name": n["name"], "role": n["role"],
             "risk": n["risk"], "reasons": engine.scores.get(n["id"], {}).get("reasons", [])}
            for n in flagged
        ],
        "money_trail": trail,
        "evidence_basis": {
            "shared_infrastructure": "Mule accounts bound by shared device(s) and reused UPI handle.",
            "algorithms": ["Louvain community detection", "betweenness centrality",
                           "shortest-path money trail", "IsolationForest anomaly",
                           "supervised risk model"],
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    return package


_ledger: Ledger | None = None


def get_ledger() -> Ledger:
    global _ledger
    if _ledger is None:
        from backend.config import settings
        _ledger = Ledger(os.path.join(settings.data_dir, "ledger.json"))
    return _ledger
