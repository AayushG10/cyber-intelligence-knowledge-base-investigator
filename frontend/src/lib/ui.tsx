export const riskLevel = (r: number) =>
  r >= 0.66 ? "High" : r >= 0.33 ? "Medium" : "Low";

export const riskColor = (r: number) =>
  r >= 0.66 ? "var(--color-danger)" : r >= 0.33 ? "var(--color-warn)" : "var(--color-info)";

export const bandColor = (band: string) =>
  band === "High" ? "var(--color-danger)" : band === "Medium" ? "var(--color-warn)" : "var(--color-info)";

export function RiskBadge({ risk }: { risk: number }) {
  const lvl = riskLevel(risk);
  const c = riskColor(risk);
  return (
    <span
      className="text-[10px] font-bold px-2 py-1 rounded-full tracking-wide"
      style={{ color: c, background: `color-mix(in srgb, ${c} 16%, transparent)` }}
    >
      {lvl.toUpperCase()} · {risk.toFixed(2)}
    </span>
  );
}

export function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-line-soft last:border-0">
      <span className="text-muted text-[13px]">{label}</span>
      <span className="font-semibold text-[13px]" style={accent ? { color: "var(--color-warn)" } : undefined}>
        {value}
      </span>
    </div>
  );
}
