// Tests for the colony economy + population (Phases 2B + 2C): founding
// conservation, the economy cadence, resource flows, power/water shortage
// cascades, population growth/decline, housing cap, the survival-clock
// relief, and determinism. Headless — no renderer, no DOM.

import { describe, it, expect } from "vitest";
import { serializeWorld } from "../src/sim/ecs/world.ts";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { step, run } from "../src/sim/loop.ts";
import { colonySystem, housingCapacity } from "../src/sim/systems/colony.ts";
import { foundColony } from "../src/sim/commands/colony.ts";
import { ECONOMY_TICK_INTERVAL } from "../src/sim/constants.ts";
import {
  COLONY_SEED,
  FOUNDING_LIFE_SUPPORT_COST,
  OXYGEN_DEATH_RATE,
  WATER_DEATH_RATE,
  FOOD_STARVATION_RATE,
  HOUSING_PER_MODULE,
} from "../src/sim/data/colony.ts";
import type { World } from "../src/sim/ecs/world.ts";
import type { Colony } from "../src/sim/ecs/components.ts";

function startedWorld(): World {
  const world = createStartingSystem();
  step(world); // populate body transforms
  return world;
}

function planetId(world: World): number {
  for (const [id, body] of world.components.celestialBody) {
    if (body.kind === "planet") return id;
  }
  throw new Error("no planet");
}

/** Mira — the wet, moderate-insolation planet — for water/power flow tests. */
function wetPlanetId(world: World): number {
  for (const [id, body] of world.components.celestialBody) {
    if (body.kind === "planet" && body.atmosphere?.hasLiquidWater) return id;
  }
  throw new Error("no wet planet");
}

/** Mark the ship landed on a body and found a colony there. */
function foundAt(world: World, bodyId: number): Colony {
  const ctrl = world.components.shipControl.get(world.shipId)!;
  ctrl.landedBodyId = bodyId;
  const result = foundColony(world, bodyId);
  if (!result.ok) throw new Error("found failed: " + result.reason);
  return world.components.colony.get(bodyId)!;
}

/** Run exactly one economy tick against the current colony state. */
function oneEconomyTick(world: World): void {
  world.tick = ECONOMY_TICK_INTERVAL; // a tick where the economy fires
  colonySystem(world);
}

describe("FoundColony", () => {
  it("conserves supplies — seeds the colony by drawing from the ship", () => {
    const world = startedWorld();
    const inv = world.components.inventory.get(world.shipId)!;
    const ls = world.components.lifeSupport.get(world.shipId)!;
    const m0 = inv.metals, f0 = inv.food, fuel0 = inv.fuel, ls0 = ls.current;

    const colony = foundAt(world, planetId(world));

    expect(inv.metals).toBe(m0 - COLONY_SEED.metals);
    expect(inv.food).toBe(f0 - COLONY_SEED.food);
    expect(inv.fuel).toBe(fuel0 - COLONY_SEED.propellant);
    expect(ls.current).toBe(ls0 - FOUNDING_LIFE_SUPPORT_COST);
    expect(colony.stockpiles.water).toBe(COLONY_SEED.water);
    expect(colony.stockpiles.oxygen).toBe(COLONY_SEED.oxygen);
    expect(colony.stockpiles.metals).toBe(COLONY_SEED.metals);
  });

  it("rejects a second colony on the same body", () => {
    const world = startedWorld();
    const pid = planetId(world);
    foundAt(world, pid);
    const again = foundColony(world, pid);
    expect(again.ok).toBe(false);
  });

  it("rejects founding when not landed on the body", () => {
    const world = startedWorld();
    const result = foundColony(world, planetId(world)); // landedBodyId unset
    expect(result.ok).toBe(false);
  });
});

describe("economy cadence", () => {
  it("does not run on non-economy flight ticks", () => {
    const world = startedWorld();
    const colony = foundAt(world, planetId(world));
    const o0 = colony.stockpiles.oxygen;
    // Advance a handful of flight ticks that are not multiples of the interval.
    world.tick = 5;
    colonySystem(world);
    expect(colony.stockpiles.oxygen).toBe(o0); // untouched between economy ticks
  });

  it("consumes crew oxygen each economy tick with no buildings", () => {
    const world = startedWorld();
    const colony = foundAt(world, planetId(world));
    const o0 = colony.stockpiles.oxygen!;
    oneEconomyTick(world);
    // 5 crew × 0.1 O₂ = 0.5 consumed.
    expect(colony.stockpiles.oxygen).toBeCloseTo(o0 - 0.5, 6);
    expect(colony.flows.oxygen!.consumption).toBeCloseTo(0.5, 6);
  });
});

describe("production & flows", () => {
  it("solar generation scales with insolation and powers extraction", () => {
    const world = startedWorld();
    const colony = foundAt(world, wetPlanetId(world));
    colony.buildings.solar = 2;
    colony.buildings.waterExtractor = 1;
    oneEconomyTick(world);
    expect(colony.flows.power!.production).toBeGreaterThan(0);
    expect(colony.flows.water!.production).toBeGreaterThan(0);
  });

  it("electrolysis turns the colony oxygen-positive", () => {
    const world = startedWorld();
    const colony = foundAt(world, wetPlanetId(world));
    colony.buildings.solar = 3;
    colony.buildings.waterExtractor = 2;
    colony.buildings.electrolysis = 1;
    oneEconomyTick(world);
    expect(colony.flows.oxygen!.net).toBeGreaterThan(0);
  });
});

