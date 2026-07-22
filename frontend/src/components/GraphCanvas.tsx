import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { Crosshair, RefreshCw, Route, X } from "lucide-react";
import type { RingDetail } from "../types";

// Cytoscape renders on <canvas> and cannot resolve CSS variables — use hex.
const HEX = { High: "#ff5872", Medium: "#ffb547", Low: "#49b6ff" } as const;
const nodeHex = (band: string) => HEX[band as keyof typeof HEX] ?? "#49b6ff";

// BFS shortest path over directed money edges (victim → … → ringleader).
function findTrail(ring: RingDetail): string[] {
  const adj = new Map<string, string[]>();
  ring.edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  });
  const target = ring.ringleader;
  const victims = ring.nodes
    .filter((n) => !n.is_leader && n.risk < 0.5)
    .map((n) => n.id);
  for (const start of victims) {
    const prev = new Map<string, string>();
    const q = [start];
    const seen = new Set([start]);
    while (q.length) {
      const cur = q.shift()!;
      if (cur === target) {
        const path = [cur];
        let c = cur;
        while (prev.has(c)) { c = prev.get(c)!; path.unshift(c); }
        if (path.length >= 3) return path;
        break;
      }
      for (const nx of adj.get(cur) ?? []) {
        if (!seen.has(nx)) { seen.add(nx); prev.set(nx, cur); q.push(nx); }
      }
    }
  }
  return [];
}

export default function GraphCanvas({
  ring, onPick,
}: {
  ring: RingDetail | null; onPick?: (id: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const layoutOpts = {
    name: "cose", animate: false, nodeRepulsion: 12000, idealEdgeLength: 80,
    nodeOverlap: 16, gravity: 0.5, padding: 44,
  } as any;
  const [tracing, setTracing] = useState(false);

  useEffect(() => {
    if (!ring || !boxRef.current) return;

    const elements: cytoscape.ElementDefinition[] = [];
    ring.nodes.forEach((n) => {
      elements.push({
        data: {
          id: n.id,
          label: n.is_leader ? "★ " + n.name : n.name,
          color: n.is_leader ? "#ffd54a" : nodeHex(n.band),
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
            width: "data(size)", height: "data(size)",
            label: "data(label)", color: "#c7d2ee", "font-size": "8px",
            "font-family": "Inter, sans-serif", "text-valign": "bottom",
            "text-margin-y": 4, "border-width": 2, "border-color": "#0a0e1a",
            "overlay-opacity": 0, "transition-property": "opacity border-color border-width",
            "transition-duration": 0.15,
          },
        },
        { selector: "node[leader = 1]", style: { "border-width": 3, "border-color": "#ffd54a", "font-size": "10px", "font-weight": 700, color: "#ffe58a" } },
        { selector: "edge", style: { width: 1.3, "line-color": "#33507f", "target-arrow-color": "#33507f", "target-arrow-shape": "triangle", "arrow-scale": 0.75, "curve-style": "bezier", opacity: 0.55 } },
        { selector: "node:selected", style: { "border-width": 3, "border-color": "#4f8cff" } },
        { selector: ".dim", style: { opacity: 0.12 } },
        { selector: ".hl", style: { opacity: 1, "border-color": "#4f8cff", "border-width": 3 } },
        { selector: "edge.hl", style: { "line-color": "#6ea8ff", "target-arrow-color": "#6ea8ff", width: 2.4, opacity: 1 } },
        { selector: ".trail", style: { opacity: 1, "border-color": "#ffd54a", "border-width": 3 } },
        { selector: "edge.trail", style: { "line-color": "#ffd54a", "target-arrow-color": "#ffd54a", width: 3.4, opacity: 1 } },
      ],
      layout: layoutOpts,
    });

    // hover → focus a node's neighbourhood
    cy.on("mouseover", "node", (evt) => {
      if (tracing) return;
      const n = evt.target;
      const hood = n.closedNeighborhood();
      cy.elements().addClass("dim");
      hood.removeClass("dim").addClass("hl");
    });
    cy.on("mouseout", "node", () => {
      if (tracing) return;
      cy.elements().removeClass("dim hl");
    });
    cy.on("tap", "node", (evt) => onPick?.(evt.target.id()));

    const raf = requestAnimationFrame(() => {
      if (!cy.destroyed()) { cy.resize(); cy.fit(undefined, 44); }
    });
    cyRef.current = cy;
    setTracing(false);
    return () => { cancelAnimationFrame(raf); if (!cy.destroyed()) cy.destroy(); cyRef.current = null; };
  }, [ring]);

  const fit = () => cyRef.current?.fit(undefined, 44);
  const relayout = () => { clearTrace(); cyRef.current?.layout(layoutOpts).run(); };

  const traceTrail = () => {
    const cy = cyRef.current;
    if (!cy || !ring) return;
    const path = findTrail(ring);
    if (path.length < 2) return;
    cy.elements().removeClass("hl trail").addClass("dim");
    path.forEach((id) => cy.getElementById(id).removeClass("dim").addClass("trail"));
    for (let i = 0; i < path.length - 1; i++) {
      cy.edges(`[source = "${path[i]}"][target = "${path[i + 1]}"]`).removeClass("dim").addClass("trail");
    }
    cy.animate({ fit: { eles: cy.elements(".trail"), padding: 80 }, duration: 500 });
    setTracing(true);
  };

  const clearTrace = () => {
    cyRef.current?.elements().removeClass("dim hl trail");
    setTracing(false);
    cyRef.current?.fit(undefined, 44);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={boxRef} className="w-full h-full" />
      {!ring && (
        <div className="absolute inset-0 grid place-items-center text-faint text-sm">
          Select a ring to visualise its network
        </div>
      )}

      {/* toolbar */}
      {ring && (
        <div className="absolute left-4 top-4 flex gap-1.5">
          {!tracing ? (
            <button onClick={traceTrail} title="Trace money trail"
              className="glass rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] text-txt hover:border-brand transition-colors">
              <Route size={13} className="text-gold" /> Trace money trail
            </button>
          ) : (
            <button onClick={clearTrace}
              className="glass rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] text-txt hover:border-brand transition-colors"
              style={{ borderColor: "var(--color-gold)" }}>
              <X size={13} className="text-gold" /> Clear trail
            </button>
          )}
          <button onClick={fit} title="Fit to view" className="glass rounded-lg px-2 py-1.5 text-muted hover:text-txt hover:border-brand transition-colors">
            <Crosshair size={14} />
          </button>
          <button onClick={relayout} title="Re-layout" className="glass rounded-lg px-2 py-1.5 text-muted hover:text-txt hover:border-brand transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      )}

      {/* legend */}
      <div className="absolute left-4 bottom-4 glass rounded-xl px-3 py-2.5 text-[11px] space-y-1.5">
        {[["#ffd54a", "Ringleader"], ["var(--color-danger)", "High risk"], ["var(--color-warn)", "Medium"], ["var(--color-info)", "Low / victim"]].map(([c, l]) => (
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
            {tracing ? "Gold path = victim → ringleader money trail" : "Hover to focus · click to investigate →"}
          </div>
        </div>
      )}
    </div>
  );
}
