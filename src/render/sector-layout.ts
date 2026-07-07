// Sector-map geometry + zoom-tier logic (docs/12 multi-scale map).
//
// PURE math, no Three.js — so the placement and the system↔sector zoom
// transition can be unit-tested without a renderer. The sector view plots real
// catalog stars (coordinates in parsecs) into scene units, centred on a chosen
// origin star, and a hysteretic tier function decides when zooming the map view
// crosses between the in-system tier and the sector tier.

import { LY_PER_PARSEC, type SectorNode } from "../sim/data/sector.ts";

/** Scene units per light-year in the sector view. */
export const SECTOR_SCALE_PER_LY = 100;
/** Scene units per parsec (the catalog's native unit). */
export const SECTOR_SCALE_PER_PC = SECTOR_SCALE_PER_LY * LY_PER_PARSEC;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Scene-space position of a sector node relative to an origin node, in sector
 * units. The origin star sits at (0,0,0); distances scale linearly so on-screen
 * separation is faithful to the real geometry.
 */
export function sectorScenePosition(node: SectorNode, origin: SectorNode): Vec3 {
  return {
    x: (node.star.x - origin.star.x) * SECTOR_SCALE_PER_PC,
    y: (node.star.y - origin.star.y) * SECTOR_SCALE_PER_PC,
    z: (node.star.z - origin.star.z) * SECTOR_SCALE_PER_PC,
  };
}

/** Convert a sector-scene distance back to light-years (inverse of the scale). */
export function sceneDistanceToLy(sceneDistance: number): number {
  return sceneDistance / SECTOR_SCALE_PER_LY;
}

export type MapTier = "intra" | "system" | "sector" | "galactic" | "intergalactic";

// The zoom continuum, inner → outer. nextMapTier walks ONE step along it per flip.
export const TIER_ORDER: readonly MapTier[] = ["intra", "system", "sector", "galactic", "intergalactic"];

// Legacy names kept (existing tests + scene.ts import these).
export const SYSTEM_TO_SECTOR_DIST = 3000; // system → sector when zoomed out past this
export const SECTOR_TO_SYSTEM_DIST = 220;  // sector → system when zoomed in past this

// Per-tier default camera distances (used on a tier flip to reframe the view).
export const INTRA_DEFAULT_CAM_DIST = 90;
export const SYSTEM_DEFAULT_CAM_DIST = 1080;
export const SECTOR_DEFAULT_CAM_DIST = 900;
export const GALACTIC_DEFAULT_CAM_DIST = 2500;
export const INTERGALACTIC_DEFAULT_CAM_DIST = 9000;

/** Camera distance to frame a tier when it becomes active. */
export function tierDefaultCamDist(tier: MapTier): number {
  switch (tier) {
    case "intra": return INTRA_DEFAULT_CAM_DIST;
    case "system": return SYSTEM_DEFAULT_CAM_DIST;
    case "sector": return SECTOR_DEFAULT_CAM_DIST;
    case "galactic": return GALACTIC_DEFAULT_CAM_DIST;
    case "intergalactic": return INTERGALACTIC_DEFAULT_CAM_DIST;
  }
}

// Boundary between TIER_ORDER[i] (inner) and TIER_ORDER[i+1] (outer). `up` = zoom
// OUT to the outer tier when cameraDistance exceeds it; `down` = zoom IN to the
// inner tier when cameraDistance falls below it. up > down leaves a hysteresis gap.
interface TierBoundary { up: number; down: number }
const BOUNDARIES: readonly TierBoundary[] = [
  { up: 150,   down: 120 },   // intra ↔ system
  { up: SYSTEM_TO_SECTOR_DIST, down: SECTOR_TO_SYSTEM_DIST }, // system ↔ sector
  { up: 4000,  down: 400 },    // sector ↔ galactic
  { up: 12000, down: 1200 },   // galactic ↔ intergalactic
];

/**
 * Decide the map tier from the current camera distance, given the current tier
 * (hysteretic — only flips one step when the relevant threshold is crossed).
 */
export function nextMapTier(current: MapTier, cameraDistance: number): MapTier {
  const i = TIER_ORDER.indexOf(current);
  if (i < 0) return current;
  // Zoom out to the next-outer tier.
  if (i < TIER_ORDER.length - 1 && cameraDistance > BOUNDARIES[i]!.up) return TIER_ORDER[i + 1]!;
  // Zoom in to the next-inner tier.
  if (i > 0 && cameraDistance < BOUNDARIES[i - 1]!.down) return TIER_ORDER[i - 1]!;
  return current;
}

/** Eased 0→1 transition progress (smoothstep) for cross-fading the two tiers. */
export function easeTransition(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}
