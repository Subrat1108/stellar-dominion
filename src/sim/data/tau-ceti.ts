// Static data for the Tau Ceti star system.
//
// Provenance tags (docs/04 real-vs-invented policy):
//   real    — values taken directly from cited catalogs (HYG, HIPPARCOS, NASA fact sheets).
//   derived — computed from real Tau Ceti parameters or interpolated from real exoplanet
//             candidate signals; plausible but not confirmed.
//   fictional — invented for gameplay; obeys the same physics, not tied to a real signal.
//
// Tau Ceti real data sources: HYG database v3; Hipparcos catalog; Tau Ceti planetary
// candidate paper (Feng et al. 2017, AJ 154 135).

import type { CelestialBody } from "../ecs/components.ts";
import { computeHabitability } from "../math/habitability.ts";
import {
  starRenderRadius,
  planetRenderRadius,
  gasGiantRenderRadius,
} from "../presentation.ts";

// Physical constants
const M_SOL   = 1.989e30; // kg
const R_SOL   = 6.957e8;  // m
const M_EARTH = 5.972e24; // kg
const R_EARTH = 6.371e6;  // m
const G_CONST = 6.674e-11; // m³ kg⁻¹ s⁻²

function surfaceGravity(massKg: number, radiusM: number): number {
  return (G_CONST * massKg) / (radiusM * radiusM);
}

// ---------------------------------------------------------------------------
// Host star — Tau Ceti (τ Ceti, HD 10700)
// ---------------------------------------------------------------------------
// Spectral type: G8V — slightly cooler and dimmer than the Sun.
// Source: HYG v3 + HIPPARCOS; luminosity from Ribas et al. 2010.

export const TAU_CETI_LUMINOSITY_SOL = 0.488;

export const tauCetiStar: CelestialBody = {
  kind: "star",
  name: "Tau Ceti",
  renderRadius: starRenderRadius(0.793 * R_SOL),
  color: 0xffd493,  // G8V — warm yellow-orange
  dataTag: "real",
  description:
    "A G8V main-sequence star 11.9 light-years from Earth. " +
    "Roughly 80% of the Sun's mass and 50% of its luminosity. " +
    "One of the nearest Sun-like stars, long considered a candidate for habitable worlds.",
  massKg: 0.783 * M_SOL,
  radiusM: 0.793 * R_SOL,
  spectralType: "G8V",
  luminositySol: TAU_CETI_LUMINOSITY_SOL,
  tempK: 5344,
};

// ---------------------------------------------------------------------------
// Ferrum  (inner hot rock)
// ---------------------------------------------------------------------------
// Derived from Tau Ceti b/c candidate signals (~0.1–0.2 AU region).
// Placed at 0.20 AU — well inside the inner edge of the habitable zone.

const FERRUM_MASS   = 0.55 * M_EARTH;
const FERRUM_RADIUS = 0.82 * R_EARTH;

export const ferrum: CelestialBody = {
  kind: "planet",
  name: "Ferrum",
  renderRadius: planetRenderRadius(FERRUM_RADIUS),
  color: 0xb87333,  // copper-brown, scorched rock
  dataTag: "derived",
  description:
    "A scorching barren rock bombarded by Tau Ceti radiation. " +
    "Surface temperatures far exceed lead's melting point. " +
    "Named for the iron-silicate plains that gleam dull red from orbit.",
  massKg: FERRUM_MASS,
  radiusM: FERRUM_RADIUS,
  orbitalDistanceAu: 0.20,
  surfaceTempK: 740,
  gravityMs2: surfaceGravity(FERRUM_MASS, FERRUM_RADIUS),
  atmosphere: {
    pressurePa: 900,
    composition: "trace SO₂, CO₂",
    toxicity: 0.95,
    hasLiquidWater: false,
  },
  magnetosphere: 0.05,
  habitability: computeHabitability({
    luminositySol: TAU_CETI_LUMINOSITY_SOL,
    orbitalDistanceAu: 0.20,
    surfaceTempK: 740,
    gravityMs2: surfaceGravity(FERRUM_MASS, FERRUM_RADIUS),
    atmospherePressurePa: 900,
    atmosphereToxicity: 0.95,
    hasLiquidWater: false,
    magnetosphere: 0.05,
  }),
};

// ---------------------------------------------------------------------------
// Caldor  (Venus-like greenhouse world)
// ---------------------------------------------------------------------------
// Derived from Tau Ceti d candidate (~0.374 AU); thick CO₂ atmosphere has
// triggered a runaway greenhouse effect.

const CALDOR_MASS   = 1.18 * M_EARTH;
const CALDOR_RADIUS = 1.04 * R_EARTH;

export const caldor: CelestialBody = {
  kind: "planet",
  name: "Caldor",
  renderRadius: planetRenderRadius(CALDOR_RADIUS),
  color: 0xe09020,  // ochre-yellow, thick cloud deck
  dataTag: "derived",
  description:
    "A Venus-analogue with a crushing CO₂ atmosphere that has trapped heat " +
    "far beyond what raw insolation would predict. " +
    "Cloud tops visible from space; surface is a hellscape of 550 K.",
  massKg: CALDOR_MASS,
  radiusM: CALDOR_RADIUS,
  orbitalDistanceAu: 0.37,
  surfaceTempK: 548,
  gravityMs2: surfaceGravity(CALDOR_MASS, CALDOR_RADIUS),
  atmosphere: {
    pressurePa: 9_200_000, // ~91 atm, Venus-like
    composition: "CO₂ 96%, N₂ 3%, SO₂ trace",
    toxicity: 1.0,
    hasLiquidWater: false,
  },
  magnetosphere: 0.03,
  habitability: computeHabitability({
    luminositySol: TAU_CETI_LUMINOSITY_SOL,
    orbitalDistanceAu: 0.37,
    surfaceTempK: 548,
    gravityMs2: surfaceGravity(CALDOR_MASS, CALDOR_RADIUS),
    atmospherePressurePa: 9_200_000,
    atmosphereToxicity: 1.0,
    hasLiquidWater: false,
    magnetosphere: 0.03,
  }),
};

