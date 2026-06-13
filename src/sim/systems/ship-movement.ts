// Ship movement system — deterministic, headless, no rendering code.
//
// Full 3D flight: yaw + pitch orient the nose; thrust drives the ship along
// the nose vector; vertical thrust moves straight up/down in world space.
// Velocity is a full Vec3, capped at maxSpeed (scaled by the throttle lever).
// Manual input (any non-zero axis) immediately disables autopilot.

import type { World } from "../ecs/world.ts";
import type { Input } from "../loop.ts";
import { FIXED_DT } from "../constants.ts";

const TURN_RATE     = Math.PI / 2;       // rad / sim-sec (quarter turn per second)
const BASE_ACCEL    = 4;                 // scene units / sim-sec² at throttle 1×
const DRAG          = 0.98;              // velocity multiplied each tick
const PITCH_LIMIT   = Math.PI / 2 - 0.05; // clamp just shy of straight up/down

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

  let { thrust, yaw, pitch, vertical } = input;
  const throttle = input.throttle > 0 ? input.throttle : 1;

  // Manual input overrides autopilot.
  if (
    Math.abs(thrust) > 0.01 || Math.abs(yaw) > 0.01 ||
    Math.abs(pitch) > 0.01 || Math.abs(vertical) > 0.01
  ) {
    ctrl.autopilotActive = false;
  }

  // Autopilot: steer the nose toward the target entity in 3D.
  if (ctrl.autopilotActive && ctrl.autopilotTargetId !== undefined) {
    const tgt = transform.get(ctrl.autopilotTargetId);
    if (tgt) {
      const dx = tgt.position.x - pos.position.x;
      const dy = tgt.position.y - pos.position.y;
      const dz = tgt.position.z - pos.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > 2) {
        const targetHeading = Math.atan2(dx, dz);
        const targetPitch   = Math.asin(Math.max(-1, Math.min(1, dy / dist)));

        let yawDiff = targetHeading - ctrl.heading;
        while (yawDiff >  Math.PI) yawDiff -= 2 * Math.PI;
        while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
        const pitchDiff = targetPitch - ctrl.pitch;

        yaw   = Math.sign(yawDiff)   * Math.min(1, Math.abs(yawDiff)   / 0.2);
        pitch = Math.sign(pitchDiff) * Math.min(1, Math.abs(pitchDiff) / 0.2);

        const speed = Math.hypot(vel.vx, vel.vy, vel.vz);
        const accel = BASE_ACCEL * throttle;
        const brakingDist = (speed * speed) / (2 * accel) * 1.5;
        thrust = Math.abs(yawDiff) < Math.PI / 4
          ? (dist < brakingDist ? -1 : 1)
          : 0;
        vertical = 0;
      } else {
        ctrl.autopilotActive = false;
        thrust = 0; yaw = 0; pitch = 0; vertical = 0;
      }
    }
  }

  // Rotate nose.
  ctrl.heading += yaw * TURN_RATE * FIXED_DT;
  ctrl.pitch    = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, ctrl.pitch + pitch * TURN_RATE * FIXED_DT));

  // Apply thrust along the nose, plus world-space vertical thrust, then drag.
  const accel = BASE_ACCEL * throttle;
  const nose  = noseVector(ctrl.heading, ctrl.pitch);

  vel.vx = (vel.vx + thrust * accel * nose.x * FIXED_DT) * DRAG;
  vel.vy = (vel.vy + (thrust * accel * nose.y + vertical * accel) * FIXED_DT) * DRAG;
  vel.vz = (vel.vz + thrust * accel * nose.z * FIXED_DT) * DRAG;

  // Clamp to maxSpeed (scaled by throttle).
  const maxSpeed = vel.maxSpeed * throttle;
  const speed = Math.hypot(vel.vx, vel.vy, vel.vz);
  if (speed > maxSpeed) {
    const s = maxSpeed / speed;
    vel.vx *= s; vel.vy *= s; vel.vz *= s;
  }

  // Integrate position.
  pos.position.x += vel.vx * FIXED_DT;
  pos.position.y += vel.vy * FIXED_DT;
  pos.position.z += vel.vz * FIXED_DT;
}
