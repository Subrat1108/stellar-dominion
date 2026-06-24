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
// Scaled up substantially (Session 9) so a planet fills most of the view on
// approach: at 6 u per Earth-radius, Mira ≈ 5.9 u and the autopilot parks at
// ~9 u from centre, giving a ~66° apparent diameter in the 60° FOV.
// Orbit gaps stay healthy — tightest pair (Ferrum/Caldor, 34 u apart) has ~22 u
// clearance between surfaces. GAS_GIANT_SCALE raised proportionally so Titan's
// Eye (9 R⊕ ≈ 13.5 u) stays bigger than any rocky planet. Star bumped to 12 to
// remain visually dominant over the larger planets.
export const STAR_RENDER_RADIUS = 12;
const PLANET_RADIUS_SCALE = 6.0; // 1 Earth-radius ≈ 6 scene units
const PLANET_RADIUS_MIN = 4.0;   // floor so small worlds stay visible
const GAS_GIANT_SCALE = 1.5;     // Titan's Eye (9 R⊕) ≈ 13.5 u

// Star render radius scales with PHYSICAL size, anchored so a Tau-Ceti-class
// star (0.793 R⊙) stays at the legacy STAR_RENDER_RADIUS (12). Small red dwarfs
// (YZ Ceti ≈ 0.16 R⊙) render genuinely small — which both sells "a different,
// dim star" and lets their ultra-tight orbits clear the star's sphere.
const R_SUN = 6.957e8; // m
const TAU_CETI_RADIUS_M = 0.793 * R_SUN; // the anchor (renders at 12)
const STAR_RADIUS_MIN = 3.0;
const STAR_RADIUS_MAX = 16.0;

export function starRenderRadius(radiusM: number): number {
  const scaled = (radiusM / TAU_CETI_RADIUS_M) * STAR_RENDER_RADIUS;
  return Math.max(STAR_RADIUS_MIN, Math.min(STAR_RADIUS_MAX, scaled));
}

export function planetRenderRadius(radiusM: number): number {
  return Math.max(PLANET_RADIUS_MIN, (radiusM / R_EARTH) * PLANET_RADIUS_SCALE);
}

export function gasGiantRenderRadius(radiusM: number): number {
  return (radiusM / R_EARTH) * GAS_GIANT_SCALE;
}

// --- Orbit placement floors --------------------------------------------------
// A body's scene-unit orbit is normally sceneDistance(au), but ultra-tight real
// systems (e.g. YZ Ceti's planets at 0.016–0.028 AU) would otherwise render
// inside the star or on top of each other. These floors push such orbits out to
// a legible minimum WITHOUT touching well-spaced systems: for Tau Ceti the raw
// sceneDistance always already exceeds them, so its layout is unchanged.
export const STAR_SURFACE_CLEAR = 6; // min scene gap between star surface and innermost orbit
export const MIN_ORBIT_GAP = 16;     // min scene gap between successive orbits

/**
 * Scene-unit semi-major axis for a star-orbiting body, applying the floors:
 * at least sceneDistance(au), clear of the star, and spaced from the previous
 * orbit. `prevSceneRadius` is the placed radius of the next-inner body (0 = none).
 */
export function orbitSceneRadius(
  au: number,
  starRender: number,
  prevSceneRadius: number,
): number {
  const floor = Math.max(starRender + STAR_SURFACE_CLEAR, prevSceneRadius + MIN_ORBIT_GAP);
  return Math.max(sceneDistance(au), floor);
}

// --- Approach / parking ------------------------------------------------------
// Distance (scene units, from a body's centre) at which the autopilot parks and
// at which landing becomes available: far enough to clear the surface, close
// enough that the body fills the view. Shared by the autopilot (ship-movement)
// and landing validation (commands/apply) so "parked" means one thing.
export function parkDistance(renderRadius: number): number {
  return Math.max(renderRadius * 1.5, renderRadius + 3);
}

// --- Ship --------------------------------------------------------------------
// The player's craft — deliberately tiny next to a planet (≈ 1/6 of a planet's
// diameter). The chase/cockpit camera offsets in the renderer are tuned to this
// length, so retune those if you change it.
export const SHIP_RADIUS = 0.07;
export const SHIP_LENGTH = 0.32;
