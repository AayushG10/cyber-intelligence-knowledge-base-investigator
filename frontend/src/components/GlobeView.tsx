import { useEffect, useRef } from "react";
import type { RingDetail, GeoResponse } from "../types";

/**
 * Dependency-free "AI earth globe" — a rotating wireframe sphere rendered on
 * Canvas2D with an orthographic projection (no WebGL/three.js). Plots fraud
 * hotspots / ring entities as glowing points and cross-jurisdiction money
 * flow as animated great-circle arcs.
 */

interface Point { lat: number; lng: number; color: string; radius: number; glow?: boolean }
interface Arc { a: [number, number]; b: [number, number]; color: string }

const TILT = (18 * Math.PI) / 180; // fixed viewing tilt, like looking slightly down at Earth

function project(latDeg: number, lngDeg: number, rotation: number, R: number) {
  const phi = (latDeg * Math.PI) / 180;
  const lambda = (lngDeg * Math.PI) / 180 + rotation;
  let x = R * Math.cos(phi) * Math.sin(lambda);
  let y = R * Math.sin(phi);
  let z = R * Math.cos(phi) * Math.cos(lambda);
  // apply viewing tilt around the x-axis
  const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
  const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
  return { x, y: y2, z: z2 };
}

function slerpPoint(a: [number, number], b: [number, number], t: number): [number, number] {
  const toVec = (lat: number, lng: number) => {
    const phi = (lat * Math.PI) / 180, lambda = (lng * Math.PI) / 180;
    return [Math.cos(phi) * Math.cos(lambda), Math.sin(phi), Math.cos(phi) * Math.sin(lambda)];
  };
  const v0 = toVec(a[0], a[1]), v1 = toVec(b[0], b[1]);
  const dot = Math.max(-1, Math.min(1, v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return a;
  const s0 = Math.sin((1 - t) * omega) / Math.sin(omega);
  const s1 = Math.sin(t * omega) / Math.sin(omega);
  const v = [v0[0] * s0 + v1[0] * s1, v0[1] * s0 + v1[1] * s1, v0[2] * s0 + v1[2] * s1];
  const lat = (Math.asin(v[1]) * 180) / Math.PI;
  const lng = (Math.atan2(v[2], v[0]) * 180) / Math.PI;
  return [lat, lng];
}

export default function GlobeView({ ring, geo }: { ring: RingDetail | null; geo: GeoResponse | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const dataRef = useRef<{ points: Point[]; arcs: Arc[] }>({ points: [], arcs: [] });

  // rebuild point/arc data whenever ring or geo hotspots change
  useEffect(() => {
    const hotspotPoints: Point[] = (geo?.hotspots ?? [])
      .filter((h) => h.flagged > 0)
      .map((h) => ({ lat: h.lat, lng: h.lng, color: "#ff5872", radius: 2.5 + Math.min(h.flagged / 5, 6), glow: true }));

    const ringPoints: Point[] =
      ring?.nodes.map((n) => ({
        lat: n.lat, lng: n.lng,
        color: n.is_leader ? "#ffd54a" : n.band === "High" ? "#ff5872" : n.band === "Medium" ? "#ffb547" : "#49b6ff",
        radius: n.is_leader ? 6 : 2.6,
        glow: n.is_leader,
      })) ?? [];

    const arcs: Arc[] =
      ring?.edges
        .map((e) => {
          const src = ring.nodes.find((n) => n.id === e.source);
          const dst = ring.nodes.find((n) => n.id === e.target);
          if (!src || !dst) return null;
          return { a: [src.lat, src.lng] as [number, number], b: [dst.lat, dst.lng] as [number, number], color: "#ffb547" };
        })
        .filter((a): a is Arc => a !== null) ?? [];

    dataRef.current = { points: ring ? ringPoints : hotspotPoints, arcs };
  }, [ring, geo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const box = canvas.parentElement!;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = box.clientWidth * dpr;
      canvas.height = box.clientHeight * dpr;
      canvas.style.width = box.clientWidth + "px";
      canvas.style.height = box.clientHeight + "px";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    const GRID_LAT = Array.from({ length: 7 }, (_, i) => -75 + i * 25); // parallels
    const GRID_LNG = Array.from({ length: 12 }, (_, i) => i * 30); // meridians

    const draw = () => {
      const W = canvas.width / dpr, H = canvas.height / dpr;
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.36;
      rotRef.current += 0.0022;
      const rot = rotRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // outer atmosphere glow
      const atmo = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.35);
      atmo.addColorStop(0, "rgba(79,127,255,0.22)");
      atmo.addColorStop(1, "rgba(79,127,255,0)");
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // sphere body (subtle radial shading, dark navy)
      const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      body.addColorStop(0, "#141d36");
      body.addColorStop(1, "#080b14");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(120,150,220,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // clip subsequent drawing to the sphere disc
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // graticule: parallels
      ctx.strokeStyle = "rgba(120,150,220,0.16)";
      ctx.lineWidth = 1;
      GRID_LAT.forEach((lat) => {
        ctx.beginPath();
        let started = false;
        for (let lng = 0; lng <= 360; lng += 4) {
          const p = project(lat, lng, rot, R);
          if (p.z < 0) { started = false; continue; }
          const sx = cx + p.x, sy = cy - p.y;
          if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      });
      // meridians
      GRID_LNG.forEach((lng) => {
        ctx.beginPath();
        let started = false;
        for (let lat = -90; lat <= 90; lat += 4) {
          const p = project(lat, lng, rot, R);
          if (p.z < 0) { started = false; continue; }
          const sx = cx + p.x, sy = cy - p.y;
          if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      });

      // arcs (animated dash flow, great-circle interpolation, slight altitude bulge)
      const { points, arcs } = dataRef.current;
      const t = performance.now() / 1000;
      arcs.forEach((arc, ai) => {
        const STEPS = 40;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= STEPS; i++) {
          const frac = i / STEPS;
          const [lat, lng] = slerpPoint(arc.a, arc.b, frac);
          const bulge = Math.sin(frac * Math.PI) * 0.09; // altitude bulge factor
          const p = project(lat, lng, rot, R * (1 + bulge));
          if (p.z < -R * 0.05) { started = false; continue; }
          const sx = cx + p.x, sy = cy - p.y;
          if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = arc.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // a moving pulse dot along the arc
        const pulseT = (t * 0.35 + ai * 0.17) % 1;
        const [plat, plng] = slerpPoint(arc.a, arc.b, pulseT);
        const bulge = Math.sin(pulseT * Math.PI) * 0.09;
        const pp = project(plat, plng, rot, R * (1 + bulge));
        if (pp.z > 0) {
          ctx.beginPath();
          ctx.arc(cx + pp.x, cy - pp.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = arc.color;
          ctx.fill();
        }
      });

      // points (glow for hotspots/ringleader)
      points.forEach((pt) => {
        const p = project(pt.lat, pt.lng, rot, R);
        if (p.z < 0) return;
        const sx = cx + p.x, sy = cy - p.y;
        const depthScale = 0.55 + 0.45 * (p.z / R); // subtle depth-based scaling
        if (pt.glow) {
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, pt.radius * 4);
          g.addColorStop(0, pt.color + "aa");
          g.addColorStop(1, pt.color + "00");
          ctx.beginPath();
          ctx.arc(sx, sy, pt.radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(sx, sy, pt.radius * depthScale, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.fill();
      });

      ctx.restore(); // undo clip

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
