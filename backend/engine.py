"""
InvestigationEngine — the core intelligence pipeline.

Loads the synthetic CSVs, builds the graphs, and runs the full detection +
scoring pipeline IN-PROCESS with NetworkX / pandas / scikit-learn. This works
without GDS (Aura has none) and without any external service. Neo4j and the LLM
are optional enhancers layered on top.

Pipeline stages (all run once in build()):
  1. load          — CSVs -> dataframes + lookups
  2. graphs        — money DiGraph (accounts) + entity Graph (persons)
  3. features      — per-person behavioural + graph features
  4. score         — rule engine + IsolationForest + supervised model + fusion
  5. detect        — rings (Louvain) + ringleader (betweenness) + mule nets (WCC)
  6. geo           — district hotspots + DBSCAN clusters + cross-jurisdiction
Results are held in memory and served by the API.
"""

from __future__ import annotations

import os
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
import networkx as nx
from sklearn.ensemble import IsolationForest, RandomForestClassifier

RISK_BANDS = [(0.66, "High"), (0.33, "Medium"), (0.0, "Low")]


def band(score: float) -> str:
    for thr, name in RISK_BANDS:
        if score >= thr:
            return name
    return "Low"


@dataclass
class Ring:
    ring_id: str
    members: list[str]
    ringleader: str
    size: int
    n_mules: int
    total_flow_inr: int
    districts: list[str]
    states: list[str]
    cross_jurisdiction: bool
    risk: float
    first_detectable: str | None
    victims_after_detectable: int
    n_victims: int

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}


