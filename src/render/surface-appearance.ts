// Surface tile appearance — pure color/glyph helpers for the 2D surface map
// (docs/17). No DOM/canvas here (SurfaceMap does the actual drawing); these are
// pure functions so they unit-test and stay reusable.
//
// Commit 2 (this file): the BARE substrate look — base-terrain colour shaded by
// altitude, used for every world (hostile worlds stay bare). The habitable
// CLIMATE SKIN (water/vegetation/snow derived from current planet state) is a
// separate pure `tileAppearance()` added in a later commit; keeping the bare
// palette here means that skin layers cleanly on top.

import type { SurfaceTile, BaseTerrain, SurfaceResourceId } from "../sim/gen/surface.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";

export type Rgb = [number, number, number];

/** Bare substrate colour per base-terrain type (before altitude shading). */
const TERRAIN_RGB: Record<BaseTerrain, Rgb> = {
  rock: [107, 107, 112],
  regolith: [138, 122, 104],
  sand: [194, 168, 120],
  basalt: [58, 51, 54],
  ice: [207, 228, 238],
  lowland: [106, 122, 85],
  highland: [122, 111, 94],
};

/** Small single-glyph icon per resource, drawn on a tile when it fits. */
export const RESOURCE_GLYPH: Record<SurfaceResourceId, string> = {
  metals: "▲",
  rareMetals: "◆",
  volatiles: "❄",
  geothermal: "♨",
  organics: "❦",
  fissiles: "☢",
};

/** Legible label per resource (for the tile-info readout). */
export const RESOURCE_LABEL: Record<SurfaceResourceId, string> = {
  metals: "Metals",
  rareMetals: "Rare metals",
  volatiles: "Volatiles / ice",
  geothermal: "Geothermal",
  organics: "Organics",
  fissiles: "Fissiles",
};

function clampByte(x: number): number {
  return Math.max(0, Math.min(255, Math.round(x)));
}

/** Multiply an rgb by a brightness factor (altitude shading), clamped to bytes. */
export function shade(rgb: Rgb, factor: number): Rgb {
  return [clampByte(rgb[0] * factor), clampByte(rgb[1] * factor), clampByte(rgb[2] * factor)];
}

export function rgbToCss(rgb: Rgb): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

/**
 * Altitude brightness factor: low basins darker, high peaks lighter. A gentle
 * ramp (0.68 → 1.18) so terrain reads as relief without washing out.
 */
export function altitudeShade(altitude: number): number {
  return 0.68 + altitude * 0.5;
}

/** Bare tile colour (base terrain × altitude shading) — the hostile-world look. */
export function baseTileColor(tile: SurfaceTile): Rgb {
  return shade(TERRAIN_RGB[tile.baseTerrain], altitudeShade(tile.altitude));
}

/** Bare tile colour as a CSS string (convenience for the canvas). */
export function baseTileColorCss(tile: SurfaceTile): string {
  return rgbToCss(baseTileColor(tile));
}

// ---------------------------------------------------------------------------
// Climate skin — the VISIBLE surface, derived from CURRENT planet state (docs/17)
// ---------------------------------------------------------------------------
//
// Water/vegetation/snow are NOT stored on tiles; they are a pure function of the
// immutable tile (altitude) + latitude + the body's live climate. So a habitable
// world renders alive, a hostile world stays bare, and terraforming (which moves
// surfaceTempK / hydrosphere) visibly changes the surface with no per-tile save
// state. Altitude never changes — only the skin over it does.

const FREEZE_K = 273.15;
/** Armstrong-ish pressure floor (Pa) below which liquid water can't be stable. */
const LIQUID_PRESSURE_FLOOR_PA = 6_262; // ≈ 0.0618 atm (docs/11)
const BOIL_CAP_K = 373; // above this (at modest pressure) surface water isn't liquid

