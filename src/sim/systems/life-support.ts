// Life-support depletion system.
//
// Each tick, every entity with a LifeSupport component loses
// `depletionRatePerTick` units. The survival clock (docs/02) is driven here.
// The system is deterministic: same rate, same ticks → same remaining value.
// Clamped to 0 so it never goes negative.

import type { World } from "../ecs/world.ts";

export function lifeSupportSystem(world: World): void {
  for (const [, ls] of world.components.lifeSupport) {
    ls.current = Math.max(0, ls.current - ls.depletionRatePerTick);
  }
}

/** Remaining life-support as a fraction 0–1. */
export function lifeSupportFraction(current: number, capacity: number): number {
  return capacity > 0 ? Math.max(0, Math.min(1, current / capacity)) : 0;
}

/**
 * Estimated ticks remaining until life support hits zero.
 * Returns Infinity if depletion rate is zero.
 */
export function ticksRemaining(current: number, depletionRatePerTick: number): number {
  return depletionRatePerTick > 0 ? current / depletionRatePerTick : Infinity;
}
