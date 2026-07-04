// Tests for the pure mouse/touchpad steering math (Polish B).
//
// No DOM here — pointerToSteering is a deterministic mapping from an accumulated
// pointer delta to the sim's yaw/pitch Input axes, so it is unit-tested directly.

import { describe, it, expect } from "vitest";
import { pointerToSteering } from "../src/app/steering.ts";

describe("pointerToSteering", () => {
  const SENS = 0.06;

  it("no delta → no steering", () => {
    const s = pointerToSteering(0, 0, SENS);
    expect(s.yaw).toBe(0);
    expect(s.pitch).toBe(0);
  });

  it("moving the pointer right steers right (yaw > 0)", () => {
    expect(pointerToSteering(5, 0, SENS).yaw).toBeGreaterThan(0);
  });

  it("moving the pointer left steers left (yaw < 0)", () => {
    expect(pointerToSteering(-5, 0, SENS).yaw).toBeLessThan(0);
  });

  it("moving the pointer up pitches the nose up (pitch > 0)", () => {
    // Screen-space +y is DOWN, so an up-motion has dy < 0 → pitch > 0.
    expect(pointerToSteering(0, -5, SENS).pitch).toBeGreaterThan(0);
  });

  it("moving the pointer down pitches the nose down (pitch < 0)", () => {
    expect(pointerToSteering(0, 5, SENS).pitch).toBeLessThan(0);
  });

  it("scales linearly with the delta below the clamp", () => {
    const a = pointerToSteering(2, 0, SENS).yaw;
    const b = pointerToSteering(4, 0, SENS).yaw;
    expect(b).toBeCloseTo(2 * a, 10);
  });

  it("clamps to the [-1, 1] Input contract for large deltas", () => {
    const big = pointerToSteering(10000, -10000, SENS);
    expect(big.yaw).toBe(1);
    expect(big.pitch).toBe(1);
    const bigNeg = pointerToSteering(-10000, 10000, SENS);
    expect(bigNeg.yaw).toBe(-1);
    expect(bigNeg.pitch).toBe(-1);
  });
});
