# Demo Video Script — CyberInvestigator

A shot-by-shot recording script. Target runtime: **3–4 minutes**. Read narration at a
natural pace; don't rush — judges watching a recording forgive length far more than they
forgive a confusing pace.

---

## Before you hit record

1. **Reset to a clean state** so the demo tells a clean story:
   ```bash
   # regenerate data fresh (optional — only if you want brand-new numbers)
   python data_generator/generate.py --out data

   # reset the evidence ledger so you seal "Package #1" on camera, not #7
   echo "[]" > data/ledger.json
   ```
2. **Start both servers** and confirm they're healthy before recording:
   ```bash
   python -m uvicorn backend.main:app --port 8010
   cd frontend && npm run dev
   ```
   Check `http://localhost:8010/health` returns `rings_detected: 3` and
   `http://localhost:5173` loads the landing page.
3. **Close everything else** — Slack, notifications, other browser tabs. Full-screen the
   browser window at **1600×900 or larger** so text is crisp on a recording.
4. **Have `data/GROUND_TRUTH.md` open in a second window** — it has the exact ringleader
   name/ID and lead-time numbers so your narration is always accurate, never approximate.
5. Do **one full silent dry-run** of every click below before recording audio, so you're not
   discovering a slow API response or a misremembered button location on camera.

---

## Recording

### Scene 1 — The problem (0:00–0:20)

**Screen:** Blank/title card, or the landing page hero before scrolling.

**Say:**
> "India registered 1.14 million cybercrime complaints in 2023 — up 60% year over year.
> Digital arrest scams alone cost citizens over 1,776 crore rupees in just nine months.
> Police get this evidence one complaint at a time, after the money is already gone. What's
> missing isn't evidence — it's intelligence *before* mass victimisation. That's what we
> built."

---

### Scene 2 — Landing page walkthrough (0:20–0:45)

**Screen:** `http://localhost:5173` — scroll slowly through hero → problem stats →
architecture diagram.

**Say:**
> "This is CyberInvestigator — a fraud *network* intelligence platform, not another fraud
> classifier. It ingests transaction and complaint data, detects entire coordinated fraud
> rings, identifies the ringleader, and produces evidence a prosecutor can actually use."

**Action:** Click **"Launch command centre."**

---

### Scene 3 — The graph, live (0:45–1:20)

**Screen:** Command centre, Overview tab, DR07 (or your top ring) selected.

**Say:**
> "The system has already ingested this batch and automatically clustered dozens of
> complaints into one fraud ring — not by looking at one flagged transaction, but by
> finding the shared devices, shared UPI handles, and money flow that tie these accounts
> together."

**Action:** Point at (hover over) the gold ringleader node.

**Say:**
> "This gold node is the ringleader — identified automatically using betweenness
> centrality on the money-flow graph. Every rupee funnels through this one entity. This
> isn't a guess — it's graph math."

**Action:** Click the ringleader node to open the Entity Dossier drawer.

**Say:**
> "Click any entity and you get a full explainable breakdown — the rule engine, an anomaly
> score, a machine learning score, all fused into one number, with the actual reasons
> spelled out: shared device, fresh account, high fan-in. Nothing here is a black box."

**Action:** Close the drawer. Click **"Trace money trail."**

**Say:**
> "One click traces the actual money path — victim, to mule, to mule, to ringleader, to
> cash-out. This is the 'follow the money' view an investigator needs."

---

### Scene 4 — The lead-time reveal (1:20–1:50)

**Screen:** Overview tab, the amber "Lead-time intelligence" panel.

**Say:**
> "Here's the number that matters most. This ring became detectable at victim number
> three — yet [N, from GROUND_TRUTH.md] more victims were defrauded after that point. If
> we act at the moment of detection instead of waiting for a complaint, we stop the
> majority of the harm before it happens. That's the shift from reactive investigation to
> proactive prevention."

*(Read the exact number from `data/GROUND_TRUTH.md` — don't approximate on camera.)*

---

### Scene 5 — Cross-jurisdiction map / globe (1:50–2:20)

**Screen:** Click the **Map** tab (defaults to the rotating globe view).

**Say:**
> "The same ring, now on the map. Victims are scattered across multiple states — mules and
> cash-out accounts are concentrated in just one or two districts. No single police station
> would ever see this whole picture. We do."

**Action:** Toggle to **"Tactical map"** to show the flat cross-jurisdiction view with
hotspots.

**Say:**
> "This is a live cross-jurisdiction intelligence layer — exactly the kind of inter-district
> sharing the problem actually requires."

---

### Scene 6 — The investigation agent (2:20–2:55)

**Screen:** Click the **Agent** tab.

**Action:** Type (or click the suggestion chip): *"Who leads this ring and why?"*

**Say (while it's answering):**
> "Investigators can just ask. This isn't a chatbot summarizing a document — it's an agent
> that queries the actual case graph live and must cite entity and transaction IDs for
> every claim it makes. It reasons over evidence; it doesn't invent it."

**Action:** Let the answer finish rendering, point at the cited IDs and the "tools used"
line underneath the answer.

---

### Scene 7 — Sealing the evidence (2:55–3:25)

**Screen:** Click the **Evidence** tab.

**Say:**
> "And finally — the piece built specifically for legal admissibility."

**Action:** Click **"Generate Intelligence Package."** Wait for it to render.

**Say:**
> "One click seals every fact about this ring — the entities, the scores, the money trail,
> the lead-time — into a package hashed with SHA-256. Each new package is chained to the
> hash of the one before it. If anyone tampers with a past record, the chain breaks and we
> can prove it. This is a tamper-evident, court-ready evidence trail, generated
> automatically."

**Action:** Point at the SHA-256 hash and the "ledger integrity: INTACT" line.

---

### Scene 8 — Close (3:25–3:45)

**Screen:** Return to the Overview tab or the landing page KPI strip.

**Say:**
> "Detection today runs entirely in-process — no external graph database required — with a
> clear path to Neo4j and queue-based ingestion at national scale. CyberInvestigator: see
> the fraud network, not just the transaction. Thank you."

**Action (optional):** End on the landing page hero or a slide with the GitHub link.

---

## Recording tips

- **Screen-record at 1080p minimum**, browser zoomed to 100% (not the tool's internal test
  resolution) so text is legible when compressed for upload.
- **Record narration separately and mix in post** if you're not confident doing it live —
  cleaner audio matters more than judges realize.
- **Keep total runtime under 4 minutes.** If you're running long, cut Scene 5 (map) short
  rather than rushing the lead-time reveal (Scene 4) or the evidence seal (Scene 7) — those
  two are your Business Impact and Innovation moments respectively.
- **Do a final full run start-to-finish** before your real take — the first "Generate
  Intelligence Package" click of a session is always package #1; if you've already clicked
  it once while testing, either reset `data/ledger.json` again or just don't mention the
  package number out loud.
