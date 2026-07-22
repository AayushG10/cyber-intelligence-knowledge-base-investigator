import { useEffect, useState } from "react";

/** Small radial risk gauge — an SVG ring that animates to `value` (0-1). */
export default function RiskGauge({ value, color, size = 40 }: { value: number; color: string; size?: number }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPct(value), 60);
    return () => clearTimeout(t);
  }, [value]);

  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#141c31" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: size * 0.28, fontWeight: 700, fill: color, fontFamily: "Inter, sans-serif" }}>
        {Math.round(pct * 100)}
      </text>
    </svg>
  );
}
