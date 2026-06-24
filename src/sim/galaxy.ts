// Multi-system ("galaxy") management — the single-active-system model (docs/09,
// Session 18).
//
// One persistent world holds exactly the active system's bodies + the persistent
// ship entity. Warping swaps the world's contents: the departed system's
// player-deltas are stashed (keyed by stable bodyKey), its body entities are
// cleared, the destination is regenerated deterministically via the 1A engine
// and instantiated, any previously-stashed deltas for it are re-applied, and the
// ship is repositioned. Off-view systems do not tick — the re-entry catch-up
// (catch-up.ts, applied by the caller) advances their economy.
//
// Body entity ids are per-visit (the ship's id is stable); everything that must
// persist across a swap is keyed by bodyKey, so id reallocation is harmless.

import type { World } from "./ecs/world.ts";
import type {
  CelestialBody,
  BodyOverride,
  SystemStash,
  Colony,
  Terraforming,
} from "./ecs/components.ts";
import { generateSystemById } from "./gen/system.ts";
import { instantiateSystem } from "./instantiate.ts";
import { hygIdFromSystemId } from "./data/sector.ts";
import type { GeneratedSystem } from "./gen/types.ts";

/** Diff a body's mutable (terraformable) fields against its pristine baseline. */
function diffOverride(current: CelestialBody, baseline: CelestialBody): BodyOverride | null {
  const ov: BodyOverride = {};
  if (current.surfaceTempK !== baseline.surfaceTempK && current.surfaceTempK !== undefined)
    ov.surfaceTempK = current.surfaceTempK;
  if (current.atmosphere?.pressurePa !== baseline.atmosphere?.pressurePa && current.atmosphere)
    ov.pressurePa = current.atmosphere.pressurePa;
  if (current.hydrosphere !== baseline.hydrosphere && current.hydrosphere !== undefined)
    ov.hydrosphere = current.hydrosphere;
  if (current.atmosphere?.hasLiquidWater !== baseline.atmosphere?.hasLiquidWater && current.atmosphere)
    ov.hasLiquidWater = current.atmosphere.hasLiquidWater;
  if (current.habitability !== baseline.habitability && current.habitability !== undefined)
    ov.habitability = current.habitability;
  return Object.keys(ov).length > 0 ? ov : null;
}

/** Baseline (pristine) bodies for a system, keyed by bodyKey. */
function baselineBodies(world: World, systemId: string): Map<string, CelestialBody> {
  const hygId = hygIdFromSystemId(systemId)!;
  const gen = generateSystemById(world.universeSeed, hygId);
  const m = new Map<string, CelestialBody>();
  m.set(gen.star.bodyKey, gen.star.body);
  for (const gb of gen.bodies) m.set(gb.bodyKey, gb.body);
  return m;
}

/**
 * Collect the active system's player-deltas (colonies, terraforming, the
 * terraformed body fields) keyed by stable bodyKey. `lastSimTick` is set to the
 * current world tick so re-entry can catch the system up.
 */
export function collectSystemStash(world: World): SystemStash {
  const c = world.components;
  const idToKey = new Map<number, string>();
  for (const [id, body] of c.celestialBody) if (body.bodyKey) idToKey.set(id, body.bodyKey);

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

  const baseline = baselineBodies(world, world.activeSystemId);
  const bodyOverrides: [string, BodyOverride][] = [];
  for (const [, body] of c.celestialBody) {
    if (!body.bodyKey) continue;
    const base = baseline.get(body.bodyKey);
    if (!base) continue;
    const ov = diffOverride(body, base);
    if (ov) bodyOverrides.push([body.bodyKey, ov]);
  }

  return { colonies, terraforming, bodyOverrides, lastSimTick: world.tick };
}

/** Apply a stash to the freshly-instantiated active system (resolve by bodyKey). */
export function applyStash(world: World, stash: SystemStash, keyToId: Map<string, number>): void {
  const c = world.components;
  for (const [key, ov] of stash.bodyOverrides) {
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
  for (const [key, colony] of stash.colonies) {
    const id = keyToId.get(key);
    if (id !== undefined) c.colony.set(id, { ...colony, bodyId: id });
  }
  for (const [key, tf] of stash.terraforming) {
    const id = keyToId.get(key);
    if (id !== undefined) c.terraforming.set(id, { ...tf, bodyId: id });
  }
}

/** Delete every body entity (and its components), preserving the ship. */
function clearActiveSystem(world: World): void {
  const c = world.components;
  for (const id of [...c.celestialBody.keys()]) {
    c.celestialBody.delete(id);
    c.orbit.delete(id);
    c.transform.delete(id);
    c.colony.delete(id);
    c.terraforming.delete(id);
  }
}

/** Reposition the ship into a fresh inner-system start (clear flight/landing). */
function resetShipForArrival(world: World): void {
  const c = world.components;
  const id = world.shipId;
  c.transform.set(id, { position: { x: 0, y: 0, z: 60 } });
  const vel = c.shipVelocity.get(id);
  if (vel) { vel.vx = 0; vel.vy = 0; vel.vz = 0; }
  const ctrl = c.shipControl.get(id);
  if (ctrl) {
    ctrl.heading = 0;
    ctrl.pitch = 0;
    ctrl.autopilotActive = false;
    delete ctrl.autopilotTargetId;
    delete ctrl.landedBodyId;
  }
}

export interface ArrivalResult {
  system: GeneratedSystem;
  /** True if this system had been visited before (stash was re-applied). */
  revisited: boolean;
}

/**
 * Swap the active system to `targetSystemId`: stash the current one, regenerate
 * + instantiate the destination, re-apply its stash if previously visited, and
 * reposition the ship. Deterministic. Returns the generated system (for the
 * hazard/UI) and whether it was a revisit (so the caller can run catch-up).
 */
export function setActiveSystem(world: World, targetSystemId: string): ArrivalResult {
  const hygId = hygIdFromSystemId(targetSystemId);
  if (hygId === undefined) throw new Error(`setActiveSystem: bad systemId "${targetSystemId}"`);

  // 1. Stash the system we're leaving.
  if (world.activeSystemId) {
    world.systemDeltas.set(world.activeSystemId, collectSystemStash(world));
  }

  // 2. Clear it (ship persists) and 3. instantiate the destination.
  clearActiveSystem(world);
  const system = generateSystemById(world.universeSeed, hygId);
  const { keyToId } = instantiateSystem(world, system);

  // 4. Re-apply previously-stashed deltas for the destination, if any.
  const prior = world.systemDeltas.get(targetSystemId);
  const revisited = prior !== undefined;
  if (prior) applyStash(world, prior, keyToId);

  // 5. Reposition the ship; 6. mark active + discovered.
  resetShipForArrival(world);
  world.activeSystemId = targetSystemId;
  if (!world.discovered.includes(targetSystemId)) world.discovered.push(targetSystemId);

  return { system, revisited };
}
