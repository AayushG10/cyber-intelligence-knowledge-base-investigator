#!/usr/bin/env python3
"""
Synthetic dataset generator for an AI cyber-fraud investigation platform (India).

Generates a realistic transaction/entity dataset with DELIBERATELY PLANTED,
discoverable fraud rings woven into legitimate background activity, so that
downstream graph algorithms (Louvain / centrality / shortest-path), geospatial
clustering (DBSCAN), and ML models have real signal to find.

Everything is deterministic for a given --seed: the emitted data CSVs are
byte-identical across runs (only manifest.json's generation wall-clock differs).

Usage:
    python generate.py --seed 42 --out ../data
    python generate.py --persons 2000 --rings 3

Outputs (into --out): persons.csv, accounts.csv, upi.csv, phones.csv, devices.csv,
device_usage.csv, ips.csv, logins.csv, transactions.csv, ground_truth.csv,
ring_meta.csv, manifest.json, GROUND_TRUTH.md
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import networkx as nx
from faker import Faker


# --------------------------------------------------------------------------- #
# Static reference data
# --------------------------------------------------------------------------- #

# ~30 real Indian districts across 7 states with approximate centroid lat/lng.
# (district, state, lat, lng, telecom_circle)
DISTRICTS = [
    ("Mumbai", "Maharashtra", 19.0760, 72.8777, "Maharashtra"),
    ("Pune", "Maharashtra", 18.5204, 73.8567, "Maharashtra"),
    ("Nagpur", "Maharashtra", 21.1458, 79.0882, "Maharashtra"),
    ("Thane", "Maharashtra", 19.2183, 72.9781, "Maharashtra"),
    ("Jamtara", "Jharkhand", 23.9615, 86.8035, "Bihar & Jharkhand"),
    ("Deoghar", "Jharkhand", 24.4823, 86.6968, "Bihar & Jharkhand"),
    ("Ranchi", "Jharkhand", 23.3441, 85.3096, "Bihar & Jharkhand"),
    ("Dhanbad", "Jharkhand", 23.7957, 86.4304, "Bihar & Jharkhand"),
    ("Gurugram", "Haryana", 28.4595, 77.0266, "Haryana"),
    ("Nuh", "Haryana", 28.1080, 77.0010, "Haryana"),
    ("Faridabad", "Haryana", 28.4089, 77.3178, "Haryana"),
    ("Rohtak", "Haryana", 28.8955, 76.6066, "Haryana"),
    ("Bharatpur", "Rajasthan", 27.2173, 77.4895, "Rajasthan"),
    ("Alwar", "Rajasthan", 27.5530, 76.6346, "Rajasthan"),
    ("Jaipur", "Rajasthan", 26.9124, 75.7873, "Rajasthan"),
    ("Kota", "Rajasthan", 25.2138, 75.8648, "Rajasthan"),
    ("Kolkata", "West Bengal", 22.5726, 88.3639, "Kolkata"),
    ("Howrah", "West Bengal", 22.5958, 88.2636, "West Bengal"),
    ("Asansol", "West Bengal", 23.6739, 86.9524, "West Bengal"),
    ("Durgapur", "West Bengal", 23.5204, 87.3119, "West Bengal"),
    ("Bengaluru", "Karnataka", 12.9716, 77.5946, "Karnataka"),
    ("Mysuru", "Karnataka", 12.2958, 76.6394, "Karnataka"),
    ("Mangaluru", "Karnataka", 12.9141, 74.8560, "Karnataka"),
    ("Hubballi", "Karnataka", 15.3647, 75.1240, "Karnataka"),
    ("New Delhi", "Delhi", 28.6139, 77.2090, "Delhi"),
    ("Delhi Central", "Delhi", 28.6519, 77.2315, "Delhi"),
    ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462, "UP East"),
    ("Noida", "Uttar Pradesh", 28.5355, 77.3910, "UP West"),
    ("Ghaziabad", "Uttar Pradesh", 28.6692, 77.4538, "UP West"),
    ("Agra", "Uttar Pradesh", 27.1767, 78.0081, "UP West"),
]

BANKS = ["HDFC", "SBI", "ICICI", "Axis", "PNB", "Kotak", "Yes Bank", "Bank of Baroda"]
UPI_SUFFIXES = ["okhdfcbank", "oksbi", "okicici", "okaxis", "ybl", "paytm", "upi"]
CHANNELS = ["UPI", "IMPS", "NEFT"]

# The district (index into DISTRICTS) used as the mule / cash-out hotspot.
HOTSPOT_DISTRICT_IDX = 4  # Jamtara, Jharkhand — a real cyber-fraud hotspot.
SECONDARY_HOTSPOT_IDX = 9  # Nuh, Haryana.


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #

@dataclass
class RingSpec:
    scammers: int
    mules: int
    victims: int
    is_hero: bool


@dataclass
class Config:
    seed: int = 42
    num_persons: int = 1500
    num_rings: int = 3
    num_transactions: int = 15000          # approximate total (normal + ring)
    days: int = 28                          # dataset spans this many days...
    end_date: str = "2026-07-21"            # ...ending on this fixed date (deterministic)
    out: str = "data"
    structuring_band: tuple = (49000, 49900)
    min_structuring_txns: int = 5           # criterion 7 threshold "N"

    def ring_specs(self) -> list[RingSpec]:
        specs = [RingSpec(scammers=5, mules=9, victims=50, is_hero=True)]
        for _ in range(self.num_rings - 1):
            specs.append(RingSpec(scammers=3, mules=5, victims=18, is_hero=False))
        return specs


# --------------------------------------------------------------------------- #
# Generator
# --------------------------------------------------------------------------- #

class Generator:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.rng = np.random.default_rng(cfg.seed)
        self.fake = Faker("en_IN")
        Faker.seed(cfg.seed)
        self.fake.seed_instance(cfg.seed)

        self.end = datetime.fromisoformat(cfg.end_date)
        self.start = self.end - timedelta(days=cfg.days)

        # row accumulators
        self.persons: list[dict] = []
        self.accounts: list[dict] = []
        self.upi: list[dict] = []
        self.phones: list[dict] = []
        self.devices: dict[str, str] = {}          # device_id -> os
        self.device_usage: list[dict] = []
        self.ips: dict[str, dict] = {}             # ip -> row
        self.logins: list[dict] = []
        self.txns: list[dict] = []
        self.ground_truth: list[dict] = []
        self.ring_meta: list[dict] = []

        # counters
        self._pc = self._ac = self._uc = self._dc = self._tc = 0
        # lookup
        self.owner_of_account: dict[str, str] = {}
        self.accounts_of_person: dict[str, list[str]] = {}

    # ---- id helpers -------------------------------------------------------- #
    def pid(self) -> str:
        self._pc += 1
        return f"P{self._pc:06d}"

    def aid(self) -> str:
        self._ac += 1
        return f"A{self._ac:06d}"

    def uid(self) -> str:
        self._uc += 1
        return f"U{self._uc:06d}"

    def did(self) -> str:
        self._dc += 1
        return f"D{self._dc:06d}"

    def tid(self) -> str:
        self._tc += 1
        return f"T{self._tc:07d}"

    # ---- primitive builders ----------------------------------------------- #
    def rand_time(self, lo: datetime | None = None, hi: datetime | None = None) -> datetime:
        lo = lo or self.start
        hi = hi or self.end
        span = int((hi - lo).total_seconds())
        return lo + timedelta(seconds=int(self.rng.integers(0, max(span, 1))))

    def make_ip(self, is_vpn: bool = False, district_idx: int | None = None) -> str:
        octets = self.rng.integers(1, 224), self.rng.integers(0, 256), \
                 self.rng.integers(0, 256), self.rng.integers(1, 255)
        ip = ".".join(str(int(o)) for o in octets)
        if ip not in self.ips:
            d = DISTRICTS[district_idx] if district_idx is not None \
                else DISTRICTS[int(self.rng.integers(len(DISTRICTS)))]
            self.ips[ip] = {
                "ip_address": ip,
                "geo_lat": round(d[2] + float(self.rng.normal(0, 0.05)), 5),
                "geo_lng": round(d[3] + float(self.rng.normal(0, 0.05)), 5),
                "is_vpn": bool(is_vpn),
            }
        return ip

    def make_device(self) -> str:
        d = self.did()
        self.devices[d] = "Android" if self.rng.random() < 0.8 else "iOS"
        return d

    def make_phone(self, owner: str, spoofed: bool, circle: str) -> str:
        num = f"+91{int(self.rng.integers(6, 10))}{int(self.rng.integers(0, 10**9)):09d}"
        self.phones.append({
            "phone_number": num, "owner_person_id": owner,
            "is_spoofed": bool(spoofed), "telecom_circle": circle,
        })
        return num

    def make_person(self, role: str, district_idx: int, account_age_days: int,
                    ring_id: str | None) -> dict:
        d = DISTRICTS[district_idx]
        pid = self.pid()
        p = {
            "person_id": pid,
            "name": self.fake.name(),
            "role": role,
            "account_age_days": int(account_age_days),
            "district": d[0], "state": d[1],
            "lat": round(d[2] + float(self.rng.normal(0, 0.04)), 5),
            "lng": round(d[3] + float(self.rng.normal(0, 0.04)), 5),
        }
        self.persons.append(p)
        is_fraud = 1 if role in ("ringleader", "scammer", "mule") else 0
        self.ground_truth.append({
            "person_id": pid, "is_fraud": is_fraud, "role": role, "ring_id": ring_id or "",
        })
        return p

    def make_account(self, owner: str, age_days: int) -> str:
        aid = self.aid()
        opened = (self.end - timedelta(days=int(age_days))).date().isoformat()
        self.accounts.append({
            "account_id": aid, "owner_person_id": owner,
            "bank": BANKS[int(self.rng.integers(len(BANKS)))],
            "opened_date": opened,
            "kyc_level": "full" if self.rng.random() < 0.85 else "min",
        })
        self.owner_of_account[aid] = owner
        self.accounts_of_person.setdefault(owner, []).append(aid)
        return aid

    def make_upi(self, account: str, owner_name: str, handle: str | None = None) -> str:
        if handle is None:
            base = "".join(ch for ch in owner_name.lower() if ch.isalnum())[:8] or "user"
            handle = f"{base}{int(self.rng.integers(10, 9999))}@" \
                     f"{UPI_SUFFIXES[int(self.rng.integers(len(UPI_SUFFIXES)))]}"
        self.upi.append({"upi_id": self.uid(), "linked_account_id": account, "handle": handle})
        return handle

    def add_txn(self, frm: str, to: str, amount: int, ts: datetime,
                channel: str | None = None, status: str = "success") -> None:
        self.txns.append({
            "txn_id": self.tid(), "from_account": frm, "to_account": to,
            "amount_inr": int(amount),
            "timestamp": ts.replace(microsecond=0).isoformat(),
            "channel": channel or CHANNELS[int(self.rng.integers(len(CHANNELS)))],
            "status": status,
        })

    # ---- population builders ---------------------------------------------- #
    def build_normals(self, n: int) -> list[str]:
        """Legitimate background population. Returns their account ids."""
        accts = []
        for _ in range(n):
            di = int(self.rng.integers(len(DISTRICTS)))
            # Most normals are established, but a realistic minority are genuinely
            # new customers. This overlaps the fraud age range so account_age alone
            # is NOT a giveaway — the model must rely on graph/behavioural signal.
            if self.rng.random() < 0.12:
                age = int(self.rng.integers(5, 200))          # new legit customer
            else:
                age = int(self.rng.integers(200, 3200))       # established account
            p = self.make_person("normal", di, age, None)
            a = self.make_account(p["person_id"], age)
            self.make_upi(a, p["name"])
            self.make_phone(p["person_id"], False, DISTRICTS[di][4])
            dev = self.make_device()
            self.device_usage.append({
                "person_id": p["person_id"], "device_id": dev,
                "timestamp": self.rand_time().replace(microsecond=0).isoformat(),
            })
            ip = self.make_ip(is_vpn=self.rng.random() < 0.03, district_idx=di)
            self.logins.append({
                "person_id": p["person_id"], "ip_address": ip,
                "timestamp": self.rand_time().replace(microsecond=0).isoformat(),
            })
            accts.append(a)

        # A few INNOCENT coincidental shared attributes (not fraud):
        # 3 "family" members sharing one device; 2 "roommates" sharing one IP.
        if len(self.persons) >= 5:
            fam_dev = self.make_device()
            for pi in self.rng.choice(len(self.persons), size=3, replace=False):
                self.device_usage.append({
                    "person_id": self.persons[int(pi)]["person_id"], "device_id": fam_dev,
                    "timestamp": self.rand_time().replace(microsecond=0).isoformat(),
                })
            room_ip = self.make_ip()
            for pi in self.rng.choice(len(self.persons), size=2, replace=False):
                self.logins.append({
                    "person_id": self.persons[int(pi)]["person_id"], "ip_address": room_ip,
                    "timestamp": self.rand_time().replace(microsecond=0).isoformat(),
                })
        return accts

    def build_ring(self, ring_idx: int, spec: RingSpec) -> dict:
        """Plant one fraud ring with all discoverable structure. Returns meta."""
        cfg = self.cfg
        ring_id = f"RING{ring_idx:02d}"
        hotspot = HOTSPOT_DISTRICT_IDX if spec.is_hero else SECONDARY_HOTSPOT_IDX

        # victim districts: spread across several districts / >=3 states (hero)
        if spec.is_hero:
            victim_district_pool = [0, 8, 16, 20, 24, 26]   # Mum, Gurugram, Kolkata, Bengaluru, Delhi, Lucknow
        else:
            victim_district_pool = [1, 12, 17]
        victim_district_pool = [d for d in victim_district_pool]

        # ---- ring members ----
        ringleader = self.make_person("ringleader", hotspot,
                                      int(self.rng.integers(15, 90)), ring_id)
        rl_main = self.make_account(ringleader["person_id"], int(self.rng.integers(15, 90)))
        rl_cash = self.make_account(ringleader["person_id"], int(self.rng.integers(5, 40)))
        self.make_upi(rl_main, ringleader["name"])
        self.make_phone(ringleader["person_id"], False, DISTRICTS[hotspot][4])

        scammers = []
        for _ in range(spec.scammers):
            s = self.make_person("scammer", hotspot, int(self.rng.integers(10, 80)), ring_id)
            sa = self.make_account(s["person_id"], int(self.rng.integers(10, 80)))
            self.make_upi(sa, s["name"])
            self.make_phone(s["person_id"], True, DISTRICTS[hotspot][4])   # spoofed
            scammers.append((s, sa))

        # shared UPI handle reused across mule accounts (the glue)
        shared_handle = f"quickpay{ring_idx}{int(self.rng.integers(100,999))}@ybl"
        # shared devices used by many mules (the glue)
        shared_dev_a = self.make_device()
        shared_dev_b = self.make_device()
        # shared login IP for the ring
        shared_ip = self.make_ip(is_vpn=True, district_idx=hotspot)

        mules = []
        mule_district_second = hotspot + 1  # concentrate mules in <=2 districts
        for mi in range(spec.mules):
            di = hotspot if mi % 2 == 0 else mule_district_second
            # Mules skew fresh, but ~30% are AGED / compromised real accounts so the
            # age distribution overlaps normals (no trivial age threshold separates them).
            if self.rng.random() < 0.30:
                mage = int(self.rng.integers(120, 600))   # aged / compromised mule
            else:
                mage = int(self.rng.integers(2, 45))      # freshly opened mule
            m = self.make_person("mule", di, mage, ring_id)
            ma = self.make_account(m["person_id"], mage)
            # every mule linked to the SAME reused UPI handle + its own
            self.make_upi(ma, m["name"], handle=shared_handle)
            self.make_upi(ma, m["name"])
            self.make_phone(m["person_id"], False, DISTRICTS[di][4])
            # every mule uses shared_dev_a (>=8 share it in hero ring); some use dev_b
            self.device_usage.append({
                "person_id": m["person_id"], "device_id": shared_dev_a,
                "timestamp": self.rand_time().replace(microsecond=0).isoformat(),
            })
            if mi % 3 == 0:
                self.device_usage.append({
                    "person_id": m["person_id"], "device_id": shared_dev_b,
                    "timestamp": self.rand_time().replace(microsecond=0).isoformat(),
                })
            self.logins.append({
                "person_id": m["person_id"], "ip_address": shared_ip,
                "timestamp": self.rand_time().replace(microsecond=0).isoformat(),
            })
            mules.append((m, ma))

        # scammers also log in from the shared ring IP (ties them into the cluster)
        for s, sa in scammers:
            self.logins.append({
                "person_id": s["person_id"], "ip_address": shared_ip,
                "timestamp": self.rand_time().replace(microsecond=0).isoformat(),
            })

        # ---- ring timing window ----
        ring_start = self.rand_time(self.start, self.end - timedelta(days=14))
        window = timedelta(days=int(self.rng.integers(10, 14)))

        # ---- victims + money flow ----
        mule_accts = [ma for _, ma in mules]
        victim_payments: list[datetime] = []
        total_amount = 0
        struct_planted = 0

        # burst mule: first ~9 victims pay mule[2] within a 2h window (hero)
        burst_mule_idx = 2 if spec.mules > 2 else 0
        burst_count = 9 if spec.is_hero else 6
        burst_anchor = ring_start + timedelta(days=int(self.rng.integers(4, 8)),
                                              hours=int(self.rng.integers(9, 18)))

        for vi in range(spec.victims):
            vdist = victim_district_pool[vi % len(victim_district_pool)]
            v = self.make_person("victim", vdist, int(self.rng.integers(150, 3000)), ring_id)
            va = self.make_account(v["person_id"], int(self.rng.integers(150, 3000)))
            self.make_upi(va, v["name"])
            self.make_phone(v["person_id"], False, DISTRICTS[vdist][4])
            dev = self.make_device()
            self.device_usage.append({
                "person_id": v["person_id"], "device_id": dev,
                "timestamp": self.rand_time().replace(microsecond=0).isoformat(),
            })

            # amount: mostly 20k-300k; plant a handful in the structuring band
            if spec.is_hero and struct_planted < 8 and vi % 6 == 0:
                amount = int(self.rng.integers(*cfg.structuring_band))
                struct_planted += 1
            else:
                amount = int(np.clip(self.rng.lognormal(11.0, 0.7), 15000, 400000))

            # timestamp + assigned mule
            if vi < burst_count:
                mule_i = burst_mule_idx
                ts = burst_anchor + timedelta(minutes=int(self.rng.integers(0, 120)))
            else:
                mule_i = vi % spec.mules
                ts = ring_start + timedelta(seconds=int(self.rng.integers(0, int(window.total_seconds()))))
            ma = mule_accts[mule_i]
            self.add_txn(va, ma, amount, ts, channel="UPI")
            victim_payments.append(ts)
            total_amount += amount

        first_detectable = sorted(victim_payments)[2]  # 3rd victim payment

        # mule -> ringleader funnel;  mule[1] -> mule[0] -> ringleader (multi-hop)
        for mi, (m, ma) in enumerate(mules):
            fwd_ts = ring_start + window - timedelta(hours=int(self.rng.integers(1, 60)))
            amt = int(self.rng.integers(120000, 500000))
            if spec.mules > 1 and mi == 1:
                self.add_txn(ma, mule_accts[0], amt, fwd_ts, channel="IMPS")     # M1 -> M0
            else:
                self.add_txn(ma, rl_main, amt, fwd_ts, channel="IMPS")           # Mj -> RL
        # M0 -> ringleader (completes the multi-hop chain)
        self.add_txn(mule_accts[0], rl_main,
                     int(self.rng.integers(200000, 600000)),
                     ring_start + window - timedelta(minutes=30), channel="IMPS")
        # scammers also forward some collected funds to ringleader
        for s, sa in scammers:
            self.add_txn(sa, rl_main, int(self.rng.integers(30000, 150000)),
                         self.rand_time(ring_start, ring_start + window), channel="IMPS")
        # ringleader -> cash-out (money leaves the visible system)
        self.add_txn(rl_main, rl_cash, int(self.rng.integers(500000, 2000000)),
                     ring_start + window, channel="NEFT")

        districts_spanned = len({DISTRICTS[d][0] for d in
                                 [victim_district_pool[i % len(victim_district_pool)]
                                  for i in range(spec.victims)]})
        states_spanned = len({DISTRICTS[d][1] for d in
                              [victim_district_pool[i % len(victim_district_pool)]
                               for i in range(spec.victims)]})
        victims_after = sum(1 for t in victim_payments if t > first_detectable)

        meta = {
            "ring_id": ring_id,
            "ringleader_person_id": ringleader["person_id"],
            "first_detectable_timestamp": first_detectable.replace(microsecond=0).isoformat(),
            "num_victims": spec.victims,
            "districts_spanned": districts_spanned,
            "states_spanned": states_spanned,
            "total_amount_inr": int(total_amount),
        }
        self.ring_meta.append(meta)

        # keep hero internals for acceptance checks
        meta["_hero"] = spec.is_hero
        meta["_ring_accounts"] = (
            [rl_main, rl_cash] + [sa for _, sa in scammers]
            + [ma for _, ma in mules]
            + [a for p in self.persons if p["role"] == "victim"
               and self.ground_truth_ring(p["person_id"]) == ring_id
               for a in self.accounts_of_person.get(p["person_id"], [])]
        )
        meta["_rl_main"] = rl_main
        meta["_rl_cash"] = rl_cash
        meta["_mule_persons"] = [m["person_id"] for m, _ in mules]
        meta["_shared_dev"] = shared_dev_a
        meta["_first_detectable"] = first_detectable
        meta["_victims_after"] = victims_after
        return meta

    def ground_truth_ring(self, pid: str) -> str:
        for g in self.ground_truth:
            if g["person_id"] == pid:
                return g["ring_id"]
        return ""

    # ---- normal transaction stream ---------------------------------------- #
    def build_normal_txns(self, normal_accts: list[str], n: int) -> None:
        if len(normal_accts) < 2:
            return
        arr = np.array(normal_accts, dtype=object)
        for _ in range(n):
            i, j = self.rng.integers(0, len(arr), size=2)
            if i == j:
                continue
            r = self.rng.random()
            if r < 0.15:                         # salary-like
                amount = int(self.rng.choice([15000, 25000, 35000, 50000, 65000, 80000]))
            elif r < 0.75:                       # everyday shopping / small P2P
                amount = int(np.clip(self.rng.lognormal(6.7, 0.9), 50, 9000))
            else:                                # larger P2P
                amount = int(np.clip(self.rng.lognormal(10.0, 0.8), 5000, 200000))
            status = "failed" if self.rng.random() < 0.02 else "success"
            self.add_txn(str(arr[i]), str(arr[j]), amount, self.rand_time(), status=status)

    # ---- orchestration ---------------------------------------------------- #
    def generate(self) -> dict:
        specs = self.cfg.ring_specs()
        ring_person_total = sum(1 + s.scammers + s.mules + s.victims for s in specs)
        n_normal = self.cfg.num_persons - ring_person_total
        if n_normal < 50:
            raise ValueError(
                f"num_persons={self.cfg.num_persons} too small for {ring_person_total} "
                f"ring persons; increase --persons.")

        # 1) legitimate background FIRST
        normal_accts = self.build_normals(n_normal)

        # 2) plant rings
        metas = [self.build_ring(i + 1, s) for i, s in enumerate(specs)]

        # 3) fill remaining transaction budget with normal activity, then
        #    interleave everything by timestamp (weave, don't block)
        remaining = max(self.cfg.num_transactions - len(self.txns), 0)
        self.build_normal_txns(normal_accts, remaining)
        self.txns.sort(key=lambda t: t["timestamp"])

        return {"metas": metas}


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #

COLUMNS = {
    "persons": ["person_id", "name", "role", "account_age_days", "district", "state", "lat", "lng"],
    "accounts": ["account_id", "owner_person_id", "bank", "opened_date", "kyc_level"],
    "upi": ["upi_id", "linked_account_id", "handle"],
    "phones": ["phone_number", "owner_person_id", "is_spoofed", "telecom_circle"],
    "devices": ["device_id", "os"],
    "device_usage": ["person_id", "device_id", "timestamp"],
    "ips": ["ip_address", "geo_lat", "geo_lng", "is_vpn"],
    "logins": ["person_id", "ip_address", "timestamp"],
    "transactions": ["txn_id", "from_account", "to_account", "amount_inr", "timestamp", "channel", "status"],
    "ground_truth": ["person_id", "is_fraud", "role", "ring_id"],
    "ring_meta": ["ring_id", "ringleader_person_id", "first_detectable_timestamp",
                  "num_victims", "districts_spanned", "states_spanned", "total_amount_inr"],
}


def write_outputs(gen: Generator, cfg: Config) -> dict:
    os.makedirs(cfg.out, exist_ok=True)
    frames = {
        "persons": pd.DataFrame(gen.persons),
        "accounts": pd.DataFrame(gen.accounts),
        "upi": pd.DataFrame(gen.upi),
        "phones": pd.DataFrame(gen.phones),
        "devices": pd.DataFrame([{"device_id": d, "os": o} for d, o in gen.devices.items()]),
        "device_usage": pd.DataFrame(gen.device_usage),
        "ips": pd.DataFrame(list(gen.ips.values())),
        "logins": pd.DataFrame(gen.logins),
        "transactions": pd.DataFrame(gen.txns),
        "ground_truth": pd.DataFrame(gen.ground_truth),
        "ring_meta": pd.DataFrame([{k: m[k] for k in COLUMNS["ring_meta"]} for m in gen.ring_meta]),
    }
    counts = {}
    for name, df in frames.items():
        df = df[COLUMNS[name]]
        df.to_csv(os.path.join(cfg.out, f"{name}.csv"), index=False)
        counts[name] = len(df)
    return counts


def write_ground_truth_md(gen: Generator, cfg: Config, metas: list[dict]) -> None:
    lines = ["# GROUND_TRUTH — the answer key for this synthetic dataset", "",
             f"Seed: `{cfg.seed}` · Dataset window: {gen.start.date()} → {gen.end.date()}", "",
             "This file describes every deliberately planted fraud ring. Use it to demo "
             "(which ring to click, the lead-time number) and to validate detection.", ""]
    for m in metas:
        rl = m["ringleader_person_id"]
        lines += [
            f"## {m['ring_id']}{'  ⭐ HERO RING' if m.get('_hero') else ''}",
            "",
            f"- **Ringleader:** `{rl}` (highest betweenness centrality in the ring)",
            f"- **Mules:** {len(m['_mule_persons'])} accounts sharing device `{m['_shared_dev']}` "
            f"and a reused UPI handle",
            f"- **Victims:** {m['num_victims']}, spread across {m['districts_spanned']} districts "
            f"in {m['states_spanned']} states",
            f"- **Money trail:** victim → mule → mule → ringleader (`{m['_rl_main']}`) "
            f"→ cash-out (`{m['_rl_cash']}`)",
            f"- **First detectable:** `{m['first_detectable_timestamp']}` "
            f"(shared infra observable from the 3rd victim)",
            f"- **Lead-time gap:** {m['_victims_after']} of {m['num_victims']} victims were defrauded "
            f"*after* the ring first became detectable",
            f"- **Total defrauded:** ₹{m['total_amount_inr']:,}",
            "",
        ]
    with open(os.path.join(cfg.out, "GROUND_TRUTH.md"), "w") as f:
        f.write("\n".join(lines))


def write_manifest(cfg: Config, counts: dict) -> None:
    manifest = {
        "seed": cfg.seed,
        "config": asdict(cfg),
        "row_counts": counts,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }
    with open(os.path.join(cfg.out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)


# --------------------------------------------------------------------------- #
# Acceptance checks
# --------------------------------------------------------------------------- #

def run_acceptance(gen: Generator, cfg: Config, metas: list[dict]) -> bool:
    checks: list[tuple[str, bool, str]] = []
    hero = next(m for m in metas if m.get("_hero"))

    # 1) fraud prevalence 2-5% (perpetrators = is_fraud==1)
    gt = pd.DataFrame(gen.ground_truth)
    prev = gt["is_fraud"].mean()
    checks.append(("Fraud prevalence 2-5%", 0.02 <= prev <= 0.05, f"{prev*100:.2f}%"))

    # build hero ring account-level money graph
    hero_accts = set(hero["_ring_accounts"])
    G = nx.DiGraph()
    for t in gen.txns:
        if t["from_account"] in hero_accts and t["to_account"] in hero_accts:
            G.add_edge(t["from_account"], t["to_account"])

    # 2) ringleader has max betweenness among ring members (map account->owner)
    bc = nx.betweenness_centrality(G)
    owner_score: dict[str, float] = {}
    for acct, score in bc.items():
        owner = gen.owner_of_account.get(acct, acct)
        owner_score[owner] = owner_score.get(owner, 0.0) + score
    top_owner = max(owner_score, key=owner_score.get) if owner_score else None
    checks.append(("Ringleader has max betweenness",
                   top_owner == hero["ringleader_person_id"],
                   f"top={top_owner} rl={hero['ringleader_person_id']}"))

    # 3) a device shared by >= 8 mule accounts
    du = pd.DataFrame(gen.device_usage)
    mule_set = set(hero["_mule_persons"])
    shared = du[du["person_id"].isin(mule_set)].groupby("device_id")["person_id"].nunique()
    max_share = int(shared.max()) if len(shared) else 0
    checks.append(("Device shared by >=8 mules", max_share >= 8, f"max={max_share}"))

    # 4) victim -> ... -> ringleader -> cashout path exists
    path_ok = False
    victim_accts = [a for a in hero_accts
                    if gen.owner_of_account.get(a) and
                    gen.ground_truth_ring(gen.owner_of_account[a]) == hero["ring_id"] and
                    any(p["person_id"] == gen.owner_of_account[a] and p["role"] == "victim"
                        for p in gen.persons)]
    for va in victim_accts:
        if G.has_node(va) and G.has_node(hero["_rl_cash"]) and nx.has_path(G, va, hero["_rl_cash"]):
            path_ok = True
            break
    checks.append(("Money-trail path victim→ringleader→cashout", path_ok, ""))

    # 5) victims span >=4 districts & >=2 states; mules in <=2 districts
    persons_df = pd.DataFrame(gen.persons)
    gt_ring = gt[gt["ring_id"] == hero["ring_id"]]
    vic_ids = gt_ring[gt_ring["role"] == "victim"]["person_id"]
    vic = persons_df[persons_df["person_id"].isin(vic_ids)]
    mul = persons_df[persons_df["person_id"].isin(mule_set)]
    geo_ok = (vic["district"].nunique() >= 4 and vic["state"].nunique() >= 2
              and mul["district"].nunique() <= 2)
    checks.append(("Victims >=4 districts/>=2 states, mules <=2 districts", geo_ok,
                   f"vic_d={vic['district'].nunique()} vic_s={vic['state'].nunique()} "
                   f"mule_d={mul['district'].nunique()}"))

    # 6) >=50% hero victim txns after first_detectable
    after = hero["_victims_after"]
    checks.append((">=50% victim txns after first_detectable",
                   after >= hero["num_victims"] * 0.5,
                   f"{after}/{hero['num_victims']}"))

    # 7) >= N structuring-band transactions
    tx = pd.DataFrame(gen.txns)
    lo, hi = cfg.structuring_band
    band = int(((tx["amount_inr"] >= lo) & (tx["amount_inr"] <= hi)).sum())
    checks.append((f"Structuring txns >= {cfg.min_structuring_txns}",
                   band >= cfg.min_structuring_txns, f"count={band}"))

    # 8) all FK resolve
    acct_ids = set(pd.DataFrame(gen.accounts)["account_id"])
    person_ids = set(persons_df["person_id"])
    fk_ok = (
        tx["from_account"].isin(acct_ids).all()
        and tx["to_account"].isin(acct_ids).all()
        and pd.DataFrame(gen.accounts)["owner_person_id"].isin(person_ids).all()
        and pd.DataFrame(gen.upi)["linked_account_id"].isin(acct_ids).all()
        and pd.DataFrame(gen.phones)["owner_person_id"].isin(person_ids).all()
        and pd.DataFrame(gen.device_usage)["person_id"].isin(person_ids).all()
        and pd.DataFrame(gen.logins)["person_id"].isin(person_ids).all()
    )
    checks.append(("All foreign keys resolve", bool(fk_ok), ""))

    # report
    print("\n" + "=" * 64)
    print("ACCEPTANCE REPORT")
    print("=" * 64)
    all_ok = True
    for name, ok, detail in checks:
        all_ok &= ok
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  ({detail})" if detail else ""))
    print("=" * 64)
    print(f"  {'ALL CHECKS PASSED' if all_ok else 'SOME CHECKS FAILED'}")
    print("=" * 64 + "\n")
    return all_ok


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def main() -> int:
    ap = argparse.ArgumentParser(description="Synthetic cyber-fraud dataset generator (India).")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--persons", type=int, default=Config.num_persons)
    ap.add_argument("--rings", type=int, default=Config.num_rings)
    ap.add_argument("--transactions", type=int, default=Config.num_transactions)
    ap.add_argument("--out", type=str, default=Config.out)
    args = ap.parse_args()

    cfg = Config(seed=args.seed, num_persons=args.persons, num_rings=args.rings,
                 num_transactions=args.transactions, out=args.out)

    gen = Generator(cfg)
    result = gen.generate()
    counts = write_outputs(gen, cfg)
    write_ground_truth_md(gen, cfg, result["metas"])
    write_manifest(cfg, counts)

    print(f"\nGenerated dataset in ./{cfg.out}/")
    for name, c in counts.items():
        print(f"  {name+'.csv':<22} {c:>7,} rows")

    ok = run_acceptance(gen, cfg, result["metas"])
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
