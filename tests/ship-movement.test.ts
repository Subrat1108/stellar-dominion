// Tests for the ship movement system (Phase 1B).
//
// All tests run headless — no renderer, no DOM. The system is deterministic:
// same inputs and same initial state always produce the same result.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { step, run, type Input } from "../src/sim/loop.ts";
import { FIXED_DT } from "../src/sim/constants.ts";
import { orbitInsertionRadius } from "../src/sim/presentation.ts";

/** First star-orbiting rocky planet in the world, with its entity id + radius. */
function firstPlanet(world: ReturnType<typeof createStartingSystem>) {
  for (const [id, body] of world.components.celestialBody) {
    if (body.kind === "planet") return { id, body };
  }
  throw new Error("no planet");
}

/** Centre-to-centre distance from the ship to a body. */
function distToBody(world: ReturnType<typeof createStartingSystem>, bodyId: number): number {
  const s = world.components.transform.get(world.shipId)!.position;
  const b = world.components.transform.get(bodyId)!.position;
  return Math.hypot(s.x - b.x, s.y - b.y, s.z - b.z);
}

/** Build a full Input from a partial, defaulting the rest to neutral. */
function mk(partial: Partial<Input>): Input {
  return { thrust: 0, yaw: 0, pitch: 0, throttle: 1, ...partial };
}

