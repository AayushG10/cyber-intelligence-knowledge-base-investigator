# 🛡️ CyberInvestigator — AI Fraud Network Intelligence

An AI investigation platform for law-enforcement / financial-crime units. It ingests
transaction & complaint data, **detects coordinated fraud rings**, identifies the
**ringleader**, traces the **money trail**, maps **cross-jurisdiction** spread, and
generates **tamper-evident, court-admissible intelligence packages** — shifting from
reactive case work to proactive network detection *before* mass victimisation.

Built for the *AI for Digital Public Safety* national hackathon. See [AGENTS.md](AGENTS.md)
for the full architecture and design decisions.

---

## What it does (demo flow)

1. **Detects fraud rings** from raw transactions using graph community detection (Louvain).
2. **Names the ringleader** via betweenness centrality on the money-flow graph.
3. **Scores every entity** with a rule engine + anomaly detection + a supervised model, each
   with human-readable reasons (explainable AI).
4. **Reconstructs the lead-time story** — when the ring became detectable vs. how many victims
   fell afterward (the "we could have stopped it" number).
5. **Maps hotspots & cross-jurisdiction spread** (DBSCAN + Leaflet).
6. **Answers investigator questions** via a tool-calling LLM agent that cites entity IDs.
7. **Seals a court-admissible Intelligence Package** — hash-chained, tamper-evident.

Everything runs **in-process (NetworkX + pandas + scikit-learn)** — no GDS, no external
service required for the core demo. Neo4j and the LLM are optional enhancers.

---

## Quickstart

```bash
# 1. environment
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

# 2. generate the synthetic dataset (deterministic; embeds discoverable fraud rings)
python data_generator/generate.py --out data      # prints an ACCEPTANCE REPORT (must be all PASS)

# 3. run the backend (detection API + data)
python -m uvicorn backend.main:app --port 8010
```

### Frontend — React command centre (recommended UI)
```bash
cd frontend
npm install
npm run dev          # Vite dev server on http://localhost:5173 (proxies /api to :8010)
open http://localhost:5173
```

The React app (Vite + React + TypeScript + Tailwind) is the polished command centre:
graph, map, agent chat, and hash-chained evidence packages. A no-build fallback dashboard
is also served by the backend at `http://localhost:8010`.

That's it — the UI loads with 3 detected rings, an interactive network graph, a
cross-jurisdiction map, a live investigation agent, and court-admissible evidence packages.

### Optional: enable the LLM agent (OpenRouter)
```bash
cp .env.example .env       # set OPENROUTER_API_KEY and LLM_MODEL
```
Without a key the agent runs in **offline mode** with deterministic, evidence-grounded answers,
so the demo works with zero keys.

### Optional: load the graph into Neo4j (for Bloom visualization)
```bash
# set NEO4J_* in .env, then:
python -m backend.graph.check_connection      # verify connection + capabilities
python -m backend.graph.neo4j_loader          # load CSVs into Neo4j
```
Detection does **not** require Neo4j (Aura has no GDS) — it runs in NetworkX.

---

## API (served under `/api`)

| Endpoint | Purpose |
|---|---|
| `GET /api/kpis` | headline metrics |
| `GET /api/rings` | detected rings (ranked by risk) |
| `GET /api/rings/{id}` | ring detail: members, edges, ringleader, lead-time |
| `GET /api/entities/{id}` | entity risk, reasons, features |
| `GET /api/entities/{id}/timeline` · `/devices` | activity + shared-device evidence |
| `GET /api/geo/hotspots` | district hotspots + DBSCAN clusters |
| `POST /api/agent/ask` | tool-calling investigation agent |
| `POST /api/rings/{id}/package` | generate hash-chained intelligence package |
| `GET /api/ledger/verify` | verify the audit chain is intact |

---

## Project layout

```
data_generator/   synthetic dataset generator (+ GROUND_TRUTH.md answer key)
data/             generated CSVs
backend/
  engine.py       core pipeline: load → graphs → features → score → detect → geo
  ledger.py       hash-chained intelligence packages (court-admissibility)
  agent.py        OpenRouter tool-calling agent (offline fallback)
  api.py          REST endpoints
  main.py         FastAPI app + serves the dashboard
  graph/          Neo4j client, connection checker, optional loader
  static/         dashboard.html (single-page command centre)
infra/            docker-compose (Neo4j + Postgres, optional)
```

---

## Tech

FastAPI · NetworkX · scikit-learn · pandas · Neo4j (optional) · OpenRouter (optional) ·
Leaflet + Cytoscape (dashboard). See [AGENTS.md](AGENTS.md) for the why behind each choice.
# cyber-intelligence-knowledge-base-investigator
