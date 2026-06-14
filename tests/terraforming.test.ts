// Tests for terraforming (Phase 3A): parameter shift under allocation, the
// Hydrosphere gate (locked below thresholds, unlocks above), habitability +
// stage recompute, and the population payoff (higher habitability → better
// growth). Headless — no renderer, no DOM.

import { describe, it, expect } from "vitest";
import { serializeWorld } from "../src/sim/ecs/world.ts";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { step } from "../src/sim/loop.ts";
import { colonySystem } from "../src/sim/systems/colony.ts";
import { foundColony, setTerraformAllocation } from "../src/sim/commands/colony.ts";
import { hydrosphereGate, terraformStage } from "../src/sim/math/terraforming.ts";
import { ECONOMY_TICK_INTERVAL } from "../src/sim/constants.ts";
import {
  TERRAFORM_LEVER_DEFS,
  ARMSTRONG_PA,
  FREEZING_K,
  ONE_ATM_PA,
} from "../src/sim/data/colony.ts";
import type { World } from "../src/sim/ecs/world.ts";
import type { Colony } from "../src/sim/ecs/components.ts";

function startedWorld(): World {
  const world = createStartingSystem();
  step(world); // populate body transforms
  return world;
}

/** Glacius — the cold, dry world (213 K, no liquid water): the terraforming subject. */
function coldPlanetId(world: World): number {
  for (const [id, body] of world.components.celestialBody) {
    if (
      body.kind === "planet" &&
      !body.atmosphere?.hasLiquidWater &&
      (body.surfaceTempK ?? 9999) < 273
    ) {
      return id;
    }
  }
  throw new Error("no cold dry planet");
}

/** Found a colony at a body and give it ample solar so power is never the limiter. */
function foundWithPower(world: World, bodyId: number): Colony {
  const ctrl = world.components.shipControl.get(world.shipId)!;
  ctrl.landedBodyId = bodyId;
  const result = foundColony(world, bodyId);
  if (!result.ok) throw new Error("found failed: " + result.reason);
  const colony = world.components.colony.get(bodyId)!;
  colony.buildings.solar = 100; // huge surplus regardless of insolation
  return colony;
}

/** Run exactly one economy tick against the current world state. */
function oneEconomyTick(world: World): void {
  world.tick = ECONOMY_TICK_INTERVAL;
  colonySystem(world);
}

describe("terraforming — parameter shift under allocation", () => {
  it("shifts temperature toward target by maxShift × fraction when affordable", () => {
    const world = startedWorld();
    const id = coldPlanetId(world);
    const body = world.components.celestialBody.get(id)!;
    foundWithPower(world, id);
    const t0 = body.surfaceTempK!;

    const r = setTerraformAllocation(world, id, "temperature", 1.0);
    expect(r.ok).toBe(true);

    oneEconomyTick(world);
    expect(body.surfaceTempK!).toBeCloseTo(t0 + TERRAFORM_LEVER_DEFS.temperature.maxShift, 5);
  });

  it("scales the shift with the allocation fraction", () => {
    const world = startedWorld();
    const id = coldPlanetId(world);
    const body = world.components.celestialBody.get(id)!;
    foundWithPower(world, id);
    const t0 = body.surfaceTempK!;

    setTerraformAllocation(world, id, "temperature", 0.5);
    oneEconomyTick(world);
    expect(body.surfaceTempK!).toBeCloseTo(t0 + 0.5 * TERRAFORM_LEVER_DEFS.temperature.maxShift, 5);
  });

  it("does nothing at zero allocation", () => {
    const world = startedWorld();
    const id = coldPlanetId(world);
    const body = world.components.celestialBody.get(id)!;
    foundWithPower(world, id);
    const t0 = body.surfaceTempK!;

    oneEconomyTick(world);
    expect(body.surfaceTempK!).toBe(t0);
  });

  it("runs at the affordable fraction when a stockpile is short, and clamps at target", () => {
    const world = startedWorld();
    const id = coldPlanetId(world);
    const body = world.components.celestialBody.get(id)!;
    const colony = foundWithPower(world, id);

    // Starve the metals input to half of one tick's demand at 100%.
    const want = TERRAFORM_LEVER_DEFS.temperature.maxBurn.metals!;
    colony.stockpiles.metals = want * 0.5;
    const t0 = body.surfaceTempK!;

    setTerraformAllocation(world, id, "temperature", 1.0);
    oneEconomyTick(world);

    // ratio 0.5 → half the shift, half the burn.
    expect(body.surfaceTempK!).toBeCloseTo(t0 + 0.5 * TERRAFORM_LEVER_DEFS.temperature.maxShift, 5);
    expect(colony.stockpiles.metals!).toBeCloseTo(0, 5);
  });
});

