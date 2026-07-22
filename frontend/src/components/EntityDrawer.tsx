import { useEffect, useState } from "react";
import { X, User, Crown, Smartphone, ShieldAlert, Fingerprint } from "lucide-react";
import { api } from "../api";
import type { EntityDetail } from "../types";
import { bandColor } from "../lib/ui";

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 40); return () => clearTimeout(t); }, [value]);
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-semibold mono" style={{ color }}>{value.toFixed(2)}</span>
      </div>
      <div className="risk-bar">
        <span style={{ width: `${Math.round(w * 100)}%`, background: color, transition: "width 0.5s ease-out" }} />
      </div>
    </div>
  );
}

export default function EntityDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [ent, setEnt] = useState<EntityDetail | null>(null);
  const [devices, setDevices] = useState<{ device_id: string; shared_by: any[] }[]>([]);

  useEffect(() => {
    if (!id) { setEnt(null); return; }
    setEnt(null);
    api.entity(id).then(setEnt).catch(() => {});
    api.devices(id).then(setDevices).catch(() => setDevices([]));
  }, [id]);

  if (!id) return null;
  return (
    <>
          <div
            className="fixed inset-0 bg-black/50 z-40 drawer-fade"
            onClick={onClose}
          />
          <div
            className="fixed right-0 top-0 h-full w-[380px] glass border-l border-line z-50 overflow-y-auto drawer-slide"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-line sticky top-0 glass z-10">
              <div className="flex items-center gap-2">
                <Fingerprint size={16} className="text-brand" />
                <span className="text-[11px] uppercase tracking-[0.12em] text-faint font-semibold">
                  Entity dossier
                </span>
              </div>
              <button onClick={onClose} className="text-muted hover:text-txt p-1 rounded-lg hover:bg-ink-700">
                <X size={16} />
              </button>
            </div>

            {!ent ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14" />)}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0"
                    style={{ background: ent.role === "ringleader" ? "linear-gradient(135deg,#b8860b,#ffd54a)" : "var(--color-ink-700)" }}>
                    {ent.role === "ringleader" ? <Crown size={20} /> : <User size={20} />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[16px] leading-tight truncate">{ent.name}</div>
                    <div className="mono text-[11px] text-faint">{ent.person_id}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: bandColor(ent.scores.risk_band), background: `color-mix(in srgb, ${bandColor(ent.scores.risk_band)} 15%, transparent)` }}>
                        {ent.scores.risk_band} risk
                      </span>
                      <span className="text-[11px] text-muted capitalize">{ent.role}</span>
                    </div>
                  </div>
                </div>

                <div className="card p-3.5 space-y-3">
                  <div className="text-[11px] uppercase tracking-wide text-faint font-semibold flex items-center gap-1.5">
                    <ShieldAlert size={13} /> Risk breakdown
                  </div>
                  <ScoreBar label="Rule engine" value={ent.scores.rule_score} color="var(--color-warn)" />
                  <ScoreBar label="Anomaly (unsupervised)" value={ent.scores.anomaly_score} color="var(--color-info)" />
                  <ScoreBar label="ML model" value={ent.scores.ml_score} color="#a78bfa" />
                  <div className="pt-1 border-t border-line-soft">
                    <ScoreBar label="Fused risk" value={ent.scores.fused_score} color={bandColor(ent.scores.risk_band)} />
                  </div>
                </div>

                {ent.reasons.length > 0 && (
                  <div className="card p-3.5">
                    <div className="text-[11px] uppercase tracking-wide text-faint font-semibold mb-2">
                      Why flagged (explainable)
                    </div>
                    <ul className="space-y-1.5">
                      {ent.reasons.map((r, i) => (
                        <li key={i} className="flex gap-2 text-[12.5px] text-txt leading-snug">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--color-danger)" }} />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="card p-2.5">
                    <div className="text-[10px] text-faint uppercase">Location</div>
                    <div className="text-[13px] font-medium">{ent.district}</div>
                    <div className="text-[11px] text-muted">{ent.state}</div>
                  </div>
                  <div className="card p-2.5">
                    <div className="text-[10px] text-faint uppercase">Account age</div>
                    <div className="text-[13px] font-medium">{ent.features.account_age ?? "—"} days</div>
                    <div className="text-[11px] text-muted">{ent.accounts.length} account(s)</div>
                  </div>
                </div>

                {devices.length > 0 && (
                  <div className="card p-3.5">
                    <div className="text-[11px] uppercase tracking-wide text-faint font-semibold mb-2 flex items-center gap-1.5">
                      <Smartphone size={13} /> Shared-device evidence
                    </div>
                    {devices.map((d) => (
                      <div key={d.device_id} className="mb-2 last:mb-0">
                        <div className="mono text-[11px] text-info">{d.device_id}</div>
                        <div className="text-[11px] text-muted">
                          shared by {d.shared_by.length} entities — {d.shared_by.filter(s => s.role === "mule").length} mules
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {ent.ring_id && (
                  <div className="text-[11px] text-center text-faint">
                    Part of ring <span className="mono text-txt">{ent.ring_id}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
  );
}
