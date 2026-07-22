# AGENTS.md — AI Cyber Investigation Platform

> Canonical context for any AI assistant or teammate working in this repo.
> Read this fully before writing code. It encodes decisions already made — do not re-litigate them.

---

## 1. What we are building

An **AI-powered Fraud Network Intelligence platform** for a national AI hackathon
(theme: *AI for Digital Public Safety — Defeating Fraud & Digital Arrest Scams*).

It is an **investigation tool for law enforcement / financial-crime units**, not a fraud
classifier. The job is to detect **fraud networks** (rings, mules, money trails), **explain why**
an entity is suspicious, and produce **court-admissible intelligence packages** — shifting from
reactive case investigation to proactive network detection *before* mass victimisation.

### Scope decision (LOCKED — do not expand)
The hackathon brief lists 5 possible tracks. We build **ONE deep**:

- ✅ **PRIMARY: Fraud Network Graph Intelligence** — graph AI mapping victims, mules, scammer
  infrastructure, and money trails into actionable, court-admissible intelligence packages.
- ✅ **SECONDARY (cheap add-on): Geospatial Crime Pattern Intelligence** — hotspot map +
  cross-jurisdiction ring overlay. Reuses the same data; ~half a day of work.
- ❌ **CUT — do not build:** Counterfeit-currency CV, real-time digital-arrest call interception,
  citizen WhatsApp/IVR bot (unless everything else is done), microservices, Kubernetes, GNNs,
  real external threat-intel feeds, ML-based entity resolution.

### The two moments that win the demo
Everything serves these. If a feature doesn't feed one, deprioritise it.
1. **Lead-time number** — "flagged this ring at victim #3, N days before the last victim." (Business Impact)
2. **Tamper-evident Intelligence Package** — one-click, hash-chained, court-admissible evidence bundle. (Innovation)

### Judging criteria (build toward the weights)
Innovation 25% · Business Impact 25% · Technical Excellence 20% · Scalability 15% · UX 15%.

---

## 2. Architecture

```
CSV Upload → Validation → Entity Resolution (DETERMINISTIC, not ML)
  → Feature Engineering (velocity + graph-derived features)
  → [ Rule Engine + XGBoost + Isolation Forest ] + Threat Intel (STATIC STUB)
  → Score Fusion + SHAP
  → SQL store (source of truth: cases, predictions, hash-chained AUDIT LEDGER)
  → batch rebuild → Neo4j (graph view)
  → Graph Algorithms (Louvain / betweenness / WCC / shortest-path) + Geospatial (DBSCAN)
  → Investigation API
  → Tool-calling LLM Agent (queries the API live, cites entity/txn IDs)
  → Intelligence Package Generator (hash-chained)  +  Command Centre UI
```

Key principles:
- **SQL = source of truth. Neo4j = derived, batch-rebuilt view.** No dual-write. This is the answer
  to "how do your two databases stay consistent?"
- **Modular monolith, not microservices.** Clean internal module boundaries that *could* split later.
- The LLM agent **reads the Investigation API via tools** — it is an investigator, not a summariser.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js + React + Tailwind | One command centre: graph view + map + case view + agent chat |
| Graph viz | Cytoscape.js or react-force-graph | Renders from JSON; does not require Neo4j |
| Map | **Leaflet + OpenStreetMap** (`react-leaflet`) | **No API key.** Pre-cache tiles for demo (venue wifi risk) |
| Backend | FastAPI + Python | Modular monolith |
| Graph DB | **Neo4j + GDS + APOC plugins** | Enable plugins at container start or `gds.*` errors |
| SQL DB | **SQLite for MVP via SQLAlchemy**, Postgres for prod | ORM makes it a one-line connection-string swap |
| ML | XGBoost / LightGBM + Isolation Forest + SHAP | No deep learning, no GNNs (unexplainable → contradicts court-admissibility) |
| LLM | **OpenRouter** (OpenAI-compatible gateway) | One key, swap models via a string. Use the OpenAI SDK with `base_url=https://openrouter.ai/api/v1`. Pick a **tool-calling-capable** model (e.g. `anthropic/claude-sonnet-4`; cheap fallback `openai/gpt-4o-mini`). Avoid `:free`/small models for the agent — weak/no tool support |
| Deploy | Docker Compose | One-command spin-up; judges will run it |

---

## 4. Repository structure (target)

