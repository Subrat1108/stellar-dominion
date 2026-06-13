// Life-support system tests.
//
// Verifies that depletion is deterministic, clamps at zero, and that the
// helper functions (fraction, ticks-remaining) compute correctly.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import {
  lifeSupportFraction,
  ticksRemaining,
} from "../src/sim/systems/life-support.ts";

describe("lifeSupportSystem", () => {
  it("depletes by exactly rate × ticks after N ticks", () => {
    const world = createStartingSystem("ls-test");
    const ls = world.components.lifeSupport.get(world.shipId)!;
    const initial = ls.current;
    const rate = ls.depletionRatePerTick;
    const N = 500;

    run(world, N);

    const updated = world.components.lifeSupport.get(world.shipId)!;
    expect(updated.current).toBe(initial - rate * N);
  });

  it("never goes below zero even when ticked past exhaustion", () => {
    const world = createStartingSystem("ls-clamp");
    const ls = world.components.lifeSupport.get(world.shipId)!;
    // Run far past capacity / rate
    run(world, Math.ceil(ls.capacity / ls.depletionRatePerTick) + 1000);

    const updated = world.components.lifeSupport.get(world.shipId)!;
    expect(updated.current).toBe(0);
  });
});

describe("lifeSupportFraction", () => {
  it("returns 1 when full", () => {
    expect(lifeSupportFraction(100, 100)).toBe(1);
  });

  it("returns 0 when empty", () => {
    expect(lifeSupportFraction(0, 100)).toBe(0);
  });

  it("returns correct midpoint", () => {
    expect(lifeSupportFraction(25, 100)).toBe(0.25);
  });

  it("returns 0 when capacity is 0", () => {
    expect(lifeSupportFraction(0, 0)).toBe(0);
  });
});

describe("ticksRemaining", () => {
  it("returns current / rate when rate > 0", () => {
    expect(ticksRemaining(1000, 2)).toBe(500);
  });

  it("returns Infinity when rate is 0", () => {
    expect(ticksRemaining(1000, 0)).toBe(Infinity);
  });
});
