// Seed + deltas save model (docs/09, docs/13; extended for Step 1B multi-system).
//
// extractDeltas(world)  → a SavePayload = universe seed + only what the player
//                         changed: the active-system id, the discovered set, the
//                         ship, and per-system stashes (colonies / terraforming /
//                         terraformed body fields) for EVERY visited system,
//                         keyed by stable systemId + bodyKey.
// reconstructWorld(p)   → regenerate from the seed, restore the stashes + the
//                         discovered set, make the saved system active, and
//                         re-apply the ship.
//
// Bodies + colonies key by stable identity (systemId / bodyKey), never raw entity
// ids — which are per-visit artifacts of the warp swap (docs/09, Session 18). For
// a home-only save the reconstruction is byte-identical; once warping is involved
// the guarantee is semantic (same bodies/colonies by key, same active + discovered),
// since entity ids depend on the visit history.

import type { World } from "../ecs/world.ts";
import type {
  Transform,
  ShipVelocity,
  ShipControl,
  Inventory,
  LifeSupport,
  Crew,
  SystemStash,
} from "../ecs/components.ts";
import { createStartingSystem } from "../world-setup.ts";
import { orbitalSystem } from "../systems/orbital.ts";
import { collectSystemStash, applyStash, setActiveSystem } from "../galaxy.ts";
import { LOCAL_PLAYER_OWNER } from "../owner.ts";
import { migrate } from "./migrate.ts";

export type { BodyOverride } from "../ecs/components.ts";

/**
 * Current save format version — bump when the payload shape changes, and add a
 * migrator (save/migrate.ts) so older saves load forward instead of breaking
 * (the production save-migration rule, docs/15 §6; docs/09 2026-07-18).
 *   v2 → v3: colonies gain `ownerId` (the multi-agent seam) + site fields.
 */
export const SAVE_VERSION = 3;

export interface SaveDeltas {
  meta: {
    tick: number;
    time: number;
    rngState: number;
    nextId: number;
    shipId: number;
    /** Local player's owner id (v3+). Older saves default to the local player. */
    localOwnerId?: string;
  };
  ship: {
    transform?: Transform;
    shipVelocity?: ShipVelocity;
    shipControl?: ShipControl;
    inventory?: Inventory;
    lifeSupport?: LifeSupport;
    crew?: Crew;
  };
  /** The system the player is currently in (`hyg:<id>`). */
  activeSystemId: string;
  /** Systems whose fog of war is lifted. */
  discovered: string[];
  /** Per-system player deltas for EVERY visited system (incl. the active one). */
  systems: [string, SystemStash][];
}

export interface SavePayload {
  version: number;
  universeSeed: string | number;
  deltas: SaveDeltas;
  /**
   * Wall-clock time (Date.now()) this payload was saved, if known — persistence
   * metadata, NOT sim state (reconstructWorld ignores it). Older payloads may
   * lack it (no offline progression is computed for them). Set by the
   * persistence layer (app/persistence.ts), not by extractDeltas.
   */
  savedAtMs?: number;
}

/** bodyKey → entity id for the bodies currently in the world. */
function keyToEntity(world: World): Map<string, number> {
  const m = new Map<string, number>();
  for (const [id, body] of world.components.celestialBody) {
    if (body.bodyKey) m.set(body.bodyKey, id);
  }
  return m;
}

/** Capture the player-changed state of a world as a portable SavePayload. */
export function extractDeltas(world: World): SavePayload {
  const c = world.components;

  // Every visited system: the stashed inactive ones + the live active one.
  const systems = new Map(world.systemDeltas);
  systems.set(world.activeSystemId, collectSystemStash(world));

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
        localOwnerId: world.localOwnerId,
      },
      ship,
      activeSystemId: world.activeSystemId,
      discovered: [...world.discovered],
      systems: [...systems.entries()],
    },
  };
}

/** Rebuild a world from a SavePayload: regenerate from seed, then apply deltas. */
export function reconstructWorld(payload: SavePayload): World {
  // Migrate an older payload forward to the current version (throws only if the
  // payload is NEWER than we understand, or a migrator is missing). This is the
  // reusable save-migration seam — old saves load, never break (docs/15 §6).
  payload = migrate(payload, SAVE_VERSION);

  const world = createStartingSystem(payload.universeSeed);
  const c = world.components;
  const { meta, ship, activeSystemId, discovered, systems } = payload.deltas;
  const homeSystemId = world.activeSystemId; // what createStartingSystem built

  // Time first, so the active-system catch-up sees elapsed = 0 (stash is "now").
  world.tick = meta.tick;
  world.time = meta.time;
  world.rng.state = meta.rngState;
  world.localOwnerId = meta.localOwnerId ?? LOCAL_PLAYER_OWNER;
  world.discovered = [...discovered];

  const systemsMap = new Map(systems);
  // Inactive systems go straight into the stash map.
  world.systemDeltas = new Map();
  for (const [sid, stash] of systemsMap) {
    if (sid !== activeSystemId) world.systemDeltas.set(sid, stash);
  }

  const activeStash = systemsMap.get(activeSystemId);
  if (activeSystemId === homeSystemId) {
    // Active system is the one createStartingSystem already built — apply its
    // stash in place (preserves entity ids → byte-identical for home-only saves).
    if (activeStash) applyStash(world, activeStash, keyToEntity(world));
  } else {
    // Swap to the saved active system; setActiveSystem applies + removes its stash.
    if (activeStash) world.systemDeltas.set(activeSystemId, activeStash);
    setActiveSystem(world, activeSystemId, { stashCurrent: false, resetShip: false });
  }

  // Restore the id counter AFTER the swap, so future allocations stay aligned.
  world.nextId = meta.nextId;

  // Re-derive body transforms from the restored time (pure function of time).
  orbitalSystem(world);

  // Ship components (player-mutated) overwrite the freshly-set-up ship.
  const shipId = world.shipId;
  if (ship.transform) c.transform.set(shipId, ship.transform);
  if (ship.shipVelocity) c.shipVelocity.set(shipId, ship.shipVelocity);
  if (ship.shipControl) c.shipControl.set(shipId, ship.shipControl);
  if (ship.inventory) c.inventory.set(shipId, ship.inventory);
  if (ship.lifeSupport) c.lifeSupport.set(shipId, ship.lifeSupport);
  if (ship.crew) c.crew.set(shipId, ship.crew);

  return world;
}
