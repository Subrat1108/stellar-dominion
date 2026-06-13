// Component type definitions for the ECS.
//
// Components are PLAIN DATA — no methods, no class instances, no references to
// the renderer. This is what lets a save be "just the component state + RNG
// seed + tick count" (docs/03) and what keeps the sim serialisable and
// deterministic.

import type { OrbitalElements, Vec3 } from "../math/kepler.ts";

/** What kind of celestial body an entity is (drives rendering + later sim). */
export type BodyKind = "star" | "planet";

/** Static description of a celestial body. */
export interface Body {
  kind: BodyKind;
  name: string;
  /** Display radius in scene units (not physically scaled in Phase 0). */
  radius: number;
  /** Hex colour for the renderer, e.g. 0xffcc66. */
  color: number;
}

/** Orbit around a parent entity. Absence = the body is stationary (the star). */
export interface Orbit {
  /** Entity id of the focus this body orbits (e.g. the star). */
  parent: number;
  elements: OrbitalElements;
}

/** Current world-space position, written by the orbital system each tick. */
export interface Transform {
  position: Vec3;
}

/** The set of component stores held by the World, keyed by entity id. */
export interface Components {
  body: Map<number, Body>;
  orbit: Map<number, Orbit>;
  transform: Map<number, Transform>;
}

export function createComponents(): Components {
  return {
    body: new Map(),
    orbit: new Map(),
    transform: new Map(),
  };
}
