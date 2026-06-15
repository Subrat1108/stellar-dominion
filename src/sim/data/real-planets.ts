// Real-system data table (docs/04 honesty policy, docs/13 pipeline).
//
// Systems whose bodies are taken from real catalog / candidate data live here,
// keyed by HYG record id. The content engine loads the star + these planets
// VERBATIM (tagged real/derived) and only generates the fill (a gas giant, its
// moons) procedurally — so the home system is produced *through* the engine
// while its real candidate planets keep their exact tuning.
//
// Tau Ceti's rocky candidates come from src/sim/data/tau-ceti.ts (Feng et al.
// 2017); their orbital phases match the original hand-authored world setup so
// the system looks and plays identically after moving behind the engine.

import { ferrum, caldor, mira, glacius, tauCetiStar } from "./tau-ceti.ts";
import type { RealSystemDef } from "../gen/types.ts";

// Tau Ceti's HYG record id (HD 10700 / HIP 8102). Confirmed against the bundled
// neighborhood subset: G8V, 3.65 pc.
export const TAU_CETI_HYG_ID = 8087;

const TAU_CETI: RealSystemDef = {
  hygId: TAU_CETI_HYG_ID,
  systemName: "Tau Ceti",
  star: {
    name: tauCetiStar.name,
    color: tauCetiStar.color,
    description: tauCetiStar.description,
    massKg: tauCetiStar.massKg,
    radiusM: tauCetiStar.radiusM,
    spectralType: tauCetiStar.spectralType!,
    luminositySol: tauCetiStar.luminositySol!,
    tempK: tauCetiStar.tempK!,
  },
  // Orbital phases mirror the original world-setup bodyDefs.
  planets: [
    { body: ferrum,  provenance: ferrum.dataTag,  orbit: { semiMajorAxisAu: ferrum.orbitalDistanceAu!,  eccentricity: 0.04, meanAnomalyAtEpoch: 0,             argumentOfPeriapsis: 0            } },
    { body: caldor,  provenance: caldor.dataTag,  orbit: { semiMajorAxisAu: caldor.orbitalDistanceAu!,  eccentricity: 0.08, meanAnomalyAtEpoch: Math.PI / 3,   argumentOfPeriapsis: Math.PI / 8 } },
    { body: mira,    provenance: mira.dataTag,    orbit: { semiMajorAxisAu: mira.orbitalDistanceAu!,    eccentricity: 0.05, meanAnomalyAtEpoch: Math.PI / 4,   argumentOfPeriapsis: Math.PI / 5 } },
    { body: glacius, provenance: glacius.dataTag, orbit: { semiMajorAxisAu: glacius.orbitalDistanceAu!, eccentricity: 0.12, meanAnomalyAtEpoch: Math.PI * 0.7, argumentOfPeriapsis: Math.PI / 4 } },
  ],
  // The outer gas giant (formerly hand-authored "Titan's Eye") is now produced
  // by the procedural step, tagged fictional, with generated moons.
  generateGasGiant: true,
  gasGiantMoons: [2, 3],
};

export const REAL_SYSTEMS: Record<number, RealSystemDef> = {
  [TAU_CETI_HYG_ID]: TAU_CETI,
};

/** Real-system definition for a star, or undefined if it is generated whole. */
export function realSystemFor(hygId: number): RealSystemDef | undefined {
  return REAL_SYSTEMS[hygId];
}
