// Warp state machine — the timed phases (docs/12, docs/09 Session 18).
//
// Runs once per tick. Player commands (commands/warp.ts) set the phase to scan /
// spool / cancel; this system counts down the committed phases and fires the
// arrival. Tick-counted, so warp is fully deterministic: a given commit tick
// always arrives at the same tick and (via the seed) generates the same system.
//
//   scan   → (CommitWarp) → spool → [SPOOL_TICKS] → transit → [TRANSIT_TICKS] → ARRIVE
//
// ARRIVE swaps the active system (galaxy.setActiveSystem, which regenerates the
// destination via the 1A engine), then hands back an ArrivedAtSystem event so
// the app can rebuild the renderer. Off-view catch-up is applied by the caller
// of setActiveSystem in commit 4; here arrival restores the destination's
// stashed state as it was left.

import type { World } from "../ecs/world.ts";
import type { GameEvent } from "../commands/types.ts";
import { setActiveSystem } from "../galaxy.ts";
import { distanceLyById, hygIdFromSystemId } from "../data/sector.ts";

// Phase durations in ticks (60 ticks ≈ 1 s). Short enough to stay snappy, long
// enough to read as a deliberate, committed sequence.
export const SPOOL_TICKS = 180; // ~3 s committed countdown

// Transit is DISTANCE-PROPORTIONAL (Polish C): a base crossing + a per-light-year
// term, clamped, so a 1.6 ly hop and a 9 ly hop no longer feel identical. Pure
// function of the committed distance, so warp stays deterministic. Display + real
// duration only — no fuel/cost (deferred with the economy layer). `TRANSIT_TICKS`
// is kept as the BASE (the minimum crossing) for callers that want a constant.
export const TRANSIT_TICKS = 120;          // ~2 s minimum locked crossing
export const TRANSIT_TICKS_PER_LY = 48;    // ~0.8 s added per light-year
export const TRANSIT_TICKS_MAX = 900;      // ~15 s cap on the longest hops

/** Locked-transit duration (ticks) for a jump of `ly` light-years. */
export function transitTicksForLy(ly: number): number {
  const raw = TRANSIT_TICKS + TRANSIT_TICKS_PER_LY * Math.max(0, ly);
  return Math.round(Math.max(TRANSIT_TICKS, Math.min(TRANSIT_TICKS_MAX, raw)));
}

/** Advance the warp FSM by one tick. Returns any events produced this tick. */
export function warpSystem(world: World): GameEvent[] {
  const w = world.warp;
  if (w.phase !== "spool" && w.phase !== "transit") return [];

  const tick = world.tick;
  const events: GameEvent[] = [];
  w.ticksRemaining -= 1;
  if (w.ticksRemaining > 0) return events;

  if (w.phase === "spool") {
    // Spool complete → enter the locked transit crossing. Its duration scales with
    // the departure→destination distance (world.activeSystemId is still the
    // departure system until ARRIVE swaps it below).
    w.phase = "transit";
    const fromHyg = hygIdFromSystemId(world.activeSystemId);
    const toHyg = hygIdFromSystemId(w.destinationSystemId ?? "");
    const ly = fromHyg !== undefined && toHyg !== undefined ? distanceLyById(fromHyg, toHyg) : 0;
    w.ticksRemaining = transitTicksForLy(ly);
    events.push({ kind: "WarpPhaseChanged", phase: "transit", systemId: w.destinationSystemId, tick });
    return events;
  }

  // Transit complete → ARRIVE: materialise the destination + drop into it.
  const destination = w.destinationSystemId!;
  setActiveSystem(world, destination);
  world.warp = { phase: "idle", destinationSystemId: null, ticksRemaining: 0 };
  events.push({ kind: "ArrivedAtSystem", systemId: destination, tick });
  return events;
}
