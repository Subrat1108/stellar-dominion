// Deterministic planet surface generator — the surface layer (docs/17).
//
// From a body's stable seed, produces a 2D tile grid: per-tile IMMUTABLE
// altitude (coherent value-noise, archetype-biased), sparse/clustered resources,
// and a base terrain substrate. Pure + deterministic — same (universeSeed, body)
// → byte-identical grid, every load, on every machine (xxHash-seeded RNG, no
// Math.random). Stored NOWHERE: terrain regenerates from seed; only the player's
// colony.tile (a placement delta) is saved.
//
// The BOUNDARY (docs/09 2026-07-20): this is terrain + placement + a source of
// the existing siteModifiers() attributes. It is NOT a per-tile economy — no
// per-tile production/population/stockpiles. The colony stays aggregate.
//
// Altitude never changes. The visible surface (water/vegetation/snow) is a
// SEPARATE derived climate skin (see surface/appearance.ts) computed from the
// current planet state — that split is what lets hydrosphere rise flood low
// tiles later without any per-tile save state.

import type { CelestialBody } from "../ecs/components.ts";
import { makeRng, hashSeed, type Rng } from "../math/rng.ts";
import { xxHashString } from "./hash.ts";
import { localStrategicResources } from "./strategic.ts";
import { siteModifiers, type CandidateSite, type SiteModifiers } from "./sites.ts";

/** Default grid: 96×48 (2:1 lat/long aspect; 4608 tiles). Tunable. */
export const SURFACE_WIDTH = 96;
export const SURFACE_HEIGHT = 48;

/** Base terrain substrate — the BARE (hostile-world) look. Climate skin overlays this. */
export type BaseTerrain = "rock" | "regolith" | "sand" | "basalt" | "ice" | "lowland" | "highland";

/** Surface resource deposits (sparse). Grounded in the docs/10 resource set + ISRU. */
export type SurfaceResourceId =
  | "metals"
  | "rareMetals"
  | "volatiles"
  | "geothermal"
  | "organics"
  | "fissiles";

export interface TileCoord {
  x: number;
  y: number;
}

/** One immutable, seed-derived surface tile. */
export interface SurfaceTile {
  /** Elevation, 0 (deepest basin) – 1 (highest peak). NEVER changes. */
  altitude: number;
  /** Resource deposits on this tile — usually empty (deposits are sparse + clustered). */
  resources: SurfaceResourceId[];
  /** Substrate terrain type (the bare look; the climate skin overlays it). */
  baseTerrain: BaseTerrain;
}

export interface SurfaceGrid {
  width: number;
  height: number;
  /** Row-major, length width*height. Row 0 = north pole … row H-1 = south pole. */
  tiles: SurfaceTile[];
}

