import { Clock, Crown, TriangleAlert } from "lucide-react";
import type { RingDetail } from "../../types";
import { inr } from "../../api";
import { Stat } from "../../lib/ui";

export default function OverviewTab({ ring }: { ring: RingDetail }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Crown size={15} className="text-gold" />
        <h3 className="text-[11px] uppercase tracking-[0.12em] text-faint font-semibold">
          {ring.ring_id} · investigation
        </h3>
      </div>

      <div className="card p-3.5">
        <Stat label="Ringleader" value={<span className="text-gold">★ {ring.ringleader_name}</span>} />
        <Stat label="Ringleader ID" value={<span className="mono">{ring.ringleader}</span>} />
        <Stat label="Entities in network" value={ring.size} />
        <Stat label="Mule-like accounts" value={ring.n_mules} />
        <Stat label="Money flow" value={inr(ring.total_flow_inr)} />
        <Stat
          label="Jurisdictions"
          value={<span>{ring.states.length} states {ring.cross_jurisdiction && <TriangleAlert size={13} className="inline text-warn" />}</span>}
          accent={ring.cross_jurisdiction}
        />
      </div>

      <div className="card p-3">
        <div className="text-[11px] text-faint mb-1.5">Districts spanned</div>
        <div className="flex flex-wrap gap-1.5">
          {ring.districts.map((d) => (
            <span key={d} className="text-[11px] px-2 py-0.5 rounded-md"
              style={{ background: "var(--color-ink-700)", color: "var(--color-muted)" }}>
              {d}
            </span>
          ))}
        </div>
      </div>

      {ring.first_detectable && (
        <div className="rounded-xl p-3.5 border"
          style={{ borderColor: "#4a2740", background: "linear-gradient(135deg,#2a1420,#161d34)" }}>
          <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--color-warn)" }}>
            <Clock size={14} /> <span className="text-[12px] font-bold uppercase tracking-wide">Lead-time intelligence</span>
          </div>
          <p className="text-[13px] leading-relaxed text-txt">
            Detectable from{" "}
            <b className="text-warn">{new Date(ring.first_detectable).toLocaleString("en-IN")}</b> — yet{" "}
            <b className="text-warn">{ring.victims_after_detectable} further victim payments</b>{" "}
            occurred afterward. Acting at point of contact instead of complaint would have stopped them.
          </p>
        </div>
      )}
    </div>
  );
}
