// Phase 1 starting scenario: the Tau Ceti system + the stranded ship.
//
// Step 1A (Session 17): the home system is now produced THROUGH the content
// engine (src/sim/gen) rather than hand-assembled. The engine loads Tau Ceti's
// real star + real candidate planets verbatim from the real-systems table
// (tagged real/derived) and procedurally generates the fill — an outer gas giant
// and its moons (tagged fictional). This proves the pipeline on the home system
// while keeping the real planets' tuning identical. Everything downstream
// (colony, terraforming, population, saves) consumes the same CelestialBody
// shape as before; only HOW bodies are produced changed.
//
// Orbital speed scaling (unchanged): mean-motion values (rad / sim-second) are
// derived from Mira's reference period via Kepler's third law (n ∝ a^-3/2),
// giving pleasing relative motion; the global clock is slowed by
// ORBITAL_TIME_RATE so planets are nearly stationary during a flight. Scene-unit
// semi-major axes come from sceneDistance() in presentation.ts.

import { createWorld, createEntity, type World } from "./ecs/world.ts";
import { sceneDistance } from "./presentation.ts";
import { generateSystem } from "./gen/system.ts";
import { starById } from "./gen/catalog.ts";
import { realSystemFor, TAU_CETI_HYG_ID } from "./data/real-planets.ts";
import type { GeneratedBody } from "./gen/types.ts";

// Mira's reference orbital parameters. This sets the RELATIVE speeds of the
// star-orbiting planets; the global orbital clock is slowed by ORBITAL_TIME_RATE
// (orbital.ts) so planets are nearly stationary during a flight.
const MIRA_N = 0.08; // rad / sim-sec — relative mean motion reference
const MIRA_AU = 0.65;

// Scale mean motion by Kepler's third law: n(a) = MIRA_N * (MIRA_AU / a)^1.5
function keplerN(realAu: number): number {
  return MIRA_N * Math.pow(MIRA_AU / realAu, 1.5);
}

// Moons orbit their planet on a fixed modest rate (their physical AU is tiny and
// not visually meaningful at our scene scale; they're placed just outside the
// planet's render radius). Faster than planets so they visibly circle.
const MOON_N = MIRA_N * 5;

export function createStartingSystem(seed: string | number = "tau-ceti-alpha"): World {
  const world = createWorld({ seed });
  const { celestialBody, orbit } = world.components;

  // --- Generate the home system through the content engine ---
  const star = starById(TAU_CETI_HYG_ID);
  if (!star) throw new Error(`Tau Ceti (HYG ${TAU_CETI_HYG_ID}) missing from bundled catalog`);
  const system = generateSystem(seed, star, realSystemFor(TAU_CETI_HYG_ID));
  // The home system is the initially active + discovered system (Step 1B).
  world.activeSystemId = system.systemId;
  world.discovered = [system.systemId];

  // Insert bodies. They are structuredClone'd so the sim can mutate body fields
  // (terraforming shifts temp/pressure/hydrosphere + rewrites habitability)
  // without leaking into the shared catalog/real-planet constants (Session 14).
  // Parents are emitted before their moons, so a key→id map resolves moon parents.
  const keyToId = new Map<string, number>();

  const starId = createEntity(world);
  celestialBody.set(starId, structuredClone(system.star.body));
  keyToId.set(system.star.bodyKey, starId);

  for (const gb of system.bodies) {
    const id = createEntity(world);
    celestialBody.set(id, structuredClone(gb.body));
    keyToId.set(gb.bodyKey, id);
    if (!gb.orbit) continue;

    if (gb.parentKey) {
      // Moon: orbit the parent planet, placed in scene units just outside it.
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
      // Star-orbiting body: real-AU scene distance + Kepler-scaled mean motion.
      const au = gb.orbit.semiMajorAxisAu;
      orbit.set(id, {
        parent: starId,
        elements: {
          semiMajorAxis: sceneDistance(au),
          eccentricity: gb.orbit.eccentricity,
          meanMotion: keplerN(au),
          meanAnomalyAtEpoch: gb.orbit.meanAnomalyAtEpoch,
          argumentOfPeriapsis: gb.orbit.argumentOfPeriapsis,
        },
      });
    }
  }

  // --- Ship entity: ISS Prometheus (stranded) ---
  const shipId = createEntity(world);
  world.shipId = shipId;

  world.components.crew.set(shipId, {
    members: [
      {
        id: "c1",
        name: "Cdr. Sora Vasquez",
        role: "Commander",
        skills: { command: 8, piloting: 6, engineering: 3, science: 3, biology: 2, medicine: 2 },
        health: 0.92,
      },
      {
        id: "c2",
        name: "Mako Reyes",
        role: "Chief Engineer",
        skills: { engineering: 9, science: 4, command: 3, piloting: 3, biology: 1, medicine: 2 },
        health: 0.78,
      },
      {
        id: "c3",
        name: "Dr. Yara Chen",
        role: "Science Officer",
        skills: { science: 9, biology: 6, command: 3, engineering: 3, piloting: 1, medicine: 4 },
        health: 1.0,
      },
      {
        id: "c4",
        name: "Pita Fale",
        role: "Medic",
        skills: { medicine: 9, biology: 8, science: 5, command: 2, engineering: 2, piloting: 1 },
        health: 0.85,
      },
      {
        id: "c5",
        name: "Rin Nakamura",
        role: "Navigator / Pilot",
        skills: { piloting: 9, engineering: 5, command: 3, science: 3, biology: 1, medicine: 1 },
        health: 0.95,
      },
    ],
  });

  world.components.inventory.set(shipId, {
    metals: 500,
    fuel: 200,
    food: 300,
  });

  // Life support: 100 000 units; 1 unit/tick → ~28 min real time at 60 fps.
  // More ticks per second at higher speed = more depletion per second (intentional).
  world.components.lifeSupport.set(shipId, {
    current: 100_000,
    capacity: 100_000,
    depletionRatePerTick: 1,
  });

  // Ship starts stationary in the inner system, just outside Ferrum's orbit
  // (~44 u) so there's somewhere to fly to in every direction.
  world.components.transform.set(shipId, {
    position: { x: 0, y: 0, z: 60 },
  });

  // Base max speed is small because the system is large (gas giant ~1000+ u).
  // The throttle lever scales it: 1× = 0.01 u/s (fine docking near a planet),
  // 1000× = 10 u/s. See presentation.ts.
  world.components.shipVelocity.set(shipId, {
    vx: 0,
    vy: 0,
    vz: 0,
    maxSpeed: 0.01, // scene units / sim-sec at throttle 1×
  });

  world.components.shipControl.set(shipId, {
    heading: 0,
    pitch: 0,
    autopilotActive: false,
  });

  return world;
}

/** Re-export for callers that want the generated form without instantiating a world. */
export type { GeneratedBody };
