// System generator — the heart of the content engine (docs/13).
//
// generateSystem(universeSeed, catalogStar, realDef?) deterministically produces
// a full star system from a real catalog star: real bodies injected verbatim
// where a RealSystemDef provides them, physically-plausible bodies generated
// otherwise. Same (seed, star) → identical system, every time, on every machine.
// Generation is LAZY (call it when a system is visited) and never precomputed.
//
// Pipeline (docs/13): xxHash(star id + coords) → seed → seeded RNG; spectral
// type → planet count + masses (occurrence rates); Chen & Kipping → radius →
// gravity; "peas in a pod" (~20 mutual Hill radii) → orbital spacing; archetype
// → surface/atmosphere/colour. Every body is tagged real / derived / fictional.

import type { CelestialBody } from "../ecs/components.ts";
import { computeHabitability } from "../math/habitability.ts";
import { surfaceGravity, insolation as insolationOf } from "../math/physics.ts";
import {
  STAR_RENDER_RADIUS,
  planetRenderRadius,
  gasGiantRenderRadius,
} from "../presentation.ts";
import { makeRng } from "../math/rng.ts";
import { systemSeed } from "./hash.ts";
import {
  spectralClass,
  stellarMassSol,
  stellarLuminositySol,
  stellarTempK,
  planetCount,
  samplePlanetMassEarth,
} from "./occurrence.ts";
import {
  R_EARTH_M,
  M_EARTH_KG,
  M_SUN_KG,
  radiusEarthFromMassEarth,
} from "./mass-radius.ts";
import {
  nextSemiMajorAxisAu,
  sampleHillSpacing,
  sampleInnerAxisAu,
} from "./spacing.ts";
import { deriveSurface, starColor, gasGiantColor } from "./archetype.ts";
import { generateBodyName, moonName } from "./names.ts";
import type { CatalogStar } from "./catalog.ts";
import type {
  GeneratedBody,
  GeneratedSystem,
  OrbitParams,
  RealSystemDef,
} from "./types.ts";

const R_SUN_M = 6.957e8;

/** Build the star body from catalog data + an optional real override. */
function buildStar(star: CatalogStar, realDef?: RealSystemDef): GeneratedBody {
  const cls = spectralClass(star.spect);
  const systemId = `hyg:${star.id}`;
  if (realDef) {
    const s = realDef.star;
    const body: CelestialBody = {
      kind: "star",
      name: s.name,
      renderRadius: STAR_RENDER_RADIUS,
      color: s.color,
      dataTag: "real",
      description: s.description,
      massKg: s.massKg,
      radiusM: s.radiusM,
      spectralType: s.spectralType,
      luminositySol: s.luminositySol,
      tempK: s.tempK,
      bodyKey: `${systemId}:star`,
    };
    return { bodyKey: body.bodyKey!, provenance: "real", body };
  }

  // Generated-but-anchored: a real star whose detailed parameters we estimate
  // from its spectral class (catalog luminosity used when present).
  const tempK = stellarTempK(cls);
  const lum = star.lum ?? stellarLuminositySol(cls);
  const massKg = stellarMassSol(cls) * M_SUN_KG;
  const body: CelestialBody = {
    kind: "star",
    name: star.name ?? `HYG ${star.id}`,
    renderRadius: STAR_RENDER_RADIUS,
    color: starColor(tempK),
    dataTag: "derived",
    description: `A ${star.spect ?? cls}-type star ${star.distPc.toFixed(1)} pc away.`,
    massKg,
    radiusM: stellarMassSol(cls) ** 0.8 * R_SUN_M,
    spectralType: star.spect ?? cls,
    luminositySol: lum,
    tempK,
    bodyKey: `${systemId}:star`,
  };
  return { bodyKey: body.bodyKey!, provenance: "derived", body };
}