/** The subset of planet state the climate skin reads. */
export interface PlanetClimate {
  surfaceTempK: number;
  /** 0–1 surface-water fraction: the lowest `waterFraction` of altitude floods. */
  waterFraction: number;
  pressurePa: number;
}

/** Extract a body's live climate for the surface skin (pure). */
export function planetClimateOf(body: CelestialBody): PlanetClimate {
  const surfaceTempK = body.surfaceTempK ?? 288;
  const pressurePa = body.atmosphere?.pressurePa ?? 0;
  // Prefer the terraforming hydrosphere gauge; else infer from the liquid-water flag.
  const waterFraction =
    body.hydrosphere !== undefined ? body.hydrosphere : body.atmosphere?.hasLiquidWater ? 0.5 : 0;
  return { surfaceTempK, waterFraction: Math.max(0, Math.min(1, waterFraction)), pressurePa };
}

export type TileAppearanceKind = "ocean" | "ice" | "snow" | "vegetation" | "barren";

export interface TileAppearance {
  kind: TileAppearanceKind;
  rgb: Rgb;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function lerp(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const OCEAN_DEEP: Rgb = [18, 44, 92];
const OCEAN_SHALLOW: Rgb = [46, 104, 158];
const ICE_RGB: Rgb = [206, 226, 236];
const SNOW_RGB: Rgb = [238, 243, 250];
const VEG_LUSH: Rgb = [58, 112, 54];
const VEG_DRY: Rgb = [104, 116, 68];

/**
 * The visible appearance of a tile given latitude + the body's live climate.
 * Pure + deterministic. Hostile/dry worlds fall through to the bare substrate.
 */
export function tileAppearance(tile: SurfaceTile, latitudeDeg: number, c: PlanetClimate): TileAppearance {
  const alt = tile.altitude;
  const submerged = c.waterFraction > 0 && alt < c.waterFraction;
  const liquidStable =
    c.surfaceTempK > FREEZE_K && c.surfaceTempK < BOIL_CAP_K && c.pressurePa > LIQUID_PRESSURE_FLOOR_PA;

  if (submerged) {
    if (c.surfaceTempK <= FREEZE_K) {
      return { kind: "ice", rgb: ICE_RGB };
    }
    if (liquidStable) {
      // Depth shading: near the deepest basin → dark; near the shoreline → light.
      const depthT = clamp01(alt / Math.max(1e-3, c.waterFraction));
      return { kind: "ocean", rgb: lerp(OCEAN_DEEP, OCEAN_SHALLOW, depthT) };
    }
    // Water present in the basin but not liquid-stable (too hot/thin) → bare basin.
  }

  // Land. Cold → snow: very cold everywhere, or cool + exposed (high alt / high lat).
  const veryCold = c.surfaceTempK < FREEZE_K - 5;
  const coolExposed = c.surfaceTempK < FREEZE_K + 8 && (alt > 0.7 || latitudeDeg > 60);
  if (veryCold || coolExposed) {
    return { kind: "snow", rgb: shade(SNOW_RGB, altitudeShade(alt)) };
  }

  // Vegetation: temperate land with available surface water.
  const temperate = c.surfaceTempK > FREEZE_K && c.surfaceTempK < 313;
  if (temperate && c.waterFraction > 0.08 && alt >= c.waterFraction) {
    // Lusher in low-mid altitude + lower latitude; drier up high / toward the poles.
    const dryness = clamp01((alt - c.waterFraction) * 0.8 + latitudeDeg / 120);
    return { kind: "vegetation", rgb: shade(lerp(VEG_LUSH, VEG_DRY, dryness), altitudeShade(alt)) };
  }

  return { kind: "barren", rgb: baseTileColor(tile) };
}

/** Climate-aware tile colour as a CSS string (the canvas fill). */
export function tileAppearanceCss(tile: SurfaceTile, latitudeDeg: number, c: PlanetClimate): string {
  return rgbToCss(tileAppearance(tile, latitudeDeg, c).rgb);
}