export interface SurfaceDims {
  width: number;
  height: number;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function tileIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

export function tileAt(grid: SurfaceGrid, x: number, y: number): SurfaceTile {
  return grid.tiles[tileIndex(grid.width, x, y)]!;
}

/**
 * Absolute latitude (degrees, 0 = equator, 90 = pole) for a grid row. Row 0 is
 * the north pole, row H-1 the south pole; the middle rows are the equator.
 */
export function absLatitudeDeg(y: number, height: number): number {
  const signed = ((y + 0.5) / height) * 180 - 90; // -90 (N) … +90 (S)
  return Math.abs(signed);
}

// ---------------------------------------------------------------------------
// Terrain character (body-only, so the generator stays a pure fn of the body)
// ---------------------------------------------------------------------------

type TerrainClass = "molten" | "desert" | "frozen" | "temperate" | "barren";

/** Coarse terrain character from body fields (no star lookup needed). */
function terrainClass(body: CelestialBody): TerrainClass {
  const t = body.surfaceTempK ?? 288;
  const pAtm = (body.atmosphere?.pressurePa ?? 0) / 101_325;
  const water = (body.atmosphere?.hasLiquidWater ?? false) || (body.hydrosphere ?? 0) > 0.3;
  if (t > 450) return "molten";
  if (t < 230) return "frozen";
  if (pAtm < 0.05) return "barren"; // effectively airless → cratered rock/regolith
  if (water || (t > 260 && t < 320 && pAtm > 0.2)) return "temperate";
  return "desert";
}

/** Per-class altitude shaping: how rough, and how the mean shifts. */
function altitudeBias(cls: TerrainClass): { roughness: number; meanShift: number } {
  switch (cls) {
    case "molten": return { roughness: 1.35, meanShift: 0.05 };  // volcanic, jagged
    case "barren": return { roughness: 1.3, meanShift: 0.0 };    // cratered
    case "frozen": return { roughness: 1.0, meanShift: 0.0 };
    case "temperate": return { roughness: 0.9, meanShift: -0.08 }; // more basins to pool water
    case "desert":
    default: return { roughness: 1.05, meanShift: -0.02 };
  }
}

function baseTerrainFor(cls: TerrainClass, altitude: number): BaseTerrain {
  const high = altitude > 0.6;
  switch (cls) {
    case "molten": return high ? "rock" : "basalt";
    case "frozen": return high ? "rock" : "ice";
    case "barren": return high ? "rock" : "regolith";
    case "temperate": return high ? "highland" : "lowland";
    case "desert":
    default: return high ? "rock" : "sand";
  }
}

// ---------------------------------------------------------------------------
// Coherent value-noise altitude field (x-wrapped for longitude continuity)
// ---------------------------------------------------------------------------

interface Octave {
  cellsX: number;
  cellsY: number;
  amp: number;
}

const ALTITUDE_OCTAVES: Octave[] = [
  { cellsX: 6, cellsY: 4, amp: 1.0 },
  { cellsX: 12, cellsY: 8, amp: 0.5 },
  { cellsX: 24, cellsY: 16, amp: 0.25 },
];

/** Bilinearly-sampled random lattice, wrapping in x (longitude), clamping in y. */
function sampleOctave(lattice: number[], cellsX: number, cellsY: number, u: number, v: number): number {
  const fx = u * cellsX;
  const fy = v * (cellsY - 1);
  const ix0 = Math.floor(fx);
  const iy0 = Math.floor(fy);
  const tx = fx - ix0;
  const ty = fy - iy0;
  const x0 = ((ix0 % cellsX) + cellsX) % cellsX;
  const x1 = (x0 + 1) % cellsX;
  const y0 = Math.max(0, Math.min(cellsY - 1, iy0));
  const y1 = Math.max(0, Math.min(cellsY - 1, iy0 + 1));
  const v00 = lattice[y0 * cellsX + x0]!;
  const v10 = lattice[y0 * cellsX + x1]!;
  const v01 = lattice[y1 * cellsX + x0]!;
  const v11 = lattice[y1 * cellsX + x1]!;
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * ty;
}

/** Raw fractal altitude in [0,1] per tile (before archetype shaping). */
function fractalAltitude(rng: Rng, width: number, height: number): Float64Array {
  const lattices = ALTITUDE_OCTAVES.map((o) => {
    const arr: number[] = [];
    for (let i = 0; i < o.cellsX * o.cellsY; i++) arr.push(rng.next());
    return arr;
  });
  const totalAmp = ALTITUDE_OCTAVES.reduce((s, o) => s + o.amp, 0);
  const out = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / width;
      let sum = 0;
      for (let o = 0; o < ALTITUDE_OCTAVES.length; o++) {
        const oc = ALTITUDE_OCTAVES[o]!;
        sum += oc.amp * sampleOctave(lattices[o]!, oc.cellsX, oc.cellsY, u, v);
      }
      out[tileIndex(width, x, y)] = sum / totalAmp;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resource placement — SPARSE + CLUSTERED (absolute count, NOT scaled by area)
// ---------------------------------------------------------------------------

/** Deposit count for a whole planet — deliberately low so resources are FOUND,
 *  not sprinkled. Independent of grid size (prospecting-feel, docs/17). */
const MIN_DEPOSITS = 6;
const MAX_DEPOSITS = 14;

/** General (non-fissile) deposit type, weighted by terrain + altitude at the site. */
function rollResource(rng: Rng, cls: TerrainClass, altitude: number): SurfaceResourceId {
  // Weight table, then a weighted pick from the rng.
  const w: [SurfaceResourceId, number][] = [
    ["metals", 3 + (altitude > 0.6 ? 3 : 0)],             // high/rocky → metals
    ["volatiles", 2 + (altitude < 0.4 ? 3 : 0) + (cls === "frozen" ? 2 : 0)], // low/cold → ice
    ["geothermal", cls === "molten" || cls === "desert" ? 3 : 1],
    ["rareMetals", 1],
    ["organics", cls === "temperate" ? 2 : 0],
  ];
  const total = w.reduce((s, [, n]) => s + n, 0);
  let r = rng.next() * total;
  for (const [id, n] of w) {
    r -= n;
    if (r <= 0) return id;
  }
  return "metals";
}

/** Add resource `id` to a small cluster (the seed tile + 1–2 neighbours). */
function placeCluster(
  grid: SurfaceGrid,
  rng: Rng,
  cx: number,
  cy: number,
  id: SurfaceResourceId,
): void {
  const push = (x: number, y: number) => {
    if (y < 0 || y >= grid.height) return;
    const wx = ((x % grid.width) + grid.width) % grid.width; // wrap longitude
    const t = grid.tiles[tileIndex(grid.width, wx, y)]!;
    if (!t.resources.includes(id)) t.resources.push(id);
  };
  push(cx, cy);
  const extra = rng.int(0, 2); // 0–2 neighbours → veins of 1–3 tiles
  const neighbours: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < extra; i++) {
    const [dx, dy] = neighbours[rng.int(0, neighbours.length - 1)]!;
    push(cx + dx, cy + dy);
  }
}

// ---------------------------------------------------------------------------
// The generator
// ---------------------------------------------------------------------------

/**
 * Deterministically generate a body's surface grid. Pure: same (universeSeed,
 * body) → identical grid. `body.bodyKey` is the stable identity; hand-built
 * fixtures without one fall back to the body name.
 */
export function generateSurface(
  universeSeed: string | number,
  body: CelestialBody,
  dims: SurfaceDims = { width: SURFACE_WIDTH, height: SURFACE_HEIGHT },
): SurfaceGrid {
  const key = body.bodyKey ?? body.name;
  const rng = makeRng(xxHashString(`surface:${key}`, hashSeed(universeSeed)));
  const { width, height } = dims;
  const cls = terrainClass(body);
  const { roughness, meanShift } = altitudeBias(cls);

  // 1. Altitude field (all lattice draws happen first — fixed rng order).
  const raw = fractalAltitude(rng, width, height);
  const tiles: SurfaceTile[] = new Array(width * height);
  for (let i = 0; i < raw.length; i++) {
    const altitude = clamp01(0.5 + (raw[i]! - 0.5) * roughness + meanShift);
    tiles[i] = { altitude, resources: [], baseTerrain: baseTerrainFor(cls, altitude) };
  }
  const grid: SurfaceGrid = { width, height, tiles };

  // 2. Fissiles deposits — ONLY if the body hosts the strategic resource
  //    (ties the docs/16 strategic-presence seed to an actual map location).
  if (localStrategicResources(universeSeed, body).fissiles) {
    const fissileVeins = rng.int(1, 2);
    for (let i = 0; i < fissileVeins; i++) {
      const cx = rng.int(0, width - 1);
      const cy = rng.int(0, height - 1);
      placeCluster(grid, rng, cx, cy, "fissiles");
    }
  }

  // 3. General deposits — sparse, clustered, weighted by terrain + local altitude.
  const deposits = rng.int(MIN_DEPOSITS, MAX_DEPOSITS);
  for (let i = 0; i < deposits; i++) {
    const cx = rng.int(0, width - 1);
    const cy = rng.int(0, height - 1);
    const alt = tileAt(grid, cx, cy).altitude;
    placeCluster(grid, rng, cx, cy, rollResource(rng, cls, alt));
  }

  return grid;
}

// ---------------------------------------------------------------------------
// Tile → founding modifiers (reuses docs/14's siteModifiers, fed from the tile)
// ---------------------------------------------------------------------------

const DEG2RAD = Math.PI / 180;

/** Body-only water hint (mirrors sites.ts): liquid → rich, frozen → moderate, dry → poor. */
function waterHint(body: CelestialBody): number {
  if (body.atmosphere?.hasLiquidWater) return 0.9;
  if ((body.surfaceTempK ?? 9999) < 260) return 0.6;
  return 0.25;
}

/** Local altitude gradient at (x,y) — avg abs diff to the 4 neighbours (0–1). */
function localSlope(grid: SurfaceGrid, x: number, y: number): number {
  const a = tileAt(grid, x, y).altitude;
  const neighbours: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let sum = 0;
  let count = 0;
  for (const [dx, dy] of neighbours) {
    const ny = y + dy;
    if (ny < 0 || ny >= grid.height) continue;
    const nx = ((x + dx) % grid.width + grid.width) % grid.width;
    sum += Math.abs(a - tileAt(grid, nx, ny).altitude);
    count++;
  }
  return count > 0 ? clamp01((sum / count) * 4) : 0; // ×4: typical local diffs are small
}

/**
 * Map a tile to the CandidateSite attribute bundle (docs/17 §3) so the EXISTING,
 * tested siteModifiers() produces founding modifiers from a tile exactly as it
 * did from a card. Pure fn of (grid, tile, body) — no rng, deterministic.
 */
export function tileToCandidateSite(
  grid: SurfaceGrid,
  x: number,
  y: number,
  body: CelestialBody,
): CandidateSite {
  const tile = tileAt(grid, x, y);
  const latitude = absLatitudeDeg(y, grid.height);
  const insolationFactor = clamp01(Math.cos(latitude * DEG2RAD));

  const hasVolatiles = tile.resources.includes("volatiles");
  const volatileProximity = clamp01(
    waterHint(body) * 0.5 + (1 - tile.altitude) * 0.3 + (hasVolatiles ? 0.4 : 0),
  );

  const slope = localSlope(grid, x, y);

  // Radiation from the body's magnetosphere + atmosphere (same as sites.ts).
  const magFactor = 1 - clamp01(body.magnetosphere ?? 0);
  const atmShield = clamp01((body.atmosphere?.pressurePa ?? 0) / 101_325);
  const radiation = clamp01(0.75 * magFactor * (1 - 0.5 * atmShield));

  const thermalInertia = clamp01(1 - tile.altitude);

  return {
    index: tileIndex(grid.width, x, y),
    name: `Tile ${x},${y}`,
    latitude,
    insolationFactor,
    volatileProximity,
    slope,
    radiation,
    thermalInertia,
  };
}

/** Founding modifiers for placing a colony on a tile (reuses siteModifiers). */
export function tileModifiers(grid: SurfaceGrid, x: number, y: number, body: CelestialBody): SiteModifiers {
  return siteModifiers(tileToCandidateSite(grid, x, y, body));
}
