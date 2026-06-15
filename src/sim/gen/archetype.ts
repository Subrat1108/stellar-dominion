// Planetary archetype classification + surface derivation (docs/04 archetype
// table, docs/13 property pipeline).
//
// Given a generated planet's mass, radius and insolation, this assigns one of
// the docs/04 archetypes and derives the physical surface fields the rest of the
// game consumes (surface temperature, atmosphere, magnetosphere, colour). These
// are coarse, grounded heuristics — equilibrium temperature from insolation plus
// a pressure-driven greenhouse term, retention-scaled pressure, etc. — not a
// climate model. Deterministic: all variation pulls from the passed seeded RNG.

import type { Rng } from "../math/rng.ts";
import type { Atmosphere } from "../ecs/components.ts";
import { isGiantMass } from "./mass-radius.ts";

export type Archetype =
  | "terrestrial"
  | "martian"
  | "venusian"
  | "oceanic"
  | "frozen"
  | "chthonian"
  | "gas-giant";

const ONE_ATM_PA = 101_325;

/** Classify a body from its mass (Earth masses) and insolation (Earth = 1). */
export function classifyArchetype(massEarth: number, insolation: number): Archetype {
  if (isGiantMass(massEarth)) return "gas-giant";
  if (insolation > 2.0) return massEarth >= 0.8 ? "venusian" : "chthonian";
  if (insolation < 0.35) return "frozen";
  if (massEarth >= 3 && insolation >= 0.5 && insolation <= 1.4) return "oceanic";
  if (massEarth < 0.5) return "martian";
  return "terrestrial";
}

/** Black-body equilibrium temperature (K) for a given insolation and albedo. */
export function equilibriumTempK(insolation: number, albedo: number): number {
  return 278.5 * Math.pow(Math.max(0, (1 - albedo) * insolation), 0.25);
}

export interface DerivedSurface {
  archetype: Archetype;
  surfaceTempK: number;
  gravityMs2: number;
  atmosphere: Atmosphere;
  magnetosphere: number;
  /** Hex colour for the renderer fallback / base palette. */
  color: number;
}

interface SurfaceInputs {
  massEarth: number;
  insolation: number;
  /** Surface gravity in m/s² (from Chen & Kipping radius); passed through. */
  gravityMs2: number;
}

/** Per-archetype atmosphere + albedo + colour profile, varied by the seeded RNG. */
function archetypeProfile(rng: Rng, archetype: Archetype, gravityMs2: number) {
  // Heavier worlds retain thicker atmospheres — scale a per-archetype base.
  const retention = Math.min(2.0, Math.max(0.3, gravityMs2 / 9.81));
  switch (archetype) {
    case "venusian":
      return {
        albedo: 0.7,
        pressurePa: ONE_ATM_PA * rng.range(60, 100) * retention,
        composition: "CO₂ 96%, N₂ 3%, SO₂ trace",
        toxicity: 1.0,
        magnetosphere: rng.range(0, 0.1),
        color: 0xe0a030,
      };
    case "martian":
      return {
        albedo: 0.25,
        pressurePa: ONE_ATM_PA * rng.range(0.004, 0.05) * retention,
        composition: "CO₂ 95%, N₂ 3%, Ar 2%",
        toxicity: 0.45,
        magnetosphere: rng.range(0, 0.15),
        color: 0xc1654a,
      };
    case "frozen":
      return {
        albedo: 0.6,
        pressurePa: ONE_ATM_PA * rng.range(0.01, 0.4) * retention,
        composition: "N₂ 70%, CO₂ 28%, Ar 2%",
        toxicity: 0.4,
        magnetosphere: rng.range(0, 0.3),
        color: 0xcfe4ee,
      };
    case "oceanic":
      return {
        albedo: 0.35,
        pressurePa: ONE_ATM_PA * rng.range(1, 5) * retention,
        composition: "N₂ 80%, H₂O vapour, O₂ trace",
        toxicity: rng.range(0.2, 0.5),
        magnetosphere: rng.range(0.2, 0.8),
        color: 0x2f6fb0,
      };
    case "chthonian":
      return {
        albedo: 0.1,
        pressurePa: ONE_ATM_PA * rng.range(0.0, 0.02),
        composition: "trace metallic vapour",
        toxicity: 0.9,
        magnetosphere: rng.range(0, 0.2),
        color: 0x6b5648,
      };
    case "terrestrial":
    default:
      return {
        albedo: 0.3,
        pressurePa: ONE_ATM_PA * rng.range(0.3, 1.6) * retention,
        composition: "N₂ 75%, CO₂ 18%, Ar 4%, O₂ 3%",
        toxicity: rng.range(0.25, 0.6),
        magnetosphere: rng.range(0.1, 0.7),
        color: 0x6a9e6a,
      };
  }
}

/** Derive the full surface profile for a generated rocky/temperate planet. */
export function deriveSurface(rng: Rng, inputs: SurfaceInputs): DerivedSurface {
  const { massEarth, insolation, gravityMs2 } = inputs;
  const archetype = classifyArchetype(massEarth, insolation);
  const p = archetypeProfile(rng, archetype, gravityMs2);

  const pressureAtm = p.pressurePa / ONE_ATM_PA;
  // Greenhouse warming grows sub-linearly with pressure; capped so even a
  // Venusian runaway stays in a defensible range.
  const greenhouseK = Math.min(520, 60 * Math.sqrt(pressureAtm));
  const surfaceTempK = Math.max(
    3,
    Math.min(1500, equilibriumTempK(insolation, p.albedo) + greenhouseK),
  );

  // Liquid water only where it is genuinely plausible: temperate surface and a
  // pressure above water's triple point. Most generated worlds are dry.
  const hasLiquidWater =
    surfaceTempK > 273 && surfaceTempK < 340 && pressureAtm > 0.1 && rng.next() < 0.6;

  return {
    archetype,
    surfaceTempK: Math.round(surfaceTempK),
    gravityMs2,
    atmosphere: {
      pressurePa: Math.round(p.pressurePa),
      composition: p.composition,
      toxicity: Math.round(p.toxicity * 100) / 100,
      hasLiquidWater,
    },
    magnetosphere: Math.round(p.magnetosphere * 100) / 100,
    color: p.color,
  };
}

/** Colour for a star from its photosphere temperature (K). */
export function starColor(tempK: number): number {
  if (tempK >= 25000) return 0x9bb0ff; // O — blue
  if (tempK >= 10000) return 0xaabfff; // B — blue-white
  if (tempK >= 7500) return 0xe6e8ff;  // A — white
  if (tempK >= 6000) return 0xfff4e8;  // F — yellow-white
  if (tempK >= 5200) return 0xffd493;  // G — warm yellow
  if (tempK >= 3700) return 0xffb56b;  // K — orange
  return 0xff8a5c;                     // M — red-orange
}

/** Colour for a generated gas giant, varied by seed. */
export function gasGiantColor(rng: Rng): number {
  const palette = [0xc8a060, 0xd8b070, 0xb0c0d0, 0xa88858, 0xd0c090];
  return palette[rng.int(0, palette.length - 1)]!;
}
