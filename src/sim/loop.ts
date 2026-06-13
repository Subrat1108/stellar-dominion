// Fixed-tick simulation loop.
//
// docs/03: "Fixed-tick simulation, interpolated rendering." The sim advances in
// discrete, equal steps. dt is FIXED — never the wall-clock frame delta — so a
// given (seed, inputs, tick count) always yields identical state. The renderer
// runs on its own clock and reads whatever the latest stepped state is.

import type { World } from "./ecs/world.ts";
import { orbitalSystem } from "./systems/orbital.ts";
import { lifeSupportSystem } from "./systems/life-support.ts";
import { shipMovementSystem } from "./systems/ship-movement.ts";
import { FIXED_DT } from "./constants.ts";
export { FIXED_DT };

/** Per-tick player intents. Flight is a six-key scheme: thrust (W/S),
 *  yaw (A/D), pitch (↑/↓). No world-vertical axis. */
export interface Input {
  /** Forward/back thrust along the nose: -1 (brake) to 1 (full ahead). */
  thrust: number;
  /** Yaw rate: -1 (left) to 1 (right). */
  yaw: number;
  /** Pitch rate: -1 (nose down) to 1 (nose up). */
  pitch: number;
  /** Throttle multiplier scaling acceleration and max speed (>= 1). */
  throttle: number;
}

/** A no-op input — ship coasts. */
export const ZERO_INPUT: Input = {
  thrust: 0,
  yaw: 0,
  pitch: 0,
  throttle: 1,
};

/** Advance the world by exactly one fixed tick. */
export function step(world: World, input: Input = ZERO_INPUT): void {
  world.tick += 1;
  world.time = world.tick * FIXED_DT;

  // Systems run in a fixed, deterministic order every tick.
  orbitalSystem(world);
  shipMovementSystem(world, input);
  lifeSupportSystem(world);
}

/** Advance the world by `count` ticks, feeding one input per tick if provided. */
export function run(world: World, count: number, inputs?: readonly Input[]): void {
  for (let i = 0; i < count; i++) {
    step(world, inputs?.[i] ?? ZERO_INPUT);
  }
}
