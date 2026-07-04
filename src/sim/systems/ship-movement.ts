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
import {
  orbitInsertionRadius,
  ORBIT_RATE,
  ORBIT_DIRECTION,
  ORBIT_FRAME_YAW_BIAS,
  softStopRadius,
  THRUST_ACCEL,
  MAX_SPEED,
} from "../presentation.ts";
import { gravParameter, soiRadius, gravityAccel, type GravBody } from "../math/gravity.ts";
import { approachSpeed, moveToward, type ApproachParams } from "../math/flight.ts";
import { bodyWorldPosition, ORBITAL_TIME_RATE } from "./orbital.ts";

const TURN_RATE     = Math.PI / 2;       // rad / sim-sec (quarter turn per second)
const DRAG          = 0.99;              // velocity multiplied each tick (open space only);
                                         // light, so W builds up speed and the ship coasts
const PITCH_LIMIT   = Math.PI / 2 - 0.05; // clamp just shy of straight up/down
// Per-tick ease factor for the orbit framing (heading/pitch) on insertion, so the
// view glides from "facing the body" to the left-biased orbit framing instead of
// snapping ~29°. Cosmetic only (orbit position is analytic). ~0.06 ≈ ¾ s glide.
const ORBIT_FRAME_EASE = 0.06;

// Autopilot auto-throttle (independent of the player's gear): fast open-space
// cruise, then a LONG, slow, body-scaled final approach so the planet grows
// gradually from a far dot and slides slowly into orbit (see approachSpeed).
// The slow zone starts ~100 R out (where the body is ~0.6°) and the approach
// takes ~20 s to close in, so the growth is cinematic, not a sudden pop.
const AUTOPILOT: ApproachParams = {
  cruise: 40,         // scene u/s open-space cruise
  accel: 30,          // scene u/s² far-phase deceleration
  slowZoneMult: 100,  // slow phase begins 100 R out (~1 u for a small planet)
  slowRate: 10,       // slow-zone-edge speed = 10·R per second
  minRate: 3,         // floor = 3·R per second, so it still arrives (~20 s total)
};

