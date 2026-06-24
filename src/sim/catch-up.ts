// Off-view system catch-up (docs/09, Session 18).
//
// Systems other than the active one are NOT ticked while the player is away — to
// keep the laptop CPU budget flat. Instead, on re-entry, the system's economy is
// fast-forwarded by the elapsed economy-ticks: the existing colony economy is
// batch-run deterministically (progress is a pure function of stashed state +
// elapsed ticks), so the home colony genuinely advances while you explore.
//
// The catch-up is CLAMPED to a ceiling so a very long absence can't stall a
// frame; clamping is pure (it just caps the loop count), so determinism is
// unaffected — a clamped re-entry always yields the same result for the same
// inputs. The batch loop allocates nothing itself.

import type { World } from "./ecs/world.ts";
import { runColonyEconomy } from "./systems/colony.ts";
import { ECONOMY_TICK_INTERVAL } from "./constants.ts";

/** Maximum economy-ticks resolved in one catch-up (≈ caps the per-frame cost). */
export const MAX_CATCHUP_ECON_TICKS = 2000;

export interface CatchUpResult {
  /** Economy-ticks actually resolved. */
  ranEconTicks: number;
  /** True if the elapsed span was capped by MAX_CATCHUP_ECON_TICKS. */
  clamped: boolean;
}

/**
 * Advance the active world's colonies by the economy-ticks contained in
 * `elapsedTicks`, clamped to the ceiling. Call right after a system's stashed
 * state has been restored, before handing control back to the player.
 */
export function catchUpColony(world: World, elapsedTicks: number): CatchUpResult {
  let econ = Math.floor(Math.max(0, elapsedTicks) / ECONOMY_TICK_INTERVAL);
  let clamped = false;
  if (econ > MAX_CATCHUP_ECON_TICKS) {
    econ = MAX_CATCHUP_ECON_TICKS;
    clamped = true;
  }
  for (let i = 0; i < econ; i++) {
    runColonyEconomy(world);
  }
  if (clamped) {
    console.warn(
      `[catch-up] off-view elapsed exceeded ${MAX_CATCHUP_ECON_TICKS} economy-ticks; clamped.`,
    );
  }
  return { ranEconTicks: econ, clamped };
}
