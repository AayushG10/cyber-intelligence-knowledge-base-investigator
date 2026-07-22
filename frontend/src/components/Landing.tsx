import { useEffect, useState } from "react";
import {
  ShieldAlert, Network, Brain, Globe2, FileLock2, Clock, Github, ArrowRight, ArrowDown,
  Upload, ScanSearch, Workflow, MessageSquareText, Gavel, TrendingUp,
  Database, GitBranch, LayoutDashboard, Bot,
} from "lucide-react";
import { api, inrShort } from "../api";
import type { Kpis } from "../types";
import { useCountUp } from "../lib/useCountUp";

const REPO_URL = "https://github.com/AayushG10/cyber-intelligence-knowledge-base-investigator";

function StatPill({ target, format, label, tone }: { target: number; format: (n: number) => string; label: string; tone: string }) {
  const n = useCountUp(target, 1100);
  return (
    <div className="card card-hover px-4 py-3 min-w-[128px] rise-in">
      <div className="text-[20px] font-bold tabular" style={{ color: tone }}>{format(n)}</div>
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-faint font-medium mt-0.5">{label}</div>
    </div>
  );
}

function ProblemStat({ value, label, source }: { value: string; label: string; source: string }) {
  return (
    <div className="card card-hover p-5 rise-in">
      <div className="text-[26px] font-extrabold tracking-tight" style={{ color: "var(--color-danger)" }}>{value}</div>
      <div className="text-[13px] text-txt mt-1 leading-snug">{label}</div>
      <div className="text-[10.5px] text-faint mt-2">{source}</div>
    </div>
  );
}

const FEATURES = [
  { icon: Network, title: "Graph ring detection", tone: "var(--color-danger)",
    body: "Louvain community detection clusters shared devices, UPI handles, and money flow into a single fraud ring — not a list of isolated flagged accounts." },
  { icon: Brain, title: "Explainable AI scoring", tone: "var(--color-brand-2)",
    body: "Rule engine + anomaly detection + supervised model fuse into one score. Every flag ships with human-readable reasons an investigator can act on." },
  { icon: Globe2, title: "Cross-jurisdiction mapping", tone: "var(--color-info)",
    body: "DBSCAN geo-clustering and a live map show a ring spanning districts and states no single police station could see alone." },
  { icon: MessageSquareText, title: "Tool-calling investigation agent", tone: "var(--color-good)",
    body: "An LLM agent queries the case graph live and cites entity & transaction IDs for every claim — reasoning over evidence, not summarising a text dump." },
  { icon: FileLock2, title: "Tamper-evident evidence", tone: "var(--color-warn)",
    body: "One click seals a SHA-256 hash-chained Intelligence Package. Any later edit breaks the chain — built for legal admissibility." },
  { icon: Clock, title: "Lead-time intelligence", tone: "var(--color-gold)",
    body: "Reconstructs exactly when a ring became detectable versus how many victims fell afterward — the number that proves prevention was possible." },
];

const PIPELINE = [
  { icon: Upload, label: "Ingest", body: "Complaints & transactions" },
  { icon: ScanSearch, label: "Resolve", body: "Entities, devices, UPI, IP" },
  { icon: Workflow, label: "Score & detect", body: "Rules · ML · graph rings" },
  { icon: MessageSquareText, label: "Investigate", body: "Agent answers, cited" },
  { icon: Gavel, label: "Seal evidence", body: "Hash-chained package" },
];

