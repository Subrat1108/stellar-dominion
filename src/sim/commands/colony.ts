// Colony command handlers (Phase 2B). Extracted from apply.ts per the Session-10
// forward note: discrete colony actions get their own module so the central
// switch stays lean. Each handler validates then mutates the world
// deterministically, returning a CommandResult (events on success).

import type { World } from "../ecs/world.ts";
import type { Colony, Terraforming } from "../ecs/components.ts";
import type { CommandResult } from "./types.ts";
import type { OwnerId } from "../owner.ts";
import { hydrosphereGate } from "../math/terraforming.ts";
import { CANDIDATE_SITE_COUNT } from "../gen/sites.ts";
import {
  COLONY_SEED,
  FOUNDING_LIFE_SUPPORT_COST,
  STORED_RESOURCES,
  BUILDING_TYPES,
  BUILDINGS,
  TERRAFORM_LEVER_DEFS,
  type BuildingType,
  type TerraformLever,
} from "../data/colony.ts";

/**
 * FoundColony — create a Colony on the body the ship is landed on, seeded from
 * the ship's own supplies (conserved, nothing from thin air):
 *   metals + food  ← ship inventory
 *   propellant     ← ship fuel
 *   water + oxygen ← offloaded from the ship's life-support reserve
 * Rejected if the ship is short on any of these. The colony is stamped with the
 * founding actor (`actorId`, defaults to the local player) — the multi-agent
 * seam (docs/15 §6): the founder OWNS it, and owner-aware commands check that.
 */
export function foundColony(
  world: World,
  bodyId: number,
  actorId: OwnerId = world.localOwnerId,
  siteIndex = 0,
): CommandResult {
  const tick = world.tick;
  // The chosen landing site (the landing arc, docs/14). Clamp to a valid index;
  // the site itself is regenerated deterministically from the body seed for
  // display/modifiers. (Modifier application lands with the site→modifier map.)
  const chosenSite = Math.max(0, Math.min(CANDIDATE_SITE_COUNT - 1, Math.floor(siteIndex)));
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
    ownerId: actorId,
    foundedTick: tick,
    siteIndex: chosenSite,
    stockpiles,
    buildings,
    flows: {},
    population: crewCount,
    popGrowthRate: 0,
    popLimitingFactor: "stable",
    buildingStatuses: {},
  };
  world.components.colony.set(bodyId, colony);

  return { ok: true, events: [{ kind: "ColonyFounded", bodyId, tick }] };
}

/**
 * BuildStructure — add one building to a colony, paying its Metals cost from the
 * colony's own stockpile. Requires the colony to exist, the ship to be landed on
 * it, and enough metals in store.
 */
export function buildStructure(
  world: World,
  bodyId: number,
  building: BuildingType,
  actorId: OwnerId = world.localOwnerId,
): CommandResult {
  const tick = world.tick;
  const ctrl = world.components.shipControl.get(world.shipId);
  if (!ctrl || ctrl.landedBodyId !== bodyId)
    return { ok: false, reason: "must be landed at the colony to build" };

  const colony = world.components.colony.get(bodyId);
  if (!colony) return { ok: false, reason: "no colony here" };
  if (colony.ownerId !== actorId)
    return { ok: false, reason: "cannot build in a colony you do not own" };

  const def = BUILDINGS[building];
  if (!def) return { ok: false, reason: "unknown structure" };

  const metals = colony.stockpiles.metals ?? 0;
  if (metals < def.costMetals)
    return { ok: false, reason: `not enough metals (need ${def.costMetals})` };

  colony.stockpiles.metals = metals - def.costMetals;
  colony.buildings[building] = (colony.buildings[building] ?? 0) + 1;

  return { ok: true, events: [{ kind: "StructureBuilt", bodyId, building, tick }] };
}

/**
 * SetTerraformAllocation — set a lever's share (0–1) of the colony's output for
 * the body's terraforming program (Phase 3A). Requires a colony on the body, the
 * ship landed there, a valid fraction, and — for a gated lever — that its
 * prerequisites are met (only Hydrosphere is gated in 3A). Creates the
 * Terraforming component on first use.
 */
export function setTerraformAllocation(
  world: World,
  bodyId: number,
  lever: TerraformLever,
  fraction: number,
  actorId: OwnerId = world.localOwnerId,
): CommandResult {
  const tick = world.tick;
  const ctrl = world.components.shipControl.get(world.shipId);
  if (!ctrl || ctrl.landedBodyId !== bodyId)
    return { ok: false, reason: "must be landed at the colony to terraform" };

  const colony = world.components.colony.get(bodyId);
  if (!colony) return { ok: false, reason: "no colony here to fund terraforming" };
  if (colony.ownerId !== actorId)
    return { ok: false, reason: "cannot terraform from a colony you do not own" };

  if (!TERRAFORM_LEVER_DEFS[lever])
    return { ok: false, reason: "unknown terraforming lever" };
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    return { ok: false, reason: "allocation must be between 0 and 1" };

  // Gate check (legibility): reject raising a locked lever, naming the reason.
  if (fraction > 0 && lever === "hydrosphere") {
    const body = world.components.celestialBody.get(bodyId);
    const gate = hydrosphereGate(body?.atmosphere?.pressurePa ?? 0, body?.surfaceTempK ?? 0);
    if (gate.locked)
      return { ok: false, reason: `hydrosphere locked: ${gate.reason}` };
  }

  let tf = world.components.terraforming.get(bodyId);
  if (!tf) {
    tf = { bodyId, allocations: {} } satisfies Terraforming;
    world.components.terraforming.set(bodyId, tf);
  }
  tf.allocations[lever] = fraction;

  return { ok: true, events: [{ kind: "TerraformAllocationSet", bodyId, lever, fraction, tick }] };
}
