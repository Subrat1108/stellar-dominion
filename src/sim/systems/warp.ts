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

// Phase durations in ticks (60 ticks ≈ 1 s). Short enough to stay snappy, long
// enough to read as a deliberate, committed sequence.
export const SPOOL_TICKS = 180; // ~3 s committed countdown
export const TRANSIT_TICKS = 240; // ~4 s locked sector crossing

/** Advance the warp FSM by one tick. Returns any events produced this tick. */
export function warpSystem(world: World): GameEvent[] {
  const w = world.warp;
  if (w.phase !== "spool" && w.phase !== "transit") return [];

  const tick = world.tick;
  const events: GameEvent[] = [];
  w.ticksRemaining -= 1;
  if (w.ticksRemaining > 0) return events;

  if (w.phase === "spool") {
    // Spool complete → enter the locked transit crossing.
    w.phase = "transit";
    w.ticksRemaining = TRANSIT_TICKS;
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
