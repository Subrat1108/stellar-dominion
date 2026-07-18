// Candidate landing sites — the landing arc (docs/14).
//
// On landing, the game offers a SMALL SET (~3) of candidate sites deterministically
// derived from the body's stable seed (bodyKey + universe seed — the same seam as
// system generation + scan previews, docs/13). Choosing one founds the colony with
// modifiers derived from the site (site→modifier mapping lives in math/sites.ts,
// applied at founding). These are OPTIONS to weigh, NOT a tile map: no rovers, no
// build radius, no action points (docs/14 header). Sites are pure + regenerated on
// demand (never persisted); only the chosen index persists on the colony.
//
// Determinism is sacred: same (universeSeed, body) → identical sites, every time,
// on every machine (pure xxHash-seeded RNG, no Math.random).

import type { CelestialBody } from "../ecs/components.ts";
import { makeRng } from "../math/rng.ts";
import { hashSeed } from "../math/rng.ts";
import { xxHashString } from "./hash.ts";

/** How many candidate sites are offered per landing. */
export const CANDIDATE_SITE_COUNT = 3;

/**
 * One landing site: a bundle of environmental attributes derived from the body's
 * real fields + seeded per-site variation (so two sites on the same world genuinely
 * differ). All 0–1 unless noted. These feed the pure site→founding-modifier mapping.
 */
export interface CandidateSite {
  /** Stable index within the body (0 … CANDIDATE_SITE_COUNT-1). */
  index: number;
  /** Human-readable label, e.g. "Equatorial Plateau". */
  name: string;
  /** Absolute latitude, degrees (0 = equator, 90 = pole). */
  latitude: number;
  /** Relative solar quality, 0–1 (higher near the equator; drives solar efficiency). */
  insolationFactor: number;
  /** Access to local volatiles/water ice, 0–1 (biased by the body's water state). */
  volatileProximity: number;
  /** Terrain roughness / setup difficulty, 0–1 (higher = costlier to establish). */
  slope: number;
  /** Surface radiation exposure, 0–1 (higher when the body's magnetosphere/atmosphere is weak). */
  radiation: number;
  /** Thermal inertia, 0–1 (reserved — flavour + a future 3A pacing hook). */
  thermalInertia: number;
}

const DEG2RAD = Math.PI / 180;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Body-only water hint (0–1), mirroring the economy's waterAbundance intent but
 * kept self-contained so gen/ stays free of systems/. Liquid → rich; frozen →
 * moderate (subsurface ice); hot/dry → poor.
 */
function waterHint(body: CelestialBody): number {
  if (body.atmosphere?.hasLiquidWater) return 0.9;
  if ((body.surfaceTempK ?? 9999) < 260) return 0.6; // frozen: subsurface ice
  return 0.25; // hot/dry barren rock
}

const LAT_BAND = (lat: number): string =>
  lat < 30 ? "Equatorial" : lat < 60 ? "Midland" : "Polar";

const LANDFORMS = ["Basin", "Plateau", "Shelf", "Flats", "Rise", "Vale"] as const;

/**
 * Deterministically generate the candidate landing sites for a body. Pure: same
 * (universeSeed, body) → identical sites. `body.bodyKey` is the stable identity;
 * hand-built fixtures without one fall back to the body name.
 */
export function generateCandidateSites(
  universeSeed: string | number,
  body: CelestialBody,
): CandidateSite[] {
  const key = body.bodyKey ?? body.name;
  const rng = makeRng(xxHashString(`sites:${key}`, hashSeed(universeSeed)));
  const water = waterHint(body);
  // Weak magnetosphere and/or thin atmosphere → higher baseline surface radiation.
  const magFactor = 1 - clamp01(body.magnetosphere ?? 0);
  const atmPa = body.atmosphere?.pressurePa ?? 0;
  const atmShield = clamp01(atmPa / 101_325); // ~1 atm fully shields (relative)
  const radBase = clamp01(0.75 * magFactor * (1 - 0.5 * atmShield));

  const sites: CandidateSite[] = [];
  for (let i = 0; i < CANDIDATE_SITE_COUNT; i++) {
    const latitude = rng.range(0, 90);
    // Equator sunniest; a little jitter so latitude isn't the sole driver.
    const insolationFactor = clamp01(Math.cos(latitude * DEG2RAD) * rng.range(0.85, 1.1));
    const volatileProximity = clamp01(water + rng.range(-0.25, 0.25));
    const slope = clamp01(rng.next());
    const radiation = clamp01(radBase + rng.range(-0.15, 0.15));
    const thermalInertia = clamp01(rng.next());
    const name = `${LAT_BAND(latitude)} ${LANDFORMS[rng.int(0, LANDFORMS.length - 1)]!}`;
    sites.push({ index: i, name, latitude, insolationFactor, volatileProximity, slope, radiation, thermalInertia });
  }
  return sites;
}

// ---------------------------------------------------------------------------
// Site → colony founding modifiers (the landing arc, docs/14)
// ---------------------------------------------------------------------------
//
// A pure mapping from a chosen site to the scalar modifiers applied to the
// EXISTING aggregate colony at founding — head-starts, a persistent efficiency,
// and one-time setup costs. Deterministic (same site → same modifiers). No
// spatial state; these just tune the aggregate colony (docs/14: NO tile/AP layer).

/** Founding modifiers derived from a landing site. */
export interface SiteModifiers {
  /** Extra starting Water in the colony stockpile (in-situ volatiles — not from the ship). */
  startWaterBonus: number;
  /** Extra starting Oxygen in the colony stockpile (in-situ volatiles — not from the ship). */
  startOxygenBonus: number;
  /** Persistent solar-generation multiplier (~0.85–1.15). Stored on the colony. */
  solarEfficiency: number;
  /** One-time extra Metals spent at founding to establish on rough terrain (slope). */
  setupMetalsCost: number;
  /** One-time extra Metals spent at founding on radiation shielding. */
  shieldingMetalsCost: number;
}

/** Tuning constants for the site→modifier mapping (kept small so founding stays affordable). */
export const SITE_MOD = {
  solarEffMin: 0.85,
  solarEffSpan: 0.3, // → solarEfficiency in [0.85, 1.15]
  maxWaterBonus: 80,
  maxOxygenBonus: 40,
  maxSlopeCost: 40,
  maxShieldCost: 50,
} as const;

/** Pure site → founding modifiers. Same site → same modifiers. */
export function siteModifiers(site: CandidateSite): SiteModifiers {
  return {
    startWaterBonus: Math.round(site.volatileProximity * SITE_MOD.maxWaterBonus),
    startOxygenBonus: Math.round(site.volatileProximity * SITE_MOD.maxOxygenBonus),
    solarEfficiency: SITE_MOD.solarEffMin + site.insolationFactor * SITE_MOD.solarEffSpan,
    setupMetalsCost: Math.round(site.slope * SITE_MOD.maxSlopeCost),
    shieldingMetalsCost: Math.round(site.radiation * SITE_MOD.maxShieldCost),
  };
}

/** Neutral modifiers (no site chosen / no body) — nothing changes. */
export const NEUTRAL_SITE_MODIFIERS: SiteModifiers = {
  startWaterBonus: 0,
  startOxygenBonus: 0,
  solarEfficiency: 1,
  setupMetalsCost: 0,
  shieldingMetalsCost: 0,
};
