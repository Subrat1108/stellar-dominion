// Colony economy system (Phase 2B) — deterministic, headless.
//
// Runs on the slower ECONOMY cadence (constants.ts), not the 60 Hz flight tick,
// so colony rates are sized per real second. Each economy tick, every colony
// resolves in a fixed order so shortages cascade deterministically:
//   1. power generation  (solar × insolation)
//   2. power allocation  (suppliers before consumers, by POWER_PRIORITY)
//   3. extraction + production (same priority order; material inputs drawn from
//      the shared stockpile in order, so feedstock is replenished before use)
//   4. crew consumption  (oxygen / water / food)
//   5. clamp ≥ 0, cache per-resource flows for the UI
//
// Body physics feed the economy: solar output scales with insolation (L/r²) and
// water yield with the body's water abundance (icy/wet worlds rich, barren dry).

import type { World } from "../ecs/world.ts";
import type { Colony, CelestialBody, ResourceFlow } from "../ecs/components.ts";
import { insolation } from "../math/physics.ts";
import { ECONOMY_TICK_INTERVAL } from "../constants.ts";
import {
  BUILDINGS,
  POWER_PRIORITY,
  RESOURCES,
  STORED_RESOURCES,
  CREW_CONSUMPTION_PER_MEMBER,
  type ResourceId,
  type BuildingType,
} from "../data/colony.ts";

/** Water richness of a body: drives ISRU extractor yield (data/colony.ts). */
export function waterAbundance(body: CelestialBody | undefined): number {
  if (!body) return 0.5;
  if (body.atmosphere?.hasLiquidWater) return 1.0; // liquid water on/near surface
  if ((body.surfaceTempK ?? 9999) < 260) return 0.8; // frozen — subsurface ice
  return 0.2; // hot/dry barren rock
}

/** Insolation at a body (Earth ≈ 1), from its host star's luminosity + distance. */
export function insolationAt(world: World, bodyId: number, body: CelestialBody | undefined): number {
  const orbit = world.components.orbit.get(bodyId);
  const star = orbit ? world.components.celestialBody.get(orbit.parent) : undefined;
  const luminositySol = star?.luminositySol ?? 1;
  const au = body?.orbitalDistanceAu ?? 1;
  return insolation(luminositySol, au);
}

function emptyFlows(): Record<string, ResourceFlow> {
  const flows: Record<string, ResourceFlow> = {};
  for (const r of RESOURCES) flows[r] = { production: 0, consumption: 0, net: 0 };
  return flows;
}

export function colonySystem(world: World): void {
  // Economy cadence: only advance on the economy tick.
  if (world.tick % ECONOMY_TICK_INTERVAL !== 0) return;

  const crewCount = world.components.crew.get(world.shipId)?.members.length ?? 0;
  for (const [bodyId, colony] of world.components.colony) {
    runColony(world, bodyId, colony, crewCount);
  }
}

function runColony(world: World, bodyId: number, colony: Colony, crewCount: number): void {
  const body = world.components.celestialBody.get(bodyId);
  const insol = insolationAt(world, bodyId, body);
  const abundance = waterAbundance(body);
  const sp = colony.stockpiles;
  const flows = emptyFlows();
  // emptyFlows pre-populates every resource, so this lookup is always defined.
  const flow = (res: ResourceId) => flows[res]!;

  // 1. Power generation (solar arrays, scaled by insolation).
  const solarCount = colony.buildings.solar ?? 0;
  const generation = solarCount * (BUILDINGS.solar.powerOutputBase ?? 0) * insol;
  flow("power").production = generation;

  // 2. Power allocation by priority. Each building unit runs only if the
  //    remaining power covers its full draw; lower-priority modules shut off
  //    first under a deficit.
  let available = generation;
  let load = 0;
  const activeUnits: Partial<Record<BuildingType, number>> = {};
  for (const type of POWER_PRIORITY) {
    const def = BUILDINGS[type];
    const count = colony.buildings[type] ?? 0;
    const canRun = def.powerDraw > 0
      ? Math.min(count, Math.floor(available / def.powerDraw))
      : count;
    activeUnits[type] = canRun;
    available -= canRun * def.powerDraw;
    load += canRun * def.powerDraw;
  }
  flow("power").consumption = load;

  // 3. Extraction + production, suppliers first (POWER_PRIORITY order). Material
  //    inputs are limited by what is in the stockpile this tick; a building runs
  //    at the fraction its scarcest input allows (deterministic cascade).
  for (const type of POWER_PRIORITY) {
    const def = BUILDINGS[type];
    const units = activeUnits[type] ?? 0;
    if (units <= 0) continue;

    const outScale = def.scaling === "waterAbundance" ? abundance : 1;

    // Limiting ratio across inputs.
    let ratio = 1;
    for (const res of Object.keys(def.inputs) as ResourceId[]) {
      const need = (def.inputs[res] ?? 0) * units;
      if (need > 0) ratio = Math.min(ratio, (sp[res] ?? 0) / need);
    }
    ratio = Math.max(0, Math.min(1, ratio));

    for (const res of Object.keys(def.inputs) as ResourceId[]) {
      const used = (def.inputs[res] ?? 0) * units * ratio;
      sp[res] = (sp[res] ?? 0) - used;
      flow(res).consumption += used;
    }
    for (const res of Object.keys(def.outputs) as ResourceId[]) {
      if (res === "power") continue; // power is the solar generator, counted above
      const made = (def.outputs[res] ?? 0) * units * ratio * outScale;
      sp[res] = (sp[res] ?? 0) + made;
      flow(res).production += made;
    }
  }

  // 4. Crew consumption — can't draw more than is in store (a shortfall is a
  //    survival problem: low/zero oxygen stops the ship's life-support relief).
  for (const res of Object.keys(CREW_CONSUMPTION_PER_MEMBER) as ResourceId[]) {
    const need = (CREW_CONSUMPTION_PER_MEMBER[res] ?? 0) * crewCount;
    const used = Math.min(need, sp[res] ?? 0);
    sp[res] = (sp[res] ?? 0) - used;
    flow(res).consumption += used;
  }

  // 5. Clamp and finalise flows.
  for (const res of STORED_RESOURCES) sp[res] = Math.max(0, sp[res] ?? 0);
  for (const r of RESOURCES) flow(r).net = flow(r).production - flow(r).consumption;
  colony.flows = flows;
}

/** The colony on a body, if any. */
export function colonyOnBody(world: World, bodyId: number): Colony | undefined {
  return world.components.colony.get(bodyId);
}

/**
 * True when the crew is landed at a colony that still has oxygen — the condition
 * under which the ship's life-support reserve recovers instead of depleting.
 */
export function isCrewSustainedByColony(world: World): boolean {
  const ctrl = world.components.shipControl.get(world.shipId);
  if (!ctrl || ctrl.landedBodyId === undefined) return false;
  const colony = world.components.colony.get(ctrl.landedBodyId);
  return !!colony && (colony.stockpiles.oxygen ?? 0) > 0;
}