describe("shortage cascades", () => {
  it("power deficit shuts the lowest-priority modules off first", () => {
    const world = startedWorld();
    // Mira's moderate insolation means one solar can't power all four consumers.
    const colony = foundAt(world, wetPlanetId(world));
    colony.buildings.solar = 1;
    colony.buildings.waterExtractor = 1;
    colony.buildings.electrolysis = 1;
    colony.buildings.hydroponics = 1;
    colony.buildings.smelter = 1;
    oneEconomyTick(world);
    // Water extractor + electrolysis (top priority) run; food + metals do not.
    expect(colony.flows.water!.production).toBeGreaterThan(0);
    expect(colony.flows.oxygen!.production).toBeGreaterThan(0);
    expect(colony.flows.food!.production).toBe(0);
    expect(colony.flows.metals!.production).toBe(0);
  });

  it("suppliers run before consumers — no water death-spiral from empty store", () => {
    const world = startedWorld();
    const colony = foundAt(world, wetPlanetId(world));
    colony.buildings.solar = 4;        // ample power
    colony.buildings.waterExtractor = 2;
    colony.buildings.electrolysis = 1;
    colony.stockpiles.water = 0;       // start dry on purpose
    oneEconomyTick(world);
    // Extractor replenishes water before electrolysis draws it, so oxygen is
    // produced at full rate (1.8) despite the empty starting stockpile.
    expect(colony.flows.oxygen!.production).toBeCloseTo(1.8, 6);
  });
});

describe("survival-clock relief", () => {
  it("recovers the ship reserve while landed at a colony with oxygen", () => {
    const world = startedWorld();
    foundAt(world, planetId(world));
    const ls = world.components.lifeSupport.get(world.shipId)!;
    const before = ls.current;
    run(world, 5); // a few flight ticks, still landed, colony has oxygen
    expect(ls.current).toBeGreaterThan(before);
  });

  it("depletes normally after take-off", () => {
    const world = startedWorld();
    foundAt(world, planetId(world));
    const ctrl = world.components.shipControl.get(world.shipId)!;
    delete ctrl.landedBodyId; // took off
    const ls = world.components.lifeSupport.get(world.shipId)!;
    const before = ls.current;
    run(world, 5);
    expect(ls.current).toBeLessThan(before);
  });
});

describe("determinism", () => {
  it("identical colony builds produce identical serialized state", () => {
    const a = startedWorld();
    const b = startedWorld();
    for (const w of [a, b]) {
      const c = foundAt(w, planetId(w));
      c.buildings.solar = 3;
      c.buildings.waterExtractor = 2;
      c.buildings.electrolysis = 1;
      c.buildings.hydroponics = 1;
    }
    for (let i = 0; i < 180; i++) { step(a); step(b); }
    expect(JSON.stringify(serializeWorld(a))).toBe(JSON.stringify(serializeWorld(b)));
  });
});

// ---------------------------------------------------------------------------
// Phase 2C — population dynamics
// ---------------------------------------------------------------------------

describe("Phase 2C — founding & housing", () => {
  it("seeds population from the ship's crew count", () => {
    const world = startedWorld();
    const crewCount = world.components.crew.get(world.shipId)!.members.length;
    const colony = foundAt(world, planetId(world));
    expect(colony.population).toBe(crewCount);
  });

  it("grants 1 free Habitation Module on founding (housing = 10)", () => {
    const world = startedWorld();
    const colony = foundAt(world, planetId(world));
    expect(colony.buildings.habitation).toBe(1);
    expect(housingCapacity(colony)).toBe(HOUSING_PER_MODULE);
  });
});

