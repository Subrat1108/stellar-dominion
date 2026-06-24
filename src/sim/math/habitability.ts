// Habitability scoring model (docs/04).
//
// Computes a 0–1 score from six real, measurable physical inputs.
// 0 = completely uninhabitable; 1 = perfect Earth-like garden world.
// The formula is intentionally coarse for Phase 1 — weights and curves
// can be tuned later once gameplay feedback is available.
//
// Weights (must sum to 1.0):
//   Habitable-zone / insolation  0.35  (most important — liquid water window)
//   Surface temperature          0.20
//   Gravity                      0.15
//   Atmosphere                   0.15
//   Liquid water                 0.10
//   Magnetosphere                0.05

const W_HZ   = 0.35;
const W_TEMP = 0.20;
const W_GRAV = 0.15;
const W_ATM  = 0.15;
const W_H2O  = 0.10;
const W_MAG  = 0.05;

/** Gaussian peak at `center`, half-width `sigma`. Returns 0–1. */
function gaussian(x: number, center: number, sigma: number): number {
  return Math.exp(-0.5 * ((x - center) / sigma) ** 2);
}

export interface HabitabilityInputs {
  /** Host star luminosity in solar luminosities. */
  luminositySol: number;
  /** Body's orbital distance from the host star, in AU. */
  orbitalDistanceAu: number;
  /** Mean surface temperature in Kelvin. */
  surfaceTempK: number;
  /** Surface gravity in m/s². Earth = 9.81. */
  gravityMs2: number;
  /** Atmospheric pressure in Pascals. Earth = 101 325. */
  atmospherePressurePa: number;
  /** Atmospheric toxicity: 0 = benign, 1 = instantly lethal. */
  atmosphereToxicity: number;
  /** Whether the body currently has liquid surface or shallow-subsurface water. */
  hasLiquidWater: boolean;
  /** Magnetosphere strength relative to Earth's: 0 = none, 1 = Earth-like+. */
  magnetosphere: number;
}

/**
 * Compute the habitability score for a body from its physical inputs.
 * The result is cached on the body's component at world-setup time and does
 * not change unless a terraforming action modifies the inputs.
 */
export function computeHabitability(inputs: HabitabilityInputs): number {
  const {
    luminositySol,
    orbitalDistanceAu,
    surfaceTempK,
    gravityMs2,
    atmospherePressurePa,
    atmosphereToxicity,
    hasLiquidWater,
    magnetosphere,
  } = inputs;

  // Insolation S = L / d² (Earth = 1.0 at 1 AU from the Sun).
  // Gaussian peaks at S=0.8 — gives margin on the inner edge of the HZ.
  // sigma = 0.35 so that ~0.36–1.6 insolation stays above 0.05.
  const insolation = luminositySol / (orbitalDistanceAu * orbitalDistanceAu);
  const hzFactor = gaussian(insolation, 0.8, 0.35);

  // Earth mean surface temperature ≈ 288 K (15 °C).
  // sigma = 35 K so that 220–360 K stays above 0.05.
  const tempFactor = gaussian(surfaceTempK, 288, 35);

  // Earth g = 9.81 m/s². Comfortable range: 5–15 m/s².
  const gravFactor = gaussian(gravityMs2, 9.81, 4.0);

  // Atmosphere: pressure Gaussian around Earth (101 325 Pa), sigma 60 000 Pa,
  // multiplied by (1 − toxicity) so a toxic atmosphere never reads as good.
  const pressureFactor = gaussian(atmospherePressurePa, 101_325, 60_000);
  const atmFactor = pressureFactor * (1 - atmosphereToxicity);

  const waterFactor = hasLiquidWater ? 1.0 : 0.0;

  const magFactor = Math.min(1.0, Math.max(0, magnetosphere));

  const raw =
    W_HZ   * hzFactor   +
    W_TEMP * tempFactor  +
    W_GRAV * gravFactor  +
    W_ATM  * atmFactor   +
    W_H2O  * waterFactor +
    W_MAG  * magFactor;

  return Math.max(0, Math.min(1, raw));
}

/** Human-readable stage label from a 0–1 score. */
export function habitabilityLabel(score: number): string {
  if (score >= 0.85) return "Garden World";
  if (score >= 0.65) return "Habitable";
  if (score >= 0.45) return "Near-Habitable";
  if (score >= 0.25) return "Marginal";
  if (score >= 0.10) return "Hostile";
  return "Barren";
}

/**
 * ESI tier LABEL for display only (docs/09, docs/12): a coarse banding derived
 * from the existing habitability score. ESI never competes with or overrides
 * `computeHabitability` — it is purely a UI tier readout (Prime → Dead).
 */
export function esiTierLabel(score: number): string {
  if (score >= 0.85) return "Prime";
  if (score >= 0.60) return "Marginal";
  if (score >= 0.30) return "Hostile";
  return "Dead";
}

/** CSS-safe colour string for a habitability score. */
export function habitabilityColor(score: number): string {
  if (score >= 0.65) return "#4caf50";
  if (score >= 0.45) return "#8bc34a";
  if (score >= 0.25) return "#ff9800";
  if (score >= 0.10) return "#f44336";
  return "#9e9e9e";
}
