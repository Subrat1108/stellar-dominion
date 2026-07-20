// 2D surface map (docs/17; Slice 1 full-screen pan/zoom) — one HTML5 canvas that
// FILLS its container, with Civ-style pan (drag) + zoom (wheel / +–).
//
// Perf: the transform math is pure (ui/surface/viewport.ts, unit-tested); the
// canvas repaints ONLY on interaction (drag/zoom/hover/selection) or state change
// (grid/climate/founded), coalesced through requestAnimationFrame, and CULLED to
// the visible tile range — so it's O(visible tiles), sub-millisecond, never
// per-frame. The viewport lives in a ref (imperative) so panning/zooming don't
// churn React renders; only hover/selection/size are React state. Cheap on a
// MacBook Air; no per-tile DOM, no Three.js.

import { useMemo, useRef, useEffect, useState, useCallback, type CSSProperties } from "react";
import type { World } from "../sim/ecs/world.ts";
import {
  generateSurface,
  tileAt,
  tileModifiers,
  absLatitudeDeg,
  type TileCoord,
} from "../sim/gen/surface.ts";
import {
  tileAppearanceCss,
  planetClimateOf,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "../render/surface-appearance.ts";
import {
  TILE_PX,
  initialViewport,
  clampPan,
  zoomAt,
  zoomBounds,
  tileScreenRect,
  tileFromScreen,
  visibleTileRange,
  type Viewport,
  type Size,
} from "./surface/viewport.ts";

interface SurfaceMapProps {
  world: World;
  bodyId: number;
  /** The tile a colony has been founded on (marked distinctly), if any. */
  foundedTile?: TileCoord | null;
  /** When provided (no colony yet), selecting a tile offers a SETTLE HERE action
   *  that founds the colony on it. Absent once a colony exists. */
  onFound?: (tile: TileCoord) => void;
}

const CLICK_MOVE_THRESHOLD = 4; // px of drag under which a pointerup counts as a click

export default function SurfaceMap({ world, bodyId, foundedTile = null, onFound }: SurfaceMapProps) {
  const body = world.components.celestialBody.get(bodyId);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vpRef = useRef<Viewport | null>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: number } | null>(null);

  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [hover, setHover] = useState<TileCoord | null>(null);
  const [selected, setSelected] = useState<TileCoord | null>(null);

  // Terrain is a pure fn of (seed, body) — memoise on stable identity.
  const grid = useMemo(
    () => (body ? generateSurface(world.universeSeed, body) : null),
    [world.universeSeed, body],
  );
  // Live climate skin — recomputed only when the body's climate fields move.
  const climate = useMemo(
    () => (body ? planetClimateOf(body) : null),
    [body?.surfaceTempK, body?.hydrosphere, body?.atmosphere?.pressurePa, body?.atmosphere?.hasLiquidWater],
  );

  // --- Painting (imperative, rAF-coalesced, culled to visible tiles) ---
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const vp = vpRef.current;
    if (!canvas || !grid || !climate || !vp || size.w <= 0) return;
    if (canvas.width !== size.w) canvas.width = size.w;
    if (canvas.height !== size.h) canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, size.w, size.h);
    const { x0, y0, x1, y1 } = visibleTileRange(vp, size, grid.width, grid.height);
    const px = TILE_PX * vp.zoom;
    const cover = Math.ceil(px) + 1; // overdraw 1px to avoid seams from rounding

    // 1. Visible surface (climate skin).
    for (let y = y0; y <= y1; y++) {
      const lat = absLatitudeDeg(y, grid.height);
      const sy = y * px + vp.panY;
      for (let x = x0; x <= x1; x++) {
        ctx.fillStyle = tileAppearanceCss(tileAt(grid, x, y), lat, climate);
        ctx.fillRect(x * px + vp.panX, sy, cover, cover);
      }
    }

    // 2. Resource glyphs (only if tiles are big enough to read).
    if (px >= 8) {
      ctx.font = `${Math.min(px - 2, 22)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const t = tileAt(grid, x, y);
          if (t.resources.length === 0) continue;
          const id = t.resources[0]!;
          ctx.fillStyle = id === "fissiles" ? "#f9e2af" : "#f5f5fa";
          ctx.fillText(RESOURCE_GLYPH[id], x * px + vp.panX + px / 2, y * px + vp.panY + px / 2);
        }
      }
    }

    // 3. Founded-colony marker.
    if (foundedTile) {
      const r = tileScreenRect(vp, foundedTile.x, foundedTile.y);
      ctx.strokeStyle = "#a6e3a1";
      ctx.lineWidth = 2;
      ctx.strokeRect(r.sx + 1, r.sy + 1, r.size - 2, r.size - 2);
      ctx.fillStyle = "#a6e3a1";
      const cx = r.sx + r.size / 2, cy = r.sy + r.size / 2, s = Math.max(3, r.size * 0.18);
      ctx.beginPath();
      ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy);
      ctx.closePath(); ctx.fill();
    }

    // 4. Hover + selection outlines.
    if (hover) {
      const r = tileScreenRect(vp, hover.x, hover.y);
      ctx.strokeStyle = "rgba(205,214,244,0.75)"; ctx.lineWidth = 1;
      ctx.strokeRect(r.sx + 0.5, r.sy + 0.5, r.size - 1, r.size - 1);
    }
    if (selected) {
      const r = tileScreenRect(vp, selected.x, selected.y);
      ctx.strokeStyle = "#89b4fa"; ctx.lineWidth = 2;
      ctx.strokeRect(r.sx + 1, r.sy + 1, r.size - 2, r.size - 2);
    }
  }, [grid, climate, size, hover, selected, foundedTile]);

  const requestRepaint = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(paint);
  }, [paint]);

  // Measure the container.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]!.contentRect;
      setSize({ w: Math.floor(cr.width), h: Math.floor(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initialise / re-fit the viewport when the grid changes; keep it in-bounds on resize.
  useEffect(() => {
    if (!grid || size.w <= 0) return;
    if (!vpRef.current) vpRef.current = initialViewport(size, grid.width, grid.height);
    else vpRef.current = clampPan(vpRef.current, size, grid.width, grid.height);
    requestRepaint();
  }, [grid, size, requestRepaint]);

  // Repaint when the derived/paint-relevant state changes.
  useEffect(() => { requestRepaint(); }, [hover, selected, climate, foundedTile, requestRepaint]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Native (non-passive) wheel listener so we can preventDefault the page scroll.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const vp = vpRef.current;
      if (!vp || !grid || size.w <= 0) return;
      const rect = canvas!.getBoundingClientRect();
      const fx = e.clientX - rect.left, fy = e.clientY - rect.top;
      const b = zoomBounds(size, grid.width, grid.height);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.max(b.min, Math.min(b.max, vp.zoom * factor));
      vpRef.current = clampPan(zoomAt(vp, fx, fy, newZoom), size, grid.width, grid.height);
      requestRepaint();
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [grid, size, requestRepaint]);

  const zoomBy = useCallback((factor: number) => {
    const vp = vpRef.current;
    if (!vp || !grid || size.w <= 0) return;
    const b = zoomBounds(size, grid.width, grid.height);
    const newZoom = Math.max(b.min, Math.min(b.max, vp.zoom * factor));
    vpRef.current = clampPan(zoomAt(vp, size.w / 2, size.h / 2, newZoom), size, grid.width, grid.height);
    requestRepaint();
  }, [grid, size, requestRepaint]);

  const fit = useCallback(() => {
    if (!grid || size.w <= 0) return;
    vpRef.current = initialViewport(size, grid.width, grid.height);
    requestRepaint();
  }, [grid, size, requestRepaint]);

  if (!body || !grid) return null;

  function pointerToScreen(e: React.PointerEvent): { sx: number; sy: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const vp = vpRef.current;
    if (!vp) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: vp.panX, panY: vp.panY, moved: 0 };
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const vp = vpRef.current;
    if (!vp || !grid) return;
    const drag = dragRef.current;
    if (drag) {
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      vpRef.current = clampPan({ zoom: vp.zoom, panX: drag.panX + dx, panY: drag.panY + dy }, size, grid.width, grid.height);
      requestRepaint();
    } else {
      const { sx, sy } = pointerToScreen(e);
      const t = tileFromScreen(vp, sx, sy, grid.width, grid.height);
      setHover((prev) => (prev && t && prev.x === t.x && prev.y === t.y ? prev : t));
    }
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    const vp = vpRef.current;
    if (!drag || !vp || !grid) return;
    if (drag.moved < CLICK_MOVE_THRESHOLD) {
      const { sx, sy } = pointerToScreen(e);
      const t = tileFromScreen(vp, sx, sy, grid.width, grid.height);
      setSelected(t);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        style={{ display: "block", width: "100%", height: "100%", cursor: dragRef.current ? "grabbing" : "crosshair", background: "#05060a", touchAction: "none" }}
      />

      {/* Zoom controls (bottom-right). */}
      <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={() => zoomBy(1.25)} style={zoomBtn} title="Zoom in">＋</button>
        <button onClick={() => zoomBy(1 / 1.25)} style={zoomBtn} title="Zoom out">－</button>
        <button onClick={fit} style={zoomBtn} title="Fit whole planet">⤢</button>
      </div>

      {/* Tile inspector (bottom-left) — hover to inspect, click to select. */}
      <TileInfo
        world={world}
        bodyId={bodyId}
        grid={grid}
        tile={selected ?? hover}
        selected={selected}
        {...(onFound ? { onFound } : {})}
      />
    </div>
  );
}

/** Readout for the hovered/selected tile + a SETTLE HERE action when founding. */
function TileInfo({
  world, bodyId, grid, tile, selected, onFound,
}: {
  world: World;
  bodyId: number;
  grid: ReturnType<typeof generateSurface>;
  tile: TileCoord | null;
  selected: TileCoord | null;
  onFound?: (tile: TileCoord) => void;
}) {
  const body = world.components.celestialBody.get(bodyId);
  if (!tile || !body) {
    return (
      <div style={infoStyle}>
        <span style={{ color: "#585b70" }}>Drag to pan · scroll to zoom · hover a tile to inspect · click to select a landing site.</span>
      </div>
    );
  }
  const t = tileAt(grid, tile.x, tile.y);
  const mods = tileModifiers(grid, tile.x, tile.y, body);
  const setup = mods.setupMetalsCost + mods.shieldingMetalsCost;
  const canSettle = !!onFound && !!selected && selected.x === tile.x && selected.y === tile.y;
  return (
    <div style={infoStyle}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ color: "#89b4fa" }}>Tile {tile.x},{tile.y}</span>
        <span style={{ color: "#585b70" }}>{absLatitudeDeg(tile.y, grid.height).toFixed(0)}° lat</span>
        <span style={{ color: "#585b70" }}>alt {(t.altitude * 100).toFixed(0)}%</span>
        <span style={{ color: "#a6adc8" }}>{t.baseTerrain}</span>
        {t.resources.length > 0 && (
          <span style={{ color: "#f5f5fa" }}>
            {t.resources.map((r) => `${RESOURCE_GLYPH[r]} ${RESOURCE_LABEL[r]}`).join(" · ")}
          </span>
        )}
      </div>
      <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#a6e3a1", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>found here → solar ×{mods.solarEfficiency.toFixed(2)}</span>
          {mods.startWaterBonus > 0 && <span>+{mods.startWaterBonus} water</span>}
          {mods.startOxygenBonus > 0 && <span>+{mods.startOxygenBonus} O₂</span>}
          {setup > 0 && <span style={{ color: "#f9e2af" }}>setup −{setup} metals</span>}
        </span>
        {canSettle && (
          <button onClick={() => onFound!(selected!)} style={settleBtn}>⛶ SETTLE HERE</button>
        )}
      </div>
    </div>
  );
}

const zoomBtn: CSSProperties = {
  width: 34, height: 34, fontSize: 16, fontFamily: "inherit", cursor: "pointer",
  background: "rgba(5,6,10,0.85)", color: "#cdd6f4", border: "1px solid #2a2c3f", borderRadius: 4,
};

const settleBtn: CSSProperties = {
  marginLeft: "auto", padding: "4px 12px", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
  background: "#1e3a5f", color: "#89b4fa", border: "1px solid #2a4a7f", borderRadius: 4, letterSpacing: 0.5,
};

const infoStyle: CSSProperties = {
  position: "absolute", left: 12, bottom: 12, maxWidth: "min(680px, 70vw)",
  padding: "6px 10px", background: "rgba(5,6,10,0.88)", border: "1px solid #1e2030", borderRadius: 4,
  font: "11px/1.5 ui-monospace, monospace", color: "#cdd6f4",
};
