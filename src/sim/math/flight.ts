// Pure flight-profile math (Exploration Polish B).
//
// Deterministic helpers for the autopilot's speed profile — no world/DOM here,
// so they unit-test in isolation. The autopilot uses trapezoidalSpeed to pick a
// target speed by remaining distance: cruise-capped far out, then a √(2·a·d)
// deceleration bound so it arrives slow instead of ramming (the accelerate-out
// phase is the ship's own accel limit tracking this target).

/**
 * Target speed at `distance` from the destination, arriving (near-)stopped at
 * `arriveDist`. Capped at `vCruise`; within the braking zone it follows the
 * kinematic bound √(2·aMax·remaining) so the ship can decelerate to the arrival
 * point without overshooting. Returns 0 at/inside the arrival radius.
 */
export function trapezoidalSpeed(
  distance: number,
  arriveDist: number,
  vCruise: number,
  aMax: number,
): number {
  const remaining = distance - arriveDist;
  if (remaining <= 0) return 0;
  const vDecel = Math.sqrt(2 * Math.max(0, aMax) * remaining);
  return Math.min(vCruise, vDecel);
}

/** Move `current` toward `target` by at most `maxDelta` (accel/decel limiter). */
export function moveToward(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (d > maxDelta) return current + maxDelta;
  if (d < -maxDelta) return current - maxDelta;
  return target;
}
