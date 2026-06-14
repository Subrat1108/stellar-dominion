// Colony economy data (Phases 2B + 2C) — the single data-driven source of
// resources, buildings, crew demand, population dynamics, and founding seed.
// Balancing happens here, not in code.
//
// All flow rates are PER ECONOMY-TICK (≈1 real second; see ECONOMY_TICK_INTERVAL
// in constants.ts), NOT per flight tick. Sized so a bare starting reserve lasts
// minutes of real time and a small build-out reaches equilibrium.
//
// Scope (docs/05 Phase 2B-2C): resource economy + population dynamics. Terraforming
// levers are Phase 3; multiple colonies are Phase 4. Propellant is produced but
// has NO consumer yet — its sink (in-system transfers) arrives in Phase 4.

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

/** The six colony resources. `power` is a per-tick FLOW (never stockpiled); the
 *  other five are stockpiled. */
export type ResourceId = "power" | "water" | "oxygen" | "food" | "metals" | "propellant";

export const RESOURCES: ResourceId[] = [
  "power", "water", "oxygen", "food", "metals", "propellant",
];

/** Stockpiled resources (everything except the power flow). */
export const STORED_RESOURCES: Exclude<ResourceId, "power">[] = [
  "water", "oxygen", "food", "metals", "propellant",
];

export const RESOURCE_LABEL: Record<ResourceId, string> = {
  power: "Power",
  water: "Water",
  oxygen: "Oxygen",
  food: "Food",
  metals: "Metals",
  propellant: "Propellant",
};

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export type BuildingType =
  | "solar"
  | "waterExtractor"
  | "smelter"
  | "electrolysis"
  | "hydroponics"
  | "habitation";

export const BUILDING_TYPES: BuildingType[] = [
  "solar", "waterExtractor", "smelter", "electrolysis", "hydroponics", "habitation",
];

export interface BuildingDef {
  type: BuildingType;
  name: string;
  description: string;
  /** Build cost paid from the colony's Metals stockpile. */
  costMetals: number;
  /** Power consumed per econ-tick (0 for the solar generator). */
  powerDraw: number;
  /** Solar only: base power generated per econ-tick before the insolation scale. */
  powerOutputBase?: number;
  /** Stored-resource inputs consumed per econ-tick (per building). */
  inputs: Partial<Record<ResourceId, number>>;
  /** Stored-resource outputs produced per econ-tick (per building). */
  outputs: Partial<Record<ResourceId, number>>;
  /** Body-dependent multiplier applied to outputs. */
  scaling?: "insolation" | "waterAbundance";
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  solar: {
    type: "solar",
    name: "Solar Array",
    description:
      "Photovoltaic field. Output scales with insolation (L/r²), so it is " +
      "strong on inner worlds and weak in the cold outer system.",
    costMetals: 50,
    powerDraw: 0,
    powerOutputBase: 10,
    inputs: {},
    outputs: { power: 10 }, // nominal; actual = base × insolation (see colony.ts system)
    scaling: "insolation",
  },
  waterExtractor: {
    type: "waterExtractor",
    name: "Ice Extractor",
    description:
      "ISRU rig that bakes water from regolith/ice. Yield depends on the " +
      "body — abundant on icy/wet worlds, meagre on barren dry rock.",
    costMetals: 40,
    powerDraw: 4,
    inputs: {},
    outputs: { water: 3.0 },
    scaling: "waterAbundance",
  },
  smelter: {
    type: "smelter",
    name: "Regolith Smelter",
    description: "Refines surface regolith into structural metals.",
    costMetals: 60,
    powerDraw: 6,
    inputs: {},
    outputs: { metals: 1.5 },
  },
  electrolysis: {
    type: "electrolysis",
    name: "Electrolysis Plant",
    description:
      "Splits water into breathable oxygen; the hydrogen byproduct feeds a " +
      "Sabatier path producing a trickle of propellant.",
    costMetals: 50,
    powerDraw: 5,
    inputs: { water: 2.0 },
    outputs: { oxygen: 1.8, propellant: 0.3 },
  },
  hydroponics: {
    type: "hydroponics",
    name: "Hydroponics Biodome",
    description: "Grows food crops under lamps from water and power.",
    costMetals: 50,
    powerDraw: 5,
    inputs: { water: 1.5 },
    outputs: { food: 1.2 },
  },
  habitation: {
    type: "habitation",
    name: "Habitation Module",
    description:
      "Pressurised dome housing 10 colonists. One is granted free at founding " +
      "(the landing dome). Without power, life-support systems go cold and growth " +
      "is penalised — colony still stands, but conditions worsen.",
    costMetals: 80,
    powerDraw: 3,
    inputs: {},
    outputs: {},
  },
};

