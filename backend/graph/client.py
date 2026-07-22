"""
Reusable Neo4j client — one shared, pooled driver for the whole app.

The neo4j `Driver` is thread-safe and connection-pooled: create ONE and reuse it.
Never open a driver per request. Always pass query parameters (never string-format
values into Cypher).

Usage (standalone):
    from backend.graph.client import get_client
    client = get_client()
    client.verify()
    rows = client.query("MATCH (p:Person) RETURN count(p) AS n")
    print(rows[0]["n"])
    client.close()

Usage (FastAPI): see backend/main.py — the driver is opened in the lifespan
startup and closed on shutdown; request handlers call get_client().
"""

from __future__ import annotations

from typing import Any

from neo4j import GraphDatabase, Driver, Record

from backend.config import settings


class Neo4jClient:
    def __init__(self, uri: str, user: str, password: str, database: str) -> None:
        # Lazy: this does NOT connect yet — the first query (or verify) does.
        self._driver: Driver = GraphDatabase.driver(uri, auth=(user, password))
        self._database = database

    def verify(self) -> None:
        """Fail fast if the DB is unreachable or auth is wrong."""
        self._driver.verify_connectivity()

    def query(self, cypher: str, **params: Any) -> list[Record]:
        """Run a Cypher statement with parameters; return the records."""
        records, _summary, _keys = self._driver.execute_query(
            cypher, database_=self._database, **params
        )
        return records

    def execute(self, cypher: str, **params: Any):
        """Run a write statement; return the result summary (counters, timing)."""
        _records, summary, _keys = self._driver.execute_query(
            cypher, database_=self._database, **params
        )
        return summary

    def close(self) -> None:
        self._driver.close()

    # allow `with Neo4jClient(...) as c:`
    def __enter__(self) -> "Neo4jClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


# --- module-level singleton (one driver per process) ----------------------- #
_client: Neo4jClient | None = None


def get_client() -> Neo4jClient:
    """Return the shared Neo4jClient, creating it on first use."""
    global _client
    if _client is None:
        _client = Neo4jClient(
            settings.neo4j_uri,
            settings.neo4j_user,
            settings.neo4j_password,
            settings.neo4j_database,
        )
    return _client


def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
