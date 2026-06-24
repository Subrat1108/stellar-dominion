// Instantiate a generated system into the world (Step 1B).
//
// Shared by world-setup (initial home system) and the warp swap
// (setActiveSystem): takes a deterministic GeneratedSystem and creates its star,
// planets, gas giants and moons as ECS entities with Orbit components. Bodies are
// structuredClone'd so the sim can mutate body fields (terraforming) without
// leaking into the shared catalog/real-planet constants (Session 14).
//
// Scene placement: star-orbiting bodies use sceneDistance(au) with the
// orbit-placement floors (orbitSceneRadius) so ultra-tight real systems stay
// legible; moons are placed in scene units just outside their planet's render
// radius. Orbital speed (meanMotion) is Kepler-scaled off Mira's reference so
// relative motion matches the home system — unchanged for Tau Ceti.

import { createEntity, type World } from "./ecs/world.ts";
import { sceneDistance, orbitSceneRadius } from "./presentation.ts";
import type { GeneratedSystem } from "./gen/types.ts";

// Mira's reference orbital parameters set the RELATIVE speeds of star-orbiting
// planets; the global orbital clock (ORBITAL_TIME_RATE) keeps them near-stationary
// during a flight.
const MIRA_N = 0.08; // rad / sim-sec — relative mean motion reference
const MIRA_AU = 0.65;
const MOON_N = MIRA_N * 5; // moons circle their planet faster than planets orbit

/** Mean motion (rad / sim-sec) for a star-orbiting body, by Kepler's third law. */
function keplerN(realAu: number): number {
  return MIRA_N * Math.pow(MIRA_AU / realAu, 1.5);
}

export interface InstantiatedSystem {
  starId: number;
  /** bodyKey → entity id, for resolving stashed deltas after a swap. */
  keyToId: Map<string, number>;
}

/** Create all entities for a generated system. Returns the star id + key index. */
export function instantiateSystem(world: World, system: GeneratedSystem): InstantiatedSystem {
  const { celestialBody, orbit } = world.components;
  const keyToId = new Map<string, number>();

  const starId = createEntity(world);
  const starBody = structuredClone(system.star.body);
  celestialBody.set(starId, starBody);
  keyToId.set(system.star.bodyKey, starId);
  const starRender = starBody.renderRadius;

  // Track the last placed star-orbit radius so the spacing floor can apply.
  let prevSceneRadius = 0;

  for (const gb of system.bodies) {
    const id = createEntity(world);
    celestialBody.set(id, structuredClone(gb.body));
    keyToId.set(gb.bodyKey, id);
    if (!gb.orbit) continue;

    if (gb.parentKey) {
      // Moon: orbit the parent planet, placed just outside its render radius.
      const parentId = keyToId.get(gb.parentKey) ?? starId;
      const parentBody = celestialBody.get(parentId)!;
      const moonIndex = Number(gb.bodyKey.split(".")[1] ?? 0);
      orbit.set(id, {
        parent: parentId,
        elements: {
          semiMajorAxis: parentBody.renderRadius * (1.8 + 0.9 * moonIndex),
          eccentricity: gb.orbit.eccentricity,
          meanMotion: MOON_N * (1 - 0.15 * moonIndex),
          meanAnomalyAtEpoch: gb.orbit.meanAnomalyAtEpoch,
          argumentOfPeriapsis: gb.orbit.argumentOfPeriapsis,
        },
      });
    } else {
      // Star-orbiting body: scene distance with placement floors + Kepler speed.
      const au = gb.orbit.semiMajorAxisAu;
      const sceneRadius = orbitSceneRadius(au, starRender, prevSceneRadius);
      prevSceneRadius = sceneRadius;
      orbit.set(id, {
        parent: starId,
        elements: {
          semiMajorAxis: sceneRadius,
          eccentricity: gb.orbit.eccentricity,
          meanMotion: keplerN(au),
          meanAnomalyAtEpoch: gb.orbit.meanAnomalyAtEpoch,
          argumentOfPeriapsis: gb.orbit.argumentOfPeriapsis,
        },
      });
    }
  }

  return { starId, keyToId };
}

export { sceneDistance };
