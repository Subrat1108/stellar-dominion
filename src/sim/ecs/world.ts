// Minimal hand-rolled ECS World.
//
// Decision (Session 3): hand-rolled over a library (Miniplex/bitECS). Phase 0
// needs almost nothing, and rolling our own keeps entity ids and iteration
// order fully under our control — both critical for determinism. We can swap in
// a library later if entity counts or query complexity demand it.
//
// Determinism notes:
//   - Entity ids are assigned from a monotonic counter (nextId), serialised
//     with the world, so a restored save keeps allocating where it left off.
//   - Systems must iterate in a stable order. Insertion-ordered Maps give us
//     that for free as long as we never rely on object key ordering elsewhere.

import { createComponents, type Components } from "./components.ts";
import { makeRng, type Rng } from "../math/rng.ts";

export interface World {
  /** Monotonic simulation tick counter (whole ticks since start). */
  tick: number;
  /** Accumulated simulation time in seconds (tick * dt). */
  time: number;
  /** Next entity id to hand out. */
  nextId: number;
  /** The single seeded RNG for the whole sim. */
  rng: Rng;
  components: Components;
}

export interface WorldInit {
  seed: string | number;
}

export function createWorld(init: WorldInit): World {
  return {
    tick: 0,
    time: 0,
    nextId: 1,
    rng: makeRng(init.seed),
    components: createComponents(),
  };
}

/** Allocate a fresh entity id. */
export function createEntity(world: World): number {
  return world.nextId++;
}

// --- Serialisation -------------------------------------------------------
//
// A save is the entity/component state + RNG state + tick count (docs/03).
// We hand-roll JSON conversion because Maps don't survive JSON.stringify and
// because a stable, explicit shape is exactly what the determinism test diffs.

export interface SerializedWorld {
  tick: number;
  time: number;
  nextId: number;
  rngState: number;
  components: {
    body: [number, Components["body"] extends Map<number, infer V> ? V : never][];
    orbit: [number, Components["orbit"] extends Map<number, infer V> ? V : never][];
    transform: [number, Components["transform"] extends Map<number, infer V> ? V : never][];
  };
}

export function serializeWorld(world: World): SerializedWorld {
  return {
    tick: world.tick,
    time: world.time,
    nextId: world.nextId,
    rngState: world.rng.state,
    components: {
      body: [...world.components.body.entries()],
      orbit: [...world.components.orbit.entries()],
      transform: [...world.components.transform.entries()],
    },
  };
}
