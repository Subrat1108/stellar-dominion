// "Peas in a pod" orbital spacing (Weiss et al. 2018, docs/13).
//
// Planets in a multi-planet system are most commonly spaced ~20 mutual Hill
// radii apart. Given an inner planet's orbit and the two bodies' masses, this
// solves for the next planet's semi-major axis in closed form, so the engine
// lays out a system outward from the innermost orbit deterministically.
//
// Mutual Hill radius (in units of semi-major axis):
//   R_H = ((m1 + m2) / (3 M*))^(1/3) · (a1 + a2)/2
// Spacing Δ = (a2 - a1) / R_H ≈ 20. Substituting and solving for a2:
//   a2 = a1 · (1 + b) / (1 - b),  where b = Δ·k/2,  k = ((m1+m2)/(3 M*))^(1/3)

import type { Rng } from "../math/rng.ts";
import { EARTH_MASSES_PER_SUN } from "./mass-radius.ts";

/** Mean mutual-Hill-radius spacing observed in Kepler multi-planet systems. */
export const MEAN_HILL_SPACING = 20;

/**
 * Semi-major axis (AU) of the next planet outward, given the inner planet's
 * axis and both masses (Earth masses) and the host star mass (solar masses).
 * `delta` is the spacing in mutual Hill radii (jittered around ~20 by callers).
 */
export function nextSemiMajorAxisAu(
  innerAxisAu: number,
  innerMassEarth: number,
  outerMassEarth: number,
  starMassSol: number,
  delta: number,
): number {
  const mSumSol = (innerMassEarth + outerMassEarth) / EARTH_MASSES_PER_SUN;
  const k = Math.cbrt(mSumSol / (3 * starMassSol));
  const b = (delta * k) / 2;
  // b < 1 always holds for realistic planet/star mass ratios; clamp for safety.
  const safeB = Math.min(0.9, b);
  return innerAxisAu * ((1 + safeB) / (1 - safeB));
}

/** A spacing value jittered around the observed mean (deterministic via rng). */
export function sampleHillSpacing(rng: Rng): number {
  return MEAN_HILL_SPACING + rng.range(-6, 8);
}

/** Innermost-orbit semi-major axis (AU), scaled by stellar mass (deterministic). */
export function sampleInnerAxisAu(rng: Rng, starMassSol: number): number {
  // Hotter/more massive stars push the inner edge out; cooler stars pull it in.
  const base = 0.04 * Math.cbrt(starMassSol / 0.95);
  return base * rng.range(0.7, 2.2);
}
