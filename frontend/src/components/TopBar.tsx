import { ShieldAlert, Users, Network, Flag, Globe2, IndianRupee } from "lucide-react";
import type { Kpis } from "../types";
import { inrShort } from "../api";

const KPI = ({ icon, value, label, tone }: {
  icon: React.ReactNode; value: React.ReactNode; label: string; tone?: string;
}) => (
  <div className="card px-3.5 py-2 flex items-center gap-2.5 min-w-[112px]">
    <div className="opacity-80" style={{ color: tone }}>{icon}</div>
    <div className="leading-tight">
      <div className="text-[16px] font-bold tracking-tight" style={{ color: tone }}>{value}</div>
      <div className="text-[9.5px] uppercase tracking-[0.09em] text-faint">{label}</div>
    </div>
  </div>
);

export default function TopBar({ kpis }: { kpis: Kpis | null }) {
  return (
    <header className="glass flex items-center gap-4 px-5 py-2.5 border-b z-20">
      <div className="flex items-center gap-2.5">
        <div className="grid place-items-center w-9 h-9 rounded-xl"
          style={{ background: "linear-gradient(135deg,#2b4d9e,#4f8cff)" }}>
          <ShieldAlert size={18} />
        </div>
        <div>
          <div className="font-bold text-[15px] tracking-tight leading-none">CyberInvestigator</div>
          <div className="text-[10.5px] text-faint flex items-center gap-1.5 mt-0.5">
            <span className="live-dot inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-good)" }} />
            Fraud Network Intelligence
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2.5 flex-wrap">
        {kpis ? (
          <>
            <KPI icon={<Users size={17} />} value={kpis.entities.toLocaleString("en-IN")} label="Entities" />
            <KPI icon={<Network size={17} />} value={kpis.rings_detected} label="Rings" tone="var(--color-danger)" />
            <KPI icon={<Flag size={17} />} value={kpis.entities_flagged} label="Flagged" tone="var(--color-warn)" />
            <KPI icon={<Globe2 size={17} />} value={kpis.cross_jurisdiction_rings} label="Cross-juris" tone="var(--color-info)" />
            <KPI icon={<IndianRupee size={17} />} value={inrShort(kpis.amount_at_risk_inr)} label="At risk" tone="var(--color-good)" />
          </>
        ) : (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton w-28 h-11 rounded-xl" />)
        )}
      </div>
    </header>
  );
}
