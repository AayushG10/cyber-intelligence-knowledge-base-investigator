import { useState } from "react";
import { FileLock2, ShieldCheck, Link2, Loader2 } from "lucide-react";
import { api } from "../../api";
import type { PackageResponse } from "../../types";

export default function EvidenceTab({ ringId }: { ringId: string }) {
  const [pkg, setPkg] = useState<PackageResponse | null>(null);
  const [ledger, setLedger] = useState<{ intact: boolean; length?: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const p = await api.generatePackage(ringId);
      const v = await api.verifyLedger();
      setPkg(p); setLedger(v);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileLock2 size={15} className="text-warn" />
        <h3 className="text-[11px] uppercase tracking-[0.12em] text-faint font-semibold">
          Court-admissible evidence
        </h3>
      </div>

      <p className="text-[12.5px] text-muted leading-relaxed">
        Seals {ringId}'s evidence — entities, scores, money trail and lead-time — into a
        SHA-256 hash-chained package. Any later tampering breaks the chain.
      </p>

      <button onClick={generate} disabled={busy}
        className="w-full py-3 rounded-xl font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#ffb547,#ff8a3d)", color: "#241300" }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileLock2 size={16} />}
        {busy ? "Sealing evidence…" : "Generate Intelligence Package"}
      </button>

      {pkg && (
        <div className="space-y-2.5">
          <div className="card p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-good font-semibold text-[13px]">
              <ShieldCheck size={15} /> Package #{pkg.seq} sealed
            </div>
            <div>
              <div className="text-[10px] text-faint uppercase tracking-wide mb-1">SHA-256</div>
              <div className="mono text-[11px] text-good break-all leading-relaxed">{pkg.this_hash}</div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <Link2 size={12} /> chained to prev:
              <span className="mono">{pkg.prev_hash.slice(0, 20)}…</span>
            </div>
            {ledger && (
              <div className="text-[11px]">
                ledger integrity:{" "}
                <span className={ledger.intact ? "text-good font-semibold" : "text-danger font-semibold"}>
                  {ledger.intact ? `INTACT (${ledger.length} entries)` : "BROKEN"}
                </span>
              </div>
            )}
          </div>

          <details className="card p-3">
            <summary className="cursor-pointer text-[12px] text-muted select-none">View package JSON</summary>
            <pre className="mono text-[10.5px] mt-2 overflow-x-auto leading-relaxed text-faint whitespace-pre-wrap">
              {JSON.stringify(pkg.package, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
