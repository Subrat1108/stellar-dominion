// Ship movement system — deterministic, headless, no rendering code.
//
// 3D flight: yaw + pitch orient the nose; thrust drives the ship along the
// nose vector (climb/dive by pitching, then thrusting). Velocity is a full Vec3.
//
// Three deterministic regimes (Polish B control model + gravity):
//  - AUTOPILOT: scripted point-to-point flight on a trapezoidal speed profile
//    (accelerate → cruise → decelerate), no gravity; player input is IGNORED.
//  - HELD ORBIT: the analytic low-orbit hold (a true circular orbit; velocity
//    matched to the body), pure function of tick; manual input drops it.
//  - MANUAL: thrust along the nose + patched-conic gravity inside a body's SOI
//    (semi-implicit Euler on the fixed tick), drag only in open space.

import type { World } from "../ecs/world.ts";
import type { Input } from "../loop.ts";
import { FIXED_DT } from "../constants.ts";
import { orbitInsertionRadius, ORBIT_RATE, softStopRadius } from "../presentation.ts";
import { gravParameter, soiRadius, gravityAccel, type GravBody } from "../math/gravity.ts";
import { trapezoidalSpeed, moveToward } from "../math/flight.ts";
import { bodyWorldPosition, ORBITAL_TIME_RATE } from "./orbital.ts";

const TURN_RATE     = Math.PI / 2;       // rad / sim-sec (quarter turn per second)
// Acceleration is a fixed multiple of the current max speed, so the ramp-up feel
// stays gear-independent (the legacy ratio was BASE_ACCEL/maxSpeed = 0.03/0.01 = 3).
const ACCEL_RATIO   = 3;
const DRAG          = 0.98;              // velocity multiplied each tick (open space only)
const PITCH_LIMIT   = Math.PI / 2 - 0.05; // clamp just shy of straight up/down

// Autopilot auto-throttle (independent of the player's gear): a cruise speed and
// accel that cross the ~700 u system in a handful of seconds and decelerate to a
// gentle arrival. Tuned feel constants (scene u/s, scene u/s²).
const AUTOPILOT_CRUISE = 40;
const AUTOPILOT_ACCEL  = 30;

/** Unit nose vector for a given yaw (heading) and pitch. */
export function noseVector(heading: number, pitch: number): { x: number; y: number; z: number } {
  const cp = Math.cos(pitch);
  return {
    x: Math.sin(heading) * cp,
    y: Math.sin(pitch),
    z: Math.cos(heading) * cp,
  };
}