/**
 * Order in which buildings claim power under a deficit (suppliers before their
 * consumers, so feedstock is replenished before it is drawn down — avoids a
 * water death-spiral). Among the water consumers, oxygen (electrolysis) beats
 * food (hydroponics). The same order governs material draw from the shared
 * stockpile, so shortages cascade deterministically.
 */
export const POWER_PRIORITY: BuildingType[] = [
  "waterExtractor", "electrolysis", "hydroponics", "habitation", "smelter",
];

// ---------------------------------------------------------------------------
// Crew demand & founding
// ---------------------------------------------------------------------------

/** Survival consumables drawn per colonist per econ-tick. */
export const POPULATION_CONSUMPTION_PER_PERSON: Partial<Record<ResourceId, number>> = {
  oxygen: 0.1,
  water: 0.08,
  food: 0.06,
};

// ---------------------------------------------------------------------------
// Population dynamics (Phase 2C)
// ---------------------------------------------------------------------------

/** Colonists housed per Habitation Module. Founding grants 1 module free. */
export const HOUSING_PER_MODULE = 10;

/**
 * Population growth rate, per econ-tick, scaled by the body's habitability
 * (0–1). E.g. hab 0.5 → +0.01/tick; hab 1.0 → +0.02/tick.
 */
export const GROWTH_RATE_BASE = 0.02;

/** Growth per econ-tick is capped at this, regardless of conditions. */
export const MAX_GROWTH_PER_TICK = 0.1;

/** Minimum habitability scale factor applied to growth (clamps hostile worlds). */
export const MIN_HABITABILITY_FACTOR = 0.1;

/** Below this habitability, the limiting factor label reads "hostile environment". */
export const HOSTILE_HABITABILITY_THRESHOLD = 0.3;

/**
 * Stockpile below which a resource is considered critically low for the
 * shortage-death check (must also have net < 0 — a recovering stockpile is fine).
 */
export const RESOURCE_CRITICAL_THRESHOLD = 10;

/**
 * Proportional death rates per econ-tick (fraction of current population).
 * Keeps crisis timing independent of colony size: ~15-30 s to 20% loss.
 *   Oxygen: ~15 s to 20% loss (fastest — immediate asphyxiation)
 *   Water:  ~22 s to 20% loss
 *   Food:   ~57 s to 20% loss (slow starvation)
 */
export const OXYGEN_DEATH_RATE = 0.015;
export const WATER_DEATH_RATE = 0.010;
export const FOOD_STARVATION_RATE = 0.004;

/**
 * Growth multiplier when ALL habitation modules lose power.
 * Actual multiplier = HOUSING_UNPOWERED_GROWTH_PENALTY + (1 - penalty) × poweredFraction.
 * So fully-powered = ×1.0; fully-unpowered = ×0.5 (half-speed growth).
 */
export const HOUSING_UNPOWERED_GROWTH_PENALTY = 0.5;

/**
 * Initial colony stockpile on FoundColony. Conserved from the ship:
 *   metals + food   ← ship inventory
 *   propellant      ← ship fuel
 *   water + oxygen  ← offloaded from the ship's life-support reserve
 * (See commands/colony.ts; founding is rejected if the ship is short.)
 */
export const COLONY_SEED = {
  metals: 300,
  food: 200,
  propellant: 50,
  water: 100,
  oxygen: 100,
} as const;

/** Life-support units the ship spends to seed the colony's water + oxygen. */
export const FOUNDING_LIFE_SUPPORT_COST = COLONY_SEED.water + COLONY_SEED.oxygen;

/**
 * Ship life-support reserve regained per FLIGHT tick while the crew is landed at
 * a colony that still has oxygen (the crew breathes colony air, so the ship
 * reserve recovers). Counters the 1/tick depletion several-fold so founding and
 * sustaining a colony visibly reverses the survival clock.
 */
export const LIFE_SUPPORT_REGEN_PER_TICK = 3;
