# Synthetic Cyber-Fraud Dataset Generator (India)

Generates a realistic transaction/entity dataset with **deliberately planted, discoverable
fraud rings** woven into legitimate background activity — so the platform's graph algorithms,
geospatial clustering, and ML models have real signal to find.

## Run

```bash
python -m venv .venv && source .venv/bin/activate      # first time
pip install numpy pandas networkx faker                # first time

python generate.py --seed 42 --out ../data
```

CLI flags: `--seed` (default 42), `--persons` (1500), `--rings` (3), `--transactions` (15000),
`--out` (data). Same `--seed` ⇒ byte-identical data CSVs.

On finish it prints an **ACCEPTANCE REPORT** — 8 PASS/FAIL self-checks proving the planted
patterns are actually present and discoverable. If any check FAILs, the data is unusable; do
not build on it.

## Output files

| File | What it is | Graph mapping |
|---|---|---|
| `persons.csv` | People: `person_id, name, role, account_age_days, district, state, lat, lng` | `:Person` nodes |
| `accounts.csv` | Bank accounts: `account_id, owner_person_id, bank, opened_date, kyc_level` | `:Account`, `(:Person)-[:OWNS]->(:Account)` |
| `upi.csv` | UPI VPAs: `upi_id, linked_account_id, handle` | `:UPI`, `(:UPI)-[:LINKED_TO]->(:Account)` |
| `phones.csv` | Phones: `phone_number, owner_person_id, is_spoofed, telecom_circle` | `:Phone`, `(:Person)-[:OWNS]->(:Phone)` |
| `devices.csv` | Devices: `device_id, os` | `:Device` |
| `device_usage.csv` | `person_id, device_id, timestamp` | `(:Person)-[:USES]->(:Device)` |
| `ips.csv` | IPs: `ip_address, geo_lat, geo_lng, is_vpn` | `:IP` |
| `logins.csv` | `person_id, ip_address, timestamp` | `(:Person)-[:LOGGED_IN_FROM]->(:IP)` |
| `transactions.csv` | `txn_id, from_account, to_account, amount_inr, timestamp, channel, status` | `(:Account)-[:SENT_MONEY]->(:Account)` |
| `ground_truth.csv` | Labels: `person_id, is_fraud, role, ring_id` — **never a model feature** | — |
| `ring_meta.csv` | Per-ring summary incl. `first_detectable_timestamp` (lead-time) | — |
| `manifest.json` | Seed, config, row counts, generation time | — |
| `GROUND_TRUTH.md` | Human-readable **answer key** — which ring to demo, the lead-time number | — |

## Labeling convention

`is_fraud = 1` for **perpetrators only** (`ringleader`, `scammer`, `mule`). **Victims are
`is_fraud = 0`** — they are victims, not offenders. `ring_id` is set for every entity involved
in a ring (including victims) so you can reconstruct the full network; use `role`/`is_fraud`
to separate offenders from victims.

## What is planted (and where to find it)

- **Fraud rings** — 1 hero ring (50 victims) + 2 secondary. Detect with community detection
  (Louvain / WCC on shared infra + money edges).
- **Ringleader** — the money funnel; **highest betweenness centrality** in the ring.
- **Shared infrastructure (the glue)** — mule accounts share one device (≥8 in the hero ring)
  and reuse a UPI handle (`group by handle having count>1`), plus a shared login IP.
- **Money trail** — `victim → mule → mule → ringleader → cash-out`; traceable with shortest-path.
- **Lead-time** — `first_detectable_timestamp` marks the 3rd victim (when shared infra becomes
  observable); most victims are defrauded *after* it. That gap is the Business-Impact number.
- **Geography** — victims spread across many districts/states; mules concentrated in 1–2
  hotspot districts (Jamtara, Nuh) → DBSCAN cluster + cross-jurisdiction story.
- **Structuring / velocity** — transfers just under ₹50,000; a mule burst (≥8 inflows in ~2h);
  fresh (low `account_age_days`) fraud accounts.
- **Background noise** — ~92% normal population + coincidental *innocent* shared device/IP, so
  fraud is not trivially separable and the model must distinguish coincidence from collusion.

## Loading into Neo4j

The CSVs map 1:1 to the graph model above. Load with `LOAD CSV` + `MERGE` per node/relationship
type after creating uniqueness constraints on the id columns (`person_id`, `account_id`,
`upi_id`, `device_id`, `ip_address`) — index first, then load.
