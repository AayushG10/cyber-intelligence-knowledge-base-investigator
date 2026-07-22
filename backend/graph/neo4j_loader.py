"""
Optional: load the synthetic CSVs into Neo4j (storage + Bloom visualization).

Detection runs in NetworkX (engine.py) — Neo4j is NOT required for the app to
work. Use this only if you want the graph browsable in Neo4j Bloom / Browser.

Run (after setting NEO4J_PASSWORD in .env):
    ./.venv/bin/python -m backend.graph.neo4j_loader
"""

from __future__ import annotations

import os

import pandas as pd

from backend.config import settings
from backend.graph.client import get_client

CONSTRAINTS = [
    "CREATE CONSTRAINT IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (u:UPI) REQUIRE u.handle IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (d:Device) REQUIRE d.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (i:IP) REQUIRE i.ip IS UNIQUE",
]


def _rows(name: str) -> list[dict]:
    return pd.read_csv(os.path.join(settings.data_dir, f"{name}.csv")).to_dict("records")


def load() -> None:
    c = get_client()
    c.verify()
    print("Creating constraints (index-before-load)...")
    for stmt in CONSTRAINTS:
        c.execute(stmt)

    print("Loading Person + Account + OWNS...")
    c.execute("""
        UNWIND $rows AS r
        MERGE (p:Person {id: r.person_id})
          SET p.name=r.name, p.role=r.role, p.district=r.district,
              p.state=r.state, p.lat=r.lat, p.lng=r.lng, p.account_age=r.account_age_days
    """, rows=_rows("persons"))
    c.execute("""
        UNWIND $rows AS r
        MERGE (a:Account {id: r.account_id}) SET a.bank=r.bank
        WITH a, r MATCH (p:Person {id: r.owner_person_id}) MERGE (p)-[:OWNS]->(a)
    """, rows=_rows("accounts"))

    print("Loading UPI, Device usage, Logins...")
    c.execute("""
        UNWIND $rows AS r
        MERGE (u:UPI {handle: r.handle})
        WITH u, r MATCH (a:Account {id: r.linked_account_id}) MERGE (u)-[:LINKED_TO]->(a)
    """, rows=_rows("upi"))
    c.execute("""
        UNWIND $rows AS r
        MERGE (d:Device {id: r.device_id})
        WITH d, r MATCH (p:Person {id: r.person_id})
        MERGE (p)-[x:USES]->(d) SET x.timestamp=r.timestamp
    """, rows=_rows("device_usage"))
    c.execute("""
        UNWIND $rows AS r
        MERGE (i:IP {ip: r.ip_address})
        WITH i, r MATCH (p:Person {id: r.person_id})
        MERGE (p)-[x:LOGGED_IN_FROM]->(i) SET x.timestamp=r.timestamp
    """, rows=_rows("logins"))

    print("Loading SENT_MONEY (batched)...")
    txns = _rows("transactions")
    for i in range(0, len(txns), 2000):
        c.execute("""
            UNWIND $rows AS r
            MATCH (a:Account {id: r.from_account}), (b:Account {id: r.to_account})
            MERGE (a)-[t:SENT_MONEY {id: r.txn_id}]->(b)
              SET t.amount=r.amount_inr, t.timestamp=r.timestamp, t.channel=r.channel
        """, rows=txns[i:i + 2000])

    counts = c.query("MATCH (n) RETURN count(n) AS n")[0]["n"]
    rels = c.query("MATCH ()-[r]->() RETURN count(r) AS r")[0]["r"]
    print(f"Done. {counts} nodes, {rels} relationships in Neo4j.")


if __name__ == "__main__":
    if not settings.neo4j_password_set:
        raise SystemExit("Set NEO4J_PASSWORD in .env first.")
    load()