```
et-hackthon/
├── AGENTS.md                 # this file
├── data_generator/           # ✅ BUILT — synthetic dataset generator
│   ├── generate.py
│   ├── requirements.txt
│   └── README.md
├── data/                     # ✅ generated CSVs + GROUND_TRUTH.md (the answer key)
├── backend/                  # FastAPI modular monolith (TO BUILD)
│   ├── ingestion/            # upload, validation, deterministic entity resolution
│   ├── features/             # feature engineering
│   ├── scoring/              # rule engine, XGBoost, IsoForest, threat-intel stub, fusion, SHAP
│   ├── graph/                # Neo4j client, LOAD CSV, GDS algorithm runners
│   ├── geo/                  # DBSCAN hotspots, cross-jurisdiction linking
│   ├── investigation/        # case + timeline + evidence-assembly API
│   ├── agent/                # tool-calling LLM agent + tool definitions
│   ├── ledger/               # hash-chained audit ledger + intelligence-package generator
│   └── main.py
├── frontend/                 # Next.js command centre (TO BUILD)
└── infra/
    └── docker-compose.yml    # neo4j (GDS+APOC) + postgres + backend + frontend
```

---

## 5. Data model

### 5a. The dataset (already generated in `data/`)
Synthetic, India-realistic, deterministic (`--seed 42`). See `data_generator/README.md`.
Contains **deliberately planted, discoverable fraud rings** in legitimate background traffic.
`GROUND_TRUTH.md` is the answer key AND the demo script (which ring to click, the lead-time number).

**Labeling convention (IMPORTANT):** `is_fraud = 1` for **perpetrators only**
(ringleader/scammer/mule). **Victims are `is_fraud = 0`** — they are victims, not offenders — but
still carry `ring_id`. Train the model to flag perpetrators; use `ring_id` to reconstruct networks.

### 5b. Neo4j graph model (CSV → graph mapping)
Nodes: `Person, Account, UPI, Phone, Device, IP, Transaction(as edge or node)`.
Relationships:
- `(:Person)-[:OWNS]->(:Account|:Phone)`
- `(:UPI)-[:LINKED_TO]->(:Account)`
- `(:Person)-[:USES {timestamp}]->(:Device)`
- `(:Person)-[:LOGGED_IN_FROM {timestamp}]->(:IP)`
- `(:Account)-[:SENT_MONEY {amount, timestamp, channel}]->(:Account)`

Write AI output **back into the graph**: put risk scores / community (ring) ids on nodes so the
agent and UI query findings graph-natively. Put properties **on relationships** (amount, timestamp),
never bare typed edges.

Load: create uniqueness constraints on id columns FIRST (`person_id, account_id, upi_id, device_id,
ip_address`), THEN `LOAD CSV` + `MERGE`. Indexing before load is a 100x difference.

### 5c. SQL model (SQLAlchemy)
Tables: `users, cases, uploaded_files, predictions (VERSIONED: model_version, score, created_at —
never overwrite), investigator_actions (human-in-the-loop feedback), intelligence_packages,
audit_ledger`.

**Audit ledger = the differentiator.** Each record stores `prev_hash` + `this_hash` (SHA-256 of the
record + prev_hash) forming a tamper-evident chain. If any past record is altered, the chain breaks
and we can prove it. This is our answer to "auditability for legal admissibility."

---

## 6. Graph algorithms — which tool for which job

| Job | Algorithm | Notes |
|---|---|---|
| Fraud rings | **Louvain** community detection (GDS) | Verified: recovers hero ring at 100% purity |
| Ringleader | **Betweenness centrality on the DIRECTED money graph** | Ringleader is the funnel |
| Mule / hub detection | **PageRank** | ⚠️ PageRank surfaces high-in-degree MULES, NOT the ringleader. Use betweenness for the ringleader, PageRank for mules. Do not swap these. |
| Mule networks | **WCC** (weakly connected components) | |
| Money trail | **shortest path** (Cypher `shortestPath()` or GDS dijkstra) | "follow the money" demo |
| Shared device/IP/UPI | Plain **Cypher** (no GDS) | `MATCH (a)-[:USES]->(d)<-[:USES]-(b)`; the mule-linkage glue |

⚠️ **Do NOT claim "graph features boost the per-transaction fraud classifier"** unless you engineer
real graph features (betweenness, community size, shared-device count) and measure a lift. In testing,
raw node-degree did NOT help. The graph's proven value is **ring-level intelligence** (network +
ringleader + money trail), not boosting a per-node score. Pitch it that way.

---

## 7. Geospatial layer

