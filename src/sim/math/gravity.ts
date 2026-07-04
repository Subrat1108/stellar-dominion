// Deterministic patched-conic orbital gravity (Exploration Polish B).
//
// The "middle rung" (docs/09, Session 21): real patched-conic STRUCTURE — sphere
// of influence, a = μ/r² toward the body, v_circ = √(μ/r), v_esc = √(2μ/r) — but
// the gravitational parameter μ is a GAMEPLAY-TUNED scene-scale constant, NOT G·M.
// This is the sibling of the ship-is-an-avatar decision: at Polish-A honest scale
// a low orbit sits at ~0.01 scene units, where literal-SI gravity is ~1e-8 u/s²
// (imperceptible, no well, free escape). So we keep the honest structure and tune
// only the magnitude. Pure functions of state → deterministic (no n-body).

import { orbitInsertionRadius, ORBIT_RATE } from "../presentation.ts";

// Sphere of influence as a multiple of the body's (real) render radius. Inside
// it the ship feels the body; outside every SOI, gravity is zero (free cruise).
// 60× → an Earth-size world's SOI ≈ 0.5 u; the 4R insertion orbit, the 10R
// enter-orbit range, and the autopilot's ~54R slow-approach zone all sit inside
// it, so gravity is present through the whole close approach.
export const SOI_MULT = 60;

export function soiRadius(renderRadius: number): number {
  return renderRadius * SOI_MULT;
}

/**
 * Tuned scene-scale gravitational parameter for a body (NOT G·M — see docs/09).
 * Chosen so a low circular orbit at the insertion radius has angular rate
 * ORBIT_RATE, i.e. the analytic held orbit IS a true circular orbit and the
 * autopilot→manual handoff is seamless:  ω = √(μ/r³)  ⇒  μ = ω²·r³,
 * with r = orbitInsertionRadius(R). So μ ∝ R³ (bigger body → deeper well, same
 * low-orbit period) — legible; a real-mass-derived μ is a noted tuning follow-up.
 */
export function gravParameter(renderRadius: number): number {
  const r = orbitInsertionRadius(renderRadius);
  return ORBIT_RATE * ORBIT_RATE * r * r * r;
}

/** Circular orbital speed at radius r for gravitational parameter μ: √(μ/r). */
export function orbitalVelocity(mu: number, r: number): number {
  return r > 0 ? Math.sqrt(mu / r) : 0;
}

/** Escape speed at radius r: √(2μ/r) = √2 · v_circ. Leaving a well needs this. */
export function escapeVelocity(mu: number, r: number): number {
  return r > 0 ? Math.sqrt((2 * mu) / r) : 0;
}

/** A body as the gravity solver sees it: position + tuned μ + SOI radius. */
export interface GravBody {
  x: number;
  y: number;
  z: number;
  mu: number;
  soi: number;
}

export interface GravAccel {
  ax: number;
  ay: number;
  az: number;
  /** True if the ship is inside at least one body's SOI (feeling gravity). */
  inSOI: boolean;
}

/**
 * Net gravitational acceleration on the ship from every body whose SOI contains
 * it (superposed — in practice one dominates). Outside all SOIs → zero, so deep
 * space is a free arcade cruise. Pure: depends only on the positions + μ + SOI,
 * so semi-implicit integration on the fixed tick stays deterministic.
 */
export function gravityAccel(
  shipX: number,
  shipY: number,
  shipZ: number,
  bodies: readonly GravBody[],
): GravAccel {
  let ax = 0, ay = 0, az = 0, inSOI = false;
  for (const b of bodies) {
    const dx = b.x - shipX, dy = b.y - shipY, dz = b.z - shipZ;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 <= 0 || d2 >= b.soi * b.soi) continue; // outside this SOI (or coincident)
    inSOI = true;
    const d = Math.sqrt(d2);
    const a = b.mu / d2;      // magnitude, toward the body
    ax += (a * dx) / d;
    ay += (a * dy) / d;
    az += (a * dz) / d;
  }
  return { ax, ay, az, inSOI };
}
