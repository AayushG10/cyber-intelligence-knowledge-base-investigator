import { useState } from "react";
import { LayoutDashboard, Map as MapIcon, Bot, FileLock2 } from "lucide-react";
import type { RingDetail, GeoResponse } from "../types";
import OverviewTab from "./tabs/OverviewTab";
import MapTab from "./tabs/MapTab";
import AgentTab from "./tabs/AgentTab";
import EvidenceTab from "./tabs/EvidenceTab";

type Tab = "overview" | "map" | "agent" | "evidence";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={14} /> },
  { id: "map", label: "Map", icon: <MapIcon size={14} /> },
  { id: "agent", label: "Agent", icon: <Bot size={14} /> },
  { id: "evidence", label: "Evidence", icon: <FileLock2 size={14} /> },
];

export default function InvestigationPanel({
  ring, geo,
}: {
  ring: RingDetail | null; geo: GeoResponse | null;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <aside className="w-[400px] shrink-0 border-l border-line h-full flex flex-col glass">
      <div className="grid grid-cols-4 gap-1.5 p-3">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all ${
              tab === t.id ? "text-white" : "text-muted hover:text-txt border border-line"
            }`}
            style={tab === t.id ? { background: "linear-gradient(135deg,#2b4d9e,#4f8cff)" } : undefined}>
            {t.icon}
            <span className="hidden xl:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-4">
        {!ring ? (
          <p className="text-faint text-sm mt-6 text-center">Select a ring to begin the investigation.</p>
        ) : tab === "overview" ? (
          <OverviewTab ring={ring} />
        ) : tab === "map" ? (
          <MapTab ring={ring} geo={geo} />
        ) : tab === "agent" ? (
          <AgentTab ringId={ring.ring_id} />
        ) : (
          <EvidenceTab ringId={ring.ring_id} />
        )}
      </div>
    </aside>
  );
}
