// Warp command handlers (Step 1B, docs/12) — the player-driven phase changes:
// select+preview a destination (scan), commit the jump (spool), or abort.
//
// The TIMED phases (spool → transit → arrive) advance in warpSystem, not here;
// these handlers only validate + apply the discrete player intents. Warp is
// UNGATED this phase: no tech prerequisite, no resource cost (docs/09).

import type { World } from "../ecs/world.ts";
import type { CommandResult } from "./types.ts";
import { isReachableSystem } from "../data/sector.ts";
import { SPOOL_TICKS } from "../systems/warp.ts";

/** Begin (or re-target) a warp scan: select a destination + show its preview. */
export function beginWarpScan(world: World, systemId: string): CommandResult {
  const tick = world.tick;
  const ctrl = world.components.shipControl.get(world.shipId);
  if (ctrl?.landedBodyId !== undefined)
    return { ok: false, reason: "cannot warp while landed — take off first" };
  if (world.warp.phase === "spool" || world.warp.phase === "transit")
    return { ok: false, reason: "a warp is already in progress" };
  if (systemId === world.activeSystemId)
    return { ok: false, reason: "already in this system" };
  if (!isReachableSystem(systemId))
    return { ok: false, reason: "destination is not a reachable system" };

  world.warp = { phase: "scan", destinationSystemId: systemId, ticksRemaining: 0 };
  return { ok: true, events: [{ kind: "WarpScanStarted", systemId, tick }] };
}

/** Commit the scanned destination: begin the spool-up countdown. */
export function commitWarp(world: World): CommandResult {
  const tick = world.tick;
  if (world.warp.phase !== "scan" || !world.warp.destinationSystemId)
    return { ok: false, reason: "no scanned destination to warp to" };
  const systemId = world.warp.destinationSystemId;
  world.warp = { phase: "spool", destinationSystemId: systemId, ticksRemaining: SPOOL_TICKS };
  return { ok: true, events: [{ kind: "WarpCommitted", systemId, tick }] };
}

/** Abort a scan or spool (transit is a locked, committed trajectory). */
export function cancelWarp(world: World): CommandResult {
  const tick = world.tick;
  if (world.warp.phase === "transit")
    return { ok: false, reason: "warp transit cannot be aborted" };
  if (world.warp.phase === "idle")
    return { ok: false, reason: "no warp to cancel" };
  world.warp = { phase: "idle", destinationSystemId: null, ticksRemaining: 0 };
  return { ok: true, events: [{ kind: "WarpCancelled", tick }] };
}
