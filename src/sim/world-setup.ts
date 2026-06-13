// Phase 0 seed scenario: one star with two planets on Kepler orbits.
//
// Values are stylised scene units, not yet real catalog data (real star/planet
// data import lands in Phase 1, per docs/05). The orbital elements are picked to
// look like a plausible system: a near-circular inner world and a slightly
// eccentric outer one, on different periods so the scene has visible motion.

import { createWorld, createEntity, type World } from "./ecs/world.ts";

export function createPhase0System(seed: string | number = "stellar-dominion"): World {
  const world = createWorld({ seed });
  const { body, orbit } = world.components;

  // The star sits at the origin and does not move.
  const star = createEntity(world);
  body.set(star, { kind: "star", name: "Helios", radius: 3, color: 0xffd27f });

  // Inner planet — small, near-circular, fast.
  const inner = createEntity(world);
  body.set(inner, { kind: "planet", name: "Vesta", radius: 0.6, color: 0x6fa8dc });
  orbit.set(inner, {
    parent: star,
    elements: {
      semiMajorAxis: 8,
      eccentricity: 0.02,
      meanMotion: 0.18,
      meanAnomalyAtEpoch: 0,
      argumentOfPeriapsis: 0,
    },
  });

  // Outer planet — larger, mildly eccentric, slower, ellipse rotated.
  const outer = createEntity(world);
  body.set(outer, { kind: "planet", name: "Tethys", radius: 1.0, color: 0xc27ba0 });
  orbit.set(outer, {
    parent: star,
    elements: {
      semiMajorAxis: 14,
      eccentricity: 0.18,
      meanMotion: 0.09,
      meanAnomalyAtEpoch: Math.PI / 2,
      argumentOfPeriapsis: Math.PI / 6,
    },
  });

  return world;
}
