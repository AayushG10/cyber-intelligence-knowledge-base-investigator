# 🛡️ CyberInvestigator — AI Fraud Network Intelligence

**See the fraud network, not just the transaction.**

An AI investigation platform for law-enforcement and financial-crime units. It ingests
transaction & complaint data, **detects coordinated fraud rings**, identifies the
**ringleader**, traces the **money trail**, maps **cross-jurisdiction** spread, answers
investigator questions via a **tool-calling AI agent**, and generates **tamper-evident,
court-admissible intelligence packages** — shifting from reactive case work to proactive
network detection *before* mass victimisation.

Built for the *AI for Digital Public Safety* national hackathon
(theme: Defeating Counterfeiting, Fraud & Digital Arrest Scams).

> 📄 See [AGENTS.md](AGENTS.md) for the full architecture, design decisions, and the
> reasoning behind every technical choice — read that first if you're extending this project.
>
> 📝 **Written submission document**: [`docs/submission-document.docx`](docs/submission-document.docx)
>
> 🎤 **Presentation deck**: [`docs/presentation-deck.pptx`](docs/presentation-deck.pptx)
>
> 🎬 **Demo video script**: [`docs/demo-video-script.md`](docs/demo-video-script.md) — shot-by-shot recording script with exact narration

---

## 👋 New to this repo? Start here

If you're a teammate picking this up cold, read in this order — it's about 15 minutes to
full context:

