// Terraforming pure helpers (Phase 3A) — gate logic + habitability stage.
//
// These take primitive physical values (not components) so both the deterministic
// sim and the UI can call them. Thresholds live in data/colony.ts (the balance
// source); stage definitions follow docs/11 §4.

import { ARMSTRONG_PA, FREEZING_K, ONE_ATM_PA } from "../data/colony.ts";

/** Coarse terraforming stage, distinct from the habitability-score label. */
export type TerraformStage = "Barren" | "Frozen" | "Marginal" | "Habitable";

export interface GateState {
  /** True when the lever cannot run yet. */
  locked: boolean;
  /** Specific unmet prerequisite(s) for the UI; empty when unlocked. */
  reason: string;
}

/**
 * Hydrosphere gate (docs/11 §2): a liquid hydrosphere needs pressure above the
 * Armstrong limit AND temperature above freezing. Returns the unmet condition(s)
 * spelled out, per the Legibility pillar (docs/01 §6).
 */
export function hydrosphereGate(pressurePa: number, surfaceTempK: number): GateState {
  const pressureOk = pressurePa > ARMSTRONG_PA;
  const tempOk = surfaceTempK > FREEZING_K;
  if (pressureOk && tempOk) return { locked: false, reason: "" };

  const parts: string[] = [];
  if (!pressureOk) {
    parts.push(`pressure ${(pressurePa / ONE_ATM_PA).toFixed(3)} < 0.062 atm`);
  }
  if (!tempOk) {
    parts.push(`temperature ${(surfaceTempK - FREEZING_K).toFixed(0)} °C < 0 °C`);
  }
  return { locked: true, reason: parts.join("; ") };
}

/**
 * Terraforming stage from the body's physical parameters (docs/11 §4 thresholds).
 *   Barren    — sub-Armstrong pressure: no atmosphere to retain, vacuum-like.
 *   Frozen    — atmosphere retained, below freezing, no liquid water.
 *   Marginal  — liquid water present, breathable-with-aids conditions.
 *   Habitable — near-Earth pressure and a 10–30 °C liquid-water world.
 *
 * The defining Barren condition is the inability to hold an atmosphere (pressure
 * below the Armstrong limit); a cold but atmosphere-bearing world is Frozen.
 */
export function terraformStage(
  pressurePa: number,
  surfaceTempK: number,
  hasLiquidWater: boolean,
): TerraformStage {
  const tempC = surfaceTempK - FREEZING_K;

  if (pressurePa < ARMSTRONG_PA) return "Barren";

  if (
    hasLiquidWater &&
    pressurePa >= 0.9 * ONE_ATM_PA &&
    tempC >= 10 &&
    tempC <= 30
  ) {
    return "Habitable";
  }

  if (hasLiquidWater && pressurePa >= 0.5 * ONE_ATM_PA && tempC > 0) {
    return "Marginal";
  }

  return "Frozen";
}
