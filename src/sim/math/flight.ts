// Pure flight-profile math (Exploration Polish B).
//
// Deterministic helpers for the autopilot's speed profile — no world/DOM here,
// so they unit-test in isolation.
//
// The hard problem is HONEST SCALE: the system spans ~700 u but a low orbit sits
// at only a few ×R (~0.03 u), so a single trapezoid can't be both fast across the
// system and slow enough to watch a tiny body grow on final approach — at cruise,
// one tick's travel dwarfs the arrival bubble and the ship blows past it. So the
// approach is TWO-PHASE and BODY-SCALED:
//   • FAR  (dist > slow zone): cruise, decelerating (√ bound) to `vSlow` by the
//     slow-zone edge — a real deceleration the ship's accel limit can achieve.
//   • NEAR (inside the slow zone = arriveDist + slowZoneMult·R): a slow ramp from
//     `vSlow` (= slowRate·R) down to a small floor (minRate·R), so the body grows
//     at a body-independent, watchable rate before insertion (never overshooting).

export interface ApproachParams {
  /** Open-space cruise cap (scene u/s). */
  cruise: number;
  /** Deceleration used for the far-phase √ bound (scene u/s²). */
  accel: number;
  /** Slow-zone radius as a multiple of the body render radius. */
  slowZoneMult: number;
  /** Speed at the slow-zone edge, per unit body radius (1/s). */
  slowRate: number;
  /** Minimum approach speed floor, per unit body radius (1/s) — ensures arrival. */
  minRate: number;
}

/**
 * Autopilot target speed at `distance` from a body of render radius `bodyR`,
 * arriving at `arriveDist`. Two-phase + body-scaled (see the module header):
 * capped at cruise far out, decelerating to a slow body-scaled crawl for a
 * watchable final approach. Returns 0 at/inside the arrival radius.
 */
export function approachSpeed(
  distance: number,
  arriveDist: number,
  bodyR: number,
  p: ApproachParams,
): number {
  if (distance <= arriveDist) return 0;
  const slowZone = arriveDist + p.slowZoneMult * bodyR;
  const vSlow = p.slowRate * bodyR;
  if (distance <= slowZone) {
    // Slow phase: ramp ∝ remaining, floored so it actually reaches the body.
    const frac = (distance - arriveDist) / (slowZone - arriveDist);
    return Math.max(vSlow * frac, p.minRate * bodyR);
  }
  // Far phase: √ bound that decelerates to vSlow exactly at the slow-zone edge.
  const remToZone = distance - slowZone;
  const vDecel = Math.sqrt(vSlow * vSlow + 2 * Math.max(0, p.accel) * remToZone);
  return Math.min(p.cruise, vDecel);
}

/** Move `current` toward `target` by at most `maxDelta` (accel/decel limiter). */
export function moveToward(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (d > maxDelta) return current + maxDelta;
  if (d < -maxDelta) return current - maxDelta;
  return target;
}
