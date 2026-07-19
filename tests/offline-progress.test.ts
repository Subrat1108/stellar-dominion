// Tests for offline progression (sim/save/offline.ts): the deterministic
// fast-forward of the colony economy across a real-world gap. Reuses
// runColonyEconomy — the same call the off-view catch-up (catch-up.ts) makes —
// so these tests focus on the wall-clock→tick conversion, the clamp, the pause
// short-circuit, and — explicitly, per the session brief — VERIFYING that
// terraforming actually advances (not just population), since that's the
// mechanism the "come back to risen water" promise depends on.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { foundColony, setTerraformAllocation } from "../src/sim/commands/colony.ts";
import { serializeWorld } from "../src/sim/ecs/world.ts";
import {
  offlineEconTicks,
  applyOfflineProgress,
  OFFLINE_ECON_TICKS_PER_REAL_HOUR,
  MAX_OFFLINE_ELAPSED_MS,
} from "../src/sim/save/offline.ts";
import { ECONOMY_TICK_INTERVAL } from "../src/sim/constants.ts";
import type { World } from "../src/sim/ecs/world.ts";

/** A world with a founded colony on a cold/dry planet with Temperature allocated
 *  (the terraforming subject — mirrors tests/terraforming.test.ts's pattern). */
function terraformingWorld(seed = "offline-seed"): { world: World; bodyId: number } {
  const world = createStartingSystem(seed);
  run(world, 300);
  let bodyId = -1;
  for (const [id, body] of world.components.celestialBody) {
    if (body.kind === "planet" && !body.atmosphere?.hasLiquidWater && (body.surfaceTempK ?? 9999) < 273) {
      bodyId = id;
      break;
    }
  }
  if (bodyId < 0) throw new Error("no cold dry planet");
  world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
  if (!foundColony(world, bodyId).ok) throw new Error("found failed");
  world.components.colony.get(bodyId)!.buildings.solar = 50; // ample power to fund terraforming
  setTerraformAllocation(world, bodyId, "temperature", 1.0);
  return { world, bodyId };
}

describe("offlineEconTicks — the wall-clock→econ-tick conversion", () => {
  it("paused yields zero, regardless of elapsed", () => {
    expect(offlineEconTicks(10 * 3_600_000, true)).toEqual({ econ: 0, clamped: false });
  });

  it("non-positive elapsed yields zero", () => {
    expect(offlineEconTicks(0, false).econ).toBe(0);
    expect(offlineEconTicks(-1000, false).econ).toBe(0);
  });

  it("credits OFFLINE_ECON_TICKS_PER_REAL_HOUR econ-ticks per real hour, unclamped", () => {
    const oneHour = offlineEconTicks(3_600_000, false);
    expect(oneHour.econ).toBe(OFFLINE_ECON_TICKS_PER_REAL_HOUR);
    expect(oneHour.clamped).toBe(false);
  });

  it("is deliberately SLOWER than active play (far below 1 econ-tick per real second)", () => {
    const oneHour = offlineEconTicks(3_600_000, false);
    // Active play runs ~3600 econ-ticks in an hour (1/real-second); offline must
    // credit substantially less — a pleasant catch-up, not a play substitute.
    expect(oneHour.econ).toBeLessThan(3600 / 4);
  });

  it("clamps elapsed to MAX_OFFLINE_ELAPSED_MS — a week-long absence credits the same as 12h", () => {
    const atCap = offlineEconTicks(MAX_OFFLINE_ELAPSED_MS, false);
    const wayOver = offlineEconTicks(MAX_OFFLINE_ELAPSED_MS * 20, false);
    expect(atCap.clamped).toBe(false); // exactly at the cap is not "exceeded"
    expect(wayOver.clamped).toBe(true);
    expect(wayOver.econ).toBe(atCap.econ);
  });
});

describe("applyOfflineProgress — determinism + terraforming verification", () => {
  it("is a pure function of (world state, elapsedMs): identical saved states + identical elapsed → identical result", () => {
    const a = terraformingWorld("det-seed").world;
    const b = terraformingWorld("det-seed").world;
    applyOfflineProgress(a, 2 * 3_600_000, false);
    applyOfflineProgress(b, 2 * 3_600_000, false);
    expect(JSON.stringify(serializeWorld(a))).toBe(JSON.stringify(serializeWorld(b)));
  });

  it("VERIFIED: terraforming (surface temperature) actually advances during offline progress, not just population", () => {
    const { world, bodyId } = terraformingWorld();
    const before = world.components.celestialBody.get(bodyId)!.surfaceTempK!;
    const progress = applyOfflineProgress(world, 3 * 3_600_000, false); // 3h away
    const after = world.components.celestialBody.get(bodyId)!.surfaceTempK!;
    expect(progress.econTicksRun).toBeGreaterThan(0);
    expect(after).toBeGreaterThan(before); // temperature climbs toward the 288K target
    // The summary itself reports the hydrosphere/habitability payoff line.
    const summary = progress.colonies.find((c) => c.bodyId === bodyId)!;
    expect(summary.habitabilityAfter).toBeGreaterThanOrEqual(summary.habitabilityBefore ?? 0);
  });

  it("advances world.tick/time by exactly econTicksRun × ECONOMY_TICK_INTERVAL flight-ticks", () => {
    const { world } = terraformingWorld();
    const t0 = world.tick;
    const progress = applyOfflineProgress(world, 5 * 3_600_000, false);
    expect(world.tick).toBe(t0 + progress.econTicksRun * ECONOMY_TICK_INTERVAL);
  });

  it("paused leaves the world completely unchanged", () => {
    const { world } = terraformingWorld("pause-seed");
    const snapshot = JSON.stringify(serializeWorld(world));
    const progress = applyOfflineProgress(world, 10 * 3_600_000, true);
    expect(progress.econTicksRun).toBe(0);
    expect(JSON.stringify(serializeWorld(world))).toBe(snapshot);
  });

  it("a clamped (very long) absence still advances by exactly the clamped econ-tick count", () => {
    const a = terraformingWorld("clamp-seed").world;
    const b = terraformingWorld("clamp-seed").world;
    const atCap = applyOfflineProgress(a, MAX_OFFLINE_ELAPSED_MS, false);
    const wayOver = applyOfflineProgress(b, MAX_OFFLINE_ELAPSED_MS * 50, false);
    expect(wayOver.clamped).toBe(true);
    expect(wayOver.econTicksRun).toBe(atCap.econTicksRun);
    expect(JSON.stringify(serializeWorld(a))).toBe(JSON.stringify(serializeWorld(b)));
  });

  it("zero elapsed (or zero econ-ticks) leaves the world unchanged and reports no colonies-advanced", () => {
    const { world } = terraformingWorld("zero-seed");
    const snapshot = JSON.stringify(serializeWorld(world));
    const progress = applyOfflineProgress(world, 0, false);
    expect(progress.econTicksRun).toBe(0);
    expect(JSON.stringify(serializeWorld(world))).toBe(snapshot);
  });
});
