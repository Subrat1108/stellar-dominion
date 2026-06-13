// Shared landing state — which body (if any) the ship is currently landed on.
// A plain mutable ref (like view-state.ts) so non-React code can read it; it is
// kept in sync by main.ts from the sim's Landed / TookOff GameEvents. The UI
// reads it via useLandingState(), which also re-renders on those events.

export const landingState: { landedBodyId: number | null } = { landedBodyId: null };
