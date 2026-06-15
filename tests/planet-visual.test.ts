// Tests for the property→appearance mapping (docs/13): bodyToVisualParams must
// be a PURE, DETERMINISTIC function of a body's state — same state → same look,
// and live state (hydrosphere, temperature, habitability, pressure) drives the
// visual parameters so terraforming visibly transforms the globe. The GLSL
// itself is not unit-tested; this guards the deterministic mapping it consumes.

import { describe, it, expect } from "vitest";
import { bodyToVisualParams } from "../src/render/planet-material.ts";
import type { CelestialBody } from "../src/sim/ecs/components.ts";

function planet(overrides: Partial<CelestialBody> = {}): CelestialBody {
  return {
    kind: "planet",
    name: "Test",
    bodyKey: "hyg:1:0",
    renderRadius: 5,
    color: 0x6a9e6a,
    dataTag: "fictional",
    description: "",
    massKg: 5.972e24,
    radiusM: 6.371e6,
    surfaceTempK: 255,
    gravityMs2: 9.81,
    atmosphere: { pressurePa: 101325, composition: "N₂", toxicity: 0.2, hasLiquidWater: false },
    magnetosphere: 0.5,
    habitability: 0.3,
    ...overrides,
  };
}

describe("bodyToVisualParams — purity + determinism", () => {
  it("is pure: identical body state → identical params", () => {
    const body = planet();
    expect(bodyToVisualParams(body)).toEqual(bodyToVisualParams(body));
  });

  it("derives a deterministic seed from the bodyKey", () => {
    const a = bodyToVisualParams(planet({ bodyKey: "hyg:1:0" }));
    const b = bodyToVisualParams(planet({ bodyKey: "hyg:1:1" }));
    expect(a.seed).toBe(bodyToVisualParams(planet({ bodyKey: "hyg:1:0" })).seed);
    expect(a.seed).not.toBe(b.seed);
    expect(a.seed).toBeGreaterThanOrEqual(0);
    expect(a.seed).toBeLessThan(1);
  });
});

describe("bodyToVisualParams — terraforming drives the look", () => {
  it("raises ocean coverage as the hydrosphere fills", () => {
    const dry = bodyToVisualParams(planet({ hydrosphere: 0.0 }));
    const wet = bodyToVisualParams(planet({ hydrosphere: 0.9 }));
    expect(wet.oceanLevel).toBeGreaterThan(dry.oceanLevel);
  });

  it("shrinks ice caps as the surface warms", () => {
    const frozen = bodyToVisualParams(planet({ surfaceTempK: 200 }));
    const temperate = bodyToVisualParams(planet({ surfaceTempK: 290 }));
    expect(temperate.iceLevel).toBeLessThan(frozen.iceLevel);
  });

  it("adds vegetation with habitability — but only when there is liquid water", () => {
    const lush = bodyToVisualParams(planet({ hydrosphere: 0.6, habitability: 0.8 }));
    const barren = bodyToVisualParams(planet({ hydrosphere: 0.0, habitability: 0.8 }));
    expect(lush.vegetation).toBeGreaterThan(0);
    expect(barren.vegetation).toBe(0);
  });

  it("scales atmospheric haze with pressure", () => {
    const thin = bodyToVisualParams(planet({ atmosphere: { pressurePa: 600, composition: "", toxicity: 0, hasLiquidWater: false } }));
    const thick = bodyToVisualParams(planet({ atmosphere: { pressurePa: 9_000_000, composition: "", toxicity: 1, hasLiquidWater: false } }));
    expect(thick.atmosphereDensity).toBeGreaterThan(thin.atmosphereDensity);
  });
});

describe("bodyToVisualParams — gas giants", () => {
  it("flags gas giants and gives them no ocean / ice / vegetation", () => {
    const p = bodyToVisualParams(planet({ kind: "gas-giant", hydrosphere: 0.9, habitability: 0.5 }));
    expect(p.isGasGiant).toBe(true);
    expect(p.oceanLevel).toBe(0);
    expect(p.iceLevel).toBe(0);
    expect(p.vegetation).toBe(0);
  });
});
