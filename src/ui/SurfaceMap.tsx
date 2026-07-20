// 2D surface map (docs/17) — a full HTML5 Canvas grid of the landed planet.
//
// Rendering approach + perf: ONE <canvas>, not per-tile React DOM (4608 nodes
// would be heavy) and not Three.js (no 3D). ~4608 fillRect + sparse glyph ops is
// sub-millisecond, and the map is static — repainted only on grid change / hover
// / selection, never per frame. Cheap on a MacBook Air.
//
// Commit 2 renders the BARE substrate (altitude shading + base terrain + resource
// icons) for every world; the habitable climate skin (water/veg/snow) layers on
// in a later commit. Clicking a tile selects it and previews what founding there
// would give (the tile→siteModifiers mapping); wiring the actual FoundColony{tile}
// is the next commit.

import { useMemo, useRef, useEffect, useState, type CSSProperties } from "react";
import type { World } from "../sim/ecs/world.ts";
import {
  generateSurface,
  tileAt,
  tileModifiers,
  absLatitudeDeg,
  type TileCoord,
} from "../sim/gen/surface.ts";
import {
  baseTileColorCss,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "../render/surface-appearance.ts";

/** Logical pixels per tile in the canvas backing store (CSS scales to fit). */
const CELL = 10;

interface SurfaceMapProps {
  world: World;
  bodyId: number;
  /** The tile a colony has been founded on (marked distinctly), if any. */
  foundedTile?: TileCoord | null;
  /** Called when the player selects a tile (commit 3 wires founding through this). */
  onSelectTile?: (tile: TileCoord) => void;
}

export default function SurfaceMap({ world, bodyId, foundedTile = null, onSelectTile }: SurfaceMapProps) {
  const body = world.components.celestialBody.get(bodyId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<TileCoord | null>(null);
  const [selected, setSelected] = useState<TileCoord | null>(null);

  // Terrain is a pure fn of (seed, body) — memoise on stable identity.
  const grid = useMemo(
    () => (body ? generateSurface(world.universeSeed, body) : null),
    [world.universeSeed, body],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Base terrain (bare substrate + altitude shading).
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        ctx.fillStyle = baseTileColorCss(tileAt(grid, x, y));
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    // 2. Resource glyphs (sparse — only resourced tiles).
    ctx.font = `${CELL - 2}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const t = tileAt(grid, x, y);
        if (t.resources.length === 0) continue;
        const id = t.resources[0]!;
        ctx.fillStyle = id === "fissiles" ? "#f9e2af" : "#f5f5fa";
        ctx.fillText(RESOURCE_GLYPH[id], x * CELL + CELL / 2, y * CELL + CELL / 2 + 0.5);
      }
    }

    // 3. Founded-colony marker (distinct — a filled diamond + ring).
    if (foundedTile) {
      const cx = foundedTile.x * CELL + CELL / 2;
      const cy = foundedTile.y * CELL + CELL / 2;
      ctx.strokeStyle = "#a6e3a1";
      ctx.lineWidth = 2;
      ctx.strokeRect(foundedTile.x * CELL + 1, foundedTile.y * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = "#a6e3a1";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 3); ctx.lineTo(cx + 3, cy); ctx.lineTo(cx, cy + 3); ctx.lineTo(cx - 3, cy);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Hover + selection outlines.
    if (hover) {
      ctx.strokeStyle = "rgba(205,214,244,0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * CELL + 0.5, hover.y * CELL + 0.5, CELL - 1, CELL - 1);
    }
    if (selected) {
      ctx.strokeStyle = "#89b4fa";
      ctx.lineWidth = 2;
      ctx.strokeRect(selected.x * CELL + 1, selected.y * CELL + 1, CELL - 2, CELL - 2);
    }
  }, [grid, hover, selected, foundedTile]);

  if (!body || !grid) return null;

  function tileFromEvent(e: React.MouseEvent<HTMLCanvasElement>): TileCoord | null {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * grid.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * grid.height);
    if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return null;
    return { x, y };
  }

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const t = tileFromEvent(e);
    setHover((prev) => (prev && t && prev.x === t.x && prev.y === t.y ? prev : t));
  }
  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const t = tileFromEvent(e);
    if (!t) return;
    setSelected(t);
    onSelectTile?.(t);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <canvas
        ref={canvasRef}
        width={grid.width * CELL}
        height={grid.height * CELL}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
        style={{
          width: "min(90vw, 940px)",
          height: "auto",
          imageRendering: "pixelated",
          border: "1px solid #2a2c3f",
          borderRadius: 4,
          cursor: "crosshair",
          background: "#05060a",
        }}
      />
      <TileInfo world={world} bodyId={bodyId} grid={grid} tile={selected ?? hover} />
    </div>
  );
}

/** Readout for the hovered/selected tile: terrain, resources, and a preview of
 *  the founding modifiers settling there would give. */
function TileInfo({
  world,
  bodyId,
  grid,
  tile,
}: {
  world: World;
  bodyId: number;
  grid: ReturnType<typeof generateSurface>;
  tile: TileCoord | null;
}) {
  const body = world.components.celestialBody.get(bodyId);
  if (!tile || !body) {
    return (
      <div style={infoStyle}>
        <span style={{ color: "#585b70" }}>Hover a tile to inspect it · click to select a landing site.</span>
      </div>
    );
  }
  const t = tileAt(grid, tile.x, tile.y);
  const mods = tileModifiers(grid, tile.x, tile.y, body);
  const setup = mods.setupMetalsCost + mods.shieldingMetalsCost;
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
      <div style={{ marginTop: 4, fontSize: 10, color: "#a6e3a1", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span>found here → solar ×{mods.solarEfficiency.toFixed(2)}</span>
        {mods.startWaterBonus > 0 && <span>+{mods.startWaterBonus} water</span>}
        {mods.startOxygenBonus > 0 && <span>+{mods.startOxygenBonus} O₂</span>}
        {setup > 0 && <span style={{ color: "#f9e2af" }}>setup −{setup} metals</span>}
      </div>
    </div>
  );
}

const infoStyle: CSSProperties = {
  width: "min(90vw, 940px)",
  padding: "6px 10px",
  background: "rgba(5,6,10,0.85)",
  border: "1px solid #1e2030",
  borderRadius: 4,
  font: "11px/1.5 ui-monospace, monospace",
  color: "#cdd6f4",
  minHeight: 34,
};