function speed(world: ReturnType<typeof createStartingSystem>): number {
  const v = world.components.shipVelocity.get(world.shipId)!;
  return Math.hypot(v.vx, v.vy, v.vz);
}

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
    // Drag alone decays velocity to ~zero; ship started with zero velocity.
    expect(Math.abs(posAfter.x - posBefore.x)).toBeLessThan(0.001);
    expect(Math.abs(posAfter.y - posBefore.y)).toBeLessThan(0.001);
    expect(Math.abs(posAfter.z - posBefore.z)).toBeLessThan(0.001);
  });

  it("forward thrust moves ship in heading direction (+Z at heading=0)", () => {
    const world = createStartingSystem();
    const posZ0 = world.components.transform.get(world.shipId)!.position.z;

    for (let i = 0; i < 60; i++) step(world, mk({ thrust: 1 }));

    const pos = world.components.transform.get(world.shipId)!.position;
    expect(pos.z).toBeGreaterThan(posZ0);
    expect(Math.abs(pos.x)).toBeLessThan(0.001); // sin(0) = 0
    expect(Math.abs(pos.y)).toBeLessThan(0.001); // level pitch
  });

  it("right yaw (yaw=+1) decreases heading (steer right → world -X)", () => {
    const world = createStartingSystem();
    const h0 = world.components.shipControl.get(world.shipId)!.heading;

    step(world, mk({ yaw: 1 }));

    const h1 = world.components.shipControl.get(world.shipId)!.heading;
    expect(h1).toBeLessThan(h0);
    expect(h0 - h1).toBeCloseTo((Math.PI / 2) * FIXED_DT, 5);
  });

  it("left yaw (yaw=-1) increases heading the other way", () => {
    const world = createStartingSystem();
    const h0 = world.components.shipControl.get(world.shipId)!.heading;

    step(world, mk({ yaw: -1 }));

    expect(world.components.shipControl.get(world.shipId)!.heading).toBeGreaterThan(h0);
  });

  it("steering right then thrusting moves the ship to screen-right (world -X)", () => {
    // Convention: yaw>0 = steer right. In the flight camera screen-right maps to
    // world -X, so after a right turn + forward thrust the ship should gain -X.
    const world = createStartingSystem();
    const x0 = world.components.transform.get(world.shipId)!.position.x;

    for (let i = 0; i < 20; i++) step(world, mk({ yaw: 1 }));   // bank right
    for (let i = 0; i < 60; i++) step(world, mk({ thrust: 1 })); // drive forward

    expect(world.components.transform.get(world.shipId)!.position.x).toBeLessThan(x0);
  });

  it("pitch up raises the nose and forward thrust then gains altitude (+Y)", () => {
    const world = createStartingSystem();
    const y0 = world.components.transform.get(world.shipId)!.position.y;

    // Pitch up for a while, then thrust forward.
    for (let i = 0; i < 30; i++) step(world, mk({ pitch: 1 }));
    expect(world.components.shipControl.get(world.shipId)!.pitch).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) step(world, mk({ thrust: 1 }));

    expect(world.components.transform.get(world.shipId)!.position.y).toBeGreaterThan(y0);
  });

  it("pitch is clamped near vertical (never flips over the pole)", () => {
    const world = createStartingSystem();
    for (let i = 0; i < 600; i++) step(world, mk({ pitch: 1 }));
    const p = world.components.shipControl.get(world.shipId)!.pitch;
    expect(p).toBeLessThan(Math.PI / 2);
    expect(p).toBeGreaterThan(Math.PI / 2 - 0.1);
  });

  it("velocity is capped at the throttle's max speed (u/s)", () => {
    // Exploration-polish A: input.throttle now carries the gear's ABSOLUTE max
    // speed (u/s), not a multiplier on the component's base speed.
    const world = createStartingSystem();
    const cap = 2; // u/s
    for (let i = 0; i < 600; i++) step(world, mk({ thrust: 1, throttle: cap }));
    expect(speed(world)).toBeLessThanOrEqual(cap + 0.0001);
  });

  it("a higher throttle (gear max speed) raises the effective top speed", () => {
    const slow = createStartingSystem("throttle-a");
    const fast = createStartingSystem("throttle-a");
    for (let i = 0; i < 600; i++) step(slow, mk({ thrust: 1, throttle: 1 }));
    for (let i = 0; i < 600; i++) step(fast, mk({ thrust: 1, throttle: 10 }));
    expect(speed(fast)).toBeGreaterThan(speed(slow));
  });

  it("reverse thrust reduces speed before re-accelerating in reverse", () => {
    const world = createStartingSystem();
    for (let i = 0; i < 60; i++) step(world, mk({ thrust: 1 }));
    const peak = speed(world);
    for (let i = 0; i < 20; i++) step(world, mk({ thrust: -1 }));
    expect(speed(world)).toBeLessThan(peak);
  });

  it("manual input disables autopilot", () => {
    const world = createStartingSystem();
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.autopilotActive = true;
    ctrl.autopilotTargetId = 2;

    step(world, mk({ thrust: 1 }));

    expect(ctrl.autopilotActive).toBe(false);
  });

  it("orbit-hold keeps the ship at the insertion radius while the body drifts", () => {
    // Directly enter the orbit-hold state, then confirm the ship holds the
    // insertion altitude (velocity-matched) even as the body moves on its orbit.
    const world = createStartingSystem();
    const { id, body } = firstPlanet(world);
    const rIns = orbitInsertionRadius(body.renderRadius);
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.orbitingBodyId = id;
    ctrl.orbitAngle = 0;

    step(world, mk({}));
    expect(distToBody(world, id)).toBeCloseTo(rIns, 6);

    // Many ticks later the body has drifted, but the ship still holds the radius
    // (it would diverge if it weren't matching the body's velocity).
    for (let i = 0; i < 1200; i++) step(world, mk({}));
    expect(distToBody(world, id)).toBeCloseTo(rIns, 5);
    expect(ctrl.orbitAngle).toBeGreaterThan(0); // orbit advanced
    expect(ctrl.orbitingBodyId).toBe(id);
  });

  it("manual input breaks orbit-hold", () => {
    const world = createStartingSystem();
    const { id } = firstPlanet(world);
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.orbitingBodyId = id;
    ctrl.orbitAngle = 0;
    step(world, mk({ thrust: 1 }));
    expect(ctrl.orbitingBodyId).toBeUndefined();
  });

  it("autopilot inserts into orbit on arrival instead of stopping short", () => {
    const world = createStartingSystem();
    const { id, body } = firstPlanet(world);
    const rIns = orbitInsertionRadius(body.renderRadius);
    step(world, mk({})); // populate body transforms (orbitalSystem) before placing
    const bp = world.components.transform.get(id)!.position;
    // Park the ship just outside the insertion radius, pointed at the body (+z).
    const ship = world.components.transform.get(world.shipId)!;
    ship.position = { x: bp.x, y: bp.y, z: bp.z - rIns * 4 };
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.heading = 0; ctrl.pitch = 0;
    ctrl.autopilotActive = true;
    ctrl.autopilotTargetId = id;

    for (let i = 0; i < 1200 && ctrl.orbitingBodyId === undefined; i++) {
      step(world, mk({ throttle: 0.2 }));
    }
    expect(ctrl.orbitingBodyId).toBe(id);
    expect(ctrl.autopilotActive).toBe(false);
    // One more tick: orbit-hold snaps the ship to exactly the insertion radius
    // (a low orbit, not the far park point).
    step(world, mk({}));
    expect(distToBody(world, id)).toBeCloseTo(rIns, 6);
  });

  it("ship movement is deterministic", () => {
    const a = createStartingSystem("det-seed");
    const b = createStartingSystem("det-seed");
    const inputs = Array.from({ length: 120 }, (_, i) =>
      mk({
        thrust: i < 60 ? 1 : -1,
        yaw: i % 30 < 15 ? 0.5 : -0.5,
        pitch: i % 20 < 10 ? 0.3 : -0.3,
      }),
    );

    for (const inp of inputs) step(a, inp);
    for (const inp of inputs) step(b, inp);

    const posA = a.components.transform.get(a.shipId)!.position;
    const posB = b.components.transform.get(b.shipId)!.position;
    expect(posA.x).toBe(posB.x);
    expect(posA.y).toBe(posB.y);
    expect(posA.z).toBe(posB.z);
    expect(a.components.shipControl.get(a.shipId)!.heading).toBe(
      b.components.shipControl.get(b.shipId)!.heading,
    );
    expect(a.components.shipControl.get(a.shipId)!.pitch).toBe(
      b.components.shipControl.get(b.shipId)!.pitch,
    );
  });
});
