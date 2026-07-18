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
import { landingRange, enterOrbitRange } from "../presentation.ts";
import type { Command, CommandResult } from "./types.ts";
import type { OwnerId } from "../owner.ts";
import { foundColony, buildStructure, setTerraformAllocation } from "./colony.ts";
import { beginWarpScan, commitWarp, cancelWarp } from "./warp.ts";

/** Distance (scene units) from the ship to a body's centre, ∞ if unavailable. */
function distanceToBody(world: World, bodyId: number): number {
  const ship = world.components.transform.get(world.shipId)?.position;
  const body = world.components.transform.get(bodyId)?.position;
  if (!ship || !body) return Infinity;
  return Math.hypot(ship.x - body.x, ship.y - body.y, ship.z - body.z);
}

/**
 * Validate and apply a command on behalf of `actorId` (the multi-agent envelope,
 * docs/15 §6; defaults to the local player so existing single-player callers are
 * unchanged). Owner-scoped commands stamp/enforce ownership via `actorId`.
 * Mutates `world` only on success.
 */
export function applyCommand(
  world: World,
  cmd: Command,
  actorId: OwnerId = world.localOwnerId,
): CommandResult {
  const tick = world.tick;
  const ctrl = world.components.shipControl.get(world.shipId);
  if (!ctrl) return { ok: false, reason: "ship has no control component" };

  switch (cmd.kind) {
    case "SetCourse": {
      // Marks the target only — draws the direction indicator, no motion. Flying
      // there is a separate, explicit EngageAutopilot (Polish B control model).
      if (ctrl.landedBodyId !== undefined)
        return { ok: false, reason: "cannot set course while landed — take off first" };
      const body = world.components.celestialBody.get(cmd.bodyId);
      if (!body) return { ok: false, reason: "no such body" };
      if (body.kind === "star")
        return { ok: false, reason: "cannot set course into the star" };
      ctrl.autopilotTargetId = cmd.bodyId;
      ctrl.autopilotActive = false; // marks only; does NOT engage
      return { ok: true, events: [{ kind: "CourseSet", bodyId: cmd.bodyId, tick }] };
    }

    case "EngageAutopilot": {
      // Commit to fly the marked target (or the one passed in). Flight is handed
      // to the autopilot: it trapezoids in and inserts to orbit; manual thrust is
      // locked while engaged (ship-movement) until CancelCourse.
      if (ctrl.landedBodyId !== undefined)
        return { ok: false, reason: "cannot engage autopilot while landed — take off first" };
      const targetId = cmd.bodyId ?? ctrl.autopilotTargetId;
      if (targetId === undefined)
        return { ok: false, reason: "no course set — SET COURSE to a body first" };
      const body = world.components.celestialBody.get(targetId);
      if (!body) return { ok: false, reason: "no such body" };
      if (body.kind === "star")
        return { ok: false, reason: "cannot autopilot into the star" };
      ctrl.autopilotTargetId = targetId;
      ctrl.autopilotActive = true;
      ctrl.autopilotSpeed = 0; // ramp closing speed up from rest
      delete ctrl.orbitingBodyId; // leaving any held orbit to fly out
      return { ok: true, events: [{ kind: "AutopilotEngaged", bodyId: targetId, tick }] };
    }

    case "EnterOrbit": {
      // Manual insertion into a low orbit when already near a body (the same
      // analytic orbit-hold the autopilot uses on arrival).
      if (ctrl.landedBodyId !== undefined)
        return { ok: false, reason: "cannot enter orbit while landed — take off first" };
      const body = world.components.celestialBody.get(cmd.bodyId);
      if (!body) return { ok: false, reason: "no such body" };
      if (body.kind === "star")
        return { ok: false, reason: "cannot orbit into the star" };
      const dist = distanceToBody(world, cmd.bodyId);
      if (dist > enterOrbitRange(body.renderRadius))
        return { ok: false, reason: "too far to enter orbit — fly closer first" };
      // Seed the orbit phase from the current offset so X/Z don't jump; the
      // orbit-hold in ship-movement snaps to the insertion radius next tick.
      const ship = world.components.transform.get(world.shipId)?.position;
      const bp = world.components.transform.get(cmd.bodyId)?.position;
      ctrl.orbitingBodyId = cmd.bodyId;
      ctrl.orbitAngle = ship && bp ? Math.atan2(ship.z - bp.z, ship.x - bp.x) : 0;
      ctrl.autopilotActive = false;
      delete ctrl.autopilotTargetId;
      return { ok: true, events: [{ kind: "OrbitEntered", bodyId: cmd.bodyId, tick }] };
    }

    case "CancelCourse": {
      // Disengage autopilot (and any held orbit) → hand back to manual. The
      // target stays MARKED so the direction indicator persists.
      ctrl.autopilotActive = false;
      delete ctrl.autopilotSpeed;
      delete ctrl.orbitingBodyId;
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
      if (dist > landingRange(body.renderRadius))
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

    case "FoundColony":
      return foundColony(world, cmd.bodyId, actorId);

    case "BuildStructure":
      return buildStructure(world, cmd.bodyId, cmd.building, actorId);

    case "SetTerraformAllocation":
      return setTerraformAllocation(world, cmd.bodyId, cmd.lever, cmd.fraction, actorId);

    case "BeginWarpScan":
      return beginWarpScan(world, cmd.systemId);

    case "CommitWarp":
      return commitWarp(world);

    case "CancelWarp":
      return cancelWarp(world);
  }
}
