// Valid map-click actions per body + player state (Exploration Polish C) — PURE.
//
// The unified map opens a detail popup on click; this decides which context
// actions that popup offers. It unifies the two gates that were previously split
// across SystemPanel (in-system flight actions) and SectorPanel (warp/scan), so
// the map, the (folding) panels, and the tests share ONE source of truth.
//
// No Three.js / DOM / ECS imports — a plain function of a context struct, so it
// is deterministic and unit-tested (tests/map-actions.test.ts).

/** The full set of actions the map popup can surface. */
export type MapAction =
  | "SET_COURSE"
  | "AUTOPILOT"
  | "ENTER_ORBIT"
  | "LAND"
  | "WARP"
  | "SCAN"
  | "GET_DETAILS";

/** Map zoom tier (superset of view-state's MapTier; galactic/intergalactic are
 *  the locked scaffold added in Polish C). */
export type MapActionTier = "intra" | "system" | "sector" | "galactic" | "intergalactic";

export interface BodyActionContext {
  /** Node classification: a body in the active system, a star SYSTEM node
   *  (sector tier), or a GALAXY scaffold node. */
  nodeKind: "star" | "planet" | "gas-giant" | "moon" | "system" | "galaxy";
  tier: MapActionTier;

  // --- Ship state (in-system bodies) ---
  landed: boolean;
  autopilotActive: boolean;
  /** The ship is currently holding orbit around THIS body. */
  orbitingHere: boolean;

  // --- Proximity (in-system bodies; scene units, centre-distance) ---
  distFromShip: number;
  landingRange: number;
  enterOrbitRange: number;

  // --- System nodes (sector tier) ---
  /** This node is the currently-active system (you are here). */
  isActiveSystem: boolean;
  /** Warp-reachable from the active system (distance test; ungated in god mode). */
  reachable: boolean;
  /** Coarse scan preview available (visited before, or scanned this session). */
  scanned: boolean;
  /** Permanently discovered (visited) — enables GET DETAILS. */
  visited: boolean;
  /** Locked scaffold (galaxy tier / not-yet-interactable) — no actions. */
  locked: boolean;
}

/**
 * The actions valid for a node given the current player + world state. Order is
 * stable (used directly for button order): flight actions, then WARP/SCAN, then
 * GET_DETAILS last.
 */
export function bodyActions(ctx: BodyActionContext): MapAction[] {
  // Locked scaffold (galaxy / intergalactic nodes) — inspect-only, no actions.
  if (ctx.locked || ctx.nodeKind === "galaxy") return [];

  // Star SYSTEM node (sector tier): warp / scan, never flight actions.
  if (ctx.nodeKind === "system") {
    if (ctx.isActiveSystem) return ctx.visited ? ["GET_DETAILS"] : [];
    if (!ctx.reachable) return [];
    if (ctx.landed) return []; // must take off before warping
    if (ctx.scanned) return ["WARP", "GET_DETAILS"];
    return ["SCAN"];
  }

  // A body in the active system. The star carries no flight actions (matches the
  // old SystemPanel, which hid them for the star).
  if (ctx.nodeKind === "star") return ["GET_DETAILS"];

  const out: MapAction[] = [];
  if (!ctx.landed) {
    out.push("SET_COURSE", "AUTOPILOT");
    if (!ctx.autopilotActive && !ctx.orbitingHere && ctx.distFromShip <= ctx.enterOrbitRange) {
      out.push("ENTER_ORBIT");
    }
    // LAND: rocky planets + moons within landing range (gas giants have no surface).
    if ((ctx.nodeKind === "planet" || ctx.nodeKind === "moon") && ctx.distFromShip <= ctx.landingRange) {
      out.push("LAND");
    }
  }
  out.push("GET_DETAILS");
  return out;
}