describe("Phase 2C — growth", () => {
  it("population grows when all resources in surplus and housing available", () => {
    const world = startedWorld();
    const colony = foundAt(world, wetPlanetId(world));
    colony.buildings.solar = 5;
    colony.buildings.waterExtractor = 3;
    colony.buildings.electrolysis = 2;
    colony.buildings.hydroponics = 2;
    const popBefore = colony.population;
    oneEconomyTick(world);
    expect(colony.population).toBeGreaterThan(popBefore);
    expect(colony.popGrowthRate).toBeGreaterThan(0);
  });

  it("population stops growing at housing capacity", () => {
    const world = startedWorld();
    const colony = foundAt(world, wetPlanetId(world));
    colony.population = housingCapacity(colony); // exactly at cap
    // High stockpiles prevent false shortage deaths.
    colony.stockpiles.oxygen = 500;
    colony.stockpiles.water  = 500;
    colony.stockpiles.food   = 500;
    oneEconomyTick(world);
    expect(colony.popGrowthRate).toBe(0);
    expect(colony.popLimitingFactor).toBe("growth capped: housing");
  });

  it("higher habitability yields faster growth than lower habitability", () => {
    const worldHigh = startedWorld();
    const worldLow  = startedWorld();
    const pidHigh = wetPlanetId(worldHigh);
    const pidLow  = planetId(worldLow);

    // Force explicit habitability values so the test is independent of world-setup.
    worldHigh.components.celestialBody.get(pidHigh)!.habitability = 0.8;
    worldLow.components.celestialBody.get(pidLow)!.habitability  = 0.2;

    for (const [w, pid] of [[worldHigh, pidHigh], [worldLow, pidLow]] as const) {
      const c = foundAt(w, pid);
      c.population = 5;
      c.stockpiles.oxygen = 500;
      c.stockpiles.water  = 500;
      c.stockpiles.food   = 500;
    }
    oneEconomyTick(worldHigh);
    oneEconomyTick(worldLow);

    const rateHigh = worldHigh.components.colony.get(pidHigh)!.popGrowthRate;
    const rateLow  = worldLow.components.colony.get(pidLow)!.popGrowthRate;
    expect(rateHigh).toBeGreaterThan(rateLow);
  });

  it("unpowered Habitation Module penalises growth", () => {
    // No solar → habitation loses power → growth multiplier = 0.5.
    const worldNoPwr = startedWorld();
    const colNoPwr = foundAt(worldNoPwr, wetPlanetId(worldNoPwr));
    colNoPwr.buildings.habitation = 2;
    colNoPwr.stockpiles.oxygen = 500;
    colNoPwr.stockpiles.water  = 500;
    colNoPwr.stockpiles.food   = 500;
    oneEconomyTick(worldNoPwr);
    const penaltyRate = colNoPwr.popGrowthRate;

    // Ample solar → habitation fully powered → no penalty.
    const worldPwr = startedWorld();
    const colPwr = foundAt(worldPwr, wetPlanetId(worldPwr));
    colPwr.buildings.habitation = 2;
    colPwr.buildings.solar = 6;
    colPwr.stockpiles.oxygen = 500;
    colPwr.stockpiles.water  = 500;
    colPwr.stockpiles.food   = 500;
    oneEconomyTick(worldPwr);
    const fullRate = colPwr.popGrowthRate;

    expect(fullRate).toBeGreaterThan(penaltyRate);
    expect(colNoPwr.popLimitingFactor).toContain("low power");
  });
});

describe("Phase 2C — shortage deaths", () => {
  it("oxygen deficit causes proportional population loss", () => {
    const world = startedWorld();
    const colony = foundAt(world, planetId(world));
    // Stockpile below threshold, no production → net < 0.
    colony.stockpiles.oxygen = 5;
    const popBefore = colony.population;
    oneEconomyTick(world);
    expect(colony.population).toBeLessThan(popBefore);
    expect(colony.popLimitingFactor).toBe("declining: oxygen deficit");
    // Rate = -OXYGEN_DEATH_RATE × population (proportional, not flat).
    expect(colony.popGrowthRate).toBeCloseTo(-OXYGEN_DEATH_RATE * popBefore, 4);
  });

  it("water deficit causes proportional population loss", () => {
    const world = startedWorld();
    const colony = foundAt(world, planetId(world));
    colony.stockpiles.oxygen = 500; // keep O2 above threshold
    colony.stockpiles.water  = 3;   // below threshold, no production → net < 0
    const popBefore = colony.population;
    oneEconomyTick(world);
    expect(colony.population).toBeLessThan(popBefore);
    expect(colony.popLimitingFactor).toBe("declining: water deficit");
    expect(colony.popGrowthRate).toBeCloseTo(-WATER_DEATH_RATE * popBefore, 4);
  });

  it("food shortage with net < 0 causes slow starvation", () => {
    const world = startedWorld();
    const colony = foundAt(world, planetId(world));
    colony.stockpiles.oxygen = 500;
    colony.stockpiles.water  = 500;
    colony.stockpiles.food   = 3;   // below threshold, no hydroponics → net < 0
    const popBefore = colony.population;
    oneEconomyTick(world);
    expect(colony.population).toBeLessThan(popBefore);
    expect(colony.popLimitingFactor).toBe("declining: food shortage");
    expect(colony.popGrowthRate).toBeCloseTo(-FOOD_STARVATION_RATE * popBefore, 4);
  });

  it("food low but net-positive does NOT trigger starvation", () => {
    const world = startedWorld();
    const colony = foundAt(world, wetPlanetId(world));
    colony.stockpiles.oxygen = 500;
    colony.stockpiles.water  = 500;
    colony.stockpiles.food   = 5;   // below critical threshold but recovering
    // Hydroponics produces more food than the colony consumes.
    colony.buildings.solar = 4;
    colony.buildings.waterExtractor = 2;
    colony.buildings.hydroponics = 2;
    const popBefore = colony.population;
    oneEconomyTick(world);
    // Net food must be positive for this scenario to be valid.
    expect(colony.flows.food!.net).toBeGreaterThan(0);
    // Starvation must not fire even though the stockpile was below the threshold.
    expect(colony.popLimitingFactor).not.toBe("declining: food shortage");
    expect(colony.population).toBeGreaterThanOrEqual(popBefore);
  });
});