describe("terraforming — Hydrosphere gate", () => {
  it("is locked below the freezing/Armstrong thresholds and the command is rejected", () => {
    const world = startedWorld();
    const id = coldPlanetId(world);
    const body = world.components.celestialBody.get(id)!;
    foundWithPower(world, id);

    const gate = hydrosphereGate(body.atmosphere!.pressurePa, body.surfaceTempK!);
    expect(gate.locked).toBe(true);
    expect(gate.reason).toContain("temperature");

    const r = setTerraformAllocation(world, id, "hydrosphere", 0.5);
    expect(r.ok).toBe(false);
  });

  it("unlocks once temperature clears 0 °C, then raises the hydrosphere", () => {
    const world = startedWorld();
    const id = coldPlanetId(world);
    const body = world.components.celestialBody.get(id)!;
    foundWithPower(world, id);

    // Warm the world past freezing (pressure already exceeds the Armstrong limit).
    body.surfaceTempK = FREEZING_K + 10;
    expect(hydrosphereGate(body.atmosphere!.pressurePa, body.surfaceTempK).locked).toBe(false);

    const r = setTerraformAllocation(world, id, "hydrosphere", 1.0);
    expect(r.ok).toBe(true);

    const h0 = body.hydrosphere ?? 0;
    oneEconomyTick(world);
    expect((body.hydrosphere ?? 0)).toBeGreaterThan(h0);
  });
});

describe("terraforming — habitability + stage recompute", () => {
  it("raises the habitability score as the world warms toward Earth-like", () => {
    const world = startedWorld();
    const id = coldPlanetId(world);
    const body = world.components.celestialBody.get(id)!;
    foundWithPower(world, id);
    const hab0 = body.habitability!;

    setTerraformAllocation(world, id, "temperature", 1.0);
    for (let i = 0; i < 20; i++) oneEconomyTick(world);

    expect(body.habitability!).toBeGreaterThan(hab0);
  });

  it("stages follow the docs/11 thresholds", () => {
    // Barren: sub-Armstrong pressure.
    expect(terraformStage(ARMSTRONG_PA - 1, 290, false)).toBe("Barren");
    // Frozen: atmosphere retained, below freezing, no liquid water.
    expect(terraformStage(28_000, 213, false)).toBe("Frozen");
    // Marginal: liquid water, >0.5 atm, above freezing, but not Earth-like.
    expect(terraformStage(0.6 * ONE_ATM_PA, FREEZING_K + 5, true)).toBe("Marginal");
    // Habitable: near 1 atm, 10–30 °C, liquid water.
    expect(terraformStage(ONE_ATM_PA, FREEZING_K + 15, true)).toBe("Habitable");
  });
});

describe("terraforming — population payoff", () => {
  it("a higher habitability gives faster population growth", () => {
    function growthAtHab(hab: number): number {
      const world = startedWorld();
      const id = coldPlanetId(world);
      const body = world.components.celestialBody.get(id)!;
      foundWithPower(world, id);
      body.habitability = hab;
      oneEconomyTick(world);
      return world.components.colony.get(id)!.popGrowthRate;
    }

    const low = growthAtHab(0.2);
    const high = growthAtHab(0.9);
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0); // still growing, just slower
  });
});

describe("terraforming — serialization", () => {
  it("round-trips the terraforming component", () => {
    const world = startedWorld();
    const id = coldPlanetId(world);
    foundWithPower(world, id);
    setTerraformAllocation(world, id, "temperature", 0.75);

    const snap = serializeWorld(world);
    const entry = snap.components.terraforming.find(([bodyId]) => bodyId === id);
    expect(entry).toBeDefined();
    expect(entry![1].allocations.temperature).toBe(0.75);
  });
});
