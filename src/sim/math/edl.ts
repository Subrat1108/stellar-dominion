// Entry / Descent / Landing (EDL) viability — a LIGHT affordance (docs/14 §3).
//
// A pure classifier from a body's atmosphere + gravity into how hard it is to
// put heavy payloads on the surface. This is NOT a descent simulation: no risk,
// no failure, no minigame — just a legible read (vacuum / thin / nominal / thick)
// plus a `payloadFactor` that lightly nudges founding setup cost. It reinforces
// that worlds differ in HOW you get onto them (docs/15 §3), echoing real Mars-EDL
// difficulty (thin air is the worst case for landing heavy gear).

import type { CelestialBody } from "../ecs/components.ts";
import { ONE_ATM_PA } from "../data/colony.ts";

export type EdlClass = "vacuum" | "thin" | "nominal" | "thick";

export interface LandingViability {
  edlClass: EdlClass;
  /**
   * How favourable the descent is for heavy payloads, ~0.5–1.15 (higher = easier).
   * Thin atmospheres are the WORST (too little air to brake, enough to burn) —
   * lower than vacuum. Feeds a light founding-cost nudge; below 1 adds a little
   * setup cost, at/above 1 adds none.
   */
  payloadFactor: number;
  /** Human-readable one-liner for the landing UI. */
  note: string;
}

const EARTH_G = 9.80665;

/**
 * Classify a body's landing viability from atmospheric pressure + surface gravity.
 * Pure + deterministic. A missing atmosphere reads as vacuum; gravity above 1 g
 * makes any class a little harder (a small, bounded penalty).
 */
export function landingViability(body: CelestialBody): LandingViability {
  const pAtm = (body.atmosphere?.pressurePa ?? 0) / ONE_ATM_PA;
  const g = (body.gravityMs2 ?? EARTH_G) / EARTH_G;

  let edlClass: EdlClass;
  let base: number;
  let note: string;
  if (pAtm < 0.01) {
    edlClass = "vacuum";
    base = 0.9;
    note = "Vacuum — no aerobraking; heavy drops burn extra propellant.";
  } else if (pAtm < 0.3) {
    edlClass = "thin";
    base = 0.7;
    note = "Thin atmosphere — hard to land heavy payloads (a Mars-EDL problem).";
  } else if (pAtm < 3) {
    edlClass = "nominal";
    base = 1.0;
    note = "Nominal atmosphere — routine descent.";
  } else {
    edlClass = "thick";
    base = 1.05;
    note = "Thick atmosphere — heavy drops feasible but turbulent.";
  }

  // High gravity makes getting down (and back up) harder; small bounded penalty.
  const gPenalty = Math.max(0, g - 1) * 0.15;
  const payloadFactor = Math.max(0.5, Math.min(1.15, base - gPenalty));
  return { edlClass, payloadFactor, note };
}

/** Extra founding metals cost from a hostile EDL (0 when payloadFactor ≥ 1). */
export const EDL_SETUP_PENALTY = 30;
export function edlSetupCost(v: LandingViability): number {
  return Math.round(EDL_SETUP_PENALTY * Math.max(0, 1 - v.payloadFactor));
}
