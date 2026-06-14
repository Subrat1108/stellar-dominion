// Colony command handlers (Phase 2B). Extracted from apply.ts per the Session-10
// forward note: discrete colony actions get their own module so the central
// switch stays lean. Each handler validates then mutates the world
// deterministically, returning a CommandResult (events on success).

import type { World } from "../ecs/world.ts";
import type { Colony } from "../ecs/components.ts";
import type { CommandResult } from "./types.ts";
import {
  COLONY_SEED,
  FOUNDING_LIFE_SUPPORT_COST,
  STORED_RESOURCES,
  BUILDING_TYPES,
} from "../data/colony.ts";

/**
 * FoundColony — create a Colony on the body the ship is landed on, seeded from
 * the ship's own supplies (conserved, nothing from thin air):
 *   metals + food  ← ship inventory
 *   propellant     ← ship fuel
 *   water + oxygen ← offloaded from the ship's life-support reserve
 * Rejected if the ship is short on any of these.
 */
export function foundColony(world: World, bodyId: number): CommandResult {
  const tick = world.tick;
  const ctrl = world.components.shipControl.get(world.shipId);
  if (!ctrl || ctrl.landedBodyId !== bodyId)
    return { ok: false, reason: "must be landed on the body to found a colony" };
  if (world.components.colony.has(bodyId))
    return { ok: false, reason: "a colony already exists here" };

  const inv = world.components.inventory.get(world.shipId);
  const ls = world.components.lifeSupport.get(world.shipId);
  if (!inv || !ls) return { ok: false, reason: "ship is missing supplies" };

  if (inv.metals < COLONY_SEED.metals)
    return { ok: false, reason: "not enough metals to found a colony" };
  if (inv.food < COLONY_SEED.food)
    return { ok: false, reason: "not enough food to found a colony" };
  if (inv.fuel < COLONY_SEED.propellant)
    return { ok: false, reason: "not enough fuel/propellant to found a colony" };
  if (ls.current < FOUNDING_LIFE_SUPPORT_COST)
    return { ok: false, reason: "not enough life-support reserve to seed the colony" };

  // Conserve: move supplies from ship to colony.
  inv.metals -= COLONY_SEED.metals;
  inv.food -= COLONY_SEED.food;
  inv.fuel -= COLONY_SEED.propellant;
  ls.current -= FOUNDING_LIFE_SUPPORT_COST; // offloads water + oxygen consumables

  const stockpiles: Record<string, number> = {};
  for (const r of STORED_RESOURCES) stockpiles[r] = 0;
  stockpiles.metals = COLONY_SEED.metals;
  stockpiles.food = COLONY_SEED.food;
  stockpiles.propellant = COLONY_SEED.propellant;
  stockpiles.water = COLONY_SEED.water;
  stockpiles.oxygen = COLONY_SEED.oxygen;
  stockpiles.power = 0;

  const buildings: Record<string, number> = {};
  for (const b of BUILDING_TYPES) buildings[b] = 0;

  const colony: Colony = {
    bodyId,
    foundedTick: tick,
    stockpiles,
    buildings,
    flows: {},
  };
  world.components.colony.set(bodyId, colony);

  return { ok: true, events: [{ kind: "ColonyFounded", bodyId, tick }] };
}