// ---------------------------------------------------------------------------
// Mira  (near-habitable — the early-game goal)
// ---------------------------------------------------------------------------
// Derived from Tau Ceti e candidate (~0.552 AU). Placed at 0.65 AU, just
// inside the conservative inner edge of the habitable zone. A thin N₂/CO₂
// atmosphere and seasonal liquid water make it the most promising body in
// the system — and the Civ-like "always an early goal in sight" hook.

const MIRA_MASS   = 0.94 * M_EARTH;
const MIRA_RADIUS = 0.98 * R_EARTH;

export const mira: CelestialBody = {
  kind: "planet",
  name: "Mira",
  renderRadius: planetRenderRadius(MIRA_RADIUS),
  color: 0x6baed6,  // muted blue-green — thin ocean glint
  dataTag: "derived",
  description:
    "The most promising world in the Tau Ceti system. " +
    "A thin N₂/CO₂ atmosphere retains just enough heat for seasonal liquid water " +
    "at the equator. Breathable only with a respirator; liveable in pressurised domes. " +
    "The obvious destination for the stranded crew.",
  massKg: MIRA_MASS,
  radiusM: MIRA_RADIUS,
  orbitalDistanceAu: 0.65,
  surfaceTempK: 299,
  gravityMs2: surfaceGravity(MIRA_MASS, MIRA_RADIUS),
  atmosphere: {
    pressurePa: 52_000, // ~0.51 atm — survivable with a respirator
    composition: "N₂ 72%, CO₂ 20%, Ar 5%, O₂ 3%",
    toxicity: 0.30,     // elevated CO₂; harmful without a mask, not lethal immediately
    hasLiquidWater: true,
  },
  magnetosphere: 0.42,
  habitability: computeHabitability({
    luminositySol: TAU_CETI_LUMINOSITY_SOL,
    orbitalDistanceAu: 0.65,
    surfaceTempK: 299,
    gravityMs2: surfaceGravity(MIRA_MASS, MIRA_RADIUS),
    atmospherePressurePa: 52_000,
    atmosphereToxicity: 0.30,
    hasLiquidWater: true,
    magnetosphere: 0.42,
  }),
};

// ---------------------------------------------------------------------------
// Glacius  (outer frozen world)
// ---------------------------------------------------------------------------
// Derived from Tau Ceti f candidate (~1.35 AU); at the outer edge of the HZ.
// Liquid water may exist beneath the ice at depth, but surface is frozen.

const GLACIUS_MASS   = 0.82 * M_EARTH;
const GLACIUS_RADIUS = 0.93 * R_EARTH;

export const glacius: CelestialBody = {
  kind: "planet",
  name: "Glacius",
  renderRadius: planetRenderRadius(GLACIUS_RADIUS),
  color: 0xd0e8f0,  // icy pale blue-white
  dataTag: "derived",
  description:
    "A frozen world at the outer edge of the habitable zone. " +
    "The surface is locked under kilometres of water-ice, " +
    "but tidal and radiogenic heating may sustain a liquid ocean below. " +
    "A long-term terraforming candidate once warming technology is available.",
  massKg: GLACIUS_MASS,
  radiusM: GLACIUS_RADIUS,
  orbitalDistanceAu: 1.35,
  surfaceTempK: 213,
  gravityMs2: surfaceGravity(GLACIUS_MASS, GLACIUS_RADIUS),
  atmosphere: {
    pressurePa: 28_000, // thin CO₂/N₂ — similar to early Mars
    composition: "CO₂ 60%, N₂ 35%, Ar 4%",
    toxicity: 0.50,
    hasLiquidWater: false, // surface ice; subsurface ocean not yet confirmed
  },
  magnetosphere: 0.18,
  habitability: computeHabitability({
    luminositySol: TAU_CETI_LUMINOSITY_SOL,
    orbitalDistanceAu: 1.35,
    surfaceTempK: 213,
    gravityMs2: surfaceGravity(GLACIUS_MASS, GLACIUS_RADIUS),
    atmospherePressurePa: 28_000,
    atmosphereToxicity: 0.50,
    hasLiquidWater: false,
    magnetosphere: 0.18,
  }),
};

// ---------------------------------------------------------------------------
// Titan's Eye  (outer gas giant)
// ---------------------------------------------------------------------------
// Fictional — no candidate signal at this distance, but physically reasonable
// for a protoplanetary disk of this star's mass. Useful as a future fuel source.

const TITANS_EYE_MASS   = 95 * M_EARTH;   // Saturn-class
const TITANS_EYE_RADIUS =  9 * R_EARTH;

export const titansEye: CelestialBody = {
  kind: "gas-giant",
  name: "Titan's Eye",
  renderRadius: gasGiantRenderRadius(TITANS_EYE_RADIUS),
  color: 0xc8a060,  // golden tan, Saturn-esque banding
  dataTag: "fictional",
  description:
    "A Saturn-class gas giant at 3.5 AU. No confirmed candidate signal at this distance — " +
    "its presence is physically plausible given the system's disk mass. " +
    "A dark elliptical storm near the equator resembles an eye from orbit. " +
    "Future potential: atmospheric hydrogen for fuel.",
  massKg: TITANS_EYE_MASS,
  radiusM: TITANS_EYE_RADIUS,
  orbitalDistanceAu: 3.50,
};
