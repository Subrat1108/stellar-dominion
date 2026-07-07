// Tests for the pure autopilot flight-profile math (Polish B).

import { describe, it, expect } from "vitest";
import { approachSpeed, moveToward, thrustAccel, type ApproachParams } from "../src/sim/math/flight.ts";

describe("approachSpeed (two-phase, body-scaled)", () => {
  const P: ApproachParams = { cruise: 40, accel: 30, slowZoneMult: 50, slowRate: 8, minRate: 5 };
  const R = 0.01;
  const arrive = 4 * R; // 4 R, matching orbit insertion
  const slowZone = arrive + P.slowZoneMult * R;

  it("is zero at or inside the arrival radius", () => {
    expect(approachSpeed(arrive, arrive, R, P)).toBe(0);
    expect(approachSpeed(arrive * 0.5, arrive, R, P)).toBe(0);
  });

  it("is capped at cruise far out in open space", () => {
    expect(approachSpeed(700, arrive, R, P)).toBe(P.cruise);
  });

  it("decelerates to ~vSlow at the slow-zone edge", () => {
    const vSlow = P.slowRate * R;
    expect(approachSpeed(slowZone, arrive, R, P)).toBeCloseTo(vSlow, 9);
  });

  it("ramps down through the slow zone and never exceeds vSlow there", () => {
    const vSlow = P.slowRate * R;
    const edge = approachSpeed(slowZone - 1e-6, arrive, R, P);
    const mid = approachSpeed(arrive + (slowZone - arrive) * 0.5, arrive, R, P);
    expect(edge).toBeLessThanOrEqual(vSlow + 1e-9);
    expect(mid).toBeLessThan(edge);
    expect(mid).toBeGreaterThan(0);
  });

  it("floors at minRate·R near arrival so the ship actually gets there", () => {
    const floor = P.minRate * R;
    expect(approachSpeed(arrive + 1e-9, arrive, R, P)).toBeCloseTo(floor, 9);
  });

  it("scales the slow approach with body size (bigger body → faster, same time)", () => {
    // At the slow-zone edge the speed is slowRate·R — proportional to the body.
    const small = approachSpeed(arrive + P.slowZoneMult * R, arrive, R, P);
    const bigR = 0.05;
    const bigArrive = 4 * bigR;
    const big = approachSpeed(bigArrive + P.slowZoneMult * bigR, bigArrive, bigR, P);
    expect(big / small).toBeCloseTo(bigR / R, 6);
  });
});

describe("moveToward", () => {
  it("steps toward the target within the delta limit", () => {
    expect(moveToward(0, 10, 3)).toBe(3);
    expect(moveToward(10, 0, 3)).toBe(7);
  });

  it("snaps to the target when within the delta", () => {
    expect(moveToward(9, 10, 3)).toBe(10);
    expect(moveToward(10, 9, 3)).toBe(9);
  });
});

describe("thrustAccel (gradual manual acceleration, Polish C)", () => {
  const P = { accelMin: 6, accelMax: 60, rampSpeed: 40 };

  it("is the gentle floor at rest and the cruise value at/above rampSpeed", () => {
    expect(thrustAccel(0, P)).toBe(P.accelMin);
    expect(thrustAccel(P.rampSpeed, P)).toBe(P.accelMax);
    expect(thrustAccel(P.rampSpeed * 2, P)).toBe(P.accelMax); // clamped
  });

  it("ramps up monotonically with speed", () => {
    let prev = -Infinity;
    for (let s = 0; s <= 60; s += 5) {
      const a = thrustAccel(s, P);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it("is gentle at low speed and reaches ~half the cruise accel mid-ramp", () => {
    expect(thrustAccel(0, P)).toBeLessThan(thrustAccel(20, P));
    expect(thrustAccel(20, P)).toBeCloseTo((P.accelMin + P.accelMax) / 2, 5); // 20 = rampSpeed/2
  });

  it("held from rest, speed builds over ~1–2 s: gentle early, near cruise by ~3 s", () => {
    // Mirror the manual branch: semi-implicit Euler with speed-shaped accel + the
    // open-space drag (0.99/tick), fixed 1/60 s tick, thrust held (=1).
    const dt = 1 / 60, drag = 0.99, maxSpeed = 110;
    let v = 0;
    const sample: Record<string, number> = {};
    for (let tick = 1; tick <= 60 * 3; tick++) {
      const prev = v;
      v += thrustAccel(v, P) * dt;
      v *= drag;
      if (v > maxSpeed) v = maxSpeed;
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9); // monotonic build
      if (tick === 30) sample["0.5s"] = v;
      if (tick === 90) sample["1.5s"] = v;
      if (tick === 180) sample["3s"] = v;
    }
    // Gentle early (fine docking control), then builds to a healthy cruise that
    // keeps climbing toward the drag-limited terminal (~100 u/s) — no instant jump.
    expect(sample["0.5s"]!).toBeLessThan(15);
    expect(sample["1.5s"]!).toBeGreaterThan(2 * sample["0.5s"]!); // clearly accelerating
    expect(sample["3s"]!).toBeGreaterThan(45);                    // healthy cruise
    expect(sample["3s"]!).toBeLessThan(maxSpeed);                 // still building, not pinned
  });
});
