// Static data for the YZ Ceti system — the Step 1B warp destination (docs/12).
//
// YZ Ceti (Gl 54.1, HYG 5632) is an M4.5V red-dwarf flare star 1.60 ly from Tau
// Ceti, hosting three confirmed, extremely close-in terrestrial planets (b, c, d
// with ~2.0/3.1/4.7-day periods). They are almost certainly tidally locked and
// scorched, with thin, flare-stripped atmospheres — a deliberately harsh contrast
// to the home system. The innermost planet drives a strong Star-Planet
// Interaction (SPI) radio emission; that is surfaced as a system trait, not a
// mechanic (docs/09, Session 18).
//
// Provenance: `derived` — real candidate signals, with game-convenient physical
// values consistent with the cited orbital parameters.

import type { CelestialBody } from "../ecs/components.ts";
import type { OrbitParams, RealStarOverride } from "../gen/types.ts";
import { computeHabitability } from "../math/habitability.ts";
import { surfaceGravity } from "../math/physics.ts";
import { planetRenderRadius } from "../presentation.ts";
import { radiusEarthFromMassEarth, M_EARTH_KG, R_EARTH_M } from "../gen/mass-radius.ts";

const M_SOL = 1.989e30;
const R_SOL = 6.957e8;

export const YZ_CETI_LUMINOSITY_SOL = 0.0017; // very dim red dwarf

export const yzCetiStar: RealStarOverride = {
  name: "YZ Ceti",
  color: 0xff6b4a, // cool red-orange M dwarf
  description:
    "An M4.5V red-dwarf flare star 1.6 light-years from Tau Ceti. Barely 13% of " +
    "the Sun's mass and well under 1% its luminosity, yet violently active — " +
    "frequent flares bathe its three close-in worlds in radiation.",
  massKg: 0.13 * M_SOL,
  radiusM: 0.168 * R_SOL,
  spectralType: "M4.5V",
  luminositySol: YZ_CETI_LUMINOSITY_SOL,
  tempK: 3100,
};

interface Candidate {
  name: string;
  massEarth: number;
  au: number;
  surfaceTempK: number;
  pressurePa: number;
  composition: string;
  toxicity: number;
  color: number;
  description: string;
}

// Real candidate orbital distances (semi-major axes from the cited periods).
const CANDIDATES: Candidate[] = [
  {
    name: "YZ Ceti b",
    massEarth: 0.70,
    au: 0.01557,
    surfaceTempK: 472,
    pressurePa: 400, // near-stripped
    composition: "trace CO₂, Na vapour",
    toxicity: 0.9,
    color: 0xb5462f,
    description:
      "Innermost world, tidally locked: a molten-edged dayside facing a frozen " +
      "night. Its magnetic field ploughs the stellar corona, driving the system's " +
      "characteristic radio storms. Effectively unshieldable in low orbit.",
  },
  {
    name: "YZ Ceti c",
    massEarth: 1.14,
    au: 0.02090,
    surfaceTempK: 381,
    pressurePa: 12_000,
    composition: "CO₂ 90%, N₂ 8%",
    toxicity: 0.8,
    color: 0xc06a3a,
    description:
      "A tidally-locked super-Earth with a thin, flare-scoured CO₂ atmosphere. " +
      "Perpetual twilight ring between a baking dayside and a frozen far side.",
  },
  {
    name: "YZ Ceti d",
    massEarth: 1.09,
    au: 0.02764,
    surfaceTempK: 331,
    pressurePa: 9_000,
    composition: "CO₂ 80%, N₂ 18%, Ar 2%",
    toxicity: 0.6,
    color: 0xc98a52,
    description:
      "The outermost confirmed world, still well inside the traditional habitable " +
      "zone. Tidally locked and irradiated, but its terminator ring is the least " +
      "hostile ground in the system.",
  },
];

export interface RealPlanetEntry {
  body: CelestialBody;
  orbit: OrbitParams;
}

function buildCandidate(c: Candidate, index: number): RealPlanetEntry {
  const massKg = c.massEarth * M_EARTH_KG;
  const radiusM = radiusEarthFromMassEarth(c.massEarth) * R_EARTH_M;
  const gravityMs2 = surfaceGravity(massKg, radiusM);
  const magnetosphere = 0.1;
  const body: CelestialBody = {
    kind: "planet",
    name: c.name,
    renderRadius: planetRenderRadius(radiusM),
    color: c.color,
    dataTag: "derived",
    description: c.description,
    massKg,
    radiusM,
    orbitalDistanceAu: c.au,
    surfaceTempK: c.surfaceTempK,
    gravityMs2,
    atmosphere: {
      pressurePa: c.pressurePa,
      composition: c.composition,
      toxicity: c.toxicity,
      hasLiquidWater: false,
    },
    magnetosphere,
    habitability: computeHabitability({
      luminositySol: YZ_CETI_LUMINOSITY_SOL,
      orbitalDistanceAu: c.au,
      surfaceTempK: c.surfaceTempK,
      gravityMs2,
      atmospherePressurePa: c.pressurePa,
      atmosphereToxicity: c.toxicity,
      hasLiquidWater: false,
      magnetosphere,
    }),
  };
  // Phases spread so the tight cluster isn't perfectly aligned.
  const orbit: OrbitParams = {
    semiMajorAxisAu: c.au,
    eccentricity: 0.01,
    meanAnomalyAtEpoch: (index * 2 * Math.PI) / 3,
    argumentOfPeriapsis: index * Math.PI / 4,
  };
  return { body, orbit };
}

export const yzCetiPlanets: RealPlanetEntry[] = CANDIDATES.map(buildCandidate);
