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

// --- Orbital insertion --------------------------------------------------------
// On arrival the autopilot settles into a LOW orbit at this multiple of the real
// radius (centre-distance). At 2 R the body subtends ~60° — a large, strongly
// CURVED body you cannot take in all at once (you're genuinely close, as in a
// real low orbit), not a small full disc floating far away (4 R read as "looking
// at a planet from afar"). Combined with the left framing bias it becomes a big
// curved world on the left with open space on the right, not a full-screen wall.
export const ORBIT_INSERTION_MULT = 2.0;
export function orbitInsertionRadius(renderRadius: number): number {
  return renderRadius * ORBIT_INSERTION_MULT;
}

// Orbit framing: face the body but bias the heading so the (large) body sits to
// the LEFT — its right limb near screen-centre, curving off the left/top/bottom —
// leaving open space on the right, clear of the system panel (radians; ~29°).
export const ORBIT_FRAME_YAW_BIAS = 0.5;

// --- Landing reach ------------------------------------------------------------
// A body is landable from within this centre-distance — larger than the orbit
// insertion radius so you can LAND straight out of a held low orbit (4R).
export const LANDING_REACH_MULT = 1.5;
export function landingRange(renderRadius: number): number {
  return orbitInsertionRadius(renderRadius) * LANDING_REACH_MULT;
}

// Low-orbit angular rate (rad / sim-sec). This is THE feel anchor for gravity
// (Polish B): the tuned gravitational parameter is derived so that a circular
// orbit at the insertion radius has exactly this rate (μ = ω²·r³ in math/gravity),
// which makes the analytic held orbit a TRUE circular orbit and the
// autopilot→manual handoff seamless. Set from a target low-orbit period: shorter
// period ⇒ deeper, more-felt well but a fast, unrealistic sweep around the body;
// longer ⇒ a calm, majestic orbit and a gentler well. 300 s is a very slow,
// stately orbit (~1.2°/s sweep); shorter periods felt like a spin.
export const LOW_ORBIT_PERIOD_S = 300;
export const ORBIT_RATE = (2 * Math.PI) / LOW_ORBIT_PERIOD_S;

// Orbit direction: −1 reverses the sweep (the default +1 read as "clockwise and
// backwards" in playtest). Applied to the angle advance AND the tangential
// velocity in the orbit hold, so position and velocity stay consistent.
export const ORBIT_DIRECTION = -1;

// Manual ENTER ORBIT is offered only within this centre-distance of a body, so
// the analytic insertion (which snaps to orbitInsertionRadius) is a small, gentle
// pull-in rather than a jarring jump from far away. 2.5 × 4R = 10R, comfortably
// INSIDE the sphere of influence (60R, math/gravity.ts) — so you are already
// feeling the well when you enter orbit.
export const ENTER_ORBIT_REACH_MULT = 2.5;
export function enterOrbitRange(renderRadius: number): number {
  return orbitInsertionRadius(renderRadius) * ENTER_ORBIT_REACH_MULT;
}

// --- Soft-surface stop (Session 20 fix) --------------------------------------
// Manual flight is stopped this far from a body's centre. Proportional to the
// real radius (10% altitude) with an ABSOLUTE altitude floor so the render near
// plane (0.0002 u) can never cut into the surface and make it look transparent —
// even for tiny bodies where 10% of the radius would be sub-near-plane. The
// floor (0.0008 u) is ~4× the near plane, covering the cockpit camera offset too.
// Autopilot orbit-hold bypasses this (it holds the insertion altitude directly).
export const SURFACE_MARGIN_FRAC = 0.1;
export const MIN_SURFACE_ALTITUDE = 0.0008;
export function softStopRadius(renderRadius: number): number {
  return renderRadius + Math.max(renderRadius * SURFACE_MARGIN_FRAC, MIN_SURFACE_ALTITUDE);
}

