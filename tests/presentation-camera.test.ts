// Camera-rig + depth invariants (Exploration Polish C, commit 4a).
//
// The "zoom into the ship" change moves the chase camera closer and drops the
// render near plane — WITHOUT changing honest scale. These pure assertions guard
// the relationships that keep the ship from clipping the near plane and keep the
// honest ship:body ratio intact, so a future feel-tweak can't silently break them.

import { describe, it, expect } from "vitest";
import {
  NEAR_PLANE, FAR_PLANE,
  CHASE_DIST, CHASE_HEIGHT, COCKPIT_FWD, CHASE_LOOK_AHEAD, CHASE_LOOK_UP,
  SHIP_LENGTH, SHIP_RADIUS,
  physicalRadiusToScene,
} from "../src/sim/presentation.ts";

const EARTH_RADIUS_M = 6.371e6;

describe("depth range", () => {
  it("near plane is a tiny positive value; far clears the starfield + galaxy tiers", () => {
    expect(NEAR_PLANE).toBeGreaterThan(0);
    expect(NEAR_PLANE).toBeLessThan(0.0001);
    expect(FAR_PLANE).toBeGreaterThan(6000);   // starfield shell ~4000–6000
    expect(FAR_PLANE).toBeGreaterThan(20000);  // intergalactic camera can sit ~9000 out
  });
});

describe("chase camera sits behind the ship without clipping the near plane", () => {
  it("the camera is farther back than the ship is long", () => {
    expect(CHASE_DIST).toBeGreaterThan(SHIP_LENGTH);
  });

  it("the ship's near face stays several × the near plane (no clip)", () => {
    const shipNearFace = CHASE_DIST - SHIP_LENGTH / 2;
    expect(shipNearFace).toBeGreaterThan(3 * NEAR_PLANE);
  });

  it("all rig offsets are positive (well-formed framing)", () => {
    for (const v of [CHASE_DIST, CHASE_HEIGHT, COCKPIT_FWD, CHASE_LOOK_AHEAD, CHASE_LOOK_UP]) {
      expect(v).toBeGreaterThan(0);
    }
  });

  it("the first-person camera sits nearer than the chase camera", () => {
    expect(COCKPIT_FWD).toBeLessThan(CHASE_DIST);
  });
});

describe("honest scale is preserved (camera-only change)", () => {
  it("the ship stays a tiny avatar, not an inflated body", () => {
    expect(SHIP_LENGTH).toBeLessThan(1e-4);
    expect(SHIP_RADIUS).toBeLessThan(SHIP_LENGTH);
  });

  it("the ship:Earth-radius ratio is honest (~1:400–1:700, unchanged)", () => {
    const ratio = SHIP_LENGTH / physicalRadiusToScene(EARTH_RADIUS_M);
    expect(ratio).toBeGreaterThan(1 / 700);
    expect(ratio).toBeLessThan(1 / 400);
  });
});
