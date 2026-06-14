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
  BUILDINGS,
  type BuildingType,
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
  // Founding grants 1 free Habitation Module (the landing dome) so the crew
  // have somewhere to live from day one. Additional modules cost metals.
  buildings.habitation = 1;

  // Seed population from the ship's crew — they are the founding settlers.
  // Known debt: these crew are also still listed as ship crew (docs/09).
  const crewCount = world.components.crew.get(world.shipId)?.members.length ?? 5;

  const colony: Colony = {
    bodyId,
    foundedTick: tick,
    stockpiles,
    buildings,
    flows: {},
    population: crewCount,
    popGrowthRate: 0,
    popLimitingFactor: "stable",
  };
  world.components.colony.set(bodyId, colony);

  return { ok: true, events: [{ kind: "ColonyFounded", bodyId, tick }] };
}

/**
 * BuildStructure — add one building to a colony, paying its Metals cost from the
 * colony's own stockpile. Requires the colony to exist, the ship to be landed on
 * it, and enough metals in store.
 */
export function buildStructure(world: World, bodyId: number, building: BuildingType): CommandResult {
  const tick = world.tick;
  const ctrl = world.components.shipControl.get(world.shipId);
  if (!ctrl || ctrl.landedBodyId !== bodyId)
    return { ok: false, reason: "must be landed at the colony to build" };

  const colony = world.components.colony.get(bodyId);
  if (!colony) return { ok: false, reason: "no colony here" };

  const def = BUILDINGS[building];
  if (!def) return { ok: false, reason: "unknown structure" };

  const metals = colony.stockpiles.metals ?? 0;
  if (metals < def.costMetals)
    return { ok: false, reason: `not enough metals (need ${def.costMetals})` };

  colony.stockpiles.metals = metals - def.costMetals;
  colony.buildings[building] = (colony.buildings[building] ?? 0) + 1;

  return { ok: true, events: [{ kind: "StructureBuilt", bodyId, building, tick }] };
}
