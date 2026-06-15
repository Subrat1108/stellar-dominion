// Chen & Kipping (2017) probabilistic mass–radius relation (docs/13).
//
// Translates a generated planetary mass into a physically realistic radius
// across the empirical archetypes (Terran → Neptunian → Jovian). We use the
// median (deterministic) power-law fit, made piecewise-continuous so a body's
// radius — and therefore its surface gravity — never jumps at a regime boundary.
//
// All quantities here are in EARTH UNITS; callers convert to SI with the
// constants below. The relation is anchored at the Terran segment R ≈ 1.008·M^0.279.

export const R_EARTH_M = 6.371e6; // m
export const M_EARTH_KG = 5.972e24; // kg
export const M_SUN_KG = 1.989e30; // kg
/** Earth masses per solar mass — for Hill-radius spacing in solar units. */
export const EARTH_MASSES_PER_SUN = M_SUN_KG / M_EARTH_KG;

// Chen & Kipping (2017) fit: exponents per regime and the transition masses.
const C_TERRAN = 1.008;
const E_TERRAN = 0.279;
const E_NEPTUNIAN = 0.589;
const E_JOVIAN = -0.044;
const M_TERRAN_MAX = 2.04; // Earth masses
const M_NEPTUNIAN_MAX = 131.6; // Earth masses (≈ 0.41 Jupiter masses)

/**
 * Radius in Earth radii from mass in Earth masses (Chen & Kipping 2017 median).
 * Continuous across the Terran/Neptunian/Jovian transitions.
 */
export function radiusEarthFromMassEarth(massEarth: number): number {
  const m = Math.max(1e-4, massEarth);
  if (m <= M_TERRAN_MAX) return C_TERRAN * Math.pow(m, E_TERRAN);

  // Match the Neptunian segment to the Terran value at M_TERRAN_MAX.
  const rTerranMax = C_TERRAN * Math.pow(M_TERRAN_MAX, E_TERRAN);
  const cNeptunian = rTerranMax / Math.pow(M_TERRAN_MAX, E_NEPTUNIAN);
  if (m <= M_NEPTUNIAN_MAX) return cNeptunian * Math.pow(m, E_NEPTUNIAN);

  // Match the Jovian segment to the Neptunian value at M_NEPTUNIAN_MAX.
  const rNeptunianMax = cNeptunian * Math.pow(M_NEPTUNIAN_MAX, E_NEPTUNIAN);
  const cJovian = rNeptunianMax / Math.pow(M_NEPTUNIAN_MAX, E_JOVIAN);
  return cJovian * Math.pow(m, E_JOVIAN);
}

/** True once a body is massive enough to be treated as a gas giant (Neptunian+). */
export function isGiantMass(massEarth: number): boolean {
  return massEarth > M_TERRAN_MAX * 5; // ~10 Earth masses — runaway gas accretion
}
