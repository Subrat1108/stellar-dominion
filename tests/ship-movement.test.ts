// Tests for the ship movement system (Phase 1B).
//
// All tests run headless — no renderer, no DOM. The system is deterministic:
// same inputs and same initial state always produce the same result.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { step, run, type Input } from "../src/sim/loop.ts";
import { FIXED_DT } from "../src/sim/constants.ts";
import { orbitInsertionRadius, MAX_SPEED } from "../src/sim/presentation.ts";

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
  return { thrust: 0, strafe: 0, yaw: 0, pitch: 0, ...partial };
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

  it("velocity is capped at MAX_SPEED (no gears)", () => {
    const world = createStartingSystem();
    for (let i = 0; i < 1200; i++) step(world, mk({ thrust: 1 }));
    expect(speed(world)).toBeLessThanOrEqual(MAX_SPEED + 0.0001);
  });

  it("W builds up speed over time (accelerates toward the cap, not instant)", () => {
    const world = createStartingSystem();
    for (let i = 0; i < 6; i++) step(world, mk({ thrust: 1 }));
    const early = speed(world);
    for (let i = 0; i < 120; i++) step(world, mk({ thrust: 1 }));
    const later = speed(world);
    expect(later).toBeGreaterThan(early); // still building up
    expect(early).toBeLessThan(MAX_SPEED * 0.5); // not instantly at the cap
  });

  it("A/D strafe moves the ship sideways without changing heading", () => {
    const world = createStartingSystem();
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.heading = 0; ctrl.pitch = 0; // nose +Z; right vector = -X
    const h0 = ctrl.heading;
    const p0 = { ...world.components.transform.get(world.shipId)!.position };
    for (let i = 0; i < 30; i++) step(world, mk({ strafe: 1 })); // D = right
    const p1 = world.components.transform.get(world.shipId)!.position;
    expect(ctrl.heading).toBe(h0);              // no rotation from strafing
    expect(Math.abs(p1.x - p0.x)).toBeGreaterThan(0.001); // moved along X (sideways)
    expect(Math.abs(p1.z - p0.z)).toBeLessThan(Math.abs(p1.x - p0.x)); // mostly lateral
  });

  it("reverse thrust reduces speed before re-accelerating in reverse", () => {
    const world = createStartingSystem();
    for (let i = 0; i < 60; i++) step(world, mk({ thrust: 1 }));
    const peak = speed(world);
    for (let i = 0; i < 20; i++) step(world, mk({ thrust: -1 }));
    expect(speed(world)).toBeLessThan(peak);
  });

  it("thrust is LOCKED during autopilot — manual input does not cancel it", () => {
    // Polish B control model: while autopilot is engaged, player thrust/steer is
    // IGNORED (not a cancel — you leave via a CancelCourse command). Autopilot
    // stays active and the ship keeps steering toward its target.
    const world = createStartingSystem();
    const { id } = firstPlanet(world);
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.autopilotActive = true;
    ctrl.autopilotTargetId = id;

    step(world, mk({ thrust: 1, yaw: 1, pitch: 1 }));

    expect(ctrl.autopilotActive).toBe(true); // NOT cancelled by manual input
  });

  it("manual thrust in autopilot does not drive the ship (input ignored)", () => {
    // With autopilot flying to a body, forcing a manual BRAKE + wrong yaw must be
    // discarded — the scripted autopilot still closes on the target.
    const world = createStartingSystem();
    const { id } = firstPlanet(world);
    step(world); // place bodies
    const bp = world.components.transform.get(id)!.position;
    const ship = world.components.transform.get(world.shipId)!;
    ship.position = { x: bp.x, y: bp.y, z: bp.z - 5 }; // 5 u short, facing +z
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.heading = 0; // nose +z, toward the body
    ctrl.autopilotActive = true;
    ctrl.autopilotTargetId = id;
    const before = distToBody(world, id);
    for (let i = 0; i < 120; i++) step(world, mk({ thrust: -1, strafe: 1, yaw: 1 }));
    // Manual "brake + turn away" is ignored; the autopilot closes the distance.
    expect(distToBody(world, id)).toBeLessThan(before);
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
    expect(ctrl.orbitAngle).not.toBe(0); // orbit advanced (direction-agnostic)
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
      step(world, mk({}));
    }
    expect(ctrl.orbitingBodyId).toBe(id);
    expect(ctrl.autopilotActive).toBe(false);
    // One more tick: orbit-hold snaps the ship to exactly the insertion radius
    // (a low orbit, not the far park point).
    step(world, mk({}));
    expect(distToBody(world, id)).toBeCloseTo(rIns, 6);
  });

  it("autopilot reliably spirals into orbit from an arbitrary start (no hovering)", () => {
    // Regression: with velocity-matching the ship used to station-keep just
    // OUTSIDE the arrival radius and never insert. The spiral + capture band must
    // reliably reach a stable orbit from an off-axis start with a wrong heading.
    const world = createStartingSystem();
    step(world);
    const { id, body } = firstPlanet(world);
    const rIns = orbitInsertionRadius(body.renderRadius);
    const bp = world.components.transform.get(id)!.position;
    const ship = world.components.transform.get(world.shipId)!;
    ship.position = { x: bp.x + 30, y: bp.y + 2, z: bp.z - 25 };
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.heading = 2.0; ctrl.pitch = 0.3; // NOT aimed at the body
    ctrl.autopilotActive = true;
    ctrl.autopilotTargetId = id;
    ctrl.autopilotSpeed = 0;

    let inserted = false;
    for (let i = 0; i < 3000 && !inserted; i++) {
      step(world, mk({}));
      if (ctrl.orbitingBodyId !== undefined) inserted = true;
    }
    expect(inserted).toBe(true);
    expect(ctrl.autopilotActive).toBe(false);
    // Holds a stable orbit at the insertion radius for a while (no drift out).
    let minD = Infinity, maxD = 0;
    for (let i = 0; i < 600; i++) {
      step(world, mk({}));
      const d = distToBody(world, id);
      minD = Math.min(minD, d); maxD = Math.max(maxD, d);
    }
    expect(minD).toBeCloseTo(rIns, 4);
    expect(maxD).toBeCloseTo(rIns, 4);
  });

  it("manual flight feels gravity inside a body's SOI (falls toward the star)", () => {
    // The star sits at the sim origin and never drifts, so gravity pull is clean.
    const world = createStartingSystem();
    step(world);
    const ship = world.components.transform.get(world.shipId)!;
    ship.position = { x: 5, y: 0, z: 0 }; // inside the star's SOI (~8.9 u)
    const vel = world.components.shipVelocity.get(world.shipId)!;
    vel.vx = 0; vel.vy = 0; vel.vz = 0;
    const before = Math.hypot(ship.position.x, ship.position.y, ship.position.z);
    for (let i = 0; i < 300; i++) step(world, mk({})); // no thrust — only gravity
    const after = Math.hypot(ship.position.x, ship.position.y, ship.position.z);
    expect(after).toBeLessThan(before);                        // pulled inward
    expect(Math.hypot(vel.vx, vel.vy, vel.vz)).toBeGreaterThan(0); // gained speed
  });

  it("open space applies drag (arcade auto-stop) outside every SOI", () => {
    const world = createStartingSystem();
    const ship = world.components.transform.get(world.shipId)!;
    ship.position = { x: 0, y: 0, z: 2000 }; // far outside all SOIs → no gravity
    const vel = world.components.shipVelocity.get(world.shipId)!;
    vel.vx = 0.5; vel.vy = 0; vel.vz = 0;
    const s0 = Math.hypot(vel.vx, vel.vy, vel.vz);
    for (let i = 0; i < 60; i++) step(world, mk({})); // coast, no thrust
    expect(Math.hypot(vel.vx, vel.vy, vel.vz)).toBeLessThan(s0); // drag decays it
  });

  it("gravity flight is deterministic (same state twice)", () => {
    function runOnce() {
      const w = createStartingSystem("grav-det");
      step(w);
      const ship = w.components.transform.get(w.shipId)!;
      ship.position = { x: 5, y: 0.3, z: 0 }; // inside the star SOI
      const v = w.components.shipVelocity.get(w.shipId)!;
      v.vx = 0.01; v.vy = 0; v.vz = 0.02;
      for (let i = 0; i < 200; i++) step(w, mk({ thrust: i % 2 ? 1 : 0 }));
      return { ...w.components.transform.get(w.shipId)!.position };
    }
    const a = runOnce();
    const b = runOnce();
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.z).toBe(b.z);
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
