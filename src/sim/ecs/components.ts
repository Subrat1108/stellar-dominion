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
  /** 0–1 score computed once at setup from physical inputs (docs/04). Mutated by
   *  terraforming (Phase 3A) as the body's temp/pressure/water gauges shift. */
  habitability?: number;
  /**
   * Surface-water fraction, 0–1 (Phase 3A terraforming gauge). Initialised from
   * `atmosphere.hasLiquidWater` the first time terraforming runs on the body;
   * `hasLiquidWater` is then derived from it (≥ HYDRO_LIQUID_THRESHOLD = liquid).
   * Only present once a body has been terraformed.
   */
  hydrosphere?: number;
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
  /**
   * If set, the ship is landed on this body's surface; flight is disabled until
   * a TakeOff command clears it. Set/cleared only by the command layer.
   */
  landedBodyId?: number;
}

// ---------------------------------------------------------------------------
// Colony (Phase 2B)
// ---------------------------------------------------------------------------

/** Production / consumption / net for one resource over the last economy tick. */
export interface ResourceFlow {
  production: number;
  consumption: number;
  net: number;
}

export type BuildingStatusKind = "running" | "idle-no-power" | "idle-no-input";

/**
 * Live operational status of one building type, recomputed each economy tick.
 * Answers "why isn't this working?" for every structure the colony owns.
 */
export interface BuildingStatus {
  /** Units of this type currently producing (may be < total if power-shed). */
  running: number;
  /** Total units built. */
  total: number;
  state: BuildingStatusKind;
  /** Human-readable reason when not at full capacity. Empty when fully running. */
  reason: string;
  /** Machine-readable limiting input resource (set when state === "idle-no-input"). */
  limitingResource?: string;
}

/**
 * A colony on a body. Keyed in the registry by the BODY's entity id (one colony
 * per body in Phase 2B; the Map supports more later). Stockpiles, buildings, and
 * flows are plain data so the colony serialises like any other component.
 *
 * `stockpiles` and `buildings` use the string keys from data/colony.ts; they are
 * kept as plain records (not enums) so the data file stays the single source.
 */
export interface Colony {
  /** Body entity this colony sits on (mirrors the registry key). */
  bodyId: number;
  foundedTick: number;
  /** Units in store, keyed by ResourceId (power is always 0 — it is a flow). */
  stockpiles: Record<string, number>;
  /** Count of each building type built, keyed by BuildingType. */
  buildings: Record<string, number>;
  /** Last economy-tick flows per ResourceId, for the UI (net = prod − cons). */
  flows: Record<string, ResourceFlow>;
  /**
   * Aggregate colonist count (float for fractional growth; render as Math.floor).
   * Seeded at crew count on founding (Phase 2C). Known debt: founding crew are
   * counted both as ship crew and colony population — to reconcile when the crew
   * arc lands (Phase 5–6, docs/09).
   */
  population: number;
  /** Population delta from the last economy tick (positive = growth, negative = loss). */
  popGrowthRate: number;
  /** Human-readable description of the dominant growth or decline driver. */
  popLimitingFactor: string;
  /**
   * Operational status per building type — recomputed each economy tick
   * (transient/derived, like popLimitingFactor). Keyed by BuildingType string.
   * Answers "why isn't this working?" for every structure the colony owns.
   */
  buildingStatuses: Record<string, BuildingStatus>;
}

// ---------------------------------------------------------------------------
// Terraforming (Phase 3A)
// ---------------------------------------------------------------------------

/**
 * Terraforming state for a body, keyed by the BODY's entity id (parallel to
 * Colony — a colony on the body funds the levers). Holds only the persistent
 * per-lever allocation fractions (0–1, "share of colony output"). The physical
 * gauges the levers drive (surfaceTempK, atmosphere.pressurePa, hydrosphere)
 * live on the CelestialBody; gate/lock state is derived in the UI/system from
 * those fields, so nothing transient is stored here.
 */
export interface Terraforming {
  /** Body entity this terraforming program runs on (mirrors the registry key). */
  bodyId: number;
  /** Allocation fraction 0–1 per TerraformLever string. Absent lever = 0. */
  allocations: Record<string, number>;
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
  colony: Map<number, Colony>;
  terraforming: Map<number, Terraforming>;
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
    colony: new Map(),
    terraforming: new Map(),
  };
}
