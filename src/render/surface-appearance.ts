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
