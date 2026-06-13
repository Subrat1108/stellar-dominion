// Orbital system: positions every orbiting body for the current sim time.
//
// Analytic (Kepler) — no integration, no n-body. Because position is a pure
// function of (elements, time), this system is stateless and order-independent,
// which makes it trivially deterministic. It writes into Transform components.
//
// Orbital time is decoupled from flight time: planets advance on a much slower
// clock than the real-time piloting view (positionAt uses world.time scaled by
// ORBITAL_TIME_RATE). Otherwise planets whip around their orbits while you fly
// and you can never close on one. At this rate the innermost planet (~0.2 AU)
// has an effective period of roughly an hour, so it's nearly stationary during
// a flight yet visibly drifts over several real minutes. Still a pure function
// of tick → fully deterministic. A player-facing time-compression lever is
// deferred to Phase 4 (docs/08).

import type { World } from "../ecs/world.ts";
import { positionAt } from "../math/kepler.ts";

// Halved from 0.003 when the system was spread out to real-AU proportions
// (AU_TO_SCENE 12 → 200): the larger orbital radii turn the same angular rate
// into more linear drift, so we slow the clock to keep planets near-stationary
// during a flight. Over a ~60 s cruise even the innermost planet moves only a
// few degrees.
export const ORBITAL_TIME_RATE = 0.0015;

export function orbitalSystem(world: World): void {
  const { orbit, transform } = world.components;
  const orbitalTime = world.time * ORBITAL_TIME_RATE;
  for (const [entity, orb] of orbit) {
    const pos = positionAt(orb.elements, orbitalTime);
    const t = transform.get(entity);
    if (t) {
      t.position = pos;
    } else {
      transform.set(entity, { position: pos });
    }
  }
}
