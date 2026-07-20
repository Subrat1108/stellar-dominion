// Tests for the habitable climate skin (render/surface-appearance.ts, docs/17):
// the VISIBLE surface (water/vegetation/snow) derived from CURRENT planet state +
// tile altitude/latitude — habitable worlds render alive, hostile worlds bare,
// and terraforming (rising temp/hydrosphere) visibly changes the surface with no
// per-tile save state. Pure — no canvas/DOM.

import { describe, it, expect } from "vitest";
import {
  tileAppearance,
  planetClimateOf,
  type PlanetClimate,
} from "../src/render/surface-appearance.ts";
import { generateSurface, tileAt } from "../src/sim/gen/surface.ts";
import type { CelestialBody } from "../src/sim/ecs/components.ts";
import type { SurfaceGrid, SurfaceTile } from "../src/sim/gen/surface.ts";

function tile(altitude: number): SurfaceTile {
  return { altitude, resources: [], baseTerrain: "rock" };
}

function climate(over: Partial<PlanetClimate> = {}): PlanetClimate {
  return { surfaceTempK: 288, waterFraction: 0.4, pressurePa: 101_325, ...over };
}

/** Count ocean tiles across a grid for a given climate. */
function oceanCount(grid: SurfaceGrid, c: PlanetClimate): number {
  let n = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (tileAppearance(tileAt(grid, x, y), 0, c).kind === "ocean") n++;
    }
  }
  return n;
}

describe("climate skin — water derivation", () => {
  it("a low tile floods (ocean) on a temperate wet world; a high tile stays land", () => {
    const c = climate({ waterFraction: 0.5, surfaceTempK: 290 });
    expect(tileAppearance(tile(0.1), 0, c).kind).toBe("ocean");
    expect(tileAppearance(tile(0.9), 0, c).kind).not.toBe("ocean");
  });

  it("rising hydrosphere floods MORE tiles (the water line rises)", () => {
    const grid = generateSurface("water-rise", {
      kind: "planet", name: "W", renderRadius: 1, color: 0, dataTag: "fictional", description: "",
      massKg: 5.97e24, radiusM: 6.37e6, surfaceTempK: 290, gravityMs2: 9.8,
      atmosphere: { pressurePa: 101_325, composition: "N₂", toxicity: 0, hasLiquidWater: true },
      bodyKey: "hyg:1:0",
    });
    const low = oceanCount(grid, climate({ waterFraction: 0.2, surfaceTempK: 290 }));
    const high = oceanCount(grid, climate({ waterFraction: 0.6, surfaceTempK: 290 }));
    expect(high).toBeGreaterThan(low);
  });

  it("a dry world (waterFraction 0) has NO ocean tiles", () => {
    const grid = generateSurface("dry", {
      kind: "planet", name: "D", renderRadius: 1, color: 0, dataTag: "fictional", description: "",
      massKg: 5.97e24, radiusM: 6.37e6, surfaceTempK: 240, gravityMs2: 9.8,
      atmosphere: { pressurePa: 500, composition: "trace", toxicity: 0, hasLiquidWater: false },
      bodyKey: "hyg:1:1",
    });
    expect(oceanCount(grid, climate({ waterFraction: 0, surfaceTempK: 240, pressurePa: 500 }))).toBe(0);
  });

  it("submerged tiles below freezing read as ICE, not liquid ocean", () => {
    const c = climate({ waterFraction: 0.5, surfaceTempK: 250 });
    expect(tileAppearance(tile(0.1), 0, c).kind).toBe("ice");
  });

  it("water present but too thin/hot to be liquid → the basin reads bare, not ocean", () => {
    const c = climate({ waterFraction: 0.5, surfaceTempK: 290, pressurePa: 100 }); // sub-Armstrong
    expect(tileAppearance(tile(0.1), 0, c).kind).toBe("barren");
  });
});

describe("climate skin — land (vegetation / snow / bare)", () => {
  it("temperate wet land grows vegetation", () => {
    const c = climate({ waterFraction: 0.4, surfaceTempK: 293 });
    expect(tileAppearance(tile(0.6), 10, c).kind).toBe("vegetation");
  });

  it("high latitude / high altitude on a cool world reads as snow", () => {
    const cool = climate({ surfaceTempK: 276, waterFraction: 0.3 });
    expect(tileAppearance(tile(0.9), 20, cool).kind).toBe("snow"); // high altitude
    expect(tileAppearance(tile(0.5), 75, cool).kind).toBe("snow"); // high latitude
  });

  it("a hot dry world is entirely bare — no ocean, vegetation, or snow", () => {
    const grid = generateSurface("hot-dry", {
      kind: "planet", name: "H", renderRadius: 1, color: 0, dataTag: "fictional", description: "",
      massKg: 5.97e24, radiusM: 6.37e6, surfaceTempK: 480, gravityMs2: 9.8,
      atmosphere: { pressurePa: 50, composition: "trace", toxicity: 0.9, hasLiquidWater: false },
      bodyKey: "hyg:1:2",
    });
    const c = planetClimateOf(gridBody(480, 0, 50));
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        expect(tileAppearance(tileAt(grid, x, y), 0, c).kind).toBe("barren");
      }
    }
  });
});

describe("climate skin — terraforming visibly changes the surface + determinism", () => {
  it("warming a frozen ocean world turns submerged ICE into liquid OCEAN", () => {
    const frozen = climate({ waterFraction: 0.5, surfaceTempK: 250 });
    const warmed = climate({ waterFraction: 0.5, surfaceTempK: 290 });
    expect(tileAppearance(tile(0.2), 0, frozen).kind).toBe("ice");
    expect(tileAppearance(tile(0.2), 0, warmed).kind).toBe("ocean");
  });

  it("is deterministic (same tile + latitude + climate → same appearance)", () => {
    const c = climate();
    expect(tileAppearance(tile(0.3), 30, c)).toEqual(tileAppearance(tile(0.3), 30, c));
  });

  it("planetClimateOf reads live body fields (hydrosphere preferred over the liquid flag)", () => {
    const body = gridBody(290, undefined, 101_325);
    body.hydrosphere = 0.7;
    body.atmosphere!.hasLiquidWater = false; // hydrosphere should win
    expect(planetClimateOf(body).waterFraction).toBe(0.7);
  });
});

/** A minimal CelestialBody for climate extraction. */
function gridBody(surfaceTempK: number, hydrosphere: number | undefined, pressurePa: number): CelestialBody {
  const b: CelestialBody = {
    kind: "planet", name: "B", renderRadius: 1, color: 0, dataTag: "fictional", description: "",
    massKg: 5.97e24, radiusM: 6.37e6, surfaceTempK, gravityMs2: 9.8,
    atmosphere: { pressurePa, composition: "", toxicity: 0, hasLiquidWater: false },
    bodyKey: "hyg:1:9",
  };
  if (hydrosphere !== undefined) b.hydrosphere = hydrosphere;
  return b;
}
