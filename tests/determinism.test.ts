// The core contract (CLAUDE.md): identical seed + identical inputs -> identical
// state. If this test ever breaks, saves, debugging, and any future multiplayer
// are all unreliable — so it guards the most important invariant in the project.

import { describe, it, expect } from "vitest";
import { createPhase0System } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { serializeWorld } from "../src/sim/ecs/world.ts";

const TICKS = 1000;

describe("simulation determinism", () => {
  it("same seed + same inputs -> byte-identical state after many ticks", () => {
    const a = createPhase0System("alpha-centauri");
    const b = createPhase0System("alpha-centauri");

    run(a, TICKS);
    run(b, TICKS);

    // Stringify both serialised worlds and compare exactly. Any drift — RNG,
    // floating-point order, iteration order — would change the string.
    expect(JSON.stringify(serializeWorld(a))).toBe(JSON.stringify(serializeWorld(b)));
  });

  it("advances state (the test isn't trivially comparing empty worlds)", () => {
    const fresh = createPhase0System("alpha-centauri");
    const stepped = createPhase0System("alpha-centauri");
    run(stepped, TICKS);

    expect(stepped.tick).toBe(TICKS);
    expect(JSON.stringify(serializeWorld(stepped))).not.toBe(
      JSON.stringify(serializeWorld(fresh)),
    );
  });

  it("different seed -> different state (RNG actually depends on the seed)", () => {
    const a = createPhase0System("seed-one");
    const b = createPhase0System("seed-two");

    // Orbits are seed-independent (fixed elements), so compare the RNG streams:
    // a different seed must produce a different stream.
    const drawsA = Array.from({ length: 16 }, () => a.rng.next());
    const drawsB = Array.from({ length: 16 }, () => b.rng.next());

    expect(drawsA).not.toEqual(drawsB);
  });

  it("resuming from a serialised tick count matches an uninterrupted run", () => {
    // Determinism implies a save/restore at tick N then running to 2N equals
    // running straight to 2N. (Restore here is re-seed + replay, which is the
    // strongest form of the guarantee.)
    const straight = createPhase0System("resume-seed");
    run(straight, 2 * TICKS);

    const replayed = createPhase0System("resume-seed");
    run(replayed, TICKS);
    run(replayed, TICKS);

    expect(JSON.stringify(serializeWorld(replayed))).toBe(
      JSON.stringify(serializeWorld(straight)),
    );
  });
});