// --- Ship (a player AVATAR, not a physical body) -----------------------------
// A literally-to-scale ship would be ~1e-7 u (sub-near-plane, unrenderable in one
// camera). It stays a small but visible mote, sized WELL UNDER the body radius so
// it reads as a tiny craft, not a co-equal object (Session 20 fix): at 0.00005 u
// it is ~1:167 of an Earth-radius world (0.00835 u). Its apparent on-screen size
// is set by SHIP_LENGTH : CHASE_DIST (render/scene.ts), not by absolute size, so
// the camera sits ~20 ship-lengths back while staying ≪ a body radius (the body
// still fills the view as a wall on arrival). Going smaller than ~1:300 would put
// the ship below the near plane → a dedicated ship near-camera layer (deferred).
// Shrunk further (Polish B feedback): the ship reads as a tiny craft — smaller
// than a ring ice-chunk or small asteroid — against a planet ~470× its length.
// The camera rig (render/scene.ts) is unchanged, so at CHASE_DIST the ship now
// subtends ~0.9° (was ~2.9°): a small speck ahead, for a dramatic sense of scale.
export const SHIP_RADIUS = 0.0000034;
export const SHIP_LENGTH = 0.000015;

// --- Camera rig + depth range (Polish C, "zoom into the ship") ----------------
// These live here (with the other avatar/scale knobs) so they are one tunable
// place and unit-testable without the renderer. The ship stays honestly scaled
// (SHIP_LENGTH above, ~1:470 of a planet); to make it READ as a real craft we
// bring the third-person camera CLOSER (CHASE_DIST) rather than inflating the
// ship. Because a close honest-scale ship sits near the render near plane, the
// near plane is dropped in lock-step (NEAR_PLANE); the logarithmic depth buffer
// keeps the huge near→far range from z-fighting. CHASE_DIST is THE feel knob;
// the height/look-at offsets are proportional so the framing angle is preserved.
//
// Invariant (tested): the ship's near face (CHASE_DIST − SHIP_LENGTH/2) stays
// several × NEAR_PLANE so it never clips; a true hero-shot beyond this needs the
// deferred dedicated ship near-camera layer (2-pass render).
export const NEAR_PLANE = 0.00002; // render near plane (was 0.0002 pre-Polish-C)
export const FAR_PLANE  = 60000;   // clears the ~700 u system, starfield + galaxy tiers
export const CHASE_DIST      = 0.0001;    // scene units behind the ship (THE knob)
export const CHASE_HEIGHT    = 0.00004;   // scene units above the ship
export const COCKPIT_FWD     = 0.0000125; // first-person camera just ahead of the nose
export const CHASE_LOOK_AHEAD = 0.000118; // chase look-at point ahead of the ship
export const CHASE_LOOK_UP    = 0.0000175; // chase look-at point raised slightly

// --- Thrust / speed (control redesign, Session 21) ---------------------------
// The speed GEARS are gone: W accelerates and the ship builds up speed over time
// toward MAX_SPEED (thrust + light drag), S decelerates/reverses, A/D strafe.
// THRUST_ACCEL sets how fast it builds; with the open-space drag the ship
// naturally settles near MAX_SPEED after a few seconds of holding W (honest
// distances are large, so the top speed crosses the ~700 u system in ~7 s).
// THRUST_ACCEL is the CRUISE (top-end) acceleration; manual thrust now RAMPS to
// it from a gentler floor (Polish C, math/flight.thrustAccel) so a held press
// builds speed over ~1–2 s and stays controllable for docking, instead of
// jumping to high speed instantly. THRUST_ACCEL_MIN = the at-rest floor;
// THRUST_RAMP_SPEED = the speed at which the acceleration reaches THRUST_ACCEL.
export const THRUST_ACCEL = 60;      // scene u/s² — cruise (top-end) acceleration
export const THRUST_ACCEL_MIN = 6;   // scene u/s² — gentle acceleration at rest
export const THRUST_RAMP_SPEED = 40; // scene u/s — speed where accel reaches the max
export const MAX_SPEED = 110;   // scene u/s hard cap (drag settles a touch below)
