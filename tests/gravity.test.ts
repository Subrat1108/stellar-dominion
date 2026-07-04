// Tests for the deterministic patched-conic gravity math (Polish B).
//
// Pure functions — the tuned-μ feel model keeps real patched-conic structure
// (SOI, μ/r², v_circ, v_esc). The key consistency property: a circular orbit at
// the insertion radius has exactly ORBIT_RATE angular rate, so the analytic held
// orbit is a true circular orbit and the autopilot→manual handoff is seamless.

import { describe, it, expect } from "vitest";
import {
  SOI_MULT,
  soiRadius,
  gravParameter,
  orbitalVelocity,
  escapeVelocity,
  gravityAccel,
} from "../src/sim/math/gravity.ts";
import { orbitInsertionRadius, ORBIT_RATE } from "../src/sim/presentation.ts";

describe("SOI + gravitational parameter", () => {
  it("soiRadius is a fixed multiple of the render radius", () => {
    expect(soiRadius(0.01)).toBeCloseTo(0.01 * SOI_MULT, 12);
    expect(soiRadius(0.05)).toBeCloseTo(0.05 * SOI_MULT, 12);
  });

  it("gravParameter is positive and grows with body size (∝ R³)", () => {
    const small = gravParameter(0.01);
    const big = gravParameter(0.02);
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(small);
    // insertion radius ∝ R, so μ = ω²·r³ ∝ R³ → doubling R multiplies μ by 8.
    expect(big / small).toBeCloseTo(8, 6);
  });
});

describe("orbital + escape velocity", () => {
  it("escape velocity is √2 × circular velocity", () => {
    const mu = gravParameter(0.01);
    const r = orbitInsertionRadius(0.01);
    expect(escapeVelocity(mu, r)).toBeCloseTo(Math.SQRT2 * orbitalVelocity(mu, r), 12);
  });

  it("seamless handoff: circular velocity at the insertion radius equals the held-orbit tangential speed", () => {
    // The held orbit advances at ORBIT_RATE, so its tangential speed is
    // ORBIT_RATE·r. For the manual force-orbit to continue it without falling in,
    // that must equal √(μ/r). gravParameter is derived to guarantee exactly this.
    for (const R of [0.008, 0.01, 0.05, 0.74]) {
      const r = orbitInsertionRadius(R);
      const vCirc = orbitalVelocity(gravParameter(R), r);
      expect(vCirc).toBeCloseTo(ORBIT_RATE * r, 12);
    }
  });
});

describe("gravityAccel", () => {
  const body = { x: 0, y: 0, z: 0, mu: gravParameter(0.01), soi: soiRadius(0.01) };

  it("is zero outside every SOI (free cruise)", () => {
    const far = body.soi * 2;
    const g = gravityAccel(far, 0, 0, [body]);
    expect(g.inSOI).toBe(false);
    expect(g.ax).toBe(0);
    expect(g.ay).toBe(0);
    expect(g.az).toBe(0);
  });

  it("points toward the body with magnitude μ/r² inside the SOI", () => {
    const r = body.soi * 0.5; // inside
    const g = gravityAccel(r, 0, 0, [body]); // ship at +x, body at origin
    expect(g.inSOI).toBe(true);
    expect(g.ax).toBeLessThan(0); // pulled back toward the body (−x)
    expect(g.ay).toBe(0);
    expect(g.az).toBe(0);
    expect(Math.abs(g.ax)).toBeCloseTo(body.mu / (r * r), 12);
  });

  it("superposes contributions from multiple bodies within their SOIs", () => {
    // Two identical bodies straddling the ship along x cancel the x-accel.
    const b1 = { ...body, x: -body.soi * 0.5 };
    const b2 = { ...body, x: body.soi * 0.5 };
    const g = gravityAccel(0, 0, 0, [b1, b2]);
    expect(g.inSOI).toBe(true);
    expect(g.ax).toBeCloseTo(0, 12);
  });
});
