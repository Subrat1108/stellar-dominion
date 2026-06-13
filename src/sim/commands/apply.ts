// Command reducer — validate, then deterministically apply one command.
//
// Pure with respect to the world: no Math.random, no Date, no renderer/DOM.
// Given the same world state and command, it always produces the same result
// and mutation — this is what keeps saves and tests reliable (docs/03).
//
// Called from the tick (loop.ts) at a fixed point: tick++ → drain commands →
// systems. Returning a CommandResult lets the loop collect GameEvents to emit
// on the GameBus after the tick.

import type { World } from "../ecs/world.ts";
import { parkDistance } from "../presentation.ts";
import type { Command, CommandResult } from "./types.ts";

/** Distance (scene units) from the ship to a body's centre, ∞ if unavailable. */
function distanceToBody(world: World, bodyId: number): number {
  const ship = world.components.transform.get(world.shipId)?.position;
  const body = world.components.transform.get(bodyId)?.position;
  if (!ship || !body) return Infinity;
  return Math.hypot(ship.x - body.x, ship.y - body.y, ship.z - body.z);
}

// A body counts as "reachable for landing" a little past the autopilot park
// point, since drag/orbital drift can leave the ship slightly outside it.
const LANDING_RANGE_FACTOR = 1.25;

/** Validate and apply a command. Mutates `world` only on success. */
export function applyCommand(world: World, cmd: Command): CommandResult {
  const tick = world.tick;
  const ctrl = world.components.shipControl.get(world.shipId);
  if (!ctrl) return { ok: false, reason: "ship has no control component" };

  switch (cmd.kind) {
    case "SetCourse": {
      if (ctrl.landedBodyId !== undefined)
        return { ok: false, reason: "cannot set course while landed — take off first" };
      const body = world.components.celestialBody.get(cmd.bodyId);
      if (!body) return { ok: false, reason: "no such body" };
      if (body.kind === "star")
        return { ok: false, reason: "cannot set course into the star" };
      ctrl.autopilotTargetId = cmd.bodyId;
      ctrl.autopilotActive = true;
      return { ok: true, events: [{ kind: "CourseSet", bodyId: cmd.bodyId, tick }] };
    }

    case "CancelCourse": {
      ctrl.autopilotActive = false;
      return { ok: true, events: [{ kind: "CourseCancelled", tick }] };
    }

    case "LandAtBody": {
      if (ctrl.landedBodyId !== undefined)
        return { ok: false, reason: "already landed" };
      const body = world.components.celestialBody.get(cmd.bodyId);
      if (!body) return { ok: false, reason: "no such body" };
      if (body.kind !== "planet")
        return { ok: false, reason: "only rocky planets have a landable surface" };
      const dist = distanceToBody(world, cmd.bodyId);
      const reach = parkDistance(body.renderRadius) * LANDING_RANGE_FACTOR;
      if (dist > reach)
        return { ok: false, reason: "too far from the body — fly closer first" };
      // Touch down: freeze flight, drop autopilot.
      ctrl.landedBodyId = cmd.bodyId;
      ctrl.autopilotActive = false;
      delete ctrl.autopilotTargetId;
      const vel = world.components.shipVelocity.get(world.shipId);
      if (vel) { vel.vx = 0; vel.vy = 0; vel.vz = 0; }
      return { ok: true, events: [{ kind: "Landed", bodyId: cmd.bodyId, tick }] };
    }

    case "TakeOff": {
      const bodyId = ctrl.landedBodyId;
      if (bodyId === undefined)
        return { ok: false, reason: "not landed" };
      delete ctrl.landedBodyId;
      return { ok: true, events: [{ kind: "TookOff", bodyId, tick }] };
    }

    case "FoundColony": {
      // Stub (Phase 2B builds the colony sim): validated + routed, no state yet.
      if (ctrl.landedBodyId !== cmd.bodyId)
        return { ok: false, reason: "must be landed on the body to found a colony" };
      return { ok: true, events: [{ kind: "ColonyFounded", bodyId: cmd.bodyId, tick }] };
    }
  }
}
