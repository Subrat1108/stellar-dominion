// Shared types for the content-generation engine (docs/13).
//
// The engine produces bodies in the EXACT CelestialBody shape the colony /
// terraforming / population / save systems already consume — generation changes
// HOW bodies are produced, not their downstream schema. Orbits are emitted as
// physical parameters (AU + Keplerian phase); world-setup maps them to scene
// units, keeping the sim↔presentation boundary intact.

import type { CelestialBody, DataTag } from "../ecs/components.ts";

/** Physical orbital parameters for a body (presentation-agnostic). */
export interface OrbitParams {
  semiMajorAxisAu: number;
  eccentricity: number;
  meanAnomalyAtEpoch: number;
  argumentOfPeriapsis: number;
}

/** A single generated body plus its stable identity and orbit. */
export interface GeneratedBody {
  /** Stable semantic identity, e.g. "hyg:8087:2" (system + orbital index) or
   *  "hyg:8087:4.1" (moon 1 of body 4). Used as the save key — never the
   *  raw entity id, which is an artifact of insertion order. */
  bodyKey: string;
  /** Provenance: real (catalog/NASA), derived (computed from real signals), or
   *  fictional (invented, obeys the same physics). */
  provenance: DataTag;
  /** The body itself (carries `bodyKey` so saves resolve it after regeneration). */
  body: CelestialBody;
  /** Orbit around the star (absent for the star itself and for moons). */
  orbit?: OrbitParams;
  /** For moons: the bodyKey of the planet this orbits. */
  parentKey?: string;
}

/**
 * A system-wide environmental trait surfaced to the player (docs/12). Flavour +
 * a legible indicator only this phase — NOT a damage/shielding mechanic.
 */
export interface SystemHazard {
  kind: "spi-radio";
  /** Short label for the scan/arrival UI, e.g. "Star-Planet Radio Interaction". */
  label: string;
  description: string;
  /** bodyKey the hazard centres on (e.g. the innermost planet). */
  bodyKey?: string;
}

/** A fully-generated star system, in stable order (star, then bodies outward). */
export interface GeneratedSystem {
  /** "hyg:<id>" — the system's stable identity. */
  systemId: string;
  star: GeneratedBody;
  /** Planets + gas giants + moons, in deterministic order. */
  bodies: GeneratedBody[];
  /** Optional system-wide environmental trait (surfaced in the UI). */
  hazard?: SystemHazard;
}

// --- Real-system overrides ---------------------------------------------------

/** Star fields injected verbatim for a system with real catalog/lore data. */
export interface RealStarOverride {
  name: string;
  color: number;
  description: string;
  massKg: number;
  radiusM: number;
  spectralType: string;
  luminositySol: number;
  tempK: number;
}

/** A real (or derived) planet injected verbatim — NOT procedurally sampled. */
export interface RealPlanetDef {
  /** Fully-formed body, tagged real/derived. Habitability already computed. */
  body: CelestialBody;
  orbit: OrbitParams;
  provenance: DataTag;
}

/**
 * A system whose real bodies are known. The star + listed planets load
 * verbatim; the engine's procedural step only adds the fill described here
 * (a gas giant, moons), each tagged fictional.
 */
export interface RealSystemDef {
  hygId: number;
  systemName: string;
  star: RealStarOverride;
  planets: RealPlanetDef[];
  /** If set, generate one outer gas giant beyond the outermost real planet. */
  generateGasGiant: boolean;
  /** Inclusive [min, max] moons to generate for the gas giant. */
  gasGiantMoons: [number, number];
  /** Optional system-wide hazard trait surfaced in the UI (e.g. YZ Ceti's SPI). */
  hazard?: SystemHazard;
}
