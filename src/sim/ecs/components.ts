// Component type definitions for the ECS.
//
// Components are PLAIN DATA — no methods, no class instances, no references to
// the renderer. This keeps a save as "just component state + RNG seed + tick"
// (docs/03) and keeps the sim serialisable and deterministic.

import type { OrbitalElements, Vec3 } from "../math/kepler.ts";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type DataTag = "real" | "derived" | "fictional";
export type BodyKind = "star" | "planet" | "gas-giant";

/** Atmosphere record — always present on planets, absent on stars. */
export interface Atmosphere {
  /** Pascals. Earth ≈ 101 325. */
  pressurePa: number;
  /** Human-readable composition string, e.g. "N₂ 78%, O₂ 21%". */
  composition: string;
  /** 0 = benign; 1 = instantly lethal. */
  toxicity: number;
  /** Whether liquid water is present on or just beneath the surface. */
  hasLiquidWater: boolean;
}

// ---------------------------------------------------------------------------
// Celestial bodies
// ---------------------------------------------------------------------------

/**
 * Rich description of a star, planet, or gas giant.
 * Optional fields are only present for the relevant kind; the UI/renderer
 * should narrow on `kind` before accessing them.
 */
export interface CelestialBody {
  kind: BodyKind;
  name: string;
  /** Scene-unit radius for the renderer (not physically scaled). */
  renderRadius: number;
  /** Hex colour used by the renderer, e.g. 0xffd493. */
  color: number;
  dataTag: DataTag;
  description: string;

  // Physical — all bodies
  massKg: number;
  radiusM: number;

  // Star-only
  spectralType?: string;
  luminositySol?: number;
  /** Surface temperature of the photosphere (K). */
  tempK?: number;

  // Planets and gas giants
  orbitalDistanceAu?: number;

  // Planets only (gas giants have no useful "surface")
  surfaceTempK?: number;
  gravityMs2?: number;
  atmosphere?: Atmosphere;
  /** Magnetosphere strength relative to Earth's: 0 = none, 1 = Earth-like. */
  magnetosphere?: number;
  /** 0–1 score computed once at setup from physical inputs (docs/04). */
  habitability?: number;
}

// ---------------------------------------------------------------------------
// Orbital mechanics
// ---------------------------------------------------------------------------

/** Keplerian orbit around a parent entity. Absence = stationary (the star). */
export interface Orbit {
  /** Entity id of the focus (e.g. the star). */
  parent: number;
  elements: OrbitalElements;
}

/** World-space position — written by the orbital system every tick. */
export interface Transform {
  position: Vec3;
}

// ---------------------------------------------------------------------------
// Ship / crew
// ---------------------------------------------------------------------------

export interface CrewSkills {
  engineering: number;
  science: number;
  command: number;
  biology: number;
  piloting: number;
  medicine: number;
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  skills: CrewSkills;
  /** 0 = incapacitated; 1 = full health. */
  health: number;
}

export interface Crew {
  members: CrewMember[];
}

export interface Inventory {
  /** Raw structural metal, in units. */
  metals: number;
  /** Propellant / reaction mass, in units. */
  fuel: number;
  /** Packaged food rations, in units. */
  food: number;
}

export interface LifeSupport {
  /** Current remaining life-support consumable (air/water/power). */
  current: number;
  /** Maximum capacity when fully stocked. */
  capacity: number;
  /** Units consumed per sim tick (deterministic; drives the survival clock). */
  depletionRatePerTick: number;
}

// ---------------------------------------------------------------------------
// Ship movement
// ---------------------------------------------------------------------------

export interface ShipVelocity {
  vx: number;
  vy: number;
  vz: number;
  /** Maximum speed in scene units per sim-second. */
  maxSpeed: number;
}

export interface ShipControl {
  /**
   * Yaw: heading angle in the XZ plane, radians.
   * 0 = pointing toward +Z; increases turning toward +X.
   */
  heading: number;
  /**
   * Pitch: nose elevation, radians. 0 = level; positive = nose up (+Y).
   * Clamped to just under ±90° so the ship never flips over the pole.
   */
  pitch: number;
  /** If set and autopilotActive, the ship steers toward this entity. */
  autopilotTargetId?: number;
  autopilotActive: boolean;
}

// ---------------------------------------------------------------------------
// ECS component registry
// ---------------------------------------------------------------------------

export interface Components {
  celestialBody: Map<number, CelestialBody>;
  orbit: Map<number, Orbit>;
  transform: Map<number, Transform>;
  crew: Map<number, Crew>;
  inventory: Map<number, Inventory>;
  lifeSupport: Map<number, LifeSupport>;
  shipVelocity: Map<number, ShipVelocity>;
  shipControl: Map<number, ShipControl>;
}

export function createComponents(): Components {
  return {
    celestialBody: new Map(),
    orbit: new Map(),
    transform: new Map(),
    crew: new Map(),
    inventory: new Map(),
    lifeSupport: new Map(),
    shipVelocity: new Map(),
    shipControl: new Map(),
  };
}
