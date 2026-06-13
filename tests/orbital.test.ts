// Orbital-time decoupling (Phase 1B, Session 7).
//
// Planets must advance on a much slower clock than flight time, so they're
// nearly stationary during a flight but still drift over longer spans. Pure
// function of tick → deterministic (global determinism is proven separately
// in determinism.test.ts, which now also exercises this slowed clock).

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { ORBITAL_TIME_RATE } from "../src/sim/systems/orbital.ts";

function firstPlanetPos(world: ReturnType<typeof createStartingSystem>) {
  const id = [...world.components.orbit.keys()][0]!;
  const p = world.components.transform.get(id)!.position;
  return { x: p.x, y: p.y, z: p.z };
}

describe("orbital time decoupling", () => {
  it("innermost planet is nearly stationary over a ~10s flight, yet still moving", () => {
    // Sanity: the orbital clock is a strong slowdown, not real time.
    expect(ORBITAL_TIME_RATE).toBeGreaterThan(0);
    expect(ORBITAL_TIME_RATE).toBeLessThan(0.05);

    const world = createStartingSystem("orbit-decouple");
    run(world, 1); // seed transforms
    const before = firstPlanetPos(world);

    run(world, 600); // ~10 real seconds at 60 ticks/s
    const after = firstPlanetPos(world);

    const moved = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
    // Still advancing (not frozen)…
    expect(moved).toBeGreaterThan(1e-4);
    // …but a tiny fraction of its ~10-unit orbital radius (nearly stationary).
    expect(moved).toBeLessThan(1.0);
  });
});
