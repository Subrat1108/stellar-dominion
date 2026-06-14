// Life-support depletion system.
//
// Each tick, every entity with a LifeSupport component loses
// `depletionRatePerTick` units. The survival clock (docs/02) is driven here.
// The system is deterministic: same rate, same ticks → same remaining value.
// Clamped to 0 so it never goes negative.
//
// Phase 2B survival payoff: when the crew is landed at a colony that still has
// oxygen, the ship's reserve RECOVERS instead of depleting (the crew breathes
// colony air). This is how founding and sustaining a colony reverses the
// survival clock — the whole point of the early game (docs/02, docs/10).

import type { World } from "../ecs/world.ts";
import { isCrewSustainedByColony } from "./colony.ts";
import { LIFE_SUPPORT_REGEN_PER_TICK } from "../data/colony.ts";

export function lifeSupportSystem(world: World): void {
  const sustained = isCrewSustainedByColony(world);
  for (const [id, ls] of world.components.lifeSupport) {
    if (id === world.shipId && sustained) {
      ls.current = Math.min(ls.capacity, ls.current + LIFE_SUPPORT_REGEN_PER_TICK);
    } else {
      ls.current = Math.max(0, ls.current - ls.depletionRatePerTick);
    }
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
