import type {
  Kpis, RingSummary, RingDetail, GeoResponse, AgentResponse, PackageResponse, EntityDetail,
} from "./types";

async function j<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

export const api = {
  kpis: () => j<Kpis>("/api/kpis"),
  rings: () => j<RingSummary[]>("/api/rings"),
  ring: (id: string) => j<RingDetail>(`/api/rings/${id}`),
  entity: (id: string) => j<EntityDetail>(`/api/entities/${id}`),
  devices: (id: string) => j<{ device_id: string; shared_by: { person_id: string; name: string; role: string }[] }[]>(`/api/entities/${id}/devices`),
  geo: () => j<GeoResponse>("/api/geo/hotspots"),
  ask: (question: string) =>
    j<AgentResponse>("/api/agent/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  generatePackage: (id: string) =>
    j<PackageResponse>(`/api/rings/${id}/package`, { method: "POST" }),
  verifyLedger: () => j<{ intact: boolean; length?: number }>("/api/ledger/verify"),
};

export const inr = (n: number) =>
  "₹" + Number(n).toLocaleString("en-IN");

export const inrShort = (n: number) => {
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2) + " L";
  return "₹" + Number(n).toLocaleString("en-IN");
};
