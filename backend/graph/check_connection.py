#!/usr/bin/env python3
"""
Neo4j connectivity + capability checker.

Verifies the connection AND reports whether GDS / APOC are available, so we know
before building whether to run graph algorithms in-database (GDS) or in-process
(NetworkX). Reads credentials from the environment / a .env file — never from code.

Usage:
    1. cp .env.example .env   (once)
    2. set NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD / NEO4J_DATABASE in .env
    3. ./.venv/bin/python backend/graph/check_connection.py
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError, ServiceUnavailable, AuthError


def main() -> int:
    load_dotenv()

    uri = os.getenv("NEO4J_URI", "neo4j+s://03050b8d.databases.neo4j.io")
    user = os.getenv("NEO4J_USER", "neo4j")          # Aura default is "neo4j"
    password = os.getenv("NEO4J_PASSWORD", "")
    database = os.getenv("NEO4J_DATABASE", "neo4j")  # Aura default is "neo4j"

    print("=" * 62)
    print("NEO4J CONNECTION + CAPABILITY CHECK")
    print("=" * 62)
    print(f"  URI       : {uri}")
    print(f"  User      : {user}")
    print(f"  Database  : {database}")
    print(f"  Password  : {'<set>' if password and password != 'change_me_local_only' else '<MISSING>'}")
    print("-" * 62)

    if not password or password in ("", "change_me_local_only", "<password>"):
        print("  ✗ NEO4J_PASSWORD is not set.")
        print("    Put your real Aura password in .env (NEO4J_PASSWORD=...) and re-run.")
        print("    Tip: on Aura the username & database are 'neo4j', not the instance id.")
        return 2

    try:
        with GraphDatabase.driver(uri, auth=(user, password)) as driver:
            # 1) connectivity
            driver.verify_connectivity()
            print("  ✓ Connectivity OK — a working connection was established.")

            # 2) server version / edition
            try:
                recs, _, _ = driver.execute_query(
                    "CALL dbms.components() YIELD name, versions, edition "
                    "RETURN name, versions, edition",
                    database_=database,
                )
                for r in recs:
                    print(f"  ✓ Server: {r['name']} {r['versions'][0]} ({r['edition']} edition)")
            except Neo4jError as e:
                print(f"  ! Could not read server components: {e.code}")

            # 3) trivial write+read round-trip (uses a throwaway label, then cleans up)
            try:
                driver.execute_query(
                    "CREATE (n:_HealthCheck {ts: timestamp()})", database_=database)
                recs, _, _ = driver.execute_query(
                    "MATCH (n:_HealthCheck) RETURN count(n) AS c", database_=database)
                driver.execute_query("MATCH (n:_HealthCheck) DELETE n", database_=database)
                print(f"  ✓ Write/read/delete round-trip OK (wrote {recs[0]['c']} test node).")
            except Neo4jError as e:
                print(f"  ✗ Write test failed: {e.code} — check the user has write access.")

            # 4) GDS availability (our algorithms depend on this — or NetworkX fallback)
            try:
                recs, _, _ = driver.execute_query("RETURN gds.version() AS v", database_=database)
                print(f"  ✓ GDS library available: {recs[0]['v']}  -> can run gds.* algorithms.")
                gds = True
            except Neo4jError:
                print("  ✗ GDS library NOT available on this instance "
                      "(expected on AuraDB/Aura Free).")
                gds = False

            # 5) APOC availability
            try:
                recs, _, _ = driver.execute_query("RETURN apoc.version() AS v", database_=database)
                print(f"  ✓ APOC available: {recs[0]['v']}")
            except Neo4jError:
                print("  ! APOC not available (usually fine; APOC Core is on most Aura instances).")

        print("-" * 62)
        if gds:
            print("  VERDICT: Connection healthy, GDS present. Run algorithms in-database.")
        else:
            print("  VERDICT: Connection healthy, but NO GDS.")
            print("           -> Use Neo4j for STORAGE + visualization, and run Louvain /")
            print("              betweenness / WCC / shortest-path in NetworkX in-process")
            print("              (already proven on this dataset). No GDS needed.")
        print("=" * 62)
        return 0

    except AuthError:
        print("  ✗ AUTH FAILED — wrong username or password.")
        print("    On Aura the username is 'neo4j' (NOT the instance id). Reset the")
        print("    password in the Aura console if unsure, and update .env.")
        return 1
    except ServiceUnavailable as e:
        print(f"  ✗ CANNOT REACH the server: {e}")
        print("    Check the URI/scheme (Aura needs neo4j+s://), network, and that the")
        print("    instance is running (free instances pause after inactivity).")
        return 1
    except Exception as e:  # noqa: BLE001
        print(f"  ✗ Unexpected error: {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
