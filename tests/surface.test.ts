// Tests for the deterministic surface generator (gen/surface.ts, docs/17):
// determinism (same seed → identical grid), altitude coherence + range, SPARSE
// clustered resources (a low absolute count, not scaled by area), the Fissiles
// tie-in to the strategic seed, and the tile→founding-modifier mapping. Pure —
// no world, no DOM.

import { describe, it, expect } from "vitest";
import {
  generateSurface,
  tileAt,
  tileToCandidateSite,
  tileModifiers,
  absLatitudeDeg,
  SURFACE_WIDTH,
  SURFACE_HEIGHT,
  type SurfaceGrid,
  type SurfaceResourceId,
} from "../src/sim/gen/surface.ts";
import { localStrategicResources } from "../src/sim/gen/strategic.ts";
import { siteModifiers } from "../src/sim/gen/sites.ts";
import type { CelestialBody } from "../src/sim/ecs/components.ts";

function body(overrides: Partial<CelestialBody> = {}): CelestialBody {
  return {
    kind: "planet", name: "Test World", renderRadius: 1, color: 0x888888, dataTag: "fictional",
    description: "", massKg: 5.97e24, radiusM: 6.37e6, surfaceTempK: 250, gravityMs2: 9.8,
    atmosphere: { pressurePa: 40_000, composition: "CO₂", toxicity: 0.2, hasLiquidWater: false },
    magnetosphere: 0.1, bodyKey: "hyg:1:0",
    ...overrides,
  };
}

function allResources(grid: SurfaceGrid): SurfaceResourceId[] {
  return grid.tiles.flatMap((t) => t.resources);
}
function tilesWithResources(grid: SurfaceGrid): number {
  return grid.tiles.filter((t) => t.resources.length > 0).length;
}

describe("surface generator — determinism", () => {
  it("same (universeSeed, body) → byte-identical grid", () => {
    const a = generateSurface("seed", body());
    const b = generateSurface("seed", body());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different bodyKey → different terrain", () => {
    const a = generateSurface("seed", body({ bodyKey: "hyg:1:0" }));
    const b = generateSurface("seed", body({ bodyKey: "hyg:1:1" }));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("different universe seed → different terrain", () => {
    const a = generateSurface("seed-a", body());
    const b = generateSurface("seed-b", body());
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("falls back to the body name when bodyKey is absent (still deterministic)", () => {
    const noKey = body({ name: "Nameless" });
    delete (noKey as { bodyKey?: string }).bodyKey;
    expect(JSON.stringify(generateSurface("s", noKey))).toBe(JSON.stringify(generateSurface("s", noKey)));
  });
});

describe("surface generator — grid + altitude", () => {
  it("produces a full 96×48 grid by default", () => {
    const g = generateSurface("dims", body());
    expect(g.width).toBe(SURFACE_WIDTH);
    expect(g.height).toBe(SURFACE_HEIGHT);
    expect(g.tiles.length).toBe(SURFACE_WIDTH * SURFACE_HEIGHT);
  });

  it("all altitudes are in [0,1]", () => {
    const g = generateSurface("alt", body());
    for (const t of g.tiles) {
      expect(t.altitude).toBeGreaterThanOrEqual(0);
      expect(t.altitude).toBeLessThanOrEqual(1);
    }
  });

  it("altitude is COHERENT, not white noise (neighbours are far more similar than random pairs)", () => {
    const g = generateSurface("coherent", body());
    // Mean abs diff between horizontal neighbours...
    let neighDiff = 0, neighN = 0;
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const a = tileAt(g, x, y).altitude;
        const b = tileAt(g, (x + 1) % g.width, y).altitude;
        neighDiff += Math.abs(a - b); neighN++;
      }
    }
    // ...vs. random far-apart pairs (half the map away).
    let randDiff = 0, randN = 0;
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const a = tileAt(g, x, y).altitude;
        const b = tileAt(g, (x + g.width / 2) % g.width, y).altitude;
        randDiff += Math.abs(a - b); randN++;
      }
    }
    expect(neighDiff / neighN).toBeLessThan((randDiff / randN) * 0.5);
  });

  it("row 0 is the north pole and the middle row is the equator", () => {
    expect(absLatitudeDeg(0, 48)).toBeGreaterThan(80);
    expect(absLatitudeDeg(24, 48)).toBeLessThan(5);
    expect(absLatitudeDeg(47, 48)).toBeGreaterThan(80);
  });
});

