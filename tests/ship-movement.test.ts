// Tests for the ship movement system (Phase 1B).
//
// All tests run headless — no renderer, no DOM. The system is deterministic:
// same inputs and same initial state always produce the same result.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { step, run } from "../src/sim/loop.ts";
import { FIXED_DT } from "../src/sim/constants.ts";

describe("ship movement system", () => {
  it("ship entity has transform, shipVelocity, and shipControl after world setup", () => {
    const world = createStartingSystem();
    expect(world.components.transform.get(world.shipId)).toBeDefined();
    expect(world.components.shipVelocity.get(world.shipId)).toBeDefined();
    expect(world.components.shipControl.get(world.shipId)).toBeDefined();
  });

  it("ship does not move when no input is applied", () => {
    const world = createStartingSystem();
    const posBefore = { ...world.components.transform.get(world.shipId)!.position };

    run(world, 60); // 1 real second

    const posAfter = world.components.transform.get(world.shipId)!.position;
    // Drag alone decays velocity to ~zero; ship started with zero velocity so position is stable.
    expect(Math.abs(posAfter.x - posBefore.x)).toBeLessThan(0.001);
    expect(Math.abs(posAfter.z - posBefore.z)).toBeLessThan(0.001);
  });

  it("forward thrust moves ship in heading direction (+Z at heading=0)", () => {
    const world = createStartingSystem();
    const posZ0 = world.components.transform.get(world.shipId)!.position.z;

    // Apply full forward thrust for 60 ticks.
    for (let i = 0; i < 60; i++) step(world, { thrust: 1, yaw: 0 });

    const posZ1 = world.components.transform.get(world.shipId)!.position.z;
    expect(posZ1).toBeGreaterThan(posZ0);
    // X should be virtually unchanged (heading = 0 → sin(0) = 0).
    expect(Math.abs(world.components.transform.get(world.shipId)!.position.x)).toBeLessThan(0.001);
  });

  it("right yaw rotates heading clockwise (heading increases)", () => {
    const world = createStartingSystem();
    const ctrl0 = world.components.shipControl.get(world.shipId)!;
    const h0 = ctrl0.heading;

    step(world, { thrust: 0, yaw: 1 });

    const h1 = world.components.shipControl.get(world.shipId)!.heading;
    expect(h1).toBeGreaterThan(h0);
    expect(h1 - h0).toBeCloseTo(Math.PI / 2 * FIXED_DT, 5);
  });

  it("left yaw rotates heading counter-clockwise (heading decreases)", () => {
    const world = createStartingSystem();
    const h0 = world.components.shipControl.get(world.shipId)!.heading;

    step(world, { thrust: 0, yaw: -1 });

    const h1 = world.components.shipControl.get(world.shipId)!.heading;
    expect(h1).toBeLessThan(h0);
  });

  it("velocity is capped at maxSpeed", () => {
    const world = createStartingSystem();
    const maxSpeed = world.components.shipVelocity.get(world.shipId)!.maxSpeed;

    // Apply maximum thrust for a long time.
    for (let i = 0; i < 600; i++) step(world, { thrust: 1, yaw: 0 });

    const vel = world.components.shipVelocity.get(world.shipId)!;
    const speed = Math.sqrt(vel.vx * vel.vx + vel.vz * vel.vz);
    expect(speed).toBeLessThanOrEqual(maxSpeed + 0.0001);
  });

  it("reverse thrust (braking) reduces speed before re-accelerating in reverse", () => {
    const world = createStartingSystem();

    // Build up speed in +Z.
    for (let i = 0; i < 60; i++) step(world, { thrust: 1, yaw: 0 });
    const speedPeak = Math.sqrt(
      world.components.shipVelocity.get(world.shipId)!.vx ** 2 +
      world.components.shipVelocity.get(world.shipId)!.vz ** 2,
    );

    // Brake for a short burst — should reduce speed before reversing.
    for (let i = 0; i < 20; i++) step(world, { thrust: -1, yaw: 0 });
    const speedMidBrake = Math.sqrt(
      world.components.shipVelocity.get(world.shipId)!.vx ** 2 +
      world.components.shipVelocity.get(world.shipId)!.vz ** 2,
    );

    expect(speedMidBrake).toBeLessThan(speedPeak);
  });

  it("manual input disables autopilot", () => {
    const world = createStartingSystem();
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.autopilotActive = true;
    ctrl.autopilotTargetId = 2;

    step(world, { thrust: 1, yaw: 0 });

    expect(ctrl.autopilotActive).toBe(false);
  });

  it("ship movement is deterministic", () => {
    const a = createStartingSystem("det-seed");
    const b = createStartingSystem("det-seed");
    const inputs = Array.from({ length: 120 }, (_, i) => ({
      thrust: i < 60 ? 1 : -1,
      yaw: i % 30 < 15 ? 0.5 : -0.5,
    }));

    for (const inp of inputs) step(a, inp);
    for (const inp of inputs) step(b, inp);

    const posA = a.components.transform.get(a.shipId)!.position;
    const posB = b.components.transform.get(b.shipId)!.position;
    expect(posA.x).toBe(posB.x);
    expect(posA.z).toBe(posB.z);
    expect(a.components.shipControl.get(a.shipId)!.heading).toBe(
      b.components.shipControl.get(b.shipId)!.heading,
    );
  });
});