/** Assemble a generated rocky/temperate planet body from a sampled mass. */
function buildGeneratedPlanet(
  rng: ReturnType<typeof makeRng>,
  systemId: string,
  index: number,
  massEarth: number,
  axisAu: number,
  luminositySol: number,
  orbit: OrbitParams,
): GeneratedBody {
  const radiusEarth = radiusEarthFromMassEarth(massEarth);
  const massKg = massEarth * M_EARTH_KG;
  const radiusM = radiusEarth * R_EARTH_M;
  const gravityMs2 = surfaceGravity(massKg, radiusM);
  const insol = insolationOf(luminositySol, axisAu);
  const surf = deriveSurface(rng, { massEarth, insolation: insol, gravityMs2 });
  const name = generateBodyName(rng);

  const habitability = computeHabitability({
    luminositySol,
    orbitalDistanceAu: axisAu,
    surfaceTempK: surf.surfaceTempK,
    gravityMs2,
    atmospherePressurePa: surf.atmosphere.pressurePa,
    atmosphereToxicity: surf.atmosphere.toxicity,
    hasLiquidWater: surf.atmosphere.hasLiquidWater,
    magnetosphere: surf.magnetosphere,
  });

  const body: CelestialBody = {
    kind: "planet",
    name,
    renderRadius: planetRenderRadius(radiusM),
    color: surf.color,
    dataTag: "fictional",
    description: `A generated ${surf.archetype} world (${name}).`,
    massKg,
    radiusM,
    orbitalDistanceAu: axisAu,
    surfaceTempK: surf.surfaceTempK,
    gravityMs2,
    atmosphere: surf.atmosphere,
    magnetosphere: surf.magnetosphere,
    habitability,
    bodyKey: `${systemId}:${index}`,
  };
  return { bodyKey: body.bodyKey!, provenance: "fictional", body, orbit };
}

/** Build the outer gas giant + its moons (all fictional). */
function buildGasGiantWithMoons(
  rng: ReturnType<typeof makeRng>,
  systemId: string,
  index: number,
  axisAu: number,
  orbit: OrbitParams,
  moonRange: [number, number],
): GeneratedBody[] {
  const massEarth = rng.range(60, 320); // Neptune→Saturn class
  const radiusEarth = radiusEarthFromMassEarth(massEarth);
  const massKg = massEarth * M_EARTH_KG;
  const radiusM = radiusEarth * R_EARTH_M;
  const name = generateBodyName(rng);
  const planet: CelestialBody = {
    kind: "gas-giant",
    name,
    renderRadius: gasGiantRenderRadius(radiusM),
    color: gasGiantColor(rng),
    dataTag: "fictional",
    description: `A generated gas giant (${name}) at ${axisAu.toFixed(1)} AU. A potential fuel source.`,
    massKg,
    radiusM,
    orbitalDistanceAu: axisAu,
    bodyKey: `${systemId}:${index}`,
  };
  const out: GeneratedBody[] = [
    { bodyKey: planet.bodyKey!, provenance: "fictional", body: planet, orbit },
  ];

  const moonCount = rng.int(moonRange[0], moonRange[1]);
  for (let m = 0; m < moonCount; m++) {
    const moonMassEarth = rng.range(0.01, 0.08);
    const moonRadiusEarth = radiusEarthFromMassEarth(moonMassEarth);
    const moonMassKg = moonMassEarth * M_EARTH_KG;
    const moonRadiusM = moonRadiusEarth * R_EARTH_M;
    const moonName_ = moonName(name, m);
    const moon: CelestialBody = {
      kind: "planet",
      name: moonName_,
      renderRadius: planetRenderRadius(moonRadiusM),
      color: 0x9a9aa0,
      dataTag: "fictional",
      description: `A barren moon of ${name}.`,
      massKg: moonMassKg,
      radiusM: moonRadiusM,
      surfaceTempK: Math.round(60 + rng.range(0, 80)),
      gravityMs2: surfaceGravity(moonMassKg, moonRadiusM),
      atmosphere: { pressurePa: 0, composition: "none", toxicity: 0, hasLiquidWater: false },
      magnetosphere: 0,
      habitability: 0,
      // Moon orbit is around the planet; semiMajorAxisAu is its distance from
      // the planet (small). world-setup places it in scene units relative to
      // the planet's render radius (the physical AU is not visually meaningful).
      bodyKey: `${systemId}:${index}.${m}`,
    };
    out.push({
      bodyKey: moon.bodyKey!,
      provenance: "fictional",
      body: moon,
      parentKey: planet.bodyKey!,
      orbit: {
        semiMajorAxisAu: 0.002 * (m + 1),
        eccentricity: rng.range(0, 0.05),
        meanAnomalyAtEpoch: rng.range(0, Math.PI * 2),
        argumentOfPeriapsis: 0,
      },
    });
  }
  return out;
}

