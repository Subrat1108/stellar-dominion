// Sanity checks on the analytic orbit solver. These pin down known geometric
// facts so a future "optimisation" of the math can't silently change orbits.

import { describe, it, expect } from "vitest";
import { solveEccentricAnomaly, positionAt, type OrbitalElements } from "../src/sim/math/kepler.ts";

const TWO_PI = Math.PI * 2;

describe("solveEccentricAnomaly", () => {
  it("is the identity when eccentricity is zero (circle: E == M)", () => {
    for (const m of [0, 0.5, 1, 3, 6]) {
      const e = solveEccentricAnomaly(m, 0);
      expect(e).toBeCloseTo(m % TWO_PI, 10);
    }
  });

  it("satisfies Kepler's equation M = E - e*sin(E)", () => {
    const M = 1.2;
    const ecc = 0.3;
    const E = solveEccentricAnomaly(M, ecc);
    expect(E - ecc * Math.sin(E)).toBeCloseTo(M, 10);
  });
});

describe("positionAt", () => {
  const circular: OrbitalElements = {
    semiMajorAxis: 10,
    eccentricity: 0,
    meanMotion: 1,
    meanAnomalyAtEpoch: 0,
    argumentOfPeriapsis: 0,
  };

  it("starts at periapsis on the +x axis at t=0", () => {
    const p = positionAt(circular, 0);
    expect(p.x).toBeCloseTo(10, 10);
    expect(p.y).toBe(0);
    expect(p.z).toBeCloseTo(0, 10);
  });

  it("stays on a circle of radius a for a circular orbit", () => {
    for (const t of [0.3, 1.1, 2.7, 5.0]) {
      const p = positionAt(circular, t);
      const r = Math.hypot(p.x, p.z);
      expect(r).toBeCloseTo(10, 8);
    }
  });

  it("returns to its start after one full period", () => {
    const period = TWO_PI / circular.meanMotion;
    const p0 = positionAt(circular, 0);
    const p1 = positionAt(circular, period);
    expect(p1.x).toBeCloseTo(p0.x, 8);
    expect(p1.z).toBeCloseTo(p0.z, 8);
  });

  it("places an eccentric orbit's periapsis closer than its apoapsis", () => {
    const ecc: OrbitalElements = { ...circular, eccentricity: 0.5 };
    const peri = positionAt(ecc, 0); // M=0 -> periapsis
    const apo = positionAt(ecc, (TWO_PI / ecc.meanMotion) / 2); // half period -> apoapsis
    const rPeri = Math.hypot(peri.x, peri.z);
    const rApo = Math.hypot(apo.x, apo.z);
    expect(rPeri).toBeCloseTo(10 * (1 - 0.5), 8); // a(1-e)
    expect(rApo).toBeCloseTo(10 * (1 + 0.5), 8); // a(1+e)
  });
});
