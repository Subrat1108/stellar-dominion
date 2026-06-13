// Orbital system: positions every orbiting body for the current sim time.
//
// Analytic (Kepler) — no integration, no n-body. Because position is a pure
// function of (elements, time), this system is stateless and order-independent,
// which makes it trivially deterministic. It writes into Transform components.

import type { World } from "../ecs/world.ts";
import { positionAt } from "../math/kepler.ts";

export function orbitalSystem(world: World): void {
  const { orbit, transform } = world.components;
  for (const [entity, orb] of orbit) {
    const pos = positionAt(orb.elements, world.time);
    const t = transform.get(entity);
    if (t) {
      t.position = pos;
    } else {
      transform.set(entity, { position: pos });
    }
  }
}
