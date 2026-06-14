// Physical helpers — real-unit calculations shared by sim systems and the UI.
//
// These are PHYSICS, not presentation: inputs and outputs are SI / real units.
// Surface gravity is the first use of "gravity as a gameplay stat" (docs/09,
// Session 10): a body's surface g feeds habitability and (Phase 2B) colony
// logic, and is shown on the landing view. It is NOT a flight force — ship
// flight stays arcade (thrust + drag); see the decision log.

/** Newtonian gravitational constant (m³ kg⁻¹ s⁻²). */
export const G = 6.6743e-11;

/** Standard Earth surface gravity (m/s²) used to express g relative to Earth. */
export const EARTH_G = 9.80665;

/** Surface gravity in m/s² from mass (kg) and radius (m): g = G·M / r². */
export function surfaceGravity(massKg: number, radiusM: number): number {
  if (radiusM <= 0) return 0;
  return (G * massKg) / (radiusM * radiusM);
}

/** Surface gravity expressed in Earth gravities (1.0 = Earth). */
export function surfaceGravityG(massKg: number, radiusM: number): number {
  return surfaceGravity(massKg, radiusM) / EARTH_G;
}

/**
 * Insolation (stellar flux) at a body, relative to Earth (Earth ≈ 1.0): the
 * inverse-square law S = L / r² with L in solar luminosities and r in AU. The
 * 4π of the physical S = L/(4πr²) cancels when expressed relative to Earth, so
 * this is directly a "fraction of Earth sunlight" used to scale solar output.
 */
export function insolation(luminositySol: number, orbitalDistanceAu: number): number {
  if (orbitalDistanceAu <= 0) return 0;
  return luminositySol / (orbitalDistanceAu * orbitalDistanceAu);
}
