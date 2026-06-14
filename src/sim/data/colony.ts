// Colony economy data (Phase 2B) — the single data-driven source of resources,
// buildings, crew demand, and founding seed. Balancing happens here, not in code.
//
// All flow rates are PER ECONOMY-TICK (≈1 real second; see ECONOMY_TICK_INTERVAL
// in constants.ts), NOT per flight tick. Sized so a bare starting reserve lasts
// minutes of real time and a small build-out reaches equilibrium.
//
// Scope (docs/05 Phase 2B): the resource economy only. Terraforming levers
// (temperature/pressure/biosphere) are Phase 3; population dynamics are 2C;
// multiple colonies are Phase 4. Propellant is produced and stockpiled but has
// NO consumer yet — its sink (in-system transfers) arrives in Phase 4 (docs/09).

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
  | "hydroponics";

export const BUILDING_TYPES: BuildingType[] = [
  "solar", "waterExtractor", "smelter", "electrolysis", "hydroponics",
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
};

/**
 * Order in which buildings claim power under a deficit (suppliers before their
 * consumers, so feedstock is replenished before it is drawn down — avoids a
 * water death-spiral). Among the water consumers, oxygen (electrolysis) beats
 * food (hydroponics). The same order governs material draw from the shared
 * stockpile, so shortages cascade deterministically.
 */
export const POWER_PRIORITY: BuildingType[] = [
  "waterExtractor", "electrolysis", "hydroponics", "smelter",
];

// ---------------------------------------------------------------------------
// Crew demand & founding
// ---------------------------------------------------------------------------

/** Survival consumables drawn per crew member per econ-tick. */
export const CREW_CONSUMPTION_PER_MEMBER: Partial<Record<ResourceId, number>> = {
  oxygen: 0.1,
  water: 0.08,
  food: 0.06,
};

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
