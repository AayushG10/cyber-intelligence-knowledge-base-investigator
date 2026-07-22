import { User, MapPin, ArrowRightLeft } from "lucide-react";
import type { RingSummary } from "../types";
import { inrShort } from "../api";
import { RiskBadge, riskColor } from "../lib/ui";

export default function RingRail({
  rings, selected, onSelect,
}: {
  rings: RingSummary[]; selected: string | null; onSelect: (id: string) => void;
}) {
  return (
    <aside className="w-[300px] shrink-0 border-r border-line h-full overflow-y-auto px-3.5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint font-semibold">Detected fraud rings</h2>
        <span className="text-[11px] text-faint">{rings.length}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {rings.length === 0 &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-[104px]" />)}

        {rings.map((r) => {
          const active = r.ring_id === selected;
          return (
            <button
              key={r.ring_id}
              onClick={() => onSelect(r.ring_id)}
              className={`card text-left p-3.5 transition-all duration-150 hover:-translate-y-0.5 ${
                active ? "glow-danger" : "hover:border-brand/60"
              }`}
              style={active ? { borderColor: riskColor(r.risk) } : undefined}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[15px] tracking-tight">{r.ring_id}</span>
                <RiskBadge risk={r.risk} />
              </div>
              <div className="risk-bar mb-2.5">
                <span style={{ width: `${Math.round(r.risk * 100)}%`, background: riskColor(r.risk) }} />
              </div>
              <div className="text-[12px] text-muted space-y-1">
                <div className="flex items-center gap-1.5 truncate">
                  <User size={12} className="text-gold shrink-0" />
                  <span className="text-txt font-medium truncate">{r.ringleader_name}</span>
                  <span className="text-faint">· {r.size} · {r.n_mules}m</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="shrink-0" />
                  {r.states.length} states
                  {r.cross_jurisdiction && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ color: "var(--color-warn)", background: "color-mix(in srgb, var(--color-warn) 15%, transparent)" }}>
                      CROSS-JURIS
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowRightLeft size={12} className="shrink-0" />
                  {inrShort(r.total_flow_inr)} flow
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
