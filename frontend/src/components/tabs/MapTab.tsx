import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from "react-leaflet";
import type { RingDetail, GeoResponse } from "../../types";
import { inr } from "../../api";

export default function MapTab({ ring, geo }: { ring: RingDetail | null; geo: GeoResponse | null }) {
  const pos: Record<string, [number, number]> = {};
  ring?.nodes.forEach((n) => (pos[n.id] = [n.lat, n.lng]));

  return (
    <div className="space-y-2">
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
      <p className="text-[11px] text-faint px-1">
        Red circles = fraud hotspots (size = flagged entities). Gold lines = money flow across districts —
        the same ring, spanning jurisdictions no single station sees.
      </p>
    </div>
  );
}
