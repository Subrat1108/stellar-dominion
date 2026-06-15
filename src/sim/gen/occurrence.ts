// Spectral-type-dependent occurrence rates + stellar parameter estimates (docs/13).
//
// Exoplanet demographics depend strongly on the host star's spectral class
// (NASA Exoplanet Archive occurrence-rate studies): M dwarfs host many small
// planets; hotter stars host fewer, with a wider mass spread. These are coarse,
// deterministic heuristics — enough to make generated systems feel distinct by
// star type — refined later if gameplay needs it. All sampling pulls from the
// passed seeded RNG so generation stays reproducible.

import type { Rng } from "../math/rng.ts";

export type SpectralClass = "O" | "B" | "A" | "F" | "G" | "K" | "M";

const CLASSES = "OBAFGKM";

/** First letter of a spectral type, defaulting to M (the most common) if unknown. */
export function spectralClass(spect: string | null | undefined): SpectralClass {
  const c = (spect ?? "").trim().charAt(0).toUpperCase();
  return (CLASSES.includes(c) ? c : "M") as SpectralClass;
}

/** Rough main-sequence stellar mass in solar masses, by spectral class. */
export function stellarMassSol(cls: SpectralClass): number {
  switch (cls) {
    case "O": return 16;
    case "B": return 3.0;
    case "A": return 1.8;
    case "F": return 1.2;
    case "G": return 0.95;
    case "K": return 0.7;
    case "M": return 0.3;
  }
}

/** Rough main-sequence luminosity in solar luminosities, by class (fallback only). */
export function stellarLuminositySol(cls: SpectralClass): number {
  switch (cls) {
    case "O": return 30000;
    case "B": return 200;
    case "A": return 8;
    case "F": return 2.5;
    case "G": return 1.0;
    case "K": return 0.35;
    case "M": return 0.04;
  }
}

/** Photosphere temperature (K) by class — for the star's display + colour. */
export function stellarTempK(cls: SpectralClass): number {
  switch (cls) {
    case "O": return 35000;
    case "B": return 18000;
    case "A": return 8500;
    case "F": return 6500;
    case "G": return 5600;
    case "K": return 4400;
    case "M": return 3200;
  }
}

/** Expected planet-count window [min, max] by class (peas-in-a-pod systems). */
function planetCountRange(cls: SpectralClass): [number, number] {
  switch (cls) {
    case "O": case "B": return [0, 2];
    case "A": return [0, 3];
    case "F": return [1, 4];
    case "G": return [1, 5];
    case "K": return [2, 6];
    case "M": return [2, 6];
  }
}

/** Deterministically sample the number of planets for a system. */
export function planetCount(rng: Rng, cls: SpectralClass): number {
  const [lo, hi] = planetCountRange(cls);
  return rng.int(lo, hi);
}

/**
 * Sample a planet mass in Earth masses (log-uniform, biased toward the small
 * super-Earth / sub-Neptune population that dominates real surveys). Cooler
 * stars skew smaller; hotter stars allow more massive planets.
 */
export function samplePlanetMassEarth(rng: Rng, cls: SpectralClass): number {
  // Mass window in Earth masses, per class, in log10 space.
  const hot = cls === "O" || cls === "B" || cls === "A" || cls === "F";
  const logLo = Math.log10(0.3);
  const logHi = Math.log10(hot ? 320 : 60); // hotter stars host more giants
  // Square the uniform draw to bias toward the low (small-planet) end.
  const u = rng.next();
  const biased = u * u;
  return Math.pow(10, logLo + biased * (logHi - logLo));
}
