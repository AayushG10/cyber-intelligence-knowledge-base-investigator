import { useEffect, useState } from "react";
import TopBar from "./components/TopBar";
import RingRail from "./components/RingRail";
import GraphCanvas from "./components/GraphCanvas";
import InvestigationPanel from "./components/InvestigationPanel";
import EntityDrawer from "./components/EntityDrawer";
import Landing from "./components/Landing";
import { api } from "./api";
import type { Kpis, RingSummary, RingDetail, GeoResponse } from "./types";

function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rings, setRings] = useState<RingSummary[]>([]);
  const [geo, setGeo] = useState<GeoResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [ring, setRing] = useState<RingDetail | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);

  useEffect(() => {
    api.kpis().then(setKpis).catch(() => {});
    api.geo().then(setGeo).catch(() => {});
    api.rings().then((r) => {
      setRings(r);
      if (r.length) setSelected(r[0].ring_id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) api.ring(selected).then(setRing).catch(() => {});
  }, [selected]);

  return (
    <div className="h-full flex flex-col">
      <TopBar kpis={kpis} />
      <main className="flex-1 flex min-h-0">
        <RingRail rings={rings} selected={selected} onSelect={setSelected} />
        <section className="flex-1 min-w-0 relative grid-bg">
          <GraphCanvas ring={ring} onPick={setEntityId} />
        </section>
        <InvestigationPanel ring={ring} geo={geo} />
      </main>
      <EntityDrawer id={entityId} onClose={() => setEntityId(null)} />
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<"landing" | "app">(
    window.location.hash === "#app" ? "app" : "landing"
  );

  const enterApp = () => {
    window.location.hash = "app";
    setView("app");
  };

  return view === "landing" ? <Landing onEnter={enterApp} /> : <Dashboard />;
}