Pipeline: **get coordinates (offline) → store lat/lng → analyse → render.**
- Geocode by district against the static list baked into the generator — **keep it offline**, no map API.
- Analyse: `COUNT GROUP BY district` (hotspots), **DBSCAN** on lat/lng (`metric='haversine'`) for
  boundary-independent clusters, patrol-priority score `f(density, active-ring, recency, ₹loss)`.
- **The killer view:** plot a graph-detected ring's members on the map → it visibly spans multiple
  districts/states → "no single police station sees this whole ring; we do." That is the brief's
  cross-jurisdiction ask, delivered in one screen.

---

## 8. LLM agent — genuinely useful, not a chatbot

- Give it **read-only tools**: `query_entity_graph(id)`, `get_money_trail(a, b)`,
  `get_shared_devices(id)`, `get_timeline(id)`, `get_risk_explanation(id)`.
- It **decides which tools to call** to answer an investigator's question.
- **Every claim must cite entity/transaction IDs and timestamps.** No free-form narration over a
  context dump — that is the hallucination/chatbot trap.
- Keep **classification in XGBoost**; the LLM does reasoning/explanation/next-actions, never scoring.
- Rate-limit the agent endpoint (cost + abuse).
- **Provider = OpenRouter** via the OpenAI SDK (`base_url=https://openrouter.ai/api/v1`,
  `OPENROUTER_API_KEY`). Model is env-driven (`LLM_MODEL`) so it's swappable. The chosen model MUST
  support tool/function calling — verify on openrouter.ai/models before hardcoding.

---

## 9. Conventions & commands

- Python: 3.11+. Use the repo venv. Route ALL randomness through a seeded RNG — determinism matters.
- Regenerate data: `./.venv/bin/python data_generator/generate.py --out data`
- After generating, the **acceptance report** must show ALL PASS or the data is unusable.
- Never use `ground_truth.csv` / `ring_meta.csv` as model features — they are labels/answer key only.
- Parameterise all SQL and Cypher (no string-built queries). Validate CSV uploads (size, injection,
  path traversal). Basic JWT on the API.

---

## 10. Current status

| Component | Status |
|---|---|
| Synthetic data generator | ✅ Built, all 8 acceptance checks pass, deterministic, fitness-verified against real algorithms |
| Generated dataset (`data/`) | ✅ 1,500 persons, ~15k txns, 3 planted rings, GROUND_TRUTH.md answer key |
| Detection pipeline (Louvain/betweenness/WCC/shortest-path, in NetworkX) | ✅ `backend/engine.py` — detects all 3 rings, ID's ringleader |
| Feature engineering + rule engine + IsolationForest + supervised model + fusion | ✅ `backend/engine.py` — explainable per-entity scoring |
| Geospatial layer (DBSCAN + district hotspots + Leaflet map) | ✅ `backend/engine.py` + dashboard map tab |
| Hash-chained audit ledger + intelligence package | ✅ `backend/ledger.py` — verified tamper-evident chain |
| Investigation API | ✅ `backend/api.py` — full REST surface |
| Tool-calling agent (OpenRouter + offline fallback) | ✅ `backend/agent.py` |
| React command centre (graph + map + agent + evidence) | ✅ `frontend/` — Vite + React + TS + Tailwind, verified in browser |
| Fallback single-page dashboard (no build step) | ✅ `backend/static/dashboard.html` — served at backend `/` |
| Neo4j connection + client + loader | ✅ `backend/graph/` — connected to Aura, 7,365 nodes / 20,922 rels loaded |
| Live OpenRouter tool-calling agent | ✅ verified in UI — cites entity IDs |
| docker-compose (optional Neo4j + Postgres) | ✅ `infra/docker-compose.yml` |
| XGBoost/SHAP (currently RandomForest + rule reasons) | ⬜ Optional upgrade — swap RF→XGBoost, add SHAP for per-feature attributions |

---

## 11. The 5-minute demo (rehearse this exact path)

1. Problem: "1.14M complaints/year, handled one at a time, after the money's gone."
2. Upload complaint batch → pipeline runs → dashboard populates.
3. Graph view: "auto-clustered 40+ complaints into ONE ring." Point at the ringleader (betweenness).
4. Map view: same ring spans multiple districts/states → cross-jurisdiction.
5. **Lead-time reveal:** "flagged at victim #3; 47 more victims fell over the next 11 days." ← Business Impact
6. Ask the agent "why is account X the ringleader?" → it calls tools, answers with cited txn IDs.
7. Click **Generate Intelligence Package** → hash-chained, court-ready bundle. ← Innovation
8. Close: one slide — "batch pipeline now, queue-based ingestion for national scale next." ← Scalability
