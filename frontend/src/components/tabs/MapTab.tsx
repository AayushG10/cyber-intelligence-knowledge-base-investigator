import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from "react-leaflet";
import { Globe2, Map as MapIcon } from "lucide-react";
import type { RingDetail, GeoResponse } from "../../types";
import { inr } from "../../api";
import GlobeView from "../GlobeView";

export default function MapTab({ ring, geo }: { ring: RingDetail | null; geo: GeoResponse | null }) {
  const [mode, setMode] = useState<"globe" | "flat">("globe");
  const pos: Record<string, [number, number]> = {};
  ring?.nodes.forEach((n) => (pos[n.id] = [n.lat, n.lng]));

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 p-1 rounded-xl border border-line bg-black/20 w-fit">
        <button
          onClick={() => setMode("globe")}
          className={`flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
            mode === "globe" ? "text-white" : "text-muted hover:text-txt"
          }`}
          style={mode === "globe" ? { background: "linear-gradient(135deg,#2b4d9e,#4f8cff)" } : undefined}
        >
          <Globe2 size={13} /> Globe
        </button>
        <button
          onClick={() => setMode("flat")}
          className={`flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
            mode === "flat" ? "text-white" : "text-muted hover:text-txt"
          }`}
          style={mode === "flat" ? { background: "linear-gradient(135deg,#2b4d9e,#4f8cff)" } : undefined}
        >
          <MapIcon size={13} /> Tactical map
        </button>
      </div>

      {mode === "globe" ? (
        <div
          className="rounded-xl overflow-hidden border border-line relative"
          style={{ height: 360, background: "radial-gradient(circle at 50% 45%, #0d1424 0%, #05070d 75%)" }}
        >
          <GlobeView ring={ring} geo={geo} />
          <div className="absolute left-3 bottom-3 glass rounded-lg px-2.5 py-1.5 text-[10.5px] text-faint pointer-events-none">
            Drag to rotate &middot; scroll to zoom &middot; gold arcs = money flow
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-line" style={{ height: 360 }}>
          <MapContainer center={[23.5, 80]} zoom={4.4} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />

            {geo?.hotspots.filter((h) => h.flagged > 0).map((h) => (
              <CircleMarker key={h.district} center={[h.lat, h.lng]}
                radius={6 + h.flagged * 1.3}
                pathOptions={{ color: "#ff5872", fillColor: "#ff5872", fillOpacity: 0.32, weight: 1 }}>
                <Popup>
                  <b>{h.district}</b><br />{h.flagged} flagged · {inr(h.loss_inr)} lost
                </Popup>
              </CircleMarker>
            ))}

            {ring?.edges.map((e, i) =>
              pos[e.source] && pos[e.target] ? (
                <Polyline key={i} positions={[pos[e.source], pos[e.target]]}
                  pathOptions={{ color: "#ffb547", weight: 1, opacity: 0.45 }} />
              ) : null
            )}

            {ring?.nodes.map((n) => (
              <CircleMarker key={n.id} center={[n.lat, n.lng]}
                radius={n.is_leader ? 7 : 4}
                pathOptions={{ color: n.is_leader ? "#ffd54a" : "#49b6ff", fillOpacity: 0.9, weight: 1 }}>
                <Popup>{n.is_leader ? "★ " : ""}{n.name} ({n.role})</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      <p className="text-[11px] text-faint px-1">
        Red points = fraud hotspots (size = flagged entities). Gold arcs/lines = money flow across
        districts — the same ring, spanning jurisdictions no single station sees.
      </p>
    </div>
  );
}
