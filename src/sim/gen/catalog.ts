// Real-star catalog access (docs/13).
//
// Loads the bundled HYG neighborhood subset (shipped JSON, produced by
// tools/import-hyg.mjs — the game never fetches at runtime) and exposes typed
// lookups. The catalog provides the real anchor points (coordinates, spectral
// type, luminosity, names); the engine fills each system's planets procedurally
// from the star's seed. Flat array now; an indexed store can replace this later
// without changing the call sites.

import catalogData from "../data/hyg-neighborhood.json" with { type: "json" };

/** One real star from the HYG subset. */
export interface CatalogStar {
  /** HYG record id — the stable identity hashed for the per-system seed. */
  id: number;
  name: string | null;
  hip: number | null;
  hd: number | null;
  gl: string | null;
  spect: string | null;
  distPc: number;
  mag: number;
  lum: number | null;
  /** Galactic cartesian coordinates in parsecs. */
  x: number;
  y: number;
  z: number;
}

interface CatalogFile {
  source: string;
  license: string;
  maxDistLy: number;
  count: number;
  stars: CatalogStar[];
}

const file = catalogData as unknown as CatalogFile;

/** All stars in the bundled neighborhood subset (insertion = HYG-id order). */
export const catalogStars: readonly CatalogStar[] = file.stars;

/** Look up a star by HYG record id. */
export function starById(id: number): CatalogStar | undefined {
  return file.stars.find((s) => s.id === id);
}

/** Look up a star by Henry Draper (HD) number — stable across HYG versions. */
export function starByHd(hd: number): CatalogStar | undefined {
  return file.stars.find((s) => s.hd === hd);
}
