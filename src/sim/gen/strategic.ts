// Local strategic-resource availability — the interdependence SEED (docs/14 §5,
// docs/16). The lightest possible first appearance of the two-tier resource split
// (bulk stays local; STRATEGIC is scarce + concentrated): a deterministic per-body
// PRESENCE/ABSENCE flag for the first Strategic-Core resource, Fissiles.
//
// This is NOT the economy: no stockpiles, no production, no consumption, no trade
// routes, no transport (all deferred to the economy slice, docs/16). It exists
// ONLY so a founded colony can be surfaced as import-dependent when its world
// lacks a local strategic source — creating the PULL toward other worlds (docs/15
// §2 scarcity) with zero machinery. Soft, never a softlock (docs/15 §4).
//
// Deterministic + pure: same (universeSeed, body) → same availability, every time.

import type { CelestialBody } from "../ecs/components.ts";
import { makeRng, hashSeed } from "../math/rng.ts";
import { xxHashString } from "./hash.ts";
import { M_EARTH_KG } from "./mass-radius.ts";

/** The strategic resources modelled at this slice (just the first Strategic-Core one). */
export const STRATEGIC_RESOURCES = ["fissiles"] as const;
export type StrategicResourceId = (typeof STRATEGIC_RESOURCES)[number];

export const STRATEGIC_RESOURCE_LABEL: Record<StrategicResourceId, string> = {
  fissiles: "Fissiles",
};

/** Which local strategic resources a body hosts (presence/absence only). */
export type StrategicAvailability = Record<StrategicResourceId, boolean>;

/**
 * Deterministic local strategic-resource availability for a body. Fissiles are
 * scarce + concentrated: uncommon in general, a little likelier on larger, more
 * geologically differentiated rocky worlds (enriched deposits). Gas giants have
 * no accessible surface source. Pure — regenerated on demand, never persisted.
 */
export function localStrategicResources(
  universeSeed: string | number,
  body: CelestialBody,
): StrategicAvailability {
  if (body.kind !== "planet") return { fissiles: false };
  const key = body.bodyKey ?? body.name;
  const rng = makeRng(xxHashString(`strategic:${key}`, hashSeed(universeSeed)));
  const massEarth = body.massKg / M_EARTH_KG;
  // Base ~22%; larger rocky worlds (more differentiation) get a modest bump.
  const p = 0.22 + (massEarth > 1.5 ? 0.16 : 0);
  return { fissiles: rng.next() < p };
}

/** True if the body lacks EVERY strategic resource — i.e. it will depend on imports. */
export function isStrategicallyIncomplete(availability: StrategicAvailability): boolean {
  return STRATEGIC_RESOURCES.every((r) => !availability[r]);
}
