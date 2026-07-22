import { useState } from "react";
import { LayoutDashboard, Map as MapIcon, Bot, FileLock2, SearchX } from "lucide-react";
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
  const activeIdx = TABS.findIndex((t) => t.id === tab);

  return (
    <aside className="w-[400px] shrink-0 border-l border-line h-full flex flex-col glass">
      <div className="relative grid grid-cols-4 gap-1 p-2.5 border-b border-line-soft">
        <div
          className="absolute top-2.5 bottom-2.5 rounded-lg transition-all duration-300 ease-out"
          style={{
            left: `calc(${activeIdx} * (100% - 20px) / 4 + 10px)`,
            width: "calc((100% - 20px) / 4)",
            background: "linear-gradient(135deg,#2b4d9e,#4f8cff)",
            boxShadow: "0 4px 14px -4px rgba(79,127,255,0.6)",
          }}
        />
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`btn-press relative z-10 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-colors duration-200 ${
              tab === t.id ? "text-white" : "text-muted hover:text-txt"
            }`}>
            {t.icon}
            <span className="hidden xl:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-4 pt-3.5">
        {!ring ? (
          <div className="flex flex-col items-center text-center mt-16 gap-3">
            <div className="w-12 h-12 rounded-2xl grid place-items-center border border-line bg-ink-800">
              <SearchX size={20} className="text-faint" />
            </div>
            <p className="text-faint text-[13px] max-w-[220px]">
              Select a fraud ring from the left to begin the investigation.
            </p>
          </div>
        ) : (
          <div key={tab + ring.ring_id} className="content-in">
            {tab === "overview" && <OverviewTab ring={ring} />}
            {tab === "map" && <MapTab ring={ring} geo={geo} />}
            {tab === "agent" && <AgentTab ringId={ring.ring_id} />}
            {tab === "evidence" && <EvidenceTab ringId={ring.ring_id} />}
          </div>
        )}
      </div>
    </aside>
  );
}
