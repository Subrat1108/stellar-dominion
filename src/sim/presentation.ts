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
// Exploration-polish A (docs/09 governing principle): bodies render at their TRUE
// physical radius, using the SAME AU→scene mapping as distances. So planet /
// gas-giant / star sizes are honestly proportioned against each other AND against
// the real-AU spacing — a world is a small dot until you close on it (Earth-radius
// ≈ 0.0085 u; Tau Ceti's 0.793 R⊙ ≈ 0.74 u; a 9 R⊕ gas giant ≈ 0.077 u). There is
// no per-class inflation: navigability comes from the speed curve + the target
// marker + the map, not from making bodies bigger than they are. The ship and the
// camera rig are the only non-physical avatars (see SHIP_* below + render/scene.ts).
const AU_METERS = 1.495978707e11; // m per AU — anchors the physical body scale

/** Convert a physical radius (metres) to scene units, honest to AU_TO_SCENE. */
export function physicalRadiusToScene(radiusM: number): number {
  return (radiusM * AU_TO_SCENE) / AU_METERS;
}

// All body classes share the one honest factor (no inflation, no floor).
export const planetRenderRadius = physicalRadiusToScene;
export const gasGiantRenderRadius = physicalRadiusToScene;
export const starRenderRadius = physicalRadiusToScene;

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
// at which landing becomes available. Now a pure multiple of the (real) render
// radius, so a body fills the SAME fraction of the FOV on arrival regardless of
// its physical size — honest "body fills the view" framing. No additive floor:
// the old +3 u floor dominated once radii became physical. Shared by the
// autopilot (ship-movement) and landing validation (commands/apply) so "parked"
// means one thing. 2.75 ≈ 1/tan(20°): a ~40° apparent diameter in the 60° FOV.
export const PARK_RADIUS_MULT = 2.75;
export function parkDistance(renderRadius: number): number {
  return renderRadius * PARK_RADIUS_MULT;
}

// --- Orbital insertion (Session 20 fix) --------------------------------------
// On arrival the autopilot settles into a LOW orbit at this multiple of the real
// radius (centre-distance), so the body fills the view as a curved wall rather
// than a distant marble. 1.2 → altitude 0.2 R above the surface; tunable 1.1–1.3.
export const ORBIT_INSERTION_MULT = 1.2;
export function orbitInsertionRadius(renderRadius: number): number {
  return renderRadius * ORBIT_INSERTION_MULT;
}

// Slow, deterministic orbit rate (rad / sim-sec) once inserted — a feel value:
// slow enough to admire, not a spin. 0.042 ≈ one full orbit every ~150 s.
export const ORBIT_RATE = 0.042;

// --- Ship (a player AVATAR, not a physical body) -----------------------------
// A literally-to-scale ship would be ~1e-7 u (sub-near-plane, unrenderable in one
// camera). It stays a small but visible mote, sized WELL UNDER the body radius so
// it reads as a tiny craft, not a co-equal object (Session 20 fix): at 0.00005 u
// it is ~1:167 of an Earth-radius world (0.00835 u). Its apparent on-screen size
// is set by SHIP_LENGTH : CHASE_DIST (render/scene.ts), not by absolute size, so
// the camera sits ~20 ship-lengths back while staying ≪ a body radius (the body
// still fills the view as a wall on arrival). Going smaller than ~1:300 would put
// the ship below the near plane → a dedicated ship near-camera layer (deferred).
export const SHIP_RADIUS = 0.000011;
export const SHIP_LENGTH = 0.00005;

// --- Throttle / speed (exploration-polish A) ---------------------------------
// Honest distances are large (the inner system spans ~700 u), so the throttle
// spans a wide dynamic range: very fine control onto a ~0.0085 u body up to a
// fast open-space cruise. Five exponential gears; input.throttle carries the
// chosen gear's MAX SPEED (scene u / sim-sec) — see systems/ship-movement.ts.
export const SPEED_GEAR_LABELS = ["DOCK", "SLOW", "CRUISE", "FAST", "MAX"] as const;
export type SpeedGear = 0 | 1 | 2 | 3 | 4;
const GEAR_MIN_SPEED = 0.004; // u/s at DOCK — nudge onto a small body
const GEAR_MAX_SPEED = 120;   // u/s at MAX — cross the ~700 u system in ~6 s

/** Max speed (scene u / sim-sec) for a throttle gear index. Pure, exponential. */
export function maxSpeedForGear(gear: number): number {
  const last = SPEED_GEAR_LABELS.length - 1;
  const t = Math.max(0, Math.min(last, gear)) / last;
  return GEAR_MIN_SPEED * Math.pow(GEAR_MAX_SPEED / GEAR_MIN_SPEED, t);
}