export function shipMovementSystem(world: World, input: Input): void {
  const { transform, shipVelocity, shipControl } = world.components;

  const vel  = shipVelocity.get(world.shipId);
  const ctrl = shipControl.get(world.shipId);
  const pos  = transform.get(world.shipId);

  if (!vel || !ctrl || !pos) return;

  // Landed: the ship sits on a body's surface — flight is disabled until TakeOff
  // (a command) clears landedBodyId. Zero residual velocity so it stays put.
  if (ctrl.landedBodyId !== undefined) {
    vel.vx = 0; vel.vy = 0; vel.vz = 0;
    return;
  }

  let { thrust, yaw, pitch } = input;
  // input.throttle carries the selected gear's MAX SPEED in scene-u/sim-sec
  // (presentation.maxSpeedForGear). Acceleration tracks it so the ramp feel is
  // gear-independent. Falls back to the component's base speed if unset.
  const maxSpeed = input.throttle > 0 ? input.throttle : vel.maxSpeed;
  const accel = maxSpeed * ACCEL_RATIO;

  const hasManualInput =
    Math.abs(thrust) > 0.01 || Math.abs(yaw) > 0.01 || Math.abs(pitch) > 0.01;

  // Mode gating (Polish B control model):
  //  - AUTOPILOT: thrust is LOCKED — player input is ignored, not a cancel. The
  //    ship flies itself until a CancelCourse command (the ✕ AUTOPILOT button).
  //  - HELD ORBIT: analytic hold, UNLESS the player gives manual input, which
  //    drops the hold and hands control back (continuing from the orbit state).
  if (ctrl.autopilotActive) {
    thrust = 0; yaw = 0; pitch = 0;
  } else if (ctrl.orbitingBodyId !== undefined) {
    if (hasManualInput) {
      delete ctrl.orbitingBodyId; // take manual control out of the held orbit
    } else {
      // Orbit hold: hold a slow deterministic low orbit around the body and MATCH
      // its velocity, so the body stops drifting relative to the ship and fills
      // the view as a curved wall (no ram/bounce). Bodies drift faster than the
      // DOCK throttle, so this velocity-match is what makes the state feel right.
      const body = world.components.celestialBody.get(ctrl.orbitingBodyId);
      const bodyPos = transform.get(ctrl.orbitingBodyId)?.position;
      if (body && bodyPos) {
        const rIns = orbitInsertionRadius(body.renderRadius);
        const angle = (ctrl.orbitAngle ?? 0) + ORBIT_RATE * FIXED_DT;
        ctrl.orbitAngle = angle;
        // Hold the insertion altitude in the body's local XZ plane.
        pos.position.x = bodyPos.x + Math.cos(angle) * rIns;
        pos.position.y = bodyPos.y;
        pos.position.z = bodyPos.z + Math.sin(angle) * rIns;
        // Velocity = body's heliocentric velocity (finite-difference of its
        // analytic position, moon-safe) + the tangential orbit velocity.
        const T  = world.time * ORBITAL_TIME_RATE;
        const dT = FIXED_DT * ORBITAL_TIME_RATE;
        const p1 = bodyWorldPosition(world, ctrl.orbitingBodyId, T);
        const p0 = bodyWorldPosition(world, ctrl.orbitingBodyId, T - dT);
        vel.vx = (p1.x - p0.x) / FIXED_DT - Math.sin(angle) * rIns * ORBIT_RATE;
        vel.vy = (p1.y - p0.y) / FIXED_DT;
        vel.vz = (p1.z - p0.z) / FIXED_DT + Math.cos(angle) * rIns * ORBIT_RATE;
        // Face along the orbit tangent (nose = (sin h, 0, cos h) → h = -angle).
        ctrl.heading = -angle;
        ctrl.pitch = 0;
        return;
      }
      delete ctrl.orbitingBodyId; // body gone (e.g. warp swap) — drop orbit
    }
  }

  // Autopilot: steer the nose toward the target and fly a TRAPEZOIDAL speed
  // profile (accelerate out → cruise → decelerate), inserting into a low orbit
  // on arrival. Scripted (velocity set directly, no gravity/drag) so it is a
  // deterministic point-to-point regime; `scripted` skips the manual physics tail.
  let scripted = false;
  let apSpeed = 0;
  if (ctrl.autopilotActive && ctrl.autopilotTargetId !== undefined) {
    const tgt = transform.get(ctrl.autopilotTargetId);
    if (tgt) {
      const dx = tgt.position.x - pos.position.x;
      const dy = tgt.position.y - pos.position.y;
      const dz = tgt.position.z - pos.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const targetBody = world.components.celestialBody.get(ctrl.autopilotTargetId);
      const bodyR = targetBody?.renderRadius ?? 0.01;
      const arriveDist = orbitInsertionRadius(bodyR);

      if (dist > arriveDist) {
        const targetHeading = Math.atan2(dx, dz);
        const targetPitch   = Math.asin(Math.max(-1, Math.min(1, dy / dist)));

        let yawDiff = targetHeading - ctrl.heading;
        while (yawDiff >  Math.PI) yawDiff -= 2 * Math.PI;
        while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
        const pitchDiff = targetPitch - ctrl.pitch;

        // yaw is negated below when applied to heading (yaw>0 = steer right),
        // so to drive heading toward targetHeading we negate the sign here too.
        yaw   = -Math.sign(yawDiff)  * Math.min(1, Math.abs(yawDiff)   / 0.2);
        pitch = Math.sign(pitchDiff) * Math.min(1, Math.abs(pitchDiff) / 0.2);

        // Trapezoidal target speed by remaining distance; go slow until roughly
        // pointed at the target so it turns before accelerating. Ramp actual
        // speed toward the target within the accel limit (smooth accelerate-out).
        // Turn in place (speed 0) until roughly pointed at the target, so the
        // ship doesn't drift the wrong way while it swings onto its heading.
        const facing = Math.abs(yawDiff) < Math.PI / 4;
        const vTarget = facing
          ? trapezoidalSpeed(dist, arriveDist, AUTOPILOT_CRUISE, AUTOPILOT_ACCEL)
          : 0;
        const curSpeed = Math.hypot(vel.vx, vel.vy, vel.vz);
        apSpeed = moveToward(curSpeed, vTarget, AUTOPILOT_ACCEL * FIXED_DT);
        scripted = true;
      } else {
        // Arrived → insert into orbit. Seed the phase from the current offset so
        // X/Z don't jump; orbit-hold (above) takes over next tick.
        ctrl.orbitingBodyId = ctrl.autopilotTargetId;
        ctrl.orbitAngle = Math.atan2(
          pos.position.z - tgt.position.z,
          pos.position.x - tgt.position.x,
        );
        ctrl.autopilotActive = false;
        delete ctrl.autopilotTargetId;
        vel.vx = 0; vel.vy = 0; vel.vz = 0; // no drift-in before orbit-hold
        return;
      }
    }
  }

  // Rotate nose. yaw > 0 = steer right (pilot's right). In the flight camera
  // (behind the ship, looking down +nose) screen-right maps to world -X, which
  // corresponds to a DECREASING heading — hence the minus sign. See the
  // turn-direction test in tests/ship-movement.test.ts.
  ctrl.heading -= yaw * TURN_RATE * FIXED_DT;
  ctrl.pitch    = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, ctrl.pitch + pitch * TURN_RATE * FIXED_DT));

  const nose = noseVector(ctrl.heading, ctrl.pitch);

  if (scripted) {
    // Autopilot: fly along the nose at the profile speed (auto-throttled — not
    // capped to the player's gear). No gravity/drag; deterministic point-to-point.
    vel.vx = apSpeed * nose.x;
    vel.vy = apSpeed * nose.y;
    vel.vz = apSpeed * nose.z;
  } else {
    // Manual physics: thrust along the nose, then patched-conic gravity from any
    // body whose SOI contains the ship (semi-implicit: update velocity, then
    // integrate below). Drag applies ONLY in open space (outside all SOIs) as the
    // arcade auto-stop; inside an SOI it is omitted so an orbit persists and the
    // gravity well is felt when you cut thrust.
    vel.vx += thrust * accel * nose.x * FIXED_DT;
    vel.vy += thrust * accel * nose.y * FIXED_DT;
    vel.vz += thrust * accel * nose.z * FIXED_DT;

    const gravBodies: GravBody[] = [];
    for (const [entity, body] of world.components.celestialBody) {
      const bp = transform.get(entity)?.position ?? { x: 0, y: 0, z: 0 };
      gravBodies.push({
        x: bp.x, y: bp.y, z: bp.z,
        mu: gravParameter(body.renderRadius),
        soi: soiRadius(body.renderRadius),
      });
    }
    const g = gravityAccel(pos.position.x, pos.position.y, pos.position.z, gravBodies);
    vel.vx += g.ax * FIXED_DT;
    vel.vy += g.ay * FIXED_DT;
    vel.vz += g.az * FIXED_DT;
    if (!g.inSOI) { vel.vx *= DRAG; vel.vy *= DRAG; vel.vz *= DRAG; }

    // Clamp to the gear's max speed (manual only — autopilot auto-throttles).
    const speed = Math.hypot(vel.vx, vel.vy, vel.vz);
    if (speed > maxSpeed) {
      const s = maxSpeed / speed;
      vel.vx *= s; vel.vy *= s; vel.vz *= s;
    }
  }

  // Integrate position.
  pos.position.x += vel.vx * FIXED_DT;
  pos.position.y += vel.vy * FIXED_DT;
  pos.position.z += vel.vz * FIXED_DT;

  // Soft surface stop: push the ship back if it penetrates a body's surface.
  // Bodies (incl. the star) carry a real renderRadius; the star sits at the world
  // origin with no Transform, so it defaults to (0,0,0) below.
  const bodies = world.components.celestialBody;
  for (const [entity, body] of bodies) {
    const bpos = transform.get(entity)?.position ?? { x: 0, y: 0, z: 0 };
    const minR = softStopRadius(body.renderRadius);
    const ex = pos.position.x - bpos.x;
    const ey = pos.position.y - bpos.y;
    const ez = pos.position.z - bpos.z;
    const dist2 = ex * ex + ey * ey + ez * ez;
    if (dist2 < minR * minR && dist2 > 0) {
      const d = Math.sqrt(dist2);
      const nx = ex / d, ny = ey / d, nz = ez / d;
      // Clamp position to the surface shell.
      pos.position.x = bpos.x + nx * minR;
      pos.position.y = bpos.y + ny * minR;
      pos.position.z = bpos.z + nz * minR;
      // Zero out any velocity component directed toward the body.
      const vDotN = vel.vx * nx + vel.vy * ny + vel.vz * nz;
      if (vDotN < 0) {
        vel.vx -= vDotN * nx;
        vel.vy -= vDotN * ny;
        vel.vz -= vDotN * nz;
      }
    }
  }
}
