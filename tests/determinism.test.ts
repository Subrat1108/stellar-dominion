// The core contract (CLAUDE.md): identical seed + identical inputs -> identical
// state. If this test ever breaks, saves, debugging, and any future multiplayer
// are all unreliable — so it guards the most important invariant in the project.
//
// Phase 1 extends the proof to include the stranded ship: crew, inventory, and
// the life-support depletion system all tick deterministically.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { serializeWorld } from "../src/sim/ecs/world.ts";

const TICKS = 1000;

describe("simulation determinism", () => {
  it("same seed + same inputs → byte-identical state after many ticks", () => {
    const a = createStartingSystem("alpha-centauri");
    const b = createStartingSystem("alpha-centauri");

    run(a, TICKS);
    run(b, TICKS);

    expect(JSON.stringify(serializeWorld(a))).toBe(JSON.stringify(serializeWorld(b)));
  });

  it("advances state (the test is not trivially comparing identical worlds)", () => {
    const fresh = createStartingSystem("alpha-centauri");
    const stepped = createStartingSystem("alpha-centauri");
    run(stepped, TICKS);

    expect(stepped.tick).toBe(TICKS);
    expect(JSON.stringify(serializeWorld(stepped))).not.toBe(
      JSON.stringify(serializeWorld(fresh)),
    );
  });

  it("different seed → different RNG stream", () => {
    const a = createStartingSystem("seed-one");
    const b = createStartingSystem("seed-two");

    const drawsA = Array.from({ length: 16 }, () => a.rng.next());
    const drawsB = Array.from({ length: 16 }, () => b.rng.next());

    expect(drawsA).not.toEqual(drawsB);
  });

  it("resuming (run N then run N again) equals an uninterrupted run of 2N", () => {
    const straight = createStartingSystem("resume-seed");
    run(straight, 2 * TICKS);

    const replayed = createStartingSystem("resume-seed");
    run(replayed, TICKS);
    run(replayed, TICKS);

    expect(JSON.stringify(serializeWorld(replayed))).toBe(
      JSON.stringify(serializeWorld(straight)),
    );
  });

  it("life support depletes deterministically over many ticks", () => {
    const world = createStartingSystem("ls-seed");
    const ls0 = world.components.lifeSupport.get(world.shipId);
    expect(ls0).toBeDefined();
    const initialCurrent = ls0!.current;

    run(world, TICKS);

    const ls1 = world.components.lifeSupport.get(world.shipId);
    expect(ls1).toBeDefined();
    // Should have depleted by exactly TICKS * depletionRate
    const expected = initialCurrent - TICKS * ls0!.depletionRatePerTick;
    expect(ls1!.current).toBe(Math.max(0, expected));
  });

  it("two worlds with the same seed have identical life-support after ticking", () => {
    const a = createStartingSystem("ls-determinism");
    const b = createStartingSystem("ls-determinism");

    run(a, TICKS);
    run(b, TICKS);

    const lsA = a.components.lifeSupport.get(a.shipId);
    const lsB = b.components.lifeSupport.get(b.shipId);
    expect(lsA?.current).toBe(lsB?.current);
  });

  it("ship entity id is consistent and carries crew + inventory", () => {
    const world = createStartingSystem("ship-check");
    expect(world.shipId).toBeGreaterThan(0);

    const crew = world.components.crew.get(world.shipId);
    expect(crew?.members.length).toBeGreaterThan(0);

    const inv = world.components.inventory.get(world.shipId);
    expect(inv?.metals).toBeGreaterThan(0);
  });
});