1. **This section + "What this project does" below** (2 min) — the concept in plain language.
2. **[Architecture at a glance](#architecture-at-a-glance)** (3 min) — the shape of the system.
   The same diagram is also on the landing page (`http://localhost:5173`, scroll to "System
   architecture") if you prefer a visual.
3. **[Getting started](#getting-started)** (5 min, hands-on) — get it running on your machine.
4. **[Frontend component map](#frontend-component-map)** and **[Backend module map](#backend-module-map)**
   (5 min) — know which file to open for what you're changing.
5. Only if you're touching detection logic or making an architectural change: read
   [AGENTS.md](AGENTS.md) in full — it has the design rationale and two real corrections we
   found by testing (not just claiming) the algorithms against the data.

**The one-sentence mental model**: raw CSVs go in, a Python pipeline (`backend/engine.py`)
turns them into scored entities + detected fraud rings entirely in memory (no database
required to run), FastAPI exposes that as JSON, and a React app renders it as an
investigator's command centre. Neo4j and the LLM agent are optional add-ons wired in at the
edges — remove either one and the app still runs and still detects rings.

---

## Table of contents

1. [The problem](#the-problem)
2. [What this project does](#what-this-project-does)
3. [Screenshots](#screenshots)
4. [Architecture at a glance](#architecture-at-a-glance)
5. [Tech stack](#tech-stack)
6. [Project structure](#project-structure)
7. [Frontend component map](#frontend-component-map)
8. [Backend module map](#backend-module-map)
9. [Getting started](#getting-started)
10. [The synthetic dataset](#the-synthetic-dataset)
11. [How detection actually works](#how-detection-actually-works)
12. [The intelligence package (court admissibility)](#the-intelligence-package-court-admissibility)
13. [API reference](#api-reference)
14. [Common tasks (FAQ for teammates)](#common-tasks-faq-for-teammates)
15. [The 5-minute demo script](#the-5-minute-demo-script)
16. [Judging-criteria mapping](#judging-criteria-mapping)
17. [Roadmap](#roadmap)
18. [Disclaimer](#disclaimer)

---

## The problem

- **1.14 million** cybercrime complaints were registered in India in 2023 — up **60%** year
  over year (Ministry of Home Affairs).
- **Digital arrest scams** — fraudsters impersonating CBI/ED/Customs officers — defrauded
  citizens of over **₹1,776 crore** in just the first nine months of 2024.
- These are **industrialised operations**: fraud compounds, spoofed numbers, mule account
  networks, often spanning multiple states.
- What investigators lack isn't evidence after the fact — it's **intelligence before mass
  victimisation**, and tools that reveal the *whole network*, not one flagged transaction
  at a time.

## What this project does

Instead of a fraud *classifier*, CyberInvestigator is a fraud *network intelligence
platform*. Given raw transaction/complaint data, it:

1. **Detects coordinated fraud rings** — not just individually suspicious accounts — using
   graph community detection over shared devices, UPI handles, and money flow.
2. **Names the ringleader** — via betweenness centrality on the directed money-flow graph
   (the entity all the money funnels through).
3. **Scores every entity explainably** — a transparent rule engine + unsupervised anomaly
   detection + a supervised model are fused into one score, and every flag ships with
   human-readable reasons ("Shares a device with 9 other accounts", "3 transfers just under
   ₹50,000").
4. **Reconstructs the lead-time story** — exactly when a ring became detectable versus how
   many victims fell *after* that point. This is the number that proves prevention was
   possible, not just detection after the fact.
5. **Maps cross-jurisdiction spread** — DBSCAN geo-clustering plus a live map show a ring's
   victims and mule accounts spanning districts and states that no single police station
   would ever see in isolation.
6. **Answers investigator questions live** — a tool-calling LLM agent queries the case graph
   in real time and must cite entity/transaction IDs for every claim. It reasons over
   already-computed evidence; it does not classify fraud itself.
7. **Seals court-admissible evidence** — one click produces a SHA-256 **hash-chained**
   Intelligence Package. Any later tampering with a past record breaks the chain and is
   provably detectable.

---

## Screenshots

> Run the app locally and drop your own captures into
> [`docs/screenshots/`](docs/screenshots/) using the filenames documented there
> (`landing.png`, `dashboard-overview.png`, `dashboard-map.png`, `dashboard-agent.png`,
> `dashboard-evidence.png`, `entity-drawer.png`) — this section will then render them.

| Screen | What it shows |
|---|---|
| **Landing page** (`/`) | Problem stats, live KPI strip, pipeline walkthrough, **system architecture diagram**, feature grid |
| **Command centre — Overview** | Interactive fraud-ring graph (Cytoscape), ringleader highlighted gold, risk-colored nodes, lead-time intelligence panel |
| **Command centre — Map** | Leaflet map of hotspots + the selected ring's cross-jurisdiction money flow |
| **Command centre — Agent** | Tool-calling investigation agent answering a question with cited entity IDs |
| **Command centre — Evidence** | One-click hash-chained Intelligence Package, SHA-256 + chain-integrity check |
| **Entity dossier drawer** | Click any node → explainable per-entity risk breakdown (rule/anomaly/ML scores + reasons) |

---

## Architecture at a glance

> ✏️ **Editable diagram**: [`docs/architecture.excalidraw`](docs/architecture.excalidraw) —
> open it at [excalidraw.com](https://excalidraw.com) (menu → Open) or with the
> [Excalidraw VS Code extension](https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor)
> to view or edit it directly — the same diagram is also embedded on the landing page
> (scroll to "System architecture").

```
CSV Upload → Validation → Entity Resolution (deterministic)
  → Feature Engineering (velocity + graph-derived features)
  → Rule Engine + IsolationForest + supervised model → Score Fusion
  → In-process graph build (NetworkX)
  → Louvain (rings) · Betweenness (ringleader) · WCC (mule nets) · shortest-path (money trail)
  → DBSCAN (geo hotspots)
  → Investigation API (FastAPI)
  → Tool-calling LLM Agent (OpenRouter, cites entity/txn IDs)
  → Hash-chained Intelligence Package
  → React command centre (graph + map + agent + evidence)
```

Two decisions worth calling out:

- **Detection runs in-process (NetworkX + pandas + scikit-learn), not in a graph database.**
  Neo4j Aura (the free/standard tier) does **not** ship the Graph Data Science library, so
  rather than depend on it, every algorithm (Louvain, betweenness, WCC, shortest-path) runs
  directly against the data in Python. Neo4j is wired in as an **optional** storage/visualization
  layer (see `backend/graph/`), not a hard dependency — the whole app runs and detects rings
  with zero external services.
- **The LLM agent is tool-calling, not a summarizer.** It's given read-only tools
  (`get_entity`, `get_ring`, `get_shared_devices`, `money_trail`, `list_rings`) and must decide
  which to call and cite IDs for every claim. Classification stays in the deterministic
  scoring pipeline; the LLM only reasons over already-computed evidence. Without an API key
  it falls back to a deterministic, still evidence-grounded answer — the demo works with
  zero keys.

Full rationale for every architectural choice, including two corrections found by actually
running the detection algorithms against the data (see §6 of AGENTS.md), lives in
[AGENTS.md](AGENTS.md).

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind v4 | Fast dev loop, typed API client, no CSS build headaches |
| Graph visualization | Cytoscape.js | Renders straight from JSON; no graph DB required |
| Map | Leaflet + OpenStreetMap | Zero API key, works offline-ish, no vendor lock-in |
| Backend | FastAPI (Python) | Modular monolith — clean internal boundaries, one process to run |
| Detection engine | NetworkX + pandas + scikit-learn | Every graph algorithm needed (Louvain/betweenness/WCC/shortest-path) ships free, no GDS dependency |
| ML | RandomForest + IsolationForest (rule engine on top) | Explainable, small-data-friendly; a straightforward swap to XGBoost + SHAP is documented as a roadmap item |
| Graph database (optional) | Neo4j Aura | Storage + Bloom visualization; not required for detection |
| LLM | OpenRouter (OpenAI-compatible) | One key, swap models via a string; tool-calling required |
| Ledger | SHA-256 hash chain (flat JSON) | Tamper-evident audit trail with zero infrastructure |

---

## Project structure

```
et-hackthon/
├── AGENTS.md                  # architecture, design rationale, decisions log
├── README.md                  # this file
├── data_generator/
│   ├── generate.py            # synthetic dataset generator (deterministic, seed-based)
│   ├── README.md               # dataset schema + what's deliberately planted
│   └── requirements.txt
├── data/                       # generated CSVs + GROUND_TRUTH.md (the answer key)
├── backend/
│   ├── engine.py               # core pipeline: load → graphs → features → score → detect → geo
│   ├── ledger.py                # hash-chained intelligence packages
│   ├── agent.py                 # OpenRouter tool-calling agent (+ offline fallback)
│   ├── api.py                   # REST endpoints
│   ├── config.py                # env-driven settings
│   ├── main.py                  # FastAPI app, serves the fallback dashboard
│   ├── graph/                   # Neo4j client, connection/capability checker, optional CSV loader
│   ├── static/dashboard.html    # no-build fallback single-page dashboard
│   └── requirements.txt
├── frontend/                    # React command centre (the primary UI)
│   ├── src/
│   │   ├── App.tsx               # landing ⇄ dashboard routing (hash-based, no router lib)
│   │   ├── api.ts, types.ts       # typed API client + shared TS interfaces
│   │   ├── components/
│   │   │   ├── Landing.tsx         # marketing/landing page (hero, architecture diagram, features)
│   │   │   ├── TopBar.tsx, RingRail.tsx, GraphCanvas.tsx
│   │   │   ├── InvestigationPanel.tsx, EntityDrawer.tsx
│   │   │   ├── GlobeView.tsx        # rotating Canvas2D "AI globe" (no WebGL — see AGENTS.md)
│   │   │   ├── RiskGauge.tsx        # animated radial risk-score SVG gauge
│   │   │   └── tabs/ (Overview, Map, Agent, Evidence)
│   │   └── lib/
│   │       ├── ui.tsx               # shared risk-color/badge helpers
│   │       └── useCountUp.ts        # animated count-up number hook
│   └── package.json
├── infra/
│   └── docker-compose.yml       # optional Neo4j (GDS+APOC) + Postgres for local dev
├── .env.example                 # every config variable, documented
└── docs/
    ├── architecture.excalidraw    # editable architecture diagram (open at excalidraw.com)
    ├── submission-document.docx   # written submission report (Word)
    ├── presentation-deck.pptx     # hackathon pitch deck
    ├── demo-video-script.md       # shot-by-shot recording script
    └── screenshots/               # drop your own captures here
```

---

## Frontend component map

A quick "which file do I open" reference — every component in `frontend/src/components/`:

| File | Responsibility | Touch this when... |
|---|---|---|
| `App.tsx` | Top-level routing between the landing page and the dashboard (a hash check, no router library) | You're adding a new top-level view/page |
| `Landing.tsx` | Marketing page: hero, problem stats, pipeline walkthrough, **architecture diagram**, feature grid | You're changing the pitch/messaging or the architecture diagram |
| `TopBar.tsx` | Header KPI strip with animated count-up numbers | You're adding a new headline metric |
| `RingRail.tsx` | Left sidebar list of detected rings, each with a radial risk gauge | You're changing how rings are listed/selected |
| `GraphCanvas.tsx` | The Cytoscape.js fraud-network graph — node/edge styling, hover-to-focus, money-trail tracing, the ringleader pulse animation | You're changing how the graph looks or behaves |
| `InvestigationPanel.tsx` | Right-side panel: the 4-tab switcher (Overview/Map/Agent/Evidence) with the sliding pill indicator | You're adding a new tab |
| `EntityDrawer.tsx` | Slide-in drawer with an entity's full explainable risk breakdown, opened by clicking any graph node | You're changing what's shown about a single entity |
| `RiskGauge.tsx` | Reusable animated SVG radial gauge (used in `RingRail` and `EntityDrawer`) | You need a risk/score visual elsewhere |
| `GlobeView.tsx` | The rotating "AI globe" inside the Map tab — pure Canvas2D, no WebGL/three.js (see AGENTS.md for why) | You're changing the globe's visuals or projection math |
| `tabs/OverviewTab.tsx` | Ring stats + the lead-time intelligence callout | Changing the ring-detail summary |
| `tabs/MapTab.tsx` | Globe/Tactical-map toggle + the Leaflet flat map | Changing map behavior |
| `tabs/AgentTab.tsx` | Chat UI for the tool-calling agent | Changing the agent's chat experience |
| `tabs/EvidenceTab.tsx` | "Generate Intelligence Package" button + hash-chain display | Changing evidence-package presentation |
| `lib/ui.tsx` | `riskColor`, `riskLevel`, `bandColor`, `RiskBadge`, `Stat` — shared small helpers | Adding a new shared visual primitive |
| `lib/useCountUp.ts` | The count-up-animation hook used by KPI numbers | Reusing the count-up effect elsewhere |

## Backend module map

Everything under `backend/`, in the order data flows through them:

| File | Responsibility |
|---|---|
| `config.py` | Loads all environment variables into one `Settings` object |
| `engine.py` | **The core**: loads CSVs, builds the money/entity graphs, engineers features, runs the rule engine + IsolationForest + RandomForest, runs Louvain/betweenness/WCC/shortest-path/DBSCAN, and exposes query methods (`get_ring`, `get_entity`, `money_trail`, etc.) — this is a singleton built once at startup |
| `ledger.py` | Builds an "Intelligence Package" from a ring and appends it to the SHA-256 hash chain (`data/ledger.json`) |
| `agent.py` | The OpenRouter tool-calling agent — tool schemas, dispatch, and the offline deterministic fallback |
| `api.py` | All `/api/*` REST routes; thin — it calls into `engine.py`/`ledger.py`/`agent.py` |
| `main.py` | FastAPI app setup, builds the engine at startup, serves the fallback static dashboard |
| `graph/client.py` | A pooled, reusable Neo4j driver singleton |
| `graph/check_connection.py` | Standalone script: verifies Neo4j connectivity and reports GDS/APOC availability |
| `graph/neo4j_loader.py` | Standalone script: loads the CSVs into Neo4j (optional, for Bloom visualization) |

---

## Getting started

### Prerequisites
- Python 3.11+
- Node.js 18+ / npm
- (Optional) an [OpenRouter](https://openrouter.ai/keys) API key for the live agent
- (Optional) a [Neo4j Aura](https://console.neo4j.io) instance for graph storage/visualization

### 1. Backend — generate data + run the API

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

# Generate the synthetic dataset (deterministic; embeds 3 discoverable fraud rings)
python data_generator/generate.py --out data
# Prints an ACCEPTANCE REPORT — must be ALL PASS before proceeding

python -m uvicorn backend.main:app --port 8010
```

Verify: `curl http://localhost:8010/health` → `{"status":"up","rings_detected":3,...}`

### 2. Frontend — the React command centre

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api to :8010)
```

Open **http://localhost:5173** — you'll land on the marketing page; click
**"Launch command centre"** to enter the app (or go straight to `http://localhost:5173/#app`).

A no-build fallback dashboard is also served directly by the backend at
`http://localhost:8010` if you don't want to run the Node toolchain at all.

### 3. Optional: enable the live LLM agent

```bash
cp .env.example .env
# set OPENROUTER_API_KEY and LLM_MODEL (must support tool/function calling, e.g.
# anthropic/claude-sonnet-4 or openai/gpt-4o-mini)
```
Without a key, `/api/agent/ask` returns a deterministic, still evidence-grounded answer —
nothing breaks.

### 4. Optional: load the graph into Neo4j

```bash
# set NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD / NEO4J_DATABASE in .env, then:
python -m backend.graph.check_connection   # verify connectivity + report GDS/APOC availability
python -m backend.graph.neo4j_loader        # load CSVs into Neo4j (constraints, then batched MERGE)
```
Detection does **not** require this step — it's purely for storage/Bloom visualization.

### 5. Optional: docker-compose for local Neo4j + Postgres

```bash
docker compose -f infra/docker-compose.yml up -d
```

---

## The synthetic dataset

`data_generator/generate.py` produces a fully deterministic (`--seed 42`), India-realistic
dataset: ~1,500 persons, ~15,000 transactions, across devices/UPI/phones/IPs — with **3
deliberately planted fraud rings** embedded in legitimate background traffic, so detection
has real signal to find (not just a lookup table).

Every planted pattern is validated by an **8-point acceptance report** the generator prints
on every run (ringleader has max betweenness, a device is shared by ≥8 mules, a money-trail
path exists, geo spread matches the cross-jurisdiction story, etc.) — if any check fails,
the data is unusable and the script says so explicitly.

`data/GROUND_TRUTH.md` is the human-readable answer key: which ring is the "hero" ring, its
ringleader's ID, the lead-time number, and the districts/states it spans. It doubles as the
demo script.

Full schema and column reference: [`data_generator/README.md`](data_generator/README.md).

---

## How detection actually works

| Task | Algorithm | Notes |
|---|---|---|
| Find the fraud ring | **Louvain community detection** (NetworkX) over an entity graph combining money edges + shared-device + shared-UPI edges | Verified to recover the planted hero ring at 100% purity |
| Identify the ringleader | **Betweenness centrality** on the *directed* money-flow graph | The ringleader is the funnel all money passes through — **not** the highest in-degree node (that's usually a mule; don't confuse the two) |
| Find mule networks | **Weakly connected components** | Groups the fraud sub-network as one connected mass |
| Trace the money | **Shortest path** over `SENT_MONEY` edges | Victim → mule → mule → ringleader → cash-out, the "follow the money" view |
| Geo hotspots | **DBSCAN** on entity lat/lng (haversine metric) | Finds a geographic cluster independent of administrative boundaries |
| Per-entity risk | Rule engine (transparent, additive, human-readable reasons) **fused with** an IsolationForest anomaly score **and** a supervised RandomForest | Fusion never scores below what the transparent rules alone would say — explainability is never sacrificed for the ML score |

⚠️ **A note on what NOT to claim**: raw graph degree fed into the supervised classifier did
**not** improve per-entity fraud detection in testing — the graph's proven value here is
**ring-level intelligence** (the network, the ringleader, the money trail), not a boosted
per-transaction score. See AGENTS.md §6 for the full writeup, including the PageRank vs.
betweenness distinction (PageRank surfaces mules, not the ringleader).

---

## The intelligence package (court admissibility)

Each sealed "Intelligence Package" (`backend/ledger.py`) contains: the ring summary, the
lead-time statement, the ringleader with its evidentiary basis, every flagged entity with
its reasons, the money-trail path, and the algorithms used to produce it. The package is
serialized deterministically and hashed with SHA-256; **each new package's hash is chained
to the previous package's hash** — a minimal blockchain-style ledger. If any past package is
edited, its stored hash no longer matches a recomputation, and every later link in the chain
breaks. `GET /api/ledger/verify` recomputes the entire chain on demand and reports the first
broken link, if any — this is the concrete, checkable answer to the brief's requirement that
intelligence packages be **auditable for legal admissibility**.

---

## API reference

All endpoints are served under `/api` (see `backend/api.py`):

| Endpoint | Method | Purpose |
|---|---|---|
| `/kpis` | GET | Headline metrics (entities, rings, flagged, amount at risk) |
| `/rings` | GET | All detected rings, ranked by risk |
| `/rings/{id}` | GET | Ring detail — members, edges, ringleader, lead-time stats |
| `/entities/{id}` | GET | Entity risk scores, explainable reasons, features |
| `/entities/{id}/timeline` | GET | Chronological activity for an entity |
| `/entities/{id}/devices` | GET | Shared-device evidence for an entity |
| `/geo/hotspots` | GET | District hotspots + DBSCAN geo clusters |
| `/agent/ask` | POST | `{"question": "..."}` → tool-calling agent answer + tools used |
| `/rings/{id}/package` | POST | Generate & append a hash-chained intelligence package |
| `/ledger/verify` | GET | Verify the entire hash chain is intact |

---

## Common tasks (FAQ for teammates)

**"I changed a backend file and nothing happens."**
`uvicorn` needs `--reload` to pick up changes automatically: `uvicorn backend.main:app --reload --port 8010`.
Without it, restart the process manually after each edit.

**"I want to regenerate the data with different numbers (more rings, more people, etc.)."**
`python data_generator/generate.py --persons 3000 --rings 5 --out data` — see
`data_generator/README.md` for all flags. Re-run always overwrites `data/*.csv`; the acceptance
report at the end must show all PASS.

**"I want to change which LLM model the agent uses."**
One line in `.env`: `LLM_MODEL=anthropic/claude-sonnet-4` (or any OpenRouter model — it must
support tool/function calling, verify at openrouter.ai/models). No code change needed.

**"I want to add a new detection algorithm / feature."**
It belongs in `backend/engine.py`. Follow the existing pattern: build the feature in
`_features()`, add scoring logic in `_score()`, or add ring-level logic in `_detect_rings()`.
Add a query method at the bottom if the frontend needs to read the new data, then expose it
in `backend/api.py`.

**"I want to add a new page/tab to the frontend."**
For a new investigation tab: add a file under `frontend/src/components/tabs/`, then wire it
into the `TABS` array and switch statement in `InvestigationPanel.tsx`. For a new top-level
page: add the component and extend the `view` state logic in `App.tsx`.

**"The agent isn't citing IDs / seems to be hallucinating."**
Check `backend/agent.py` — the `SYSTEM` prompt is what enforces citation behavior, and the
`TOOLS` array is what it's allowed to call. If you added new engine query methods, add a
matching tool schema + dispatch case so the agent can actually reach that data.

**"Neo4j connection isn't working."**
Run `python -m backend.graph.check_connection` — it reports the exact failure (wrong
username, instance paused, no GDS, etc.) rather than a generic error. Remember: on Aura the
username and database are literally `neo4j`, not your instance ID.

**"Tests? CI?"**
None yet — this is a hackathon build. The closest thing to a test suite is the data
generator's built-in 8-point acceptance report and manual verification via the running app.
If you add real tests, `backend/` is plain enough for `pytest` to drop in without restructuring.

---

## The 5-minute demo script

1. **The problem** (20s): "1.14M complaints a year. Police get them one at a time, after the
   money's gone."
2. **Landing page → Launch command centre.**
3. **Graph view**: point at the auto-detected ring, the gold ringleader node, the red
   mule cluster.
4. **Lead-time reveal**: read the panel — "detectable at victim #3, yet N more victims fell
   afterward." This is the Business Impact number.
5. **Map view**: same ring, now visibly spanning multiple states — "no single police station
   would ever see this whole picture; we do."
6. **Agent tab**: ask "why is this ring's leader suspicious?" — watch it call tools and cite
   entity IDs.
7. **Evidence tab**: click **Generate Intelligence Package** — "hash-chained, tamper-evident,
   ready to hand to a prosecutor."
8. **Close**: one line on scaling — batch pipeline today, queue-based ingestion for national
   volume tomorrow.

---

## Judging-criteria mapping

| Criterion | Weight | Where this project answers it |
|---|---|---|
| Innovation | 25% | Tool-calling evidence-citing agent + hash-chained court-admissible packages |
| Business Impact | 25% | The lead-time number — quantified victims-prevented-if-acted-earlier |
| Technical Excellence | 20% | Real graph algorithms (Louvain/betweenness/WCC/shortest-path), explainable fused scoring, verified against the actual data (not just claimed) |
| Scalability | 15% | Modular monolith with a clear microservice-split story; batch pipeline documented as the production path |
| UX | 15% | One coherent command centre — graph, map, agent, and evidence in one flow, not five disconnected screens |

---

## Roadmap

- [ ] Swap RandomForest → XGBoost + SHAP for per-feature attribution charts in the entity drawer
- [ ] Wire the graph view to optionally read live from Neo4j (when GDS/Aura available)
- [ ] Citizen-facing lightweight fraud-check widget reusing the same backend (stretch goal)
- [ ] Queue-based ingestion (e.g. batch → streaming) for the national-scale story

## Disclaimer

Built for a national AI hackathon on **entirely synthetic data**. Not connected to any real
financial system, law-enforcement database, or citizen data. Not for production use as-is —
see the Roadmap and AGENTS.md for what a production hardening pass would require
(authentication, real data governance, PII handling, formal legal review of the evidence
package format).
