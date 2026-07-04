// Tests for the pure autopilot flight-profile math (Polish B).

import { describe, it, expect } from "vitest";
import { trapezoidalSpeed, moveToward } from "../src/sim/math/flight.ts";

describe("trapezoidalSpeed", () => {
  const CRUISE = 40;
  const ACCEL = 30;

  it("is zero at or inside the arrival radius", () => {
    expect(trapezoidalSpeed(5, 5, CRUISE, ACCEL)).toBe(0);
    expect(trapezoidalSpeed(3, 5, CRUISE, ACCEL)).toBe(0);
  });

  it("is capped at the cruise speed far from the target", () => {
    expect(trapezoidalSpeed(10000, 5, CRUISE, ACCEL)).toBe(CRUISE);
  });

  it("follows the √(2·a·d) deceleration bound in the braking zone", () => {
    const remaining = 4;
    const v = trapezoidalSpeed(5 + remaining, 5, CRUISE, ACCEL);
    expect(v).toBeCloseTo(Math.sqrt(2 * ACCEL * remaining), 12);
    expect(v).toBeLessThan(CRUISE); // still inside the braking zone
  });

  it("decreases monotonically as the ship nears the arrival radius", () => {
    const far = trapezoidalSpeed(10, 5, CRUISE, ACCEL);
    const mid = trapezoidalSpeed(7, 5, CRUISE, ACCEL);
    const near = trapezoidalSpeed(5.5, 5, CRUISE, ACCEL);
    expect(far).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(near);
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
