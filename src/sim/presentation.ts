// Presentation scale — the one place that maps real physical quantities onto
// legible scene units. Tune the look of the system here.
//
// IMPORTANT: nothing in this file is a physical value. Real masses, radii, and
// orbital distances stay in the tagged sim data (src/sim/data/*); these
// constants only decide how big things LOOK and how far apart they sit on screen
// so the hierarchy reads believably (ship ≪ planet ≪ star) while staying
// navigable (a planet is reachable in a short flight and grows on approach).
//
// Lives under sim/ (not render/) because scene-unit orbital radii are baked into
// sim data at world setup, and the renderer also imports these. The sim never
// imports from render/, so this neutral module keeps that boundary intact.

const R_EARTH = 6.371e6; // m — used only to normalise physical radii to "Earths"

// --- Distances: AU → scene units ---------------------------------------------
// A planet at `au` sits `STAR_CLEARANCE + au * AU_TO_SCENE` scene units from the
// star at the origin. STAR_CLEARANCE keeps the innermost planet clear of the
// star's halo; AU_TO_SCENE sets how spread-out the system feels.
// AU_TO_SCENE is large so the system spreads out in roughly real-AU proportions:
// at 200, Ferrum (0.20 AU) sits ~44 u out and Titan's Eye (3.50 AU) ~704 u out,
// while planet render radii stay ~1 u — so a planet reads as a point that grows
// on approach. STAR_CLEARANCE is small to keep the inner-system spacing honest.
export const AU_TO_SCENE = 200;
export const STAR_CLEARANCE = 4;

export function sceneDistance(au: number): number {
  return STAR_CLEARANCE + au * AU_TO_SCENE;
}

// --- Body render radii (scene units) -----------------------------------------
// Physical radii span a huge range (a rocky planet vs this star is ~1 : 86) —
// far too wide to render legibly in one view. We use a compressed mapping:
// rocky planets scale ~linearly in Earth-radii; the gas giant and the star are
// compressed so they still dominate without filling the screen.
export const STAR_RENDER_RADIUS = 10; // reads as a star from across the ~700 u system
const PLANET_RADIUS_SCALE = 1.0; // 1 Earth-radius ≈ 1 scene unit
const PLANET_RADIUS_MIN = 0.7;   // floor so small worlds stay visible
const GAS_GIANT_SCALE = 0.26;    // heavy compression for Saturn/Jupiter class

export function planetRenderRadius(radiusM: number): number {
  return Math.max(PLANET_RADIUS_MIN, (radiusM / R_EARTH) * PLANET_RADIUS_SCALE);
}

export function gasGiantRenderRadius(radiusM: number): number {
  return (radiusM / R_EARTH) * GAS_GIANT_SCALE;
}

// --- Ship --------------------------------------------------------------------
// The player's craft — deliberately tiny next to a planet (≈ 1/6 of a planet's
// diameter). The chase/cockpit camera offsets in the renderer are tuned to this
// length, so retune those if you change it.
export const SHIP_RADIUS = 0.07;
export const SHIP_LENGTH = 0.32;
