import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import type { RingDetail } from "../types";

// Cytoscape renders on <canvas> and cannot resolve CSS variables — use hex.
const HEX = { High: "#ff5872", Medium: "#ffb547", Low: "#49b6ff" } as const;
const nodeHex = (band: string) => HEX[band as keyof typeof HEX] ?? "#49b6ff";

export default function GraphCanvas({
  ring, onPick,
}: {
  ring: RingDetail | null; onPick?: (id: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!ring || !boxRef.current) return;

    const elements: cytoscape.ElementDefinition[] = [];
    ring.nodes.forEach((n) => {
      const color = n.is_leader ? "#ffd54a" : nodeHex(n.band);
      elements.push({
        data: {
          id: n.id,
          label: n.is_leader ? "★ " + n.name : n.name,
          color,
          size: n.is_leader ? 52 : 22 + n.risk * 26,
          leader: n.is_leader ? 1 : 0,
        },
      });
    });
    ring.edges.forEach((e, i) =>
      elements.push({ data: { id: "e" + i, source: e.source, target: e.target } })
    );

    cyRef.current?.destroy();
    const cy = cytoscape({
      container: boxRef.current,
      elements,
      minZoom: 0.25,
      maxZoom: 2.5,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            width: "data(size)",
            height: "data(size)",
            label: "data(label)",
            color: "#c7d2ee",
            "font-size": "8px",
            "font-family": "Inter, sans-serif",
            "text-valign": "bottom",
            "text-margin-y": 4,
            "border-width": 2,
            "border-color": "#0a0e1a",
            "overlay-opacity": 0,
          },
        },
        {
          selector: "node[leader = 1]",
          style: {
            "border-width": 3,
            "border-color": "#ffd54a",
            "font-size": "10px",
            "font-weight": 700,
            color: "#ffe58a",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.3,
            "line-color": "#33507f",
            "target-arrow-color": "#33507f",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.75,
            "curve-style": "bezier",
            opacity: 0.55,
          },
        },
        {
          selector: "node:selected",
          style: { "border-width": 3, "border-color": "#4f8cff" },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        nodeRepulsion: 12000,
        idealEdgeLength: 80,
        nodeOverlap: 16,
        gravity: 0.5,
        padding: 44,
      } as any,
    });

    cy.on("tap", "node", (evt) => onPick?.(evt.target.id()));
    // ensure sizing is correct after mount, then frame the graph.
    // Guard against StrictMode/HMR unmount destroying cy before this fires.
    const raf = requestAnimationFrame(() => {
      if (!cy.destroyed()) { cy.resize(); cy.fit(undefined, 44); }
    });
    cyRef.current = cy;
    return () => {
      cancelAnimationFrame(raf);
      if (!cy.destroyed()) cy.destroy();
      cyRef.current = null;
    };
  }, [ring]);

  return (
    <div className="relative w-full h-full">
      {/* Cytoscape forces position:relative on its container, so it must size via
          w-full h-full — an `absolute inset-0` container collapses to 0 height. */}
      <div ref={boxRef} className="w-full h-full" />
      {!ring && (
        <div className="absolute inset-0 grid place-items-center text-faint text-sm">
          Select a ring to visualise its network
        </div>
      )}
      {/* legend */}
      <div className="absolute left-4 bottom-4 glass rounded-xl px-3 py-2.5 text-[11px] space-y-1.5">
        {[
          ["#ffd54a", "Ringleader"],
          ["var(--color-danger)", "High risk"],
          ["var(--color-warn)", "Medium"],
          ["var(--color-info)", "Low / victim"],
        ].map(([c, l]) => (
          <div key={l} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            <span className="text-muted">{l}</span>
          </div>
        ))}
      </div>
      {ring && (
        <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
          <div className="glass rounded-lg px-3 py-1.5 text-[11px] text-muted">
            <span className="text-txt font-semibold">{ring.ring_id}</span> · {ring.nodes.length} entities · {ring.edges.length} transfers
          </div>
          <div className="glass rounded-lg px-3 py-1.5 text-[10.5px] text-faint">
            Click any node to investigate →
          </div>
        </div>
      )}
    </div>
  );
}