// Orbital insertion (spiral): within ORBIT_BLEND_MULT·arriveDist the scripted
// velocity blends from radial-approach toward the orbit TANGENT, so the ship
// SLIDES into the orbit and is already moving tangentially at arrival — a single
// continuous motion, no "fly to centre, stop, snap to orbit". The blend is capped
// below 1 so a little radial closing always remains (otherwise the ship
// station-keeps just outside arriveDist forever and never inserts); a small
// capture band then triggers the analytic hold.
const ORBIT_BLEND_MULT  = 5;    // blend zone = 5 × arrival radius
const ORBIT_BLEND_MAX   = 0.9;  // max tangential fraction during approach (<1)
const ORBIT_CAPTURE_BAND = 1.03; // insert when within 3% of the arrival radius

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

  let { thrust, strafe, yaw, pitch } = input;
  // Fixed thrust acceleration + speed cap (no gears): W/S/A/D accelerate, the
  // ship builds up speed toward MAX_SPEED and coasts under light drag.
  const maxSpeed = MAX_SPEED;
  const accel = THRUST_ACCEL;

  const hasManualInput =
    Math.abs(thrust) > 0.01 || Math.abs(strafe) > 0.01 ||
    Math.abs(yaw) > 0.01 || Math.abs(pitch) > 0.01;

  // Mode gating (Polish B control model):
  //  - AUTOPILOT: thrust is LOCKED — player input is ignored, not a cancel. The
  //    ship flies itself until a CancelCourse command (the ✕ AUTOPILOT button).
  //  - HELD ORBIT: analytic hold, UNLESS the player gives manual input, which
  //    drops the hold and hands control back (continuing from the orbit state).
  if (ctrl.autopilotActive) {
    thrust = 0; strafe = 0; yaw = 0; pitch = 0;
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
        const w = ORBIT_DIRECTION * ORBIT_RATE; // signed angular rate
        const angle = (ctrl.orbitAngle ?? 0) + w * FIXED_DT;
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
        // Tangential velocity = d/dt[cos(angle),sin(angle)]·rIns = [−sin,cos]·rIns·w.
        vel.vx = (p1.x - p0.x) / FIXED_DT - Math.sin(angle) * rIns * w;
        vel.vy = (p1.y - p0.y) / FIXED_DT;
        vel.vz = (p1.z - p0.z) / FIXED_DT + Math.cos(angle) * rIns * w;
        // Face TOWARD the body (so it fills the forward view) but bias the heading
        // left, so the body sits ahead-and-left, clear of the right-side panel.
        // The body is at (cos,0,sin)·rIns from the ship, i.e. direction
        // (−cosθ, 0, −sinθ). Screen-left = a larger relative heading, so we
        // SUBTRACT the bias (see the yaw convention below). EASE the heading (and
        // pitch) toward that target rather than snapping — on arrival the ship is
        // facing the body directly, and an instant ~29° swing to the framing bias
        // is a jarring transition. Easing is purely cosmetic here (position is set
        // analytically above), so it stays deterministic and holds the orbit.
        const targetHeading = Math.atan2(-Math.cos(angle), -Math.sin(angle)) - ORBIT_FRAME_YAW_BIAS;
        let dh = targetHeading - ctrl.heading;
        while (dh >  Math.PI) dh -= 2 * Math.PI;
        while (dh < -Math.PI) dh += 2 * Math.PI;
        ctrl.heading += dh * ORBIT_FRAME_EASE;
        ctrl.pitch += (0 - ctrl.pitch) * ORBIT_FRAME_EASE;
        return;
      }
      delete ctrl.orbitingBodyId; // body gone (e.g. warp swap) — drop orbit
    }
  }

  // Autopilot: fly to the target and SPIRAL into orbit. The scripted velocity
  // (set directly — no gravity/drag) blends from a body-velocity-matched radial
  // approach into the orbit tangent as the ship nears, so it slides into orbit
  // in one continuous motion and hands to the analytic hold moving tangentially.
  let scripted = false;
  let svx = 0, svy = 0, svz = 0; // scripted world velocity for this tick
  if (ctrl.autopilotActive && ctrl.autopilotTargetId !== undefined) {
    const tgt = transform.get(ctrl.autopilotTargetId);
    if (tgt) {
      const dx = tgt.position.x - pos.position.x;
      const dy = tgt.position.y - pos.position.y;
      const dz = tgt.position.z - pos.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;

      const targetBody = world.components.celestialBody.get(ctrl.autopilotTargetId);
      const bodyR = targetBody?.renderRadius ?? 0.01;
      const arriveDist = orbitInsertionRadius(bodyR);

      if (dist > arriveDist * ORBIT_CAPTURE_BAND) {
        // Steer the nose to FACE the body (keeps it in view, growing).
        const targetHeading = Math.atan2(dx, dz);
        const targetPitch   = Math.asin(Math.max(-1, Math.min(1, dy / dist)));
        let yawDiff = targetHeading - ctrl.heading;
        while (yawDiff >  Math.PI) yawDiff -= 2 * Math.PI;
        while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
        const pitchDiff = targetPitch - ctrl.pitch;
        // yaw is negated below when applied to heading (yaw>0 = steer right).
        yaw   = -Math.sign(yawDiff)  * Math.min(1, Math.abs(yawDiff)   / 0.2);
        pitch = Math.sign(pitchDiff) * Math.min(1, Math.abs(pitchDiff) / 0.2);
        const facing = Math.abs(yawDiff) < Math.PI / 4;

        // Radial closing speed: the two-phase body-scaled slow approach, ramped
        // within the accel limit, never stepping past arrival in one tick.
        let vApproach = facing ? approachSpeed(dist, arriveDist, bodyR, AUTOPILOT) : 0;
        vApproach = Math.min(vApproach, (dist - arriveDist) / FIXED_DT);
        const apSpeed = moveToward(ctrl.autopilotSpeed ?? 0, vApproach, AUTOPILOT.accel * FIXED_DT);
        ctrl.autopilotSpeed = apSpeed;

        // Spiral blend: 0 (pure radial) at the blend-zone edge → ORBIT_BLEND_MAX
        // (mostly tangential) near arrival, so the ship curves in and is moving
        // along the orbit at insertion. Tangent direction matches ORBIT_DIRECTION.
        const blendStart = arriveDist * ORBIT_BLEND_MULT;
        const tb = Math.min(ORBIT_BLEND_MAX,
          Math.max(0, (blendStart - dist) / (blendStart - arriveDist)));
        const inv = 1 / dist;
        const rinx = dx * inv, riny = dy * inv, rinz = dz * inv; // unit toward body
        const ang = Math.atan2(pos.position.z - tgt.position.z, pos.position.x - tgt.position.x);
        const tanx = -Math.sin(ang) * ORBIT_DIRECTION;
        const tanz =  Math.cos(ang) * ORBIT_DIRECTION;
        const orbitSpeed = arriveDist * ORBIT_RATE;

        // Match the body's heliocentric velocity so it holds still on approach.
        const T  = world.time * ORBITAL_TIME_RATE;
        const dT = FIXED_DT * ORBITAL_TIME_RATE;
        const p1 = bodyWorldPosition(world, ctrl.autopilotTargetId, T);
        const p0 = bodyWorldPosition(world, ctrl.autopilotTargetId, T - dT);
        const bvx = (p1.x - p0.x) / FIXED_DT;
        const bvy = (p1.y - p0.y) / FIXED_DT;
        const bvz = (p1.z - p0.z) / FIXED_DT;

        svx = bvx + rinx * apSpeed * (1 - tb) + tanx * orbitSpeed * tb;
        svy = bvy + riny * apSpeed * (1 - tb);
        svz = bvz + rinz * apSpeed * (1 - tb) + tanz * orbitSpeed * tb;
        scripted = true;
      } else {
        // Arrived → hand to the analytic orbit hold. Position is continuous (seed
        // the phase from the current offset) and the spiral already left the ship
        // moving tangentially, so the hold continues it seamlessly — no snap.
        ctrl.orbitingBodyId = ctrl.autopilotTargetId;
        ctrl.orbitAngle = Math.atan2(
          pos.position.z - tgt.position.z,
          pos.position.x - tgt.position.x,
        );
        ctrl.autopilotActive = false;
        delete ctrl.autopilotTargetId;
        delete ctrl.autopilotSpeed;
        return; // keep velocity continuous; orbit-hold sets it next tick
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
    // Autopilot spiral: velocity was computed above (body-velocity-matched radial
    // approach blended into the orbit tangent). Auto-throttled (not capped to the
    // player's gear); no gravity/drag; deterministic point-to-point.
    vel.vx = svx;
    vel.vy = svy;
    vel.vz = svz;
  } else {
    // Manual physics: thrust along the nose (W/S) + strafe along the ship's
    // horizontal RIGHT vector (A/D, no rotation), then patched-conic gravity from
    // any body whose SOI contains the ship (semi-implicit: update velocity, then
    // integrate below). Drag applies ONLY in open space (outside all SOIs) as the
    // arcade slow-down; inside an SOI it is omitted so an orbit persists and the
    // gravity well is felt when you cut thrust.
    vel.vx += thrust * accel * nose.x * FIXED_DT;
    vel.vy += thrust * accel * nose.y * FIXED_DT;
    vel.vz += thrust * accel * nose.z * FIXED_DT;
    // Horizontal right vector = normalize(-nose.z, 0, nose.x); +D = right, −A = left.
    const rl = Math.hypot(nose.z, nose.x) || 1;
    const rx = -nose.z / rl, rz = nose.x / rl;
    vel.vx += strafe * accel * rx * FIXED_DT;
    vel.vz += strafe * accel * rz * FIXED_DT;

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
