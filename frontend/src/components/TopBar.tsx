import { ShieldAlert, Users, Network, Flag, Globe2, IndianRupee } from "lucide-react";
import type { Kpis } from "../types";
import { inrShort } from "../api";

const KPI = ({ icon, value, label, tone }: {
  icon: React.ReactNode; value: React.ReactNode; label: string; tone: string;
}) => (
  <div className="relative flex items-center gap-3 min-w-[118px] px-3.5 py-2 rounded-xl border border-line
                  bg-gradient-to-b from-white/[0.03] to-transparent hover:border-line-soft transition-colors group">
    <div
      className="w-8 h-8 rounded-lg grid place-items-center shrink-0 transition-transform group-hover:scale-105"
      style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}
    >
      {icon}
    </div>
    <div className="leading-tight">
      <div className="text-[17px] font-bold tracking-tight tabular-nums" style={{ color: tone }}>{value}</div>
      <div className="text-[9.5px] uppercase tracking-[0.1em] text-faint font-medium">{label}</div>
    </div>
  </div>
);

export default function TopBar({ kpis }: { kpis: Kpis | null }) {
  return (
    <header className="relative glass flex items-center gap-5 px-5 py-3 border-b z-20">
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(79,127,255,0.4), transparent)" }}
      />

      <div className="flex items-center gap-3">
        <div
          className="grid place-items-center w-10 h-10 rounded-xl shadow-lg"
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
            <KPI icon={<Users size={16} />} value={kpis.entities.toLocaleString("en-IN")} label="Entities" tone="var(--color-brand-2)" />
            <KPI icon={<Network size={16} />} value={kpis.rings_detected} label="Rings" tone="var(--color-danger)" />
            <KPI icon={<Flag size={16} />} value={kpis.entities_flagged} label="Flagged" tone="var(--color-warn)" />
            <KPI icon={<Globe2 size={16} />} value={kpis.cross_jurisdiction_rings} label="Cross-juris" tone="var(--color-info)" />
            <KPI icon={<IndianRupee size={16} />} value={inrShort(kpis.amount_at_risk_inr)} label="At risk" tone="var(--color-good)" />
          </>
        ) : (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton w-32 h-[52px] rounded-xl" />)
        )}
      </div>
    </header>
  );
}