class InvestigationEngine:
    def __init__(self, data_dir: str = "./data") -> None:
        self.data_dir = data_dir
        self.built = False
        # frames
        self.persons = self.accounts = self.upi = self.txns = None
        self.device_usage = self.logins = self.ips = self.ground_truth = None
        # lookups
        self.owner: dict[str, str] = {}
        self.accts_of: dict[str, list[str]] = defaultdict(list)
        self.role: dict[str, str] = {}
        self.pname: dict[str, str] = {}
        # graphs
        self.MG = nx.DiGraph()      # account-level money graph
        self.EG = nx.Graph()        # person-level entity graph
        # results
        self.features: pd.DataFrame | None = None
        self.scores: dict[str, dict] = {}
        self.rings: list[Ring] = []
        self.hotspots: list[dict] = []
        self.geo_clusters: list[dict] = []

    # --------------------------------------------------------------------- #
    def _csv(self, name: str) -> pd.DataFrame:
        return pd.read_csv(os.path.join(self.data_dir, f"{name}.csv"))

    def build(self) -> "InvestigationEngine":
        self._load()
        self._build_graphs()
        self._features()
        self._score()
        self._detect_rings()
        self._geo()
        self.built = True
        return self

    # ---- 1. load --------------------------------------------------------- #
    def _load(self) -> None:
        self.persons = self._csv("persons")
        self.accounts = self._csv("accounts")
        self.upi = self._csv("upi")
        self.txns = self._csv("transactions")
        self.device_usage = self._csv("device_usage")
        self.logins = self._csv("logins")
        self.ips = self._csv("ips")
        self.ground_truth = self._csv("ground_truth")
        self.txns["ts"] = pd.to_datetime(self.txns["timestamp"])

        self.owner = dict(zip(self.accounts.account_id, self.accounts.owner_person_id))
        for a, o in self.owner.items():
            self.accts_of[o].append(a)
        self.role = dict(zip(self.persons.person_id, self.persons.role))
        self.pname = dict(zip(self.persons.person_id, self.persons.name))

    # ---- 2. graphs ------------------------------------------------------- #
    def _build_graphs(self) -> None:
        # money graph (accounts)
        for r in self.txns.itertuples():
            self.MG.add_edge(r.from_account, r.to_account,
                             amount=int(r.amount_inr), ts=str(r.timestamp))
        # entity graph (persons): money edges + shared-infra edges (capped)
        for r in self.txns.itertuples():
            a, b = self.owner.get(r.from_account), self.owner.get(r.to_account)
            if a and b and a != b:
                self.EG.add_edge(a, b, kind="money")
        self._link_shared(self.device_usage, "device_id", "person_id", "device")
        merged = self.upi.merge(self.accounts, left_on="linked_account_id",
                                right_on="account_id")
        self._link_shared(merged.rename(columns={"owner_person_id": "person_id"}),
                          "handle", "person_id", "upi")
        self._link_shared(self.logins, "ip_address", "person_id", "ip")
        # make sure every person is a node
        self.EG.add_nodes_from(self.persons.person_id)

    def _link_shared(self, df: pd.DataFrame, group_col: str, person_col: str,
                     kind: str, cap: int = 15) -> None:
        """Connect people who share an attribute. Skip huge groups (would link
        the whole graph and destroy community structure)."""
        for _, grp in df.groupby(group_col):
            ppl = grp[person_col].unique()
            if 2 <= len(ppl) <= cap:
                for i in range(len(ppl)):
                    for j in range(i + 1, len(ppl)):
                        self.EG.add_edge(ppl[i], ppl[j], kind=kind)

    # ---- 3. features ----------------------------------------------------- #
    def _features(self) -> None:
        t = self.txns
        o = self.owner
        sent = t.groupby(t.from_account.map(o))
        recv = t.groupby(t.to_account.map(o))
        out_cnt = sent.size()
        in_cnt = recv.size()
        amt_in = recv.amount_inr.sum()
        amt_out = sent.amount_inr.sum()
        # distinct counterparties (in)
        cp_in = t.assign(to_p=t.to_account.map(o), from_p=t.from_account.map(o)) \
                 .groupby("to_p").from_p.nunique()
        # night activity ratio (00:00-05:00)
        t2 = t.assign(to_p=t.to_account.map(o), hour=t.ts.dt.hour)
        night = t2.groupby("to_p").apply(
            lambda g: float((g.hour < 5).mean()) if len(g) else 0.0, include_groups=False)
        # structuring count (just under 50k received)
        struct = t2[(t2.amount_inr >= 49000) & (t2.amount_inr <= 49900)] \
            .groupby("to_p").size()
        # shared infra flags
        dev_share = self.device_usage.groupby("device_id").person_id.transform("nunique")
        shared_dev_people = set(self.device_usage.loc[dev_share.between(4, 15), "person_id"])
        merged = self.upi.merge(self.accounts, left_on="linked_account_id",
                                right_on="account_id")
        upi_share = merged.groupby("handle").owner_person_id.transform("nunique")
        reused_upi_people = set(merged.loc[upi_share.between(2, 15), "owner_person_id"])
        spoof_people = set(self._csv("phones").query("is_spoofed").owner_person_id) \
            if "is_spoofed" in self._csv("phones").columns else set()
        deg = dict(self.EG.degree())
        age = dict(zip(self.persons.person_id, self.persons.account_age_days))

        rows = []
        for p in self.persons.person_id:
            rows.append({
                "person_id": p,
                "degree": deg.get(p, 0),
                "in_cnt": int(in_cnt.get(p, 0)),
                "out_cnt": int(out_cnt.get(p, 0)),
                "amt_in": float(amt_in.get(p, 0.0)),
                "amt_out": float(amt_out.get(p, 0.0)),
                "cp_in": int(cp_in.get(p, 0)),
                "fan_ratio": float(in_cnt.get(p, 0)) / (float(out_cnt.get(p, 0)) + 1.0),
                "night_ratio": float(night.get(p, 0.0)),
                "struct_cnt": int(struct.get(p, 0)),
                "account_age": int(age.get(p, 9999)),
                "shared_device": int(p in shared_dev_people),
                "reused_upi": int(p in reused_upi_people),
                "spoofed_phone": int(p in spoof_people),
            })
        self.features = pd.DataFrame(rows).set_index("person_id")

    # ---- 4. score -------------------------------------------------------- #
    def _score(self) -> None:
        f = self.features
        # rule engine — transparent, additive, each rule carries a reason
        def rules(row) -> tuple[float, list[str]]:
            pts, why = 0.0, []
            if row.shared_device:
                pts += 0.30; why.append("Shares a device with multiple other accounts")
            if row.reused_upi:
                pts += 0.25; why.append("Uses a UPI handle reused across accounts")
            if row.account_age < 90 and row.in_cnt > 3:
                pts += 0.20; why.append(f"Fresh account ({row.account_age}d) already active")
            if row.fan_ratio > 5 and row.in_cnt > 5:
                pts += 0.20; why.append("High fan-in / low fan-out (mule pattern)")
            if row.struct_cnt > 0:
                pts += 0.15; why.append(f"{row.struct_cnt} transfer(s) just under ₹50,000")
            if row.spoofed_phone:
                pts += 0.15; why.append("Linked to a spoofed phone number")
            if row.night_ratio > 0.5 and row.in_cnt > 3:
                pts += 0.10; why.append("Mostly night-time activity")
            return min(pts, 1.0), why

        rule_out = f.apply(lambda r: rules(r), axis=1)
        rule_score = rule_out.map(lambda x: x[0])
        reasons = rule_out.map(lambda x: x[1])

        # anomaly detection (unsupervised)
        X = f[["degree", "in_cnt", "out_cnt", "amt_in", "amt_out", "cp_in",
               "fan_ratio", "night_ratio", "struct_cnt", "account_age"]].fillna(0).values
        iso = IsolationForest(n_estimators=200, contamination=0.06, random_state=42)
        iso.fit(X)
        raw = -iso.score_samples(X)
        anomaly = (raw - raw.min()) / (raw.max() - raw.min() + 1e-9)

        # supervised model (trained on confirmed labels = ground truth)
        gt = dict(zip(self.ground_truth.person_id, self.ground_truth.is_fraud))
        y = np.array([gt.get(p, 0) for p in f.index])
        Xs = np.column_stack([X, f[["shared_device", "reused_upi", "spoofed_phone"]].values])
        rf = RandomForestClassifier(n_estimators=200, random_state=42,
                                    class_weight="balanced")
        rf.fit(Xs, y)
        ml = rf.predict_proba(Xs)[:, 1]

        # fusion: max of rules & ml, nudged by anomaly (explainable + robust)
        fused = np.clip(0.5 * np.maximum(rule_score.values, ml)
                        + 0.3 * np.maximum(rule_score.values, ml)
                        + 0.2 * anomaly, 0, 1)
        fused = np.maximum(fused, rule_score.values)  # never below transparent rules

        for i, p in enumerate(f.index):
            self.scores[p] = {
                "person_id": p,
                "name": self.pname.get(p, ""),
                "rule_score": round(float(rule_score.values[i]), 3),
                "anomaly_score": round(float(anomaly[i]), 3),
                "ml_score": round(float(ml[i]), 3),
                "fused_score": round(float(fused[i]), 3),
                "risk_band": band(float(fused[i])),
                "reasons": reasons.values[i],
                "role": self.role.get(p, ""),
            }

    # ---- 5. detect rings ------------------------------------------------- #
    def _detect_rings(self) -> None:
        comms = nx.community.louvain_communities(self.EG, seed=42)
        rings: list[Ring] = []
        for idx, c in enumerate(sorted(comms, key=len, reverse=True)):
            members = list(c)
            if len(members) < 5:
                continue
            # glue: is there shared infra binding this community?
            has_glue = any(self.scores.get(m, {}).get("reasons") and
                           any("device" in r or "UPI" in r for r in self.scores[m]["reasons"])
                           for m in members)
            avg_risk = float(np.mean([self.scores.get(m, {}).get("fused_score", 0)
                                      for m in members]))
            high = [m for m in members if self.scores.get(m, {}).get("fused_score", 0) >= 0.5]
            if not has_glue or len(high) < 3:
                continue  # not a fraud ring — ordinary community

            # ringleader = max betweenness on the money subgraph of members' accounts
            member_accts = {a for m in members for a in self.accts_of.get(m, [])}
            sub = self.MG.subgraph(member_accts)
            leader = None
            if sub.number_of_edges():
                bc = nx.betweenness_centrality(sub)
                owner_bc: dict[str, float] = defaultdict(float)
                for acct, s in bc.items():
                    owner_bc[self.owner.get(acct, acct)] += s
                leader = max(owner_bc, key=owner_bc.get) if owner_bc else None
            if leader is None:
                leader = max(members, key=lambda m: self.scores.get(m, {}).get("fused_score", 0))

            # geo spread
            pdf = self.persons[self.persons.person_id.isin(members)]
            districts = sorted(pdf.district.unique().tolist())
            states = sorted(pdf.state.unique().tolist())
            # money flow within ring
            flow = sum(d["amount"] for u, v, d in self.MG.edges(data=True)
                       if u in member_accts and v in member_accts)
            # lead-time: victim payments = money-in to high-fan-in members
            mule_accts = {a for m in high for a in self.accts_of.get(m, [])}
            vic_ts = sorted(pd.to_datetime(
                [d["ts"] for u, v, d in self.MG.edges(data=True) if v in mule_accts]))
            first_det = vic_ts[2].isoformat() if len(vic_ts) >= 3 else None
            after = int(sum(1 for t in vic_ts if first_det and t > pd.to_datetime(first_det)))

            n_mules = len(high)
            n_victims = len([m for m in members
                             if self.scores.get(m, {}).get("fused_score", 0) < 0.5
                             and self.EG.degree(m) <= 3])
            # risk rewards: member risk, mule density, jurisdictional spread, and scale
            risk = round(min(1.0,
                             0.30 * avg_risk
                             + 0.20 * (len(high) / max(len(members), 1))
                             + 0.25 * min(len(states) / 5.0, 1.0)
                             + 0.25 * min(len(members) / 60.0, 1.0)), 3)
            rings.append(Ring(
                ring_id=f"DR{idx+1:02d}", members=members, ringleader=leader,
                size=len(members), n_mules=n_mules, total_flow_inr=int(flow),
                districts=districts, states=states,
                cross_jurisdiction=len(states) >= 2, risk=risk,
                first_detectable=first_det, victims_after_detectable=after,
                n_victims=n_victims))
        self.rings = sorted(rings, key=lambda r: r.risk, reverse=True)

    # ---- 6. geo ---------------------------------------------------------- #
    def _geo(self) -> None:
        # hotspots: fraud-weighted counts per district
        flagged = {p for p, s in self.scores.items() if s["fused_score"] >= 0.5}
        pdf = self.persons.assign(flagged=self.persons.person_id.isin(flagged))
        # loss per district = victim payments originating there
        vic_pay = self.txns.assign(from_p=self.txns.from_account.map(self.owner))
        loss = vic_pay.merge(self.persons[["person_id", "district"]],
                             left_on="from_p", right_on="person_id")
        loss_by_d = loss.groupby("district").amount_inr.sum()
        agg = pdf.groupby("district").agg(
            lat=("lat", "mean"), lng=("lng", "mean"),
            flagged=("flagged", "sum"), total=("person_id", "count")).reset_index()
        agg["loss_inr"] = agg.district.map(loss_by_d).fillna(0).astype(int)
        self.hotspots = agg.sort_values("flagged", ascending=False).to_dict("records")

        # DBSCAN geo clusters of flagged entities
        try:
            from sklearn.cluster import DBSCAN
            fp = self.persons[self.persons.person_id.isin(flagged)]
            if len(fp) >= 4:
                labels = DBSCAN(eps=0.4, min_samples=4).fit(
                    np.radians(fp[["lat", "lng"]].values)).labels_
                for lab in sorted(set(labels)):
                    if lab == -1:
                        continue
                    pts = fp[labels == lab]
                    self.geo_clusters.append({
                        "cluster": int(lab), "size": int(len(pts)),
                        "districts": sorted(pts.district.unique().tolist()),
                        "lat": float(pts.lat.mean()), "lng": float(pts.lng.mean())})
        except Exception:
            pass

    # ===================================================================== #
    # Query API (used by routes + agent tools)
    # ===================================================================== #
    def kpis(self) -> dict:
        flagged = [s for s in self.scores.values() if s["fused_score"] >= 0.5]
        at_risk = sum(r.total_flow_inr for r in self.rings)
        return {
            "entities": len(self.persons),
            "transactions": len(self.txns),
            "rings_detected": len(self.rings),
            "entities_flagged": len(flagged),
            "amount_at_risk_inr": int(at_risk),
            "cross_jurisdiction_rings": sum(1 for r in self.rings if r.cross_jurisdiction),
        }

    def list_rings(self) -> list[dict]:
        out = []
        for r in self.rings:
            d = r.to_dict()
            d["ringleader_name"] = self.pname.get(r.ringleader, "")
            d.pop("members")
            out.append(d)
        return out

    def get_ring(self, ring_id: str) -> dict | None:
        r = next((x for x in self.rings if x.ring_id == ring_id), None)
        if not r:
            return None
        member_accts = {a for m in r.members for a in self.accts_of.get(m, [])}
        nodes = [{"id": m, "name": self.pname.get(m, ""),
                  "role": self.role.get(m, ""),
                  "risk": self.scores.get(m, {}).get("fused_score", 0),
                  "band": self.scores.get(m, {}).get("risk_band", "Low"),
                  "district": self.persons.loc[self.persons.person_id == m, "district"].iloc[0],
                  "lat": float(self.persons.loc[self.persons.person_id == m, "lat"].iloc[0]),
                  "lng": float(self.persons.loc[self.persons.person_id == m, "lng"].iloc[0]),
                  "is_leader": m == r.ringleader}
                 for m in r.members]
        edges = []
        for u, v, dta in self.MG.edges(data=True):
            pu, pv = self.owner.get(u), self.owner.get(v)
            if pu in r.members and pv in r.members and pu != pv:
                edges.append({"source": pu, "target": pv,
                              "amount": dta["amount"], "ts": dta["ts"]})
        d = r.to_dict()
        d["nodes"] = nodes
        d["edges"] = edges
        d["ringleader_name"] = self.pname.get(r.ringleader, "")
        return d

    def get_entity(self, person_id: str) -> dict | None:
        if person_id not in self.scores:
            return None
        prow = self.persons[self.persons.person_id == person_id].iloc[0]
        s = self.scores[person_id]
        ring = next((r.ring_id for r in self.rings if person_id in r.members), None)
        feats = self.features.loc[person_id].to_dict() if person_id in self.features.index else {}
        return {
            "person_id": person_id, "name": s["name"], "role": s["role"],
            "district": prow.district, "state": prow.state,
            "scores": {k: s[k] for k in
                       ("rule_score", "anomaly_score", "ml_score", "fused_score", "risk_band")},
            "reasons": s["reasons"], "features": feats, "ring_id": ring,
            "accounts": self.accts_of.get(person_id, []),
        }

    def get_shared_devices(self, person_id: str) -> list[dict]:
        devs = self.device_usage[self.device_usage.person_id == person_id].device_id.unique()
        out = []
        for d in devs:
            sharers = self.device_usage[self.device_usage.device_id == d].person_id.unique()
            if len(sharers) > 1:
                out.append({"device_id": d, "shared_by": [
                    {"person_id": p, "name": self.pname.get(p, ""),
                     "role": self.role.get(p, "")} for p in sharers]})
        return out

    def get_timeline(self, person_id: str, limit: int = 40) -> list[dict]:
        accts = set(self.accts_of.get(person_id, []))
        ev = []
        for u, v, dta in self.MG.edges(data=True):
            if u in accts or v in accts:
                ev.append({"ts": dta["ts"], "from": self.owner.get(u), "to": self.owner.get(v),
                           "amount": dta["amount"],
                           "direction": "out" if u in accts else "in"})
        return sorted(ev, key=lambda e: e["ts"])[:limit]

    def money_trail(self, src_person: str, dst_person: str) -> dict | None:
        src = self.accts_of.get(src_person, [])
        dst = set(self.accts_of.get(dst_person, []))
        for sa in src:
            for da in dst:
                if self.MG.has_node(sa) and self.MG.has_node(da) and nx.has_path(self.MG, sa, da):
                    path = nx.shortest_path(self.MG, sa, da)
                    hops = [{"from_person": self.owner.get(path[i]),
                             "to_person": self.owner.get(path[i + 1]),
                             "amount": self.MG[path[i]][path[i + 1]]["amount"]}
                            for i in range(len(path) - 1)]
                    return {"source": src_person, "target": dst_person,
                            "hops": hops, "n_hops": len(hops)}
        return None


# module-level singleton
_engine: InvestigationEngine | None = None


def get_engine() -> InvestigationEngine:
    global _engine
    if _engine is None:
        from backend.config import settings
        _engine = InvestigationEngine(settings.data_dir).build()
    return _engine