describe("surface generator — resources are SPARSE + CLUSTERED", () => {
  it("only a small fraction of tiles carry a resource (found, not sprinkled)", () => {
    const g = generateSurface("sparse", body());
    // Even worst-case (~14 deposits × up to 3 tiles) is well under 1% of 4608 tiles.
    expect(tilesWithResources(g)).toBeLessThan(g.tiles.length * 0.02);
  });

  it("the deposit count does NOT scale with grid area (a bigger grid ≠ more resources)", () => {
    const small = generateSurface("scale", body(), { width: 48, height: 24 });
    const large = generateSurface("scale", body(), { width: 192, height: 96 });
    // Absolute deposit counts are the same order regardless of area (± clustering).
    const smallCount = allResources(small).length;
    const largeCount = allResources(large).length;
    expect(largeCount).toBeLessThan(smallCount * 3); // NOT the 16× that area scaling would give
  });

  it("resources cluster into veins (a resourced tile usually has a same-resource neighbour)", () => {
    const g = generateSurface("cluster", body());
    let clustered = 0, resourced = 0;
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const t = tileAt(g, x, y);
        if (t.resources.length === 0) continue;
        resourced++;
        const neighbours: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const hasSameNeighbour = neighbours.some(([dx, dy]) => {
          const ny = y + dy; if (ny < 0 || ny >= g.height) return false;
          const nx = ((x + dx) % g.width + g.width) % g.width;
          return tileAt(g, nx, ny).resources.some((r) => t.resources.includes(r));
        });
        if (hasSameNeighbour) clustered++;
      }
    }
    // Most resourced tiles are part of a multi-tile vein (singletons exist but are the minority).
    expect(clustered).toBeGreaterThan(resourced * 0.4);
  });
});

describe("surface generator — Fissiles tie-in to the strategic seed", () => {
  it("Fissiles appear on the map IFF the body hosts them (localStrategicResources)", () => {
    // Scan many synthetic bodies; every one's map must agree with the strategic flag.
    for (let i = 0; i < 25; i++) {
      const b = body({ bodyKey: `hyg:9:${i}`, massKg: 5.97e24 * (1 + i * 0.2) });
      const hosts = localStrategicResources("u", b).fissiles;
      const onMap = allResources(generateSurface("u", b)).includes("fissiles");
      expect(onMap).toBe(hosts);
    }
  });
});

describe("surface generator — tile → founding modifiers", () => {
  it("tileToCandidateSite is deterministic and yields a valid CandidateSite bundle", () => {
    const g = generateSurface("mods", body());
    const a = tileToCandidateSite(g, 10, 24, body());
    const b = tileToCandidateSite(g, 10, 24, body());
    expect(a).toEqual(b);
    for (const k of ["insolationFactor", "volatileProximity", "slope", "radiation", "thermalInertia"] as const) {
      expect(a[k]).toBeGreaterThanOrEqual(0);
      expect(a[k]).toBeLessThanOrEqual(1);
    }
    expect(a.latitude).toBeGreaterThanOrEqual(0);
    expect(a.latitude).toBeLessThanOrEqual(90);
  });

  it("tileModifiers reuses the existing siteModifiers on the derived attributes", () => {
    const g = generateSurface("mods2", body());
    const derived = tileModifiers(g, 30, 24, body());
    const expected = siteModifiers(tileToCandidateSite(g, 30, 24, body()));
    expect(derived).toEqual(expected);
  });

  it("an equatorial tile has stronger solar than a polar tile (latitude drives insolation)", () => {
    const g = generateSurface("lat", body());
    const equator = tileToCandidateSite(g, 20, 24, body()).insolationFactor;
    const pole = tileToCandidateSite(g, 20, 0, body()).insolationFactor;
    expect(equator).toBeGreaterThan(pole);
  });
});
