// Seed + deltas save model (docs/09, docs/13).
//
// extractDeltas(world)  → a SavePayload = universe seed + only the state the
//                         player changed (ship, colonies, terraforming, the
//                         per-body fields terraforming mutates).
// reconstructWorld(p)   → regenerate the universe from the seed, then overlay
//                         the deltas, yielding a world byte-identical to the one
//                         that was saved.
//
// Deltas key bodies by their stable semantic identity (CelestialBody.bodyKey),
// NOT the raw entity id — so a save survives future changes to generation order
// (docs/09). Body transforms are NOT stored: they are a pure function of time,
// so reconstruct re-derives them by running the orbital system at the saved time.

import type { World } from "../ecs/world.ts";
import type {
  Colony,
  Terraforming,
  Transform,
  ShipVelocity,
  ShipControl,
  Inventory,
  LifeSupport,
  Crew,
  CelestialBody,
} from "../ecs/components.ts";
import { createStartingSystem } from "../world-setup.ts";
import { orbitalSystem } from "../systems/orbital.ts";

/** Current save format version — bump when the payload shape changes. */
export const SAVE_VERSION = 1;

/** The mutable body fields terraforming changes — the only per-body deltas. */
export interface BodyOverride {
  surfaceTempK?: number;
  pressurePa?: number;
  hydrosphere?: number;
  hasLiquidWater?: boolean;
  habitability?: number;
}

export interface SaveDeltas {
  meta: { tick: number; time: number; rngState: number; nextId: number; shipId: number };
  ship: {
    transform?: Transform;
    shipVelocity?: ShipVelocity;
    shipControl?: ShipControl;
    inventory?: Inventory;
    lifeSupport?: LifeSupport;
    crew?: Crew;
  };
  colonies: [string, Colony][]; // keyed by bodyKey
  terraforming: [string, Terraforming][]; // keyed by bodyKey
  bodyOverrides: [string, BodyOverride][]; // keyed by bodyKey
}

export interface SavePayload {
  version: number;
  universeSeed: string | number;
  deltas: SaveDeltas;
}

/** Map entity id → bodyKey for the bodies in a world. */
function keyByEntity(world: World): Map<number, string> {
  const m = new Map<number, string>();
  for (const [id, body] of world.components.celestialBody) {
    if (body.bodyKey) m.set(id, body.bodyKey);
  }
  return m;
}

/** Capture the player-changed state of a world as a portable SavePayload. */
export function extractDeltas(world: World): SavePayload {
  const c = world.components;
  const idToKey = keyByEntity(world);

  // Baseline: a freshly-generated universe from the same seed. Body overrides
  // are the diff of each current body against its pristine generated form.
  const baseline = createStartingSystem(world.universeSeed);
  const baseBodies = new Map<string, CelestialBody>();
  for (const [, body] of baseline.components.celestialBody) {
    if (body.bodyKey) baseBodies.set(body.bodyKey, body);
  }

  const bodyOverrides: [string, BodyOverride][] = [];
  for (const [, body] of c.celestialBody) {
    if (!body.bodyKey) continue;
    const base = baseBodies.get(body.bodyKey);
    if (!base) continue;
    const ov: BodyOverride = {};
    if (body.surfaceTempK !== base.surfaceTempK && body.surfaceTempK !== undefined) ov.surfaceTempK = body.surfaceTempK;
    if (body.atmosphere?.pressurePa !== base.atmosphere?.pressurePa && body.atmosphere) ov.pressurePa = body.atmosphere.pressurePa;
    if (body.hydrosphere !== base.hydrosphere && body.hydrosphere !== undefined) ov.hydrosphere = body.hydrosphere;
    if (body.atmosphere?.hasLiquidWater !== base.atmosphere?.hasLiquidWater && body.atmosphere) ov.hasLiquidWater = body.atmosphere.hasLiquidWater;
    if (body.habitability !== base.habitability && body.habitability !== undefined) ov.habitability = body.habitability;
    if (Object.keys(ov).length > 0) bodyOverrides.push([body.bodyKey, ov]);
  }

  const colonies: [string, Colony][] = [];
  for (const [id, colony] of c.colony) {
    const key = idToKey.get(id);
    if (key) colonies.push([key, colony]);
  }
  const terraforming: [string, Terraforming][] = [];
  for (const [id, tf] of c.terraforming) {
    const key = idToKey.get(id);
    if (key) terraforming.push([key, tf]);
  }

  const shipId = world.shipId;
  // Only include defined ship components (exactOptionalPropertyTypes).
  const ship: SaveDeltas["ship"] = {};
  const transform = c.transform.get(shipId);
  const shipVelocity = c.shipVelocity.get(shipId);
  const shipControl = c.shipControl.get(shipId);
  const inventory = c.inventory.get(shipId);
  const lifeSupport = c.lifeSupport.get(shipId);
  const crew = c.crew.get(shipId);
  if (transform) ship.transform = transform;
  if (shipVelocity) ship.shipVelocity = shipVelocity;
  if (shipControl) ship.shipControl = shipControl;
  if (inventory) ship.inventory = inventory;
  if (lifeSupport) ship.lifeSupport = lifeSupport;
  if (crew) ship.crew = crew;

  return {
    version: SAVE_VERSION,
    universeSeed: world.universeSeed,
    deltas: {
      meta: {
        tick: world.tick,
        time: world.time,
        rngState: world.rng.state,
        nextId: world.nextId,
        shipId,
      },
      ship,
      colonies,
      terraforming,
      bodyOverrides,
    },
  };
}

