// Shared landing state — which body (if any) the ship is currently landed on.
// A plain mutable ref (like view-state.ts) so non-React code can read it; it is
// kept in sync by main.ts from the sim's Landed / TookOff GameEvents. The UI
// reads it via useLandingState(), which also re-renders on those events.

import type { World } from "../sim/ecs/world.ts";

export const landingState: { landedBodyId: number | null } = { landedBodyId: null };

/**
 * Sync this ref from the ship's ACTUAL landedBodyId in `world`. Needed because
 * SurfaceView is gated on this ref, which is normally only updated by the
 * Landed/TookOff transition EVENTS (main.ts) — but a save reload restores the
 * sim STATE directly (ctrl.landedBodyId) without ever firing those events, so
 * the ref would otherwise stay stale/null even though the ship is landed,
 * leaving the player stuck with no TAKE OFF / colony UI. Call this once right
 * after building/restoring a world and BEFORE the first UI render.
 */
export function syncLandingStateFromWorld(world: World): void {
  const ctrl = world.components.shipControl.get(world.shipId);
  landingState.landedBodyId = ctrl?.landedBodyId ?? null;
}
