import { ShieldAlert, Users, Network, Flag, Globe2, IndianRupee } from "lucide-react";
import type { Kpis } from "../types";
import { inrShort } from "../api";
import { useCountUp } from "../lib/useCountUp";

const KPI = ({ icon, value, label, tone }: {
  icon: React.ReactNode; value: React.ReactNode; label: string; tone: string;
}) => (
  <div className="card-hover relative flex items-center gap-3 min-w-[118px] px-3.5 py-2 rounded-xl border border-line
                  bg-gradient-to-b from-white/[0.03] to-transparent group">
    <div
      className="w-8 h-8 rounded-lg grid place-items-center shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3"
      style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}
    >
      {icon}
    </div>
    <div className="leading-tight">
      <div className="text-[17px] font-bold tracking-tight tabular" style={{ color: tone }}>{value}</div>
      <div className="text-[9.5px] uppercase tracking-[0.1em] text-faint font-medium">{label}</div>
    </div>
  </div>
);

function CountKPI({ icon, target, format, label, tone }: {
  icon: React.ReactNode; target: number; format: (n: number) => string; label: string; tone: string;
}) {
  const n = useCountUp(target);
  return <KPI icon={icon} value={format(n)} label={label} tone={tone} />;
}

export default function TopBar({ kpis }: { kpis: Kpis | null }) {
  return (
    <header className="relative glass flex items-center gap-5 px-5 py-3 border-b z-20">
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(79,127,255,0.4), transparent)" }}
      />

      <div className="flex items-center gap-3">
        <div
          className="grid place-items-center w-10 h-10 rounded-xl shadow-lg transition-transform hover:rotate-6 hover:scale-105"
          style={{ background: "linear-gradient(140deg,#2549a8 0%,#4f7fff 55%,#7aa2ff 100%)", boxShadow: "0 6px 18px -6px rgba(79,127,255,0.6)" }}
        >
          <ShieldAlert size={19} strokeWidth={2.25} />
        </div>
        <div>
          <div className="font-bold text-[15.5px] tracking-tight leading-none">CyberInvestigator</div>
          <div className="text-[10.5px] text-faint flex items-center gap-1.5 mt-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="live-dot absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "var(--color-good)" }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "var(--color-good)" }} />
            </span>
            Fraud Network Intelligence · Live
          </div>
        </div>
      </div>

      <div className="w-px h-9 bg-line mx-1" />

      <div className="ml-auto flex items-center gap-2 flex-wrap">
        {kpis ? (
          <>
            <CountKPI icon={<Users size={16} />} target={kpis.entities} format={(n) => Math.round(n).toLocaleString("en-IN")} label="Entities" tone="var(--color-brand-2)" />
            <CountKPI icon={<Network size={16} />} target={kpis.rings_detected} format={(n) => String(Math.round(n))} label="Rings" tone="var(--color-danger)" />
            <CountKPI icon={<Flag size={16} />} target={kpis.entities_flagged} format={(n) => String(Math.round(n))} label="Flagged" tone="var(--color-warn)" />
            <CountKPI icon={<Globe2 size={16} />} target={kpis.cross_jurisdiction_rings} format={(n) => String(Math.round(n))} label="Cross-juris" tone="var(--color-info)" />
            <CountKPI icon={<IndianRupee size={16} />} target={kpis.amount_at_risk_inr} format={(n) => inrShort(n)} label="At risk" tone="var(--color-good)" />
          </>
        ) : (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton w-32 h-[52px] rounded-xl" />)
        )}
      </div>
    </header>
  );
}
