// Ship movement system — deterministic, headless, no rendering code.
//
// Applies thrust input to velocity, rotates heading by yaw input, then
// integrates velocity into position. Velocity is capped at maxSpeed.
// All math is in the XZ plane (y = 0) matching the orbital plane.
// Manual input (non-zero thrust or yaw) immediately disables autopilot.

import type { World } from "../ecs/world.ts";
import { FIXED_DT } from "../constants.ts";

const TURN_RATE    = Math.PI / 2; // rad / sim-sec (quarter turn per second)
const ACCELERATION = 4;           // scene units / sim-sec²
const DRAG         = 0.98;        // velocity multiplied each tick (~30% loss/sec)

export function shipMovementSystem(world: World, thrust: number, yaw: number): void {
  const { transform, shipVelocity, shipControl } = world.components;

  const vel  = shipVelocity.get(world.shipId);
  const ctrl = shipControl.get(world.shipId);
  const pos  = transform.get(world.shipId);

  if (!vel || !ctrl || !pos) return;

  // Manual input overrides autopilot.
  if (Math.abs(thrust) > 0.01 || Math.abs(yaw) > 0.01) {
    ctrl.autopilotActive = false;
  }

  // Autopilot: steer toward target entity when active.
  if (ctrl.autopilotActive && ctrl.autopilotTargetId !== undefined) {
    const tgt = transform.get(ctrl.autopilotTargetId);
    if (tgt) {
      const dx = tgt.position.x - pos.position.x;
      const dz = tgt.position.z - pos.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 2) {
        const targetHeading = Math.atan2(dx, dz);
        let angleDiff = targetHeading - ctrl.heading;
        while (angleDiff >  Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        yaw    = Math.sign(angleDiff) * Math.min(1, Math.abs(angleDiff) / 0.2);
        const currentSpeed = Math.sqrt(vel.vx * vel.vx + vel.vz * vel.vz);
        const brakingDist  = (currentSpeed * currentSpeed) / (2 * ACCELERATION) * 1.5;
        thrust = Math.abs(angleDiff) < Math.PI / 4
          ? (dist < brakingDist ? -1 : 1)
          : 0;
      } else {
        ctrl.autopilotActive = false;
        thrust = 0;
        yaw    = 0;
      }
    }
  }

  // Rotate heading.
  ctrl.heading += yaw * TURN_RATE * FIXED_DT;

  // Compute forward direction in XZ plane.
  const fwdX = Math.sin(ctrl.heading);
  const fwdZ = Math.cos(ctrl.heading);

  // Apply thrust and drag.
  vel.vx = (vel.vx + thrust * ACCELERATION * fwdX * FIXED_DT) * DRAG;
  vel.vz = (vel.vz + thrust * ACCELERATION * fwdZ * FIXED_DT) * DRAG;

  // Clamp to maxSpeed.
  const speed = Math.sqrt(vel.vx * vel.vx + vel.vz * vel.vz);
  if (speed > vel.maxSpeed) {
    const s = vel.maxSpeed / speed;
    vel.vx *= s;
    vel.vz *= s;
  }

  // Integrate position.
  pos.position.x += vel.vx * FIXED_DT;
  pos.position.z += vel.vz * FIXED_DT;
}
