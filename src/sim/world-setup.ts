// Phase 1 starting scenario: the Tau Ceti system + the stranded ship.
//
// Replaces the Phase 0 placeholder. Each body is built from the curated data
// in src/sim/data/tau-ceti.ts (tagged real / derived / fictional per docs/04).
// Orbital elements are scaled for visual appeal (see comment below); real
// catalog import at physical scale is a later task.
//
// Orbital speed scaling:
//   All mean-motion values (rad / sim-second) are derived from Mira's reference
//   period using Kepler's third law: n ∝ a^(-3/2). Mira's n is tuned so its
//   visual orbit takes ~79 real seconds at 60 fps, giving pleasing relative
//   motion without being too fast or too slow. Scene-unit semi-major axes are
//   a rough linear mapping from AU: sceneR ≈ realAU * 10 + 4, floored to
//   keep inner planets clear of the star mesh.

import { createWorld, createEntity, type World } from "./ecs/world.ts";
import type { CelestialBody } from "./ecs/components.ts";
import { sceneDistance } from "./presentation.ts";
import {
  tauCetiStar,
  ferrum,
  caldor,
  mira,
  glacius,
  titansEye,
} from "./data/tau-ceti.ts";

// Mira's reference orbital parameters. This sets the RELATIVE speeds of the
// planets; the global orbital clock is slowed by ORBITAL_TIME_RATE (orbital.ts)
// so planets are nearly stationary during a flight.
const MIRA_N = 0.08; // rad / sim-sec — relative mean motion reference

// Scale mean motion by Kepler's third law: n(a) = MIRA_N * (MIRA_AU / a)^1.5
function keplerN(realAu: number): number {
  const MIRA_AU = 0.65;
  return MIRA_N * Math.pow(MIRA_AU / realAu, 1.5);
}

// Scene-unit semi-major axis comes from the central presentation scale.

export function createStartingSystem(seed: string | number = "tau-ceti-alpha"): World {
  const world = createWorld({ seed });
  const { celestialBody, orbit } = world.components;

  // --- Star (stationary at origin, no Orbit component) ---
  const starId = createEntity(world);
  celestialBody.set(starId, tauCetiStar);

  // --- Planets ---
  // [data, eccentricity, meanAnomalyAtEpoch, argumentOfPeriapsis]
  const bodyDefs: Array<[CelestialBody, number, number, number]> = [
    [ferrum,    0.04, 0,              0             ],
    [caldor,    0.08, Math.PI / 3,   Math.PI / 8   ],
    [mira,      0.05, Math.PI / 4,   Math.PI / 5   ],
    [glacius,   0.12, Math.PI * 0.7, Math.PI / 4   ],
    [titansEye, 0.06, Math.PI * 1.3, Math.PI / 10  ],
  ];

  for (const [data, ecc, m0, w] of bodyDefs) {
    const id = createEntity(world);
    celestialBody.set(id, data);
    const au = data.orbitalDistanceAu ?? 1;
    orbit.set(id, {
      parent: starId,
      elements: {
        semiMajorAxis: sceneDistance(au),
        eccentricity: ecc,
        meanMotion: keplerN(au),
        meanAnomalyAtEpoch: m0,
        argumentOfPeriapsis: w,
      },
    });
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

  // Ship starts stationary in open space in the inner system, clear of the star
  // halo (sceneDistance(0) = STAR_CLEARANCE) and roughly between the inner orbits.
  world.components.transform.set(shipId, {
    position: { x: 0, y: 0, z: 11 },
  });

  world.components.shipVelocity.set(shipId, {
    vx: 0,
    vy: 0,
    vz: 0,
    maxSpeed: 10, // scene units / sim-sec
  });

  world.components.shipControl.set(shipId, {
    heading: 0,
    pitch: 0,
    autopilotActive: false,
  });

  return world;
}
