// Tests for site→founding modifiers + the EDL classifier (the landing arc, docs/14).
// Pure mappings + the one integration point (solarEfficiency is applied on the
// colony's solar-generation path). Headless.

import { describe, it, expect } from "vitest";
import {
  siteModifiers,
  SITE_MOD,
  NEUTRAL_SITE_MODIFIERS,
  type CandidateSite,
} from "../src/sim/gen/sites.ts";
import { landingViability, edlSetupCost } from "../src/sim/math/edl.ts";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { foundColony } from "../src/sim/commands/colony.ts";
import { colonySystem } from "../src/sim/systems/colony.ts";
import { ECONOMY_TICK_INTERVAL } from "../src/sim/constants.ts";
import type { CelestialBody } from "../src/sim/ecs/components.ts";

function site(overrides: Partial<CandidateSite> = {}): CandidateSite {
  return {
    index: 0,
    name: "Test Site",
    latitude: 0,
    insolationFactor: 0.5,
    volatileProximity: 0.5,
    slope: 0.5,
    radiation: 0.5,
    thermalInertia: 0.5,
    ...overrides,
  };
}

function body(overrides: Partial<CelestialBody> = {}): CelestialBody {
  return {
    kind: "planet", name: "B", renderRadius: 1, color: 0, dataTag: "fictional", description: "",
    massKg: 5.97e24, radiusM: 6.37e6, gravityMs2: 9.8,
    atmosphere: { pressurePa: 101_325, composition: "N₂", toxicity: 0, hasLiquidWater: false },
    ...overrides,
  };
}

describe("siteModifiers — the pure site→founding mapping", () => {
  it("is deterministic (same site → same modifiers)", () => {
    expect(siteModifiers(site())).toEqual(siteModifiers(site()));
  });

  it("solar efficiency rises with insolation and stays in [0.85, 1.15]", () => {
    const lo = siteModifiers(site({ insolationFactor: 0 })).solarEfficiency;
    const hi = siteModifiers(site({ insolationFactor: 1 })).solarEfficiency;
    expect(lo).toBeCloseTo(SITE_MOD.solarEffMin, 6);
    expect(hi).toBeCloseTo(SITE_MOD.solarEffMin + SITE_MOD.solarEffSpan, 6);
    expect(hi).toBeGreaterThan(lo);
  });

  it("volatile proximity drives the water + oxygen head-start", () => {
    expect(siteModifiers(site({ volatileProximity: 0 })).startWaterBonus).toBe(0);
    expect(siteModifiers(site({ volatileProximity: 1 })).startWaterBonus).toBe(SITE_MOD.maxWaterBonus);
    expect(siteModifiers(site({ volatileProximity: 1 })).startOxygenBonus).toBe(SITE_MOD.maxOxygenBonus);
  });

  it("slope drives setup cost and radiation drives shielding cost", () => {
    expect(siteModifiers(site({ slope: 0, radiation: 0 })).setupMetalsCost).toBe(0);
    expect(siteModifiers(site({ slope: 1 })).setupMetalsCost).toBe(SITE_MOD.maxSlopeCost);
    expect(siteModifiers(site({ radiation: 1 })).shieldingMetalsCost).toBe(SITE_MOD.maxShieldCost);
  });

  it("a zero site yields near-neutral modifiers (no head-start, no cost, floor efficiency)", () => {
    const m = siteModifiers(site({ insolationFactor: 0, volatileProximity: 0, slope: 0, radiation: 0 }));
    expect(m.startWaterBonus).toBe(0);
    expect(m.setupMetalsCost + m.shieldingMetalsCost).toBe(0);
    expect(NEUTRAL_SITE_MODIFIERS.solarEfficiency).toBe(1);
  });
});

describe("landingViability — the EDL classifier", () => {
  it("classifies by atmospheric pressure", () => {
    expect(landingViability(body({ atmosphere: { pressurePa: 0, composition: "", toxicity: 0, hasLiquidWater: false } })).edlClass).toBe("vacuum");
    expect(landingViability(body({ atmosphere: { pressurePa: 10_000, composition: "", toxicity: 0, hasLiquidWater: false } })).edlClass).toBe("thin");
    expect(landingViability(body({ atmosphere: { pressurePa: 101_325, composition: "", toxicity: 0, hasLiquidWater: false } })).edlClass).toBe("nominal");
    expect(landingViability(body({ atmosphere: { pressurePa: 500_000, composition: "", toxicity: 0, hasLiquidWater: false } })).edlClass).toBe("thick");
  });

  it("thin atmospheres are the WORST for heavy payloads (below vacuum)", () => {
    const vac = landingViability(body({ atmosphere: { pressurePa: 0, composition: "", toxicity: 0, hasLiquidWater: false } })).payloadFactor;
    const thin = landingViability(body({ atmosphere: { pressurePa: 10_000, composition: "", toxicity: 0, hasLiquidWater: false } })).payloadFactor;
    expect(thin).toBeLessThan(vac);
  });

  it("high gravity lowers the payload factor", () => {
    const g1 = landingViability(body({ gravityMs2: 9.8 })).payloadFactor;
    const g2 = landingViability(body({ gravityMs2: 25 })).payloadFactor;
    expect(g2).toBeLessThan(g1);
  });

  it("edlSetupCost is 0 for a nominal world and positive for a thin one", () => {
    expect(edlSetupCost(landingViability(body({ atmosphere: { pressurePa: 101_325, composition: "", toxicity: 0, hasLiquidWater: false } })))).toBe(0);
    expect(edlSetupCost(landingViability(body({ atmosphere: { pressurePa: 10_000, composition: "", toxicity: 0, hasLiquidWater: false } })))).toBeGreaterThan(0);
  });
});

describe("solar efficiency is applied on the generation path", () => {
  it("a colony's solarEfficiency scales its power generation", () => {
    const world = createStartingSystem("solar-eff");
    run(world, 120);
    const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
    world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
    foundColony(world, bodyId);
    const colony = world.components.colony.get(bodyId)!;
    colony.buildings.solar = 5;

    colony.solarEfficiency = 1;
    world.tick = ECONOMY_TICK_INTERVAL;
    colonySystem(world);
    const p1 = colony.flows.power!.production;

    colony.solarEfficiency = 2;
    world.tick = ECONOMY_TICK_INTERVAL;
    colonySystem(world);
    const p2 = colony.flows.power!.production;

    expect(p1).toBeGreaterThan(0);
    expect(p2).toBeCloseTo(2 * p1, 6);
  });
});
