// Pre-warp SCAN preview (docs/12 scanning phase, docs/09 Session 18).
//
// Returns ONLY a coarse tally — how many planets, the archetype mix, the star
// type, any system hazard — computed on demand from the destination seed. The
// full generated system is intentionally NOT returned, retained, or saved: the
// detail (per-world properties, habitability) is revealed only on arrival, which
// is the single point where the system materialises. This preserves discovery
// and keeps the save free of pre-arrival data.

import { generateSystemById } from "./system.ts";
import { hygIdFromSystemId } from "../data/sector.ts";

export interface ScanPreview {
  systemId: string;
  starSpectralType: string;
  /** Planets (excludes moons). The coarse headline number. */
  planetCount: number;
  terrestrialCount: number;
  gasGiantCount: number;
  /** System hazard label, if any (e.g. YZ Ceti's SPI). */
  hazardLabel: string | null;
}

/**
 * Coarse, deterministic scan of a destination. Generates the system, summarises
 * it, and discards it — nothing here is stored or persisted.
 */
export function scanPreview(universeSeed: string | number, systemId: string): ScanPreview {
  const hygId = hygIdFromSystemId(systemId);
  if (hygId === undefined) throw new Error(`scanPreview: bad systemId "${systemId}"`);
  const system = generateSystemById(universeSeed, hygId);

  let terrestrial = 0;
  let gasGiant = 0;
  for (const gb of system.bodies) {
    if (gb.parentKey) continue; // skip moons
    if (gb.body.kind === "gas-giant") gasGiant++;
    else if (gb.body.kind === "planet") terrestrial++;
  }

  return {
    systemId,
    starSpectralType: system.star.body.spectralType ?? "?",
    planetCount: terrestrial + gasGiant,
    terrestrialCount: terrestrial,
    gasGiantCount: gasGiant,
    hazardLabel: system.hazard?.label ?? null,
  };
}
