import { User, MapPin, ArrowRightLeft, ChevronRight } from "lucide-react";
import type { RingSummary } from "../types";
import { inrShort } from "../api";
import { riskColor, riskLevel } from "../lib/ui";
import RiskGauge from "./RiskGauge";

export default function RingRail({
  rings, selected, onSelect,
}: {
  rings: RingSummary[]; selected: string | null; onSelect: (id: string) => void;
}) {
  return (
    <aside className="w-[300px] shrink-0 border-r border-line h-full overflow-y-auto px-3.5 py-4 bg-black/10">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-faint font-semibold">Detected fraud rings</h2>
        <span className="text-[10.5px] text-faint mono bg-ink-700 px-1.5 py-0.5 rounded">{rings.length}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {rings.length === 0 &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-[112px]" />)}

        {rings.map((r, i) => {
          const active = r.ring_id === selected;
          const color = riskColor(r.risk);
          return (
            <button
              key={r.ring_id}
              onClick={() => onSelect(r.ring_id)}
              className={`btn-press rise-in relative overflow-hidden text-left p-3.5 rounded-[14px] border transition-all duration-200
                ${active ? "glow-danger" : "border-line hover:border-line-soft hover:-translate-y-0.5 hover:shadow-lg"}`}
              style={{
                animationDelay: `${i * 60}ms`,
                borderColor: active ? color : undefined,
                background: active
                  ? `linear-gradient(165deg, color-mix(in srgb, ${color} 12%, #171f36), rgba(11,15,27,0.75))`
                  : "linear-gradient(165deg, rgba(23,31,54,0.65), rgba(11,15,27,0.55))",
              }}
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
                style={{ background: color, opacity: active ? 1 : 0.55 }}
              />

              <div className="flex items-start gap-3 pl-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="font-bold text-[15px] tracking-tight">{r.ring_id}</span>
                    {active && <ChevronRight size={14} style={{ color }} />}
                    <span className="text-[9.5px] uppercase font-bold tracking-wide ml-auto pr-1" style={{ color }}>
                      {riskLevel(r.risk)}
                    </span>
                  </div>

                  <div className="text-[12px] text-muted space-y-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <User size={12} className="text-gold shrink-0" />
                      <span className="text-txt font-medium truncate">{r.ringleader_name}</span>
                      <span className="text-faint">· {r.size} · {r.n_mules}m</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="shrink-0" />
                      {r.states.length} states
                      {r.cross_jurisdiction && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded tracking-wide"
                          style={{ color: "var(--color-warn)", background: "color-mix(in srgb, var(--color-warn) 16%, transparent)" }}>
                          CROSS-JURIS
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ArrowRightLeft size={12} className="shrink-0" />
                      <span className="font-medium text-txt/90">{inrShort(r.total_flow_inr)}</span> flow
                    </div>
                  </div>
                </div>

                <RiskGauge value={r.risk} color={color} size={44} />
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
