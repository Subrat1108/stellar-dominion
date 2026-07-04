// Exploration-polish A — pure presentation math: honest physical radii, the
// real-radius park distance, and the exponential throttle gear curve.

import { describe, it, expect } from "vitest";
import {
  physicalRadiusToScene,
  planetRenderRadius,
  gasGiantRenderRadius,
  starRenderRadius,
  parkDistance,
  PARK_RADIUS_MULT,
  maxSpeedForGear,
  SPEED_GEAR_LABELS,
  SHIP_LENGTH,
  orbitInsertionRadius,
  ORBIT_INSERTION_MULT,
  landingRange,
  softStopRadius,
  MIN_SURFACE_ALTITUDE,
} from "../src/sim/presentation.ts";

const NEAR_PLANE = 0.0002; // render near plane (render/scene.ts) — kept in sync here

const R_EARTH = 6.371e6;
const R_SUN = 6.957e8;

describe("physical body radii (honest scale)", () => {
  it("maps an Earth-radius world to ~0.0085 scene units (a small dot)", () => {
    expect(physicalRadiusToScene(R_EARTH)).toBeCloseTo(0.00852, 4);
  });

  it("maps Tau Ceti (0.793 R_sun) to ~0.74 scene units", () => {
    expect(physicalRadiusToScene(0.793 * R_SUN)).toBeCloseTo(0.7375, 3);
  });

  it("all body classes share the one honest factor (no inflation)", () => {
    const r = 3 * R_EARTH;
    expect(planetRenderRadius(r)).toBe(physicalRadiusToScene(r));
    expect(gasGiantRenderRadius(r)).toBe(physicalRadiusToScene(r));
    expect(starRenderRadius(r)).toBe(physicalRadiusToScene(r));
  });

  it("preserves the true ordering ship-radius << planet << gas giant << star", () => {
    const planet = planetRenderRadius(R_EARTH);          // ~0.0085
    const gasGiant = gasGiantRenderRadius(9 * R_EARTH);  // ~0.077
    const star = starRenderRadius(0.793 * R_SUN);        // ~0.74
    expect(planet).toBeLessThan(gasGiant);
    expect(gasGiant).toBeLessThan(star);
  });

  it("is linear in radius (proportions honest)", () => {
    expect(physicalRadiusToScene(2 * R_EARTH)).toBeCloseTo(
      2 * physicalRadiusToScene(R_EARTH),
      10,
    );
  });
});

describe("ship avatar scale (Session 20 fix)", () => {
  it("is a small fraction of an Earth-radius body (well under 1:10)", () => {
    const bodyR = planetRenderRadius(R_EARTH); // ~0.00835 u
    const ratio = SHIP_LENGTH / bodyR;         // length : radius
    expect(ratio).toBeLessThan(0.1); // well under 1:10
    expect(ratio).toBeGreaterThan(1 / 300); // not below the near-plane regime
  });
});

describe("parkDistance (real-radius framing)", () => {
  it("is a pure multiple of the render radius (no additive floor)", () => {
    expect(parkDistance(0.0085)).toBeCloseTo(0.0085 * PARK_RADIUS_MULT, 10);
    expect(parkDistance(0)).toBe(0);
  });

  it("frames any body at the same apparent size (scale-invariant ratio)", () => {
    // park / radius is constant → same fraction of the FOV regardless of size.
    expect(parkDistance(0.01) / 0.01).toBeCloseTo(parkDistance(5) / 5, 10);
  });

  it("parks outside the surface", () => {
    expect(parkDistance(0.0085)).toBeGreaterThan(0.0085);
  });
});

describe("orbitInsertionRadius (close, large-body low orbit)", () => {
  it("is a low multiple of the radius — close enough to read as a large curved world", () => {
    expect(orbitInsertionRadius(0.0085)).toBeCloseTo(0.0085 * ORBIT_INSERTION_MULT, 10);
    // ~1.8–3 R: close enough that the body is a big curved mass you can't take in
    // all at once (at 2 R the angular diameter is ~60°), not a small distant disc.
    expect(ORBIT_INSERTION_MULT).toBeGreaterThanOrEqual(1.8);
    expect(ORBIT_INSERTION_MULT).toBeLessThanOrEqual(3);
  });

  it("is landable — inside the landing range so you can LAND from orbit", () => {
    expect(orbitInsertionRadius(0.0085)).toBeLessThan(landingRange(0.0085));
  });

  it("clears the surface", () => {
    expect(orbitInsertionRadius(0.0085)).toBeGreaterThan(0.0085);
  });
});

describe("softStopRadius (near-plane-safe surface stop)", () => {
  it("always stays above the surface", () => {
    expect(softStopRadius(0.0085)).toBeGreaterThan(0.0085);
    expect(softStopRadius(0.0001)).toBeGreaterThan(0.0001);
  });

  it("scales proportionally (10% altitude) for large bodies", () => {
    const R = 0.74; // a star
    expect(softStopRadius(R)).toBeCloseTo(R * 1.1, 10); // floor doesn't bind
  });

  it("applies an absolute altitude floor for tiny bodies (no near-plane clip)", () => {
    const R = 0.001; // a small moon: 10% = 0.0001 < the floor
    const altitude = softStopRadius(R) - R;
    expect(altitude).toBeCloseTo(MIN_SURFACE_ALTITUDE, 10);
    // The floor keeps the camera clear of the near plane (it is several × larger).
    expect(altitude).toBeGreaterThan(NEAR_PLANE * 3);
  });
});

describe("maxSpeedForGear (exponential throttle)", () => {
  it("spans DOCK → MAX across the five gears", () => {
    expect(maxSpeedForGear(0)).toBeCloseTo(0.004, 6);
    expect(maxSpeedForGear(4)).toBeCloseTo(120, 4);
    expect(SPEED_GEAR_LABELS.length).toBe(5);
  });

  it("is strictly increasing across gears", () => {
    for (let g = 1; g < SPEED_GEAR_LABELS.length; g++) {
      expect(maxSpeedForGear(g)).toBeGreaterThan(maxSpeedForGear(g - 1));
    }
  });

  it("is geometric (constant ratio between adjacent gears)", () => {
    const r1 = maxSpeedForGear(1) / maxSpeedForGear(0);
    const r2 = maxSpeedForGear(2) / maxSpeedForGear(1);
    expect(r2).toBeCloseTo(r1, 6);
  });

  it("clamps out-of-range gear indices to the endpoints", () => {
    expect(maxSpeedForGear(-3)).toBe(maxSpeedForGear(0));
    expect(maxSpeedForGear(99)).toBe(maxSpeedForGear(4));
  });

  it("gives fine control near a body and a fast cruise at the top", () => {
    // DOCK crosses a ~0.0085 u body in a controllable few seconds...
    expect(0.0085 / maxSpeedForGear(0)).toBeGreaterThan(1);
    // ...MAX crosses the ~700 u system in under ~10 s.
    expect(700 / maxSpeedForGear(4)).toBeLessThan(10);
  });
});
