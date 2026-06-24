// Sector neighbourhood — the curated set of real stars the player can see and
// (for Step 1B) warp to (docs/12).
//
// The bundled HYG catalog (gen/catalog.ts) holds 167 real stars with mangled
// display names ("Gl Gl 54.1"); this table assigns clean names + an interaction
// role to the handful that matter for the sector map, leaving the rest as dim,
// non-interactable background nodes. Distances are computed from the real
// catalog coordinates (parsecs → light-years) — the catalog is the source of
// truth, so the sector map is geometrically honest.
//
// Roles:
//   home      — the player's capital system (Tau Ceti).
//   reachable — an interactable warp destination this phase (YZ Ceti, Luyten 726-8).
//   locked    — visible but not yet interactable (Epsilon Eridani; Step 1C).

import { starById, catalogStars, type CatalogStar } from "../gen/catalog.ts";

export type SectorRole = "home" | "reachable" | "locked";

/** Parsecs → light-years. */
export const LY_PER_PARSEC = 3.2615638;

export interface SectorStarDef {
  /** HYG catalog id — the stable identity hashed for generation. */
  hygId: number;
  /** Clean display name (the catalog's own name field is unreliable). */
  name: string;
  role: SectorRole;
  /** Short astrophysical hook surfaced in the sector UI. */
  note: string;
}

// HYG ids verified against the bundled catalog (tools/import-hyg.mjs output):
//   Tau Ceti      8087   G8V     (home)
//   YZ Ceti       5632   M5.5Ve  1.60 ly  — flare star, tidally-locked terrestrials, SPI radio hazard
//   Luyten 726-8  118079 dM5.5e  3.36 ly  — Gliese 65 binary (A component as representative node)
//   Epsilon Eri   16496  K2V     5.46 ly  — debris-disk industrial target (Step 1C)
export const TAU_CETI_HYG_ID = 8087;
export const YZ_CETI_HYG_ID = 5632;
export const LUYTEN_726_8_HYG_ID = 118079;
export const EPSILON_ERIDANI_HYG_ID = 16496;

export const SECTOR_STARS: readonly SectorStarDef[] = [
  { hygId: TAU_CETI_HYG_ID, name: "Tau Ceti", role: "home", note: "G8V — home system; the stranded crew's capital." },
  { hygId: YZ_CETI_HYG_ID, name: "YZ Ceti", role: "reachable", note: "M5.5Ve flare star — three scorched, tidally-locked worlds; intense star-planet radio interaction." },
  { hygId: LUYTEN_726_8_HYG_ID, name: "Luyten 726-8", role: "reachable", note: "M5.5e flare binary (Gliese 65) — chaotic, UV-violent neighbourhood." },
  { hygId: EPSILON_ERIDANI_HYG_ID, name: "Epsilon Eridani", role: "locked", note: "K2V — young debris-disk system, resource-rich. (Locked — Step 1C.)" },
];

/** Stable systemId for a HYG star — matches gen/system.ts (`hyg:<id>`). */
export function systemIdFor(hygId: number): string {
  return `hyg:${hygId}`;
}

/** HYG id parsed back out of a systemId, or undefined if malformed. */
export function hygIdFromSystemId(systemId: string): number | undefined {
  const m = /^hyg:(\d+)$/.exec(systemId);
  return m ? Number(m[1]) : undefined;
}

/** The sector role of a systemId, or undefined if it is not a curated node. */
export function sectorRoleOf(systemId: string): SectorRole | undefined {
  const hygId = hygIdFromSystemId(systemId);
  return SECTOR_STARS.find((s) => s.hygId === hygId)?.role;
}

/** Whether a systemId is an interactable warp destination this phase. */
export function isReachableSystem(systemId: string): boolean {
  const role = sectorRoleOf(systemId);
  return role === "reachable" || role === "home";
}

/** Light-year distance between two catalog stars (Euclidean on parsec coords). */
export function distanceLy(a: CatalogStar, b: CatalogStar): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * LY_PER_PARSEC;
}

/** Light-year distance between two HYG ids; Infinity if either is missing. */
export function distanceLyById(hygIdA: number, hygIdB: number): number {
  const a = starById(hygIdA);
  const b = starById(hygIdB);
  if (!a || !b) return Infinity;
  return distanceLy(a, b);
}

export interface SectorNode {
  def: SectorStarDef;
  star: CatalogStar;
  systemId: string;
}

/** The curated sector nodes, each joined to its catalog star (skips any missing). */
export function sectorNodes(): SectorNode[] {
  const out: SectorNode[] = [];
  for (const def of SECTOR_STARS) {
    const star = starById(def.hygId);
    if (star) out.push({ def, star, systemId: systemIdFor(def.hygId) });
  }
  return out;
}

/** The home node (Tau Ceti). */
export function homeNode(): SectorNode {
  const nodes = sectorNodes();
  const home = nodes.find((n) => n.def.role === "home");
  if (!home) throw new Error("sector: home node (Tau Ceti) missing from catalog");
  return home;
}

/** All catalog stars, for rendering a faint non-interactive background field. */
export function backgroundStars(): readonly CatalogStar[] {
  return catalogStars;
}