/** Rebuild a world from a SavePayload: regenerate from seed, then apply deltas. */
export function reconstructWorld(payload: SavePayload): World {
  if (payload.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version ${payload.version} (expected ${SAVE_VERSION})`);
  }
  const world = createStartingSystem(payload.universeSeed);
  const c = world.components;
  const { meta, ship, colonies, terraforming, bodyOverrides } = payload.deltas;

  // Restore meta first so derived state (orbital positions) lands at the right time.
  world.tick = meta.tick;
  world.time = meta.time;
  world.rng.state = meta.rngState;
  world.nextId = meta.nextId;

  // bodyKey → entity id in the regenerated world (ids are deterministic, but we
  // resolve through the stable key so the save is robust to id changes).
  const keyToId = new Map<string, number>();
  for (const [id, body] of c.celestialBody) {
    if (body.bodyKey) keyToId.set(body.bodyKey, id);
  }

  // Apply per-body overrides (the terraformed fields).
  for (const [key, ov] of bodyOverrides) {
    const id = keyToId.get(key);
    if (id === undefined) continue;
    const body = c.celestialBody.get(id)!;
    if (ov.surfaceTempK !== undefined) body.surfaceTempK = ov.surfaceTempK;
    if (ov.habitability !== undefined) body.habitability = ov.habitability;
    if (ov.hydrosphere !== undefined) body.hydrosphere = ov.hydrosphere;
    if (body.atmosphere) {
      if (ov.pressurePa !== undefined) body.atmosphere.pressurePa = ov.pressurePa;
      if (ov.hasLiquidWater !== undefined) body.atmosphere.hasLiquidWater = ov.hasLiquidWater;
    }
  }

  // Re-derive body transforms from the restored time (pure function of time),
  // matching the order they were first written in the original run.
  orbitalSystem(world);

  // Ship components (player-mutated) overwrite the freshly-set-up ship.
  const shipId = world.shipId;
  if (ship.transform) c.transform.set(shipId, ship.transform);
  if (ship.shipVelocity) c.shipVelocity.set(shipId, ship.shipVelocity);
  if (ship.shipControl) c.shipControl.set(shipId, ship.shipControl);
  if (ship.inventory) c.inventory.set(shipId, ship.inventory);
  if (ship.lifeSupport) c.lifeSupport.set(shipId, ship.lifeSupport);
  if (ship.crew) c.crew.set(shipId, ship.crew);

  // Colonies + terraforming, resolved by stable key (bodyId rewritten to match).
  for (const [key, colony] of colonies) {
    const id = keyToId.get(key);
    if (id !== undefined) c.colony.set(id, { ...colony, bodyId: id });
  }
  for (const [key, tf] of terraforming) {
    const id = keyToId.get(key);
    if (id !== undefined) c.terraforming.set(id, { ...tf, bodyId: id });
  }

  return world;
}
