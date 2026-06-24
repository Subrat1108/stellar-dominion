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
import { colonySystem } from "./systems/colony.ts";
import { warpSystem } from "./systems/warp.ts";
import { applyCommand } from "./commands/apply.ts";
import type { GameEvent } from "./commands/types.ts";
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

/**
 * Advance the world by exactly one fixed tick, returning any GameEvents emitted
 * by commands processed this tick (empty if none). Tick order is fixed and
 * deterministic: increment tick → drain the command queue → run systems. Draining
 * commands BEFORE the systems means a command takes effect the same tick (e.g.
 * LandAtBody freezes flight before shipMovementSystem runs).
 */
export function step(world: World, input: Input = ZERO_INPUT): GameEvent[] {
  world.tick += 1;
  world.time = world.tick * FIXED_DT;

  // Discrete player commands: validated + applied in FIFO order. The queue is
  // captured and cleared first so commands enqueued during application (none
  // today) defer to the next tick rather than processing mid-drain.
  const events: GameEvent[] = [];
  if (world.commandQueue.length > 0) {
    const pending = world.commandQueue;
    world.commandQueue = [];
    for (const cmd of pending) {
      const result = applyCommand(world, cmd);
      if (result.ok) {
        events.push(...result.events);
      } else {
        events.push({ kind: "CommandRejected", command: cmd, reason: result.reason, tick: world.tick });
      }
    }
  }

  // Warp runs first: an ARRIVE this tick swaps the active system (new bodies),
  // so the systems below operate on the destination this same tick. It emits its
  // own events (phase changes, arrival) alongside any command events.
  events.push(...warpSystem(world));

  // Systems run in a fixed, deterministic order every tick. colonySystem runs
  // on its own slower cadence (gated inside) but is sequenced here before
  // life-support so the survival-clock relief sees this tick's colony state.
  orbitalSystem(world);
  shipMovementSystem(world, input);
  colonySystem(world);
  lifeSupportSystem(world);

  return events;
}

/** Advance the world by `count` ticks, feeding one input per tick if provided. */
export function run(world: World, count: number, inputs?: readonly Input[]): void {
  for (let i = 0; i < count; i++) {
    step(world, inputs?.[i] ?? ZERO_INPUT);
  }
}
