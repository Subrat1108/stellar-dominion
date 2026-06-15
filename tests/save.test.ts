// Tests for the seed + deltas save model (docs/09, docs/13): a save carries the
// universe seed + player deltas (keyed by stable bodyKey), and reconstructing it
// reproduces a byte-identical world. Headless — pure sim, no DOM.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { serializeWorld, type World } from "../src/sim/ecs/world.ts";
import { run, step } from "../src/sim/loop.ts";
import { colonySystem } from "../src/sim/systems/colony.ts";
import { foundColony, setTerraformAllocation } from "../src/sim/commands/colony.ts";
import { ECONOMY_TICK_INTERVAL } from "../src/sim/constants.ts";
import {
  extractDeltas,
  reconstructWorld,
  SAVE_VERSION,
} from "../src/sim/save/serialize.ts";
import { MemorySaveStore } from "../src/sim/save/store.ts";
import type { Colony } from "../src/sim/ecs/components.ts";

/** A cold dry planet id (the terraforming subject). */
function coldPlanetId(world: World): number {
  for (const [id, body] of world.components.celestialBody) {
    if (body.kind === "planet" && !body.atmosphere?.hasLiquidWater && (body.surfaceTempK ?? 9999) < 273) {
      return id;
    }
  }
  throw new Error("no cold dry planet");
}

/** Build a played-in world: flown, founded a colony, terraformed a few ticks. */
function playedWorld(seed = "save-seed"): { world: World; bodyId: number } {
  const world = createStartingSystem(seed);
  run(world, 300); // advance time, move orbits + ship clock
  const bodyId = coldPlanetId(world);
  world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
  const r = foundColony(world, bodyId);
  if (!r.ok) throw new Error("found failed: " + r.reason);
  const colony = world.components.colony.get(bodyId)! as Colony;
  colony.buildings.solar = 100;
  setTerraformAllocation(world, bodyId, "temperature", 1.0);
  // Run several economy ticks so temperature/habitability actually shift.
  for (let i = 0; i < 5; i++) {
    world.tick = ECONOMY_TICK_INTERVAL;
    colonySystem(world);
    step(world);
  }
  return { world, bodyId };
}

describe("save round-trip (seed + deltas)", () => {
  it("reconstructs a byte-identical world from seed + deltas", () => {
    const { world } = playedWorld();
    const payload = extractDeltas(world);
    const restored = reconstructWorld(payload);
    expect(JSON.stringify(serializeWorld(restored))).toBe(
      JSON.stringify(serializeWorld(world)),
    );
  });

  it("captures terraforming progress as a per-body override", () => {
    const { world, bodyId } = playedWorld();
    const key = world.components.celestialBody.get(bodyId)!.bodyKey!;
    const payload = extractDeltas(world);
    const override = payload.deltas.bodyOverrides.find(([k]) => k === key);
    expect(override).toBeDefined();
    expect(override![1].surfaceTempK).toBeDefined();
  });

  it("keys colonies + terraforming by stable bodyKey, not entity id", () => {
    const { world } = playedWorld();
    const payload = extractDeltas(world);
    expect(payload.deltas.colonies.length).toBe(1);
    expect(payload.deltas.colonies[0]![0]).toMatch(/^hyg:\d+:/);
    expect(payload.deltas.terraforming[0]![0]).toMatch(/^hyg:\d+:/);
  });

  it("persists the universe seed and current version", () => {
    const { world } = playedWorld("particular-seed");
    const payload = extractDeltas(world);
    expect(payload.universeSeed).toBe("particular-seed");
    expect(payload.version).toBe(SAVE_VERSION);
  });

  it("round-trips through a SaveStore (save → load → reconstruct)", async () => {
    const { world } = playedWorld();
    const store = new MemorySaveStore();
    await store.save("slot1", extractDeltas(world));
    const loaded = await store.load("slot1");
    expect(loaded).not.toBeNull();
    const restored = reconstructWorld(loaded!);
    expect(JSON.stringify(serializeWorld(restored))).toBe(
      JSON.stringify(serializeWorld(world)),
    );
    expect(await store.list()).toEqual(["slot1"]);
  });

  it("rejects an unsupported save version", () => {
    const { world } = playedWorld();
    const payload = extractDeltas(world);
    payload.version = 999;
    expect(() => reconstructWorld(payload)).toThrow(/version/i);
  });

  it("a freshly-generated world has no body overrides (clean baseline)", () => {
    const world = createStartingSystem("clean");
    step(world);
    const payload = extractDeltas(world);
    expect(payload.deltas.bodyOverrides.length).toBe(0);
  });
});
