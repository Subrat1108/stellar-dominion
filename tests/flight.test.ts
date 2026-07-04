// Tests for the pure autopilot flight-profile math (Polish B).

import { describe, it, expect } from "vitest";
import { approachSpeed, moveToward, type ApproachParams } from "../src/sim/math/flight.ts";

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