/**
 * Generate (or reconstruct) a full star system from a catalog star. Pass the
 * matching RealSystemDef to inject real bodies verbatim; omit it to generate the
 * whole system procedurally. Deterministic for a given (universeSeed, star).
 */
export function generateSystem(
  universeSeed: string | number,
  star: CatalogStar,
  realDef?: RealSystemDef,
): GeneratedSystem {
  const systemId = `hyg:${star.id}`;
  const rng = makeRng(systemSeed(universeSeed, star));
  const starBody = buildStar(star, realDef);
  const luminositySol = starBody.body.luminositySol!;
  const starMassSol = starBody.body.massKg / M_SUN_KG;
  const bodies: GeneratedBody[] = [];

  let outerAxisAu = 0;
  let outerMassEarth = 1;
  let nextIndex = 0;

  if (realDef) {
    // Real planets verbatim, in their listed (orbital) order.
    for (const def of realDef.planets) {
      const body: CelestialBody = { ...def.body, bodyKey: `${systemId}:${nextIndex}` };
      bodies.push({ bodyKey: body.bodyKey!, provenance: def.provenance, body, orbit: def.orbit });
      outerAxisAu = Math.max(outerAxisAu, def.orbit.semiMajorAxisAu);
      outerMassEarth = body.massKg / M_EARTH_KG;
      nextIndex++;
    }
  } else {
    // Fully procedural: sample count, then lay out outward by Hill spacing.
    const cls = spectralClass(star.spect);
    const n = planetCount(rng, cls);
    let axisAu = sampleInnerAxisAu(rng, starMassSol);
    let prevMassEarth = samplePlanetMassEarth(rng, cls);
    for (let i = 0; i < n; i++) {
      const massEarth = i === 0 ? prevMassEarth : samplePlanetMassEarth(rng, cls);
      if (i > 0) {
        axisAu = nextSemiMajorAxisAu(axisAu, prevMassEarth, massEarth, starMassSol, sampleHillSpacing(rng));
      }
      const orbit: OrbitParams = {
        semiMajorAxisAu: axisAu,
        eccentricity: rng.range(0, 0.12),
        meanAnomalyAtEpoch: rng.range(0, Math.PI * 2),
        argumentOfPeriapsis: rng.range(0, Math.PI * 2),
      };
      bodies.push(buildGeneratedPlanet(rng, systemId, nextIndex, massEarth, axisAu, luminositySol, orbit));
      prevMassEarth = massEarth;
      outerAxisAu = axisAu;
      outerMassEarth = massEarth;
      nextIndex++;
    }
  }

  // Optional outer gas giant + moons, spaced beyond the outermost body.
  if (realDef?.generateGasGiant) {
    const giantMassEarth = 250;
    const axisAu = nextSemiMajorAxisAu(
      outerAxisAu || 1,
      outerMassEarth,
      giantMassEarth,
      starMassSol,
      sampleHillSpacing(rng),
    );
    const orbit: OrbitParams = {
      semiMajorAxisAu: axisAu,
      eccentricity: rng.range(0, 0.08),
      meanAnomalyAtEpoch: rng.range(0, Math.PI * 2),
      argumentOfPeriapsis: rng.range(0, Math.PI * 2),
    };
    bodies.push(...buildGasGiantWithMoons(rng, systemId, nextIndex, axisAu, orbit, realDef.gasGiantMoons));
    nextIndex++;
  }

  return { systemId, star: starBody, bodies };
}
