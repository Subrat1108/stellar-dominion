// Fixed-tick simulation loop.
//
// docs/03: "Fixed-tick simulation, interpolated rendering." The sim advances in
// discrete, equal steps. dt is FIXED — never the wall-clock frame delta — so a
// given (seed, inputs, tick count) always yields identical state. The renderer
// runs on its own clock and reads whatever the latest stepped state is.

import type { World } from "./ecs/world.ts";
import { orbitalSystem } from "./systems/orbital.ts";
import { lifeSupportSystem } from "./systems/life-support.ts";

/** Fixed simulation step, in seconds. One tick = this much sim time. */
export const FIXED_DT = 1 / 60;

/** Per-tick player intents. Grows in later phases as commands are added. */
export interface Input {
  // Intentionally empty for Phase 1A; structure is here for the type contract.
}

/** Advance the world by exactly one fixed tick. */
export function step(world: World, _input: Input = {}): void {
  world.tick += 1;
  world.time = world.tick * FIXED_DT;

  // Systems run in a fixed, deterministic order every tick.
  orbitalSystem(world);
  lifeSupportSystem(world);
}

/** Advance the world by `count` ticks, feeding one input per tick if provided. */
export function run(world: World, count: number, inputs?: readonly Input[]): void {
  for (let i = 0; i < count; i++) {
    step(world, inputs?.[i] ?? {});
  }
}
