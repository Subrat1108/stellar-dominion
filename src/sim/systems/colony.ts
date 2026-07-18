// Colony economy + population system (Phases 2B + 2C) — deterministic, headless.
//
// Runs on the slower ECONOMY cadence (constants.ts), not the 60 Hz flight tick,
// so colony rates are sized per real second. Each economy tick, every colony
// resolves in a fixed order so shortages cascade deterministically:
//   1. power generation   (solar × insolation)
//   2. power allocation   (suppliers before consumers, by POWER_PRIORITY)
//   3. extraction + production (same priority order; material inputs drawn from
//      the shared stockpile in order — feedstock replenished before use)
//   4. population consumption (oxygen / water / food per colonist)
//   5. clamp ≥ 0, cache per-resource flows for the UI
//   6. population dynamics (growth / shortage deaths, using finalised flows)
//
// Body physics feed the economy: solar output scales with insolation (L/r²),
// water yield with the body's water abundance, and habitability modulates growth.

import type { World } from "../ecs/world.ts";
import type { Colony, CelestialBody, ResourceFlow, BuildingStatus } from "../ecs/components.ts";
import { insolation, surfaceGravity } from "../math/physics.ts";
import { computeHabitability } from "../math/habitability.ts";
import { hydrosphereGate } from "../math/terraforming.ts";
import { ECONOMY_TICK_INTERVAL } from "../constants.ts";
import {
  BUILDINGS,
  POWER_PRIORITY,
  RESOURCES,
  STORED_RESOURCES,
  POPULATION_CONSUMPTION_PER_PERSON,
  HOUSING_PER_MODULE,
  GROWTH_RATE_BASE,
  MAX_GROWTH_PER_TICK,
  MIN_HABITABILITY_FACTOR,
  HOSTILE_HABITABILITY_THRESHOLD,
  RESOURCE_CRITICAL_THRESHOLD,
  OXYGEN_DEATH_RATE,
  WATER_DEATH_RATE,
  FOOD_STARVATION_RATE,
  HOUSING_UNPOWERED_GROWTH_PENALTY,
  TERRAFORM_LEVERS,
  TERRAFORM_LEVER_DEFS,
  HYDRO_LIQUID_THRESHOLD,
  type ResourceId,
  type BuildingType,
  type TerraformLever,
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

/** Total housing capacity from built habitation modules. */
export function housingCapacity(colony: Colony): number {
  return (colony.buildings.habitation ?? 0) * HOUSING_PER_MODULE;
}

function emptyFlows(): Record<string, ResourceFlow> {
  const flows: Record<string, ResourceFlow> = {};
  for (const r of RESOURCES) flows[r] = { production: 0, consumption: 0, net: 0 };
  return flows;
}

export function colonySystem(world: World): void {
  // Economy cadence: only advance on the economy tick.
  if (world.tick % ECONOMY_TICK_INTERVAL !== 0) return;
  runColonyEconomy(world);
}

/**
 * Resolve every colony's economy by ONE economy-tick, ungated by cadence. Used
 * by colonySystem (after its gate) and by the off-view catch-up, which batch-runs
 * it for the elapsed economy-ticks on re-entry (catch-up.ts). Deterministic and
 * independent of the absolute tick value.
 */
export function runColonyEconomy(world: World): void {
  for (const [bodyId, colony] of world.components.colony) {
    runColony(world, bodyId, colony);
  }
}

function runColony(world: World, bodyId: number, colony: Colony): void {
  const body = world.components.celestialBody.get(bodyId);
  const insol = insolationAt(world, bodyId, body);
  const abundance = waterAbundance(body);
  const sp = colony.stockpiles;
  const flows = emptyFlows();
  // emptyFlows pre-populates every resource, so this lookup is always defined.
  const flow = (res: ResourceId) => flows[res]!;

  // Building statuses: recomputed fresh each economy tick (transient/derived).
  const buildingStatuses: Record<string, BuildingStatus> = {};

  // 1. Power generation (solar arrays, scaled by insolation).
  const solarCount = colony.buildings.solar ?? 0;
  const generation = solarCount * (BUILDINGS.solar.powerOutputBase ?? 0) * insol;
  flow("power").production = generation;
  if (solarCount > 0) {
    buildingStatuses.solar = { running: solarCount, total: solarCount, state: "running", reason: "" };
  }

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

    // Initial status from power availability. Production pass may refine to
    // "idle-no-input" if powered units are also input-starved.
    if (count > 0) {
      if (canRun < count) {
        buildingStatuses[type] = { running: canRun, total: count, state: "idle-no-power", reason: "no power" };
      } else {
        buildingStatuses[type] = { running: canRun, total: count, state: "running", reason: "" };
      }
    }
  }
  flow("power").consumption = load;

  // 3. Extraction + production, suppliers first (POWER_PRIORITY order). Material
  //    inputs are limited by what is in the stockpile this tick; a building runs
  //    at the fraction its scarcest input allows (deterministic cascade).
  //    Also finds the limiting input resource for the status display.
  for (const type of POWER_PRIORITY) {
    const def = BUILDINGS[type];
    const units = activeUnits[type] ?? 0;
    if (units <= 0) continue;
    if (Object.keys(def.outputs).length === 0) continue; // habitation: no resource output

    const outScale = def.scaling === "waterAbundance" ? abundance : 1;

    // Limiting ratio across inputs + track which resource caused the minimum.
    let ratio = 1;
    let limitingResource: ResourceId | undefined;
    for (const res of Object.keys(def.inputs) as ResourceId[]) {
      const need = (def.inputs[res] ?? 0) * units;
      if (need > 0) {
        const r = (sp[res] ?? 0) / need;
        if (r < ratio) { ratio = r; limitingResource = res; }
      }
    }
    ratio = Math.max(0, Math.min(1, ratio));

    // Only mark idle-no-input when ALL power is available (canRun === count).
    // If power is already the problem, don't override that status.
    if (limitingResource !== undefined && buildingStatuses[type]?.state === "running") {
      buildingStatuses[type] = {
        running: units,
        total: colony.buildings[type] ?? 0,
        state: "idle-no-input",
        reason: `insufficient ${limitingResource}`,
        limitingResource,
      };
    }

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

  // 4. Population consumption — scales with colony.population, not ship crew.
  //    A shortfall (less in store than needed) is a survival problem: low oxygen
  //    will trigger shortage deaths in step 6.
  for (const res of Object.keys(POPULATION_CONSUMPTION_PER_PERSON) as ResourceId[]) {
    const need = (POPULATION_CONSUMPTION_PER_PERSON[res] ?? 0) * colony.population;
    const used = Math.min(need, sp[res] ?? 0);
    sp[res] = (sp[res] ?? 0) - used;
    flow(res).consumption += used;
  }

  // 5. Clamp and finalise flows.
  for (const res of STORED_RESOURCES) sp[res] = Math.max(0, sp[res] ?? 0);
  for (const r of RESOURCES) flow(r).net = flow(r).production - flow(r).consumption;
  colony.flows = flows;
  colony.buildingStatuses = buildingStatuses;

  // 6. Terraforming — funded by this colony's surplus. Runs after flows so it
  //    draws on finalised stockpiles + surplus power, and before population so
  //    the recomputed habitability feeds this same tick's growth.
  terraformingStep(world, bodyId, body, colony, flows);

  // 7. Population dynamics — runs after flows so shortage information is final.
  populationStep(colony, body, activeUnits);
}

/**
 * Apply one econ-tick of terraforming to a body that has both a colony (the
 * funder) and an active Terraforming program (Phase 3A). Each lever moves the
 * body's real physical parameter toward its target, burning the allocated share
 * of colony resources; habitability is then recomputed so the population model
 * (and the UI) see the payoff immediately.
 *
 * Power is drawn from the colony's SURPLUS generation this tick (production −
 * load), not a stockpile; stockpiled resources (metals/propellant/water) are
 * drawn from store. A lever runs at the fraction its scarcest input allows, so
 * shift and burn scale together — the same deterministic cascade as production.
 * Levers resolve in a fixed order and share the running power surplus.
 */
function terraformingStep(
  world: World,
  bodyId: number,
  body: CelestialBody | undefined,
  colony: Colony,
  flows: Record<string, ResourceFlow>,
): void {
  const tf = world.components.terraforming.get(bodyId);
  if (!tf || !body) return;

  const sp = colony.stockpiles;
  const powerFlow = flows.power!;
  // Surplus power available to terraforming after building load this tick.
  let surplusPower = Math.max(0, powerFlow.production - powerFlow.consumption);

  // Lazily initialise the hydrosphere gauge from the authored liquid-water flag.
  if (body.hydrosphere === undefined) {
    body.hydrosphere = body.atmosphere?.hasLiquidWater ? 1.0 : 0.0;
  }

  let changed = false;

  for (const lever of TERRAFORM_LEVERS) {
    const alloc = clamp01(tf.allocations[lever] ?? 0);
    if (alloc <= 0) continue;
    // Gated levers do nothing and burn nothing (3A: only Hydrosphere is gated).
    if (lever === "hydrosphere") {
      const gate = hydrosphereGate(body.atmosphere?.pressurePa ?? 0, body.surfaceTempK ?? 0);
      if (gate.locked) continue;
    }

    const def = TERRAFORM_LEVER_DEFS[lever];

    // Desired burn this tick, and the affordable fraction across all inputs.
    let ratio = 1;
    for (const res of Object.keys(def.maxBurn) as ResourceId[]) {
      const want = (def.maxBurn[res] ?? 0) * alloc;
      if (want <= 0) continue;
      const have = res === "power" ? surplusPower : sp[res] ?? 0;
      const r = have / want;
      if (r < ratio) ratio = r;
    }
    ratio = clamp01(ratio);
    if (ratio <= 0) continue;

    // Burn the affordable share.
    for (const res of Object.keys(def.maxBurn) as ResourceId[]) {
      const used = (def.maxBurn[res] ?? 0) * alloc * ratio;
      if (used <= 0) continue;
      if (res === "power") {
        surplusPower -= used;
        flows.power!.consumption += used;
      } else {
        sp[res] = (sp[res] ?? 0) - used;
        flows[res]!.consumption += used;
      }
    }

    // Shift the parameter toward target, clamped so it never overshoots.
    const step = def.maxShift * alloc * ratio;
    applyLeverShift(body, lever, step);
    changed = true;
  }

  if (!changed) return;

  // Re-clamp burned stockpiles and refresh net flows touched by terraforming.
  for (const res of STORED_RESOURCES) sp[res] = Math.max(0, sp[res] ?? 0);
  for (const r of RESOURCES) flows[r]!.net = flows[r]!.production - flows[r]!.consumption;

  // Derive liquid-water flag from the hydrosphere gauge, then recompute the score.
  if (body.atmosphere) {
    body.atmosphere.hasLiquidWater = (body.hydrosphere ?? 0) >= HYDRO_LIQUID_THRESHOLD;
  }
  recomputeHabitability(world, bodyId, body);
}

/** Move a body's parameter toward the lever target by at most `step`. */
function applyLeverShift(body: CelestialBody, lever: TerraformLever, step: number): void {
  const target = TERRAFORM_LEVER_DEFS[lever].target;
  switch (lever) {
    case "temperature": {
      const cur = body.surfaceTempK ?? 0;
      body.surfaceTempK = approach(cur, target, step);
      break;
    }
    case "pressure": {
      if (!body.atmosphere) return;
      body.atmosphere.pressurePa = approach(body.atmosphere.pressurePa, target, step);
      break;
    }
    case "hydrosphere": {
      const cur = body.hydrosphere ?? 0;
      body.hydrosphere = clamp01(approach(cur, target, step));
      break;
    }
  }
}

/** Step `cur` toward `target` by at most `step`, never overshooting. */
function approach(cur: number, target: number, step: number): number {
  if (cur < target) return Math.min(target, cur + step);
  if (cur > target) return Math.max(target, cur - step);
  return cur;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Recompute and cache the body's habitability from its (terraformed) physical
 * inputs. HZ and gravity factors are constant; temp/pressure/water move. The
 * population system reads body.habitability as its growth factor, so this is
 * what makes terraforming visibly improve the colony.
 */
export function recomputeHabitability(world: World, bodyId: number, body: CelestialBody): void {
  const orbit = world.components.orbit.get(bodyId);
  const star = orbit ? world.components.celestialBody.get(orbit.parent) : undefined;
  body.habitability = computeHabitability({
    luminositySol: star?.luminositySol ?? 1,
    orbitalDistanceAu: body.orbitalDistanceAu ?? 1,
    surfaceTempK: body.surfaceTempK ?? 0,
    gravityMs2: body.gravityMs2 ?? surfaceGravity(body.massKg, body.radiusM),
    atmospherePressurePa: body.atmosphere?.pressurePa ?? 0,
    atmosphereToxicity: body.atmosphere?.toxicity ?? 0,
    hasLiquidWater: body.atmosphere?.hasLiquidWater ?? false,
    magnetosphere: body.magnetosphere ?? 0,
  });
}

/**
 * Advance population by one economy tick. Uses finalised flows and stockpiles
 * from the same tick, so the dominant limiting factor is always identifiable.
 *
 * Priority: shortage deaths > starvation > housing cap > growth.
 * Death rates are proportional to population so crisis timing is consistent
 * regardless of colony size (~15-30 s to 20% loss, per docs/09).
 */
function populationStep(
  colony: Colony,
  body: CelestialBody | undefined,
  activeUnits: Partial<Record<BuildingType, number>>,
): void {
  const { population, stockpiles, flows } = colony;
  const housing = housingCapacity(colony);
  const hab = body?.habitability ?? 0.5;

  const oxyNet  = flows.oxygen?.net  ?? 0;
  const waterNet = flows.water?.net  ?? 0;
  const foodNet  = flows.food?.net   ?? 0;

  // Shortage conditions: stockpile critically low AND still declining (net < 0).
  // A recovering stockpile (net ≥ 0) is not an emergency even if absolute levels are low.
  const oxyShort   = (stockpiles.oxygen ?? 0) < RESOURCE_CRITICAL_THRESHOLD && oxyNet   < 0;
  const waterShort = (stockpiles.water  ?? 0) < RESOURCE_CRITICAL_THRESHOLD && waterNet < 0;
  const foodShort  = (stockpiles.food   ?? 0) < RESOURCE_CRITICAL_THRESHOLD && foodNet  < 0;

  let delta: number;
  let limitingFactor: string;

  if (oxyShort) {
    delta = -OXYGEN_DEATH_RATE * population;
    limitingFactor = "declining: oxygen deficit";
  } else if (waterShort) {
    delta = -WATER_DEATH_RATE * population;
    limitingFactor = "declining: water deficit";
  } else if (foodShort) {
    delta = -FOOD_STARVATION_RATE * population;
    limitingFactor = "declining: food shortage";
  } else if (population >= housing) {
    delta = 0;
    limitingFactor = "growth capped: housing";
  } else {
    // Growth: base rate × habitability factor × housing-power multiplier,
    // capped at housing headroom and MAX_GROWTH_PER_TICK.
    const habFactor = Math.max(MIN_HABITABILITY_FACTOR, hab);

    // Habitation power penalty: growth × (0.5 + 0.5 × poweredFraction).
    // Fully powered → ×1.0; fully unpowered → ×0.5 (half-speed growth).
    const totalHab   = colony.buildings.habitation ?? 0;
    const poweredHab = activeUnits.habitation ?? 0;
    const poweredFrac = totalHab > 0 ? poweredHab / totalHab : 1;
    const housingMultiplier = HOUSING_UNPOWERED_GROWTH_PENALTY
      + (1 - HOUSING_UNPOWERED_GROWTH_PENALTY) * poweredFrac;

    const headroom = Math.max(0, housing - population);
    delta = Math.min(
      GROWTH_RATE_BASE * habFactor * housingMultiplier,
      MAX_GROWTH_PER_TICK,
      headroom,
    );

    if (delta > 0.001) {
      if (poweredFrac < 1) {
        limitingFactor = "growing (housing low power)";
      } else if (hab < HOSTILE_HABITABILITY_THRESHOLD) {
        limitingFactor = "growing: hostile environment";
      } else {
        limitingFactor = "growing";
      }
    } else {
      limitingFactor = "stable";
    }
  }

  colony.population = Math.max(0, population + delta);
  colony.popGrowthRate = delta;
  colony.popLimitingFactor = limitingFactor;
}

/** The colony on a body, if any. */
export function colonyOnBody(world: World, bodyId: number): Colony | undefined {
  return world.components.colony.get(bodyId);
}

/**
 * Every colony owned by `ownerId` (the multi-agent seam, docs/15 §6). The owner-
 * aware read for any actor-scoped view or AI query; single-player passes
 * `world.localOwnerId`. Returns [bodyId, colony] pairs in stable iteration order.
 */
export function coloniesOfOwner(world: World, ownerId: string): [number, Colony][] {
  const out: [number, Colony][] = [];
  for (const [bodyId, colony] of world.components.colony) {
    if (colony.ownerId === ownerId) out.push([bodyId, colony]);
  }
  return out;
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