function ArchBox({ icon: Icon, title, tone, items, wide }: {
  icon: any; title: string; tone: string; items: string[]; wide?: boolean;
}) {
  return (
    <div className={`card card-hover p-4 ${wide ? "w-[240px]" : "w-[200px]"} text-left`}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
          style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)`, color: tone }}>
          <Icon size={14} />
        </div>
        <span className="font-semibold text-[12.5px]">{title}</span>
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it} className="text-[11px] text-muted flex gap-1.5">
            <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: tone }} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchArrow() {
  return <ArrowDown size={16} className="text-faint my-1.5" />;
}

export default function Landing({ onEnter }: { onEnter: () => void }) {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => { api.kpis().then(setKpis).catch(() => {}); }, []);

  return (
    <div className="h-full overflow-y-auto">
      {/* nav */}
      <nav className="glass sticky top-0 z-30 flex items-center gap-3 px-6 py-3.5 border-b">
        <div className="grid place-items-center w-9 h-9 rounded-xl shadow-lg"
          style={{ background: "linear-gradient(140deg,#2549a8 0%,#4f7fff 55%,#7aa2ff 100%)" }}>
          <ShieldAlert size={17} strokeWidth={2.25} />
        </div>
        <span className="font-bold text-[15px] tracking-tight">CyberInvestigator</span>
        <div className="ml-auto flex items-center gap-3">
          <a href={REPO_URL} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-[12.5px] text-muted hover:text-txt transition-colors">
            <Github size={15} /> GitHub
          </a>
          <button onClick={onEnter}
            className="btn-press btn-shine flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-lg text-white transition-transform hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg,#2b4d9e,#4f8cff)", boxShadow: "0 6px 16px -6px rgba(79,127,255,0.55)" }}>
            Launch command centre <ArrowRight size={13} />
          </button>
        </div>
      </nav>

      {/* hero */}
      <section className="relative px-6 pt-16 pb-14 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10 grid-bg opacity-40" />
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium text-brand-2 mb-6 rise-in"
          style={{ borderColor: "color-mix(in srgb, var(--color-brand) 40%, transparent)", background: "color-mix(in srgb, var(--color-brand) 10%, transparent)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: "var(--color-brand-2)" }} />
          AI for Digital Public Safety · National Hackathon
        </div>

        <h1 className="rise-in text-[40px] md:text-[52px] font-extrabold tracking-tight leading-[1.08] max-w-3xl mx-auto"
          style={{ animationDelay: "60ms" }}>
          See the fraud <span style={{ color: "var(--color-danger)" }}>network</span> —
          not just the transaction.
        </h1>

        <p className="rise-in text-[16px] text-muted max-w-xl mx-auto mt-5 leading-relaxed" style={{ animationDelay: "120ms" }}>
          CyberInvestigator turns raw complaints and transfers into mapped fraud rings,
          an identified ringleader, and a court-admissible evidence package —
          before mass victimisation, not after.
        </p>

        <div className="rise-in flex items-center justify-center gap-3 mt-8" style={{ animationDelay: "180ms" }}>
          <button onClick={onEnter}
            className="btn-press btn-shine flex items-center gap-2 text-[14px] font-semibold px-5 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#2b4d9e,#4f8cff)", boxShadow: "0 10px 28px -8px rgba(79,127,255,0.6)" }}>
            Launch command centre <ArrowRight size={16} />
          </button>
          <a href={REPO_URL} target="_blank" rel="noreferrer"
            className="btn-press flex items-center gap-2 text-[14px] font-medium px-5 py-3 rounded-xl border border-line text-txt hover:border-line-soft transition-colors">
            <Github size={16} /> View source
          </a>
        </div>

        <div className="rise-in flex items-center justify-center gap-3 mt-10 flex-wrap" style={{ animationDelay: "240ms" }}>
          {kpis ? (
            <>
              <StatPill target={kpis.entities} format={(n) => Math.round(n).toLocaleString("en-IN")} label="Entities analysed" tone="var(--color-brand-2)" />
              <StatPill target={kpis.rings_detected} format={(n) => String(Math.round(n))} label="Rings detected" tone="var(--color-danger)" />
              <StatPill target={kpis.entities_flagged} format={(n) => String(Math.round(n))} label="Entities flagged" tone="var(--color-warn)" />
              <StatPill target={kpis.amount_at_risk_inr} format={(n) => inrShort(n)} label="Amount at risk" tone="var(--color-good)" />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton w-32 h-[62px]" />)
          )}
        </div>
      </section>

      {/* problem */}
      <section className="px-6 py-14 max-w-5xl mx-auto">
        <h2 className="text-center text-[12px] uppercase tracking-[0.14em] text-faint font-semibold mb-8">
          The problem law enforcement faces today
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <ProblemStat value="1.14M" label="cybercrime complaints registered in India in 2023 — up 60% year over year" source="Ministry of Home Affairs" />
          <ProblemStat value="₹1,776 Cr" label="lost to digital arrest scams in just the first nine months of 2024" source="Ministry of Home Affairs" />
          <ProblemStat value="Record" label="high-quality FICN (fake currency) seizures defeating manual detection" source="RBI Annual Report 2025" />
        </div>
        <p className="text-center text-muted text-[13.5px] max-w-2xl mx-auto mt-6 leading-relaxed">
          What's missing isn't evidence after the fact — it's intelligence <em>before</em> mass
          victimisation, and tools that reveal the whole network, not one flagged transaction at a time.
        </p>
      </section>

      {/* pipeline */}
      <section className="px-6 py-14 border-y border-line-soft" style={{ background: "rgba(255,255,255,0.015)" }}>
        <h2 className="text-center text-[12px] uppercase tracking-[0.14em] text-faint font-semibold mb-10">
          How CyberInvestigator works
        </h2>
        <div className="flex items-stretch justify-center gap-2 max-w-5xl mx-auto flex-wrap">
          {PIPELINE.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="card card-hover px-4 py-4 w-[150px] text-center rise-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-9 h-9 rounded-xl grid place-items-center mx-auto mb-2.5"
                  style={{ background: "color-mix(in srgb, var(--color-brand) 16%, transparent)", color: "var(--color-brand-2)" }}>
                  <s.icon size={16} />
                </div>
                <div className="font-semibold text-[13px]">{s.label}</div>
                <div className="text-[11px] text-faint mt-1 leading-snug">{s.body}</div>
              </div>
              {i < PIPELINE.length - 1 && (
                <ArrowRight size={16} className="text-faint shrink-0 hidden md:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* architecture */}
      <section className="px-6 py-14 max-w-5xl mx-auto">
        <h2 className="text-center text-[12px] uppercase tracking-[0.14em] text-faint font-semibold mb-2">
          System architecture
        </h2>
        <p className="text-center text-muted text-[13px] max-w-xl mx-auto mb-10">
          A modular monolith — detection runs in-process, Neo4j and the LLM are optional
          enhancers, not hard dependencies. Full rationale in <code className="mono text-[11.5px] px-1 py-0.5 rounded" style={{ background: "var(--color-ink-700)" }}>AGENTS.md</code>.
        </p>

        <div className="flex flex-col items-center">
          <ArchBox icon={Database} title="Synthetic dataset" tone="var(--color-brand-2)" wide
            items={["Persons · accounts · UPI · devices · IP", "Transactions with planted fraud rings", "Deterministic, seed-based generator"]} />
          <ArchArrow />
          <div className="flex flex-wrap justify-center gap-3">
            <ArchBox icon={ScanSearch} title="Entity resolution" tone="var(--color-info)"
              items={["Deterministic normalization", "Velocity + graph features"]} />
            <ArchBox icon={Brain} title="Scoring engine" tone="var(--color-warn)"
              items={["Rule engine (explainable)", "IsolationForest + RandomForest", "Fused risk score"]} />
            <ArchBox icon={GitBranch} title="Graph engine" tone="var(--color-danger)"
              items={["Louvain (rings) · Betweenness (leader)", "WCC · shortest-path · DBSCAN geo", "Runs in NetworkX — no GDS needed"]} />
          </div>
          <ArchArrow />
          <ArchBox icon={FileLock2} title="FastAPI + hash-chained ledger" tone="var(--color-good)" wide
            items={["REST investigation API", "SHA-256 chained evidence packages", "Optional: Neo4j Aura for graph storage"]} />
          <ArchArrow />
          <div className="flex flex-wrap justify-center gap-3">
            <ArchBox icon={LayoutDashboard} title="React command centre" tone="var(--color-brand-2)"
              items={["Graph · map · globe · evidence", "Vite + TypeScript + Tailwind"]} />
            <ArchBox icon={Bot} title="Tool-calling agent" tone="var(--color-gold)"
              items={["OpenRouter (model-agnostic)", "Cites entity/txn IDs · offline fallback"]} />
          </div>
        </div>
      </section>

      {/* features */}
      <section className="px-6 py-14 max-w-5xl mx-auto border-t border-line-soft">
        <h2 className="text-center text-[12px] uppercase tracking-[0.14em] text-faint font-semibold mb-10">
          Built for investigators, not another fraud dashboard
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="card card-hover p-5 rise-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="w-10 h-10 rounded-xl grid place-items-center mb-3.5"
                style={{ background: `color-mix(in srgb, ${f.tone} 16%, transparent)`, color: f.tone }}>
                <f.icon size={18} />
              </div>
              <div className="font-semibold text-[14.5px] mb-1.5">{f.title}</div>
              <p className="text-[12.5px] text-muted leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* tech strip */}
      <section className="px-6 py-10 text-center">
        <div className="text-[11px] uppercase tracking-[0.12em] text-faint font-semibold mb-4">Under the hood</div>
        <div className="flex items-center justify-center gap-2 flex-wrap max-w-3xl mx-auto">
          {["FastAPI", "React + TypeScript", "NetworkX", "scikit-learn", "Neo4j Aura", "OpenRouter", "Leaflet", "Cytoscape.js"].map((t) => (
            <span key={t} className="text-[12px] px-3 py-1.5 rounded-full border border-line text-muted">{t}</span>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="px-6 pb-20 pt-4 text-center">
        <div className="card max-w-2xl mx-auto p-8">
          <TrendingUp size={22} className="mx-auto mb-3 text-good" />
          <h3 className="text-[20px] font-bold mb-2">See it catch a ring in real time</h3>
          <p className="text-[13.5px] text-muted mb-6">
            Live on synthetic data with 3 planted fraud rings, ready to investigate.
          </p>
          <button onClick={onEnter}
            className="btn-press btn-shine inline-flex items-center gap-2 text-[14px] font-semibold px-5 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#2b4d9e,#4f8cff)", boxShadow: "0 10px 28px -8px rgba(79,127,255,0.6)" }}>
            Launch command centre <ArrowRight size={16} />
          </button>
        </div>
        <p className="text-[11px] text-faint mt-8">
          Built for a national AI hackathon · synthetic demo data · not for production use
        </p>
      </section>
    </div>
  );
}
