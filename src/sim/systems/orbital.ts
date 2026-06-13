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
    // Kepler position relative to the focus (the parent body).
    const local = positionAt(orb.elements, orbitalTime);

    // Compose with the parent's world position so the orbit is moon-ready: a
    // body whose parent is a planet (rather than the root star) orbits that
    // planet wherever it currently is. The star carries no Transform, so its
    // children fall back to the origin — identical to the old behaviour. This
    // stays deterministic as long as a parent is iterated before its children,
    // which insertion-ordered Maps guarantee (parents are created first). No
    // moons exist yet; this is the data path that will support them (docs/08).
    const parent = transform.get(orb.parent);
    const pos = parent
      ? { x: parent.position.x + local.x, y: parent.position.y + local.y, z: parent.position.z + local.z }
      : local;

    const t = transform.get(entity);
    if (t) {
      t.position = pos;
    } else {
      transform.set(entity, { position: pos });
    }
  }
}
