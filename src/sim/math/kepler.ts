// Analytic Kepler orbit solver.
//
// Per CLAUDE.md / docs/03: no live n-body. Each body carries orbital elements
// and its position is computed analytically from the simulation time. This is
// cheap, exact-enough, and fully deterministic.
//
// Phase 0 keeps the model 2D-in-a-plane (the ecliptic): inclination and node
// are omitted for now and added in a later phase when they matter. We still
// emit a 3D vector (y = 0) so the renderer and later phases share one type.

export interface OrbitalElements {
  /** Semi-major axis, in scene/AU units. */
  semiMajorAxis: number;
  /** Eccentricity, 0 = circle, <1 = ellipse. */
  eccentricity: number;
  /** Mean angular motion, radians per simulation second. */
  meanMotion: number;
  /** Mean anomaly at epoch (t = 0), radians. */
  meanAnomalyAtEpoch: number;
  /** Argument of periapsis, radians — rotates the ellipse in its plane. */
  argumentOfPeriapsis: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const TWO_PI = Math.PI * 2;

/** Normalise an angle into [0, 2π). */
function wrap(angle: number): number {
  const a = angle % TWO_PI;
  return a < 0 ? a + TWO_PI : a;
}

/**
 * Solve Kepler's equation  M = E - e·sin(E)  for the eccentric anomaly E,
 * using Newton–Raphson. Converges in a handful of iterations for e < ~0.9.
 * Fixed iteration count keeps the cost and the result bit-identical run to run.
 */
export function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  const m = wrap(meanAnomaly);
  let e = eccentricity < 0.8 ? m : Math.PI; // good initial guess
  for (let i = 0; i < 8; i++) {
    const f = e - eccentricity * Math.sin(e) - m;
    const fPrime = 1 - eccentricity * Math.cos(e);
    e -= f / fPrime;
  }
  return e;
}

/**
 * Position of an orbiting body at simulation time `t` (seconds), relative to
 * the focus (the parent body, e.g. the star) at the origin.
 */
export function positionAt(elements: OrbitalElements, t: number): Vec3 {
  const {
    semiMajorAxis: a,
    eccentricity: e,
    meanMotion: n,
    meanAnomalyAtEpoch: m0,
    argumentOfPeriapsis: w,
  } = elements;

  const meanAnomaly = m0 + n * t;
  const eccAnomaly = solveEccentricAnomaly(meanAnomaly, e);

  // Position in the orbital plane (periapsis along +x before rotation).
  const xOrbit = a * (Math.cos(eccAnomaly) - e);
  const yOrbit = a * Math.sqrt(1 - e * e) * Math.sin(eccAnomaly);

  // Rotate by argument of periapsis within the plane.
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);

  // Map the orbital plane onto the world XZ plane (y is "up" for the renderer).
  return {
    x: xOrbit * cosW - yOrbit * sinW,
    y: 0,
    z: xOrbit * sinW + yOrbit * cosW,
  };
}
