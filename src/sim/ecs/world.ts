// Minimal hand-rolled ECS World.
//
// Decision (Session 3): hand-rolled over a library (Miniplex/bitECS). Phase 0
// needs almost nothing, and rolling our own keeps entity ids and iteration
// order fully under our control — both critical for determinism. We can swap in
// a library later if entity counts or query complexity demand it.
//
// Determinism notes:
//   - Entity ids are assigned from a monotonic counter (nextId), serialised
//     with the world, so a restored save keeps allocating where it left off.
//   - Systems must iterate in a stable order. Insertion-ordered Maps give us
//     that for free as long as we never rely on object key ordering elsewhere.

import {
  createComponents,
  type Components,
  type CelestialBody,
  type Orbit,
  type Transform,
  type Crew,
  type Inventory,
  type LifeSupport,
  type ShipVelocity,
  type ShipControl,
  type Colony,
  type Terraforming,
} from "./components.ts";
import { makeRng, type Rng } from "../math/rng.ts";
import type { Command } from "../commands/types.ts";

export interface World {
  /** Monotonic simulation tick counter (whole ticks since start). */
  tick: number;
  /** Accumulated simulation time in seconds (tick * dt). */
  time: number;
  /** Next entity id to hand out. */
  nextId: number;
  /** The single seeded RNG for the whole sim. */
  rng: Rng;
  components: Components;
  /** Entity id of the player's ship. Set by world-setup; 0 = not yet assigned. */
  shipId: number;
  /**
   * Pending discrete player commands, drained FIFO at the start of each tick
   * (loop.ts). Transient — not serialised (normally empty at save time); the
   * resulting state lives in components, which are saved.
   */
  commandQueue: Command[];
}

export interface WorldInit {
  seed: string | number;
}

export function createWorld(init: WorldInit): World {
  return {
    tick: 0,
    time: 0,
    nextId: 1,
    rng: makeRng(init.seed),
    components: createComponents(),
    shipId: 0,
    commandQueue: [],
  };
}

/** Allocate a fresh entity id. */
export function createEntity(world: World): number {
  return world.nextId++;
}

/** Queue a discrete player command for application on the next tick. */
export function enqueueCommand(world: World, command: Command): void {
  world.commandQueue.push(command);
}

// --- Serialisation -----------------------------------------------------------
//
// A save is the entity/component state + RNG state + tick count (docs/03).
// Maps are serialised to arrays of [id, value] pairs so JSON.stringify works
// and the exact ordering is stable (insertion order).

export interface SerializedWorld {
  tick: number;
  time: number;
  nextId: number;
  shipId: number;
  rngState: number;
  components: {
    celestialBody: [number, CelestialBody][];
    orbit: [number, Orbit][];
    transform: [number, Transform][];
    crew: [number, Crew][];
    inventory: [number, Inventory][];
    lifeSupport: [number, LifeSupport][];
    shipVelocity: [number, ShipVelocity][];
    shipControl: [number, ShipControl][];
    colony: [number, Colony][];
    terraforming: [number, Terraforming][];
  };
}

export function serializeWorld(world: World): SerializedWorld {
  const {
    celestialBody, orbit, transform, crew, inventory, lifeSupport,
    shipVelocity, shipControl, colony, terraforming,
  } = world.components;
  return {
    tick: world.tick,
    time: world.time,
    nextId: world.nextId,
    shipId: world.shipId,
    rngState: world.rng.state,
    components: {
      celestialBody: [...celestialBody.entries()],
      orbit: [...orbit.entries()],
      transform: [...transform.entries()],
      crew: [...crew.entries()],
      inventory: [...inventory.entries()],
      lifeSupport: [...lifeSupport.entries()],
      shipVelocity: [...shipVelocity.entries()],
      shipControl: [...shipControl.entries()],
      colony: [...colony.entries()],
      terraforming: [...terraforming.entries()],
    },
  };
}
