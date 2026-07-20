// Tests for the pure surface-appearance helpers (render/surface-appearance.ts,
// docs/17) — the bare-substrate palette used by the 2D map. Pure — no canvas/DOM.

import { describe, it, expect } from "vitest";
import {
  baseTileColor,
  altitudeShade,
  shade,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "../src/render/surface-appearance.ts";
import type { SurfaceTile, BaseTerrain, SurfaceResourceId } from "../src/sim/gen/surface.ts";

function tile(altitude: number, baseTerrain: BaseTerrain = "rock"): SurfaceTile {
  return { altitude, resources: [], baseTerrain };
}

const ALL_TERRAIN: BaseTerrain[] = ["rock", "regolith", "sand", "basalt", "ice", "lowland", "highland"];
const ALL_RESOURCES: SurfaceResourceId[] = ["metals", "rareMetals", "volatiles", "geothermal", "organics", "fissiles"];

describe("surface appearance — bare palette", () => {
  it("baseTileColor is deterministic", () => {
    expect(baseTileColor(tile(0.5))).toEqual(baseTileColor(tile(0.5)));
  });

  it("higher altitude reads brighter than lower (relief shading)", () => {
    const low = baseTileColor(tile(0.1));
    const high = baseTileColor(tile(0.9));
    const lum = (c: [number, number, number]) => c[0] + c[1] + c[2];
    expect(lum(high)).toBeGreaterThan(lum(low));
  });

  it("altitudeShade is monotonic in altitude", () => {
    expect(altitudeShade(0.9)).toBeGreaterThan(altitudeShade(0.1));
  });

  it("shade clamps to valid bytes (0–255)", () => {
    const c = shade([200, 200, 200], 5); // way over
    for (const ch of c) {
      expect(ch).toBeGreaterThanOrEqual(0);
      expect(ch).toBeLessThanOrEqual(255);
    }
  });

  it("every base terrain yields a valid rgb", () => {
    for (const bt of ALL_TERRAIN) {
      const c = baseTileColor(tile(0.5, bt));
      expect(c).toHaveLength(3);
      for (const ch of c) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });

  it("every resource has a glyph and a label", () => {
    for (const r of ALL_RESOURCES) {
      expect(RESOURCE_GLYPH[r]).toBeTruthy();
      expect(RESOURCE_LABEL[r]).toBeTruthy();
    }
  });
});
