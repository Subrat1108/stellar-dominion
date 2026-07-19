// Tests for background-tab offline progression (app/visibility-offline.ts).
// The core guarantee under test: the accumulator-reset instruction is
// UNCONDITIONAL — both branches (below/above the threshold) always tell the
// caller to reset to 0 — which is what prevents the live fixed-tick loop from
// ALSO replaying a hidden→visible gap that offline catch-up already credited
// (double-counting it). See docs/09 2026-07-19 and main.ts for the full wiring.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { foundColony } from "../src/sim/commands/colony.ts";
import { serializeWorld } from "../src/sim/ecs/world.ts";
import {
  handleVisibilityResume,
  VISIBILITY_OFFLINE_THRESHOLD_MS,
} from "../src/app/visibility-offline.ts";
import { offlineEconTicks } from "../src/sim/save/offline.ts";
import { ECONOMY_TICK_INTERVAL } from "../src/sim/constants.ts";
import type { World } from "../src/sim/ecs/world.ts";

function foundedWorld(seed = "vis-seed"): World {
  const world = createStartingSystem(seed);
  run(world, 120);
  const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
  world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
  if (!foundColony(world, bodyId).ok) throw new Error("found failed");
  return world;
}

describe("handleVisibilityResume — the no-double-count contract", () => {
  it("below the threshold: no offline progress runs, but the accumulator reset is still instructed", () => {
    const world = foundedWorld();
    const t0 = world.tick;
    const result = handleVisibilityResume(world, 0, VISIBILITY_OFFLINE_THRESHOLD_MS - 1, false);
    expect(result.summary).toBeNull();
    expect(result.resetAccumulatorMs).toBe(0); // UNCONDITIONAL — even the no-op branch resets
    expect(world.tick).toBe(t0); // nothing advanced
  });

  it("at/above the threshold: offline progress runs AND the accumulator reset is instructed", () => {
    const world = foundedWorld();
    const t0 = world.tick;
    const elapsed = 3 * 3_600_000; // 3h hidden
    const result = handleVisibilityResume(world, 0, elapsed, false);
    expect(result.summary).not.toBeNull();
    expect(result.summary!.econTicksRun).toBeGreaterThan(0);
    expect(result.resetAccumulatorMs).toBe(0);
    expect(world.tick).toBeGreaterThan(t0);
  });

  it("both branches ALWAYS return resetAccumulatorMs === 0 — the guarantee is unconditional, not branch-dependent", () => {
    const belowWorld = foundedWorld("below");
    const aboveWorld = foundedWorld("above");
    const below = handleVisibilityResume(belowWorld, 0, 1000, false);
    const above = handleVisibilityResume(aboveWorld, 0, 3_600_000, false);
    expect(below.resetAccumulatorMs).toBe(0);
    expect(above.resetAccumulatorMs).toBe(0);
  });

  it("does NOT double-count: total ticks advanced for a gap E equal offlineEconTicks(E).econ exactly ONCE", () => {
    const world = foundedWorld("no-double");
    const t0 = world.tick;
    const elapsed = 4 * 3_600_000; // 4h hidden
    const expectedEcon = offlineEconTicks(elapsed, false).econ;

    const result = handleVisibilityResume(world, 0, elapsed, false);

    // Exactly the offline-credited amount — not double (which would happen if a
    // caller failed to reset the accumulator and the live loop ALSO replayed
    // this same gap via step()).
    expect(world.tick - t0).toBe(expectedEcon * ECONOMY_TICK_INTERVAL);
    expect(result.summary!.econTicksRun).toBe(expectedEcon);

    // The resetAccumulatorMs contract is what makes this safe in the live loop:
    // a caller that honours it (main.ts) starts the next frame's accumulator at
    // 0, so step() never independently replays flight ticks for this same span.
    expect(result.resetAccumulatorMs).toBe(0);
  });

  it("paused: no progress runs even for a long hidden gap, but reset is still instructed", () => {
    const world = foundedWorld("paused");
    const t0 = world.tick;
    const result = handleVisibilityResume(world, 0, 6 * 3_600_000, true);
    expect(result.summary!.econTicksRun).toBe(0);
    expect(world.tick).toBe(t0);
    expect(result.resetAccumulatorMs).toBe(0);
  });

  it("determinism: identical world state + identical (hiddenAt, now) → identical result", () => {
    const a = foundedWorld("det-vis");
    const b = foundedWorld("det-vis");
    handleVisibilityResume(a, 1000, 1000 + 5 * 3_600_000, false);
    handleVisibilityResume(b, 1000, 1000 + 5 * 3_600_000, false);
    expect(JSON.stringify(serializeWorld(a))).toBe(JSON.stringify(serializeWorld(b)));
  });
});
