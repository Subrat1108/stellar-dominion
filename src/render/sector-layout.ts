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

export type MapTier = "system" | "sector";

// Hysteresis: zooming the system map out past ENTER switches to the sector tier;
// zooming the sector view back in past EXIT returns to the system tier. The gap
// between the two (and the per-tier default camera distances) prevents flapping
// at the boundary.
export const SYSTEM_TO_SECTOR_DIST = 3000; // OrbitControls distance in the system tier
export const SECTOR_TO_SYSTEM_DIST = 220; // OrbitControls distance in the sector tier
export const SECTOR_DEFAULT_CAM_DIST = 900; // frames the curated nodes on entry
export const SYSTEM_DEFAULT_CAM_DIST = 1080; // re-frames the system on return

/**
 * Decide the map tier from the current camera distance, given the current tier
 * (hysteretic — only flips when the relevant threshold is crossed).
 */
export function nextMapTier(current: MapTier, cameraDistance: number): MapTier {
  if (current === "system") {
    return cameraDistance > SYSTEM_TO_SECTOR_DIST ? "sector" : "system";
  }
  return cameraDistance < SECTOR_TO_SYSTEM_DIST ? "system" : "sector";
}

/** Eased 0→1 transition progress (smoothstep) for cross-fading the two tiers. */
export function easeTransition(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}
