// Tests for candidate landing-site generation (the landing arc, docs/14):
// determinism (same body seed → same sites), attribute ranges, and that body
// fields bias the sites. Pure — no world, no DOM.

import { describe, it, expect } from "vitest";
import { generateCandidateSites, CANDIDATE_SITE_COUNT } from "../src/sim/gen/sites.ts";
import { SURFACE_WIDTH, SURFACE_HEIGHT } from "../src/sim/gen/surface.ts";
import type { CelestialBody } from "../src/sim/ecs/components.ts";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { applyCommand } from "../src/sim/commands/apply.ts";
import { extractDeltas, reconstructWorld } from "../src/sim/save/serialize.ts";

function body(overrides: Partial<CelestialBody> = {}): CelestialBody {
  return {
    kind: "planet",
    name: "Test World",
    renderRadius: 1,
    color: 0x888888,
    dataTag: "fictional",
    description: "",
    massKg: 5.97e24,
    radiusM: 6.37e6,
    surfaceTempK: 250,
    gravityMs2: 9.8,
    atmosphere: { pressurePa: 20_000, composition: "CO₂", toxicity: 0.2, hasLiquidWater: false },
    magnetosphere: 0.1,
    bodyKey: "hyg:1:0",
    ...overrides,
  };
}

describe("candidate landing sites — determinism", () => {
  it("returns CANDIDATE_SITE_COUNT sites with sequential indices", () => {
    const sites = generateCandidateSites("seed", body());
    expect(sites.length).toBe(CANDIDATE_SITE_COUNT);
    expect(sites.map((s) => s.index)).toEqual([...Array(CANDIDATE_SITE_COUNT).keys()]);
  });

  it("same (universeSeed, body) → byte-identical sites", () => {
    const a = generateCandidateSites("seed", body());
    const b = generateCandidateSites("seed", body());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different bodyKey → different sites", () => {
    const a = generateCandidateSites("seed", body({ bodyKey: "hyg:1:0" }));
    const b = generateCandidateSites("seed", body({ bodyKey: "hyg:1:1" }));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("different universe seed → different sites", () => {
    const a = generateCandidateSites("seed-a", body());
    const b = generateCandidateSites("seed-b", body());
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("falls back to the body name when bodyKey is absent (still deterministic)", () => {
    const noKey = body({ name: "Nameless" });
    delete (noKey as { bodyKey?: string }).bodyKey;
    const a = generateCandidateSites("seed", noKey);
    const b = generateCandidateSites("seed", noKey);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.length).toBe(CANDIDATE_SITE_COUNT);
  });
});

describe("candidate landing sites — attribute ranges + body bias", () => {
  it("all attributes are in range (0–1 factors; latitude 0–90)", () => {
    for (const s of generateCandidateSites("ranges", body())) {
      for (const k of ["insolationFactor", "volatileProximity", "slope", "radiation", "thermalInertia"] as const) {
        expect(s[k]).toBeGreaterThanOrEqual(0);
        expect(s[k]).toBeLessThanOrEqual(1);
      }
      expect(s.latitude).toBeGreaterThanOrEqual(0);
      expect(s.latitude).toBeLessThanOrEqual(90);
      expect(typeof s.name).toBe("string");
    }
  });

  it("a wet world's sites are richer in volatiles than a dry world's (avg)", () => {
    const wet = body({ atmosphere: { pressurePa: 101_325, composition: "N₂/O₂", toxicity: 0, hasLiquidWater: true } });
    const dry = body({ surfaceTempK: 400, atmosphere: { pressurePa: 100, composition: "trace", toxicity: 0, hasLiquidWater: false } });
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const wetV = avg(generateCandidateSites("bias", wet).map((s) => s.volatileProximity));
    const dryV = avg(generateCandidateSites("bias", dry).map((s) => s.volatileProximity));
    expect(wetV).toBeGreaterThan(dryV);
  });

  it("a weakly-magnetised, thin-atmosphere world reads more irradiated than a shielded one (avg)", () => {
    const exposed = body({ magnetosphere: 0, atmosphere: { pressurePa: 500, composition: "trace", toxicity: 0, hasLiquidWater: false } });
    const shielded = body({ magnetosphere: 1, atmosphere: { pressurePa: 101_325, composition: "N₂", toxicity: 0, hasLiquidWater: false } });
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const exV = avg(generateCandidateSites("rad", exposed).map((s) => s.radiation));
    const shV = avg(generateCandidateSites("rad", shielded).map((s) => s.radiation));
    expect(exV).toBeGreaterThan(shV);
  });
});

describe("FoundColony records the chosen tile (the surface layer, docs/17)", () => {
  it("stores the selected tile on the colony and it survives a save round-trip", () => {
    const world = createStartingSystem("site-found");
    run(world, 120);
    const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
    world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
    const r = applyCommand(world, { kind: "FoundColony", bodyId, tile: { x: 12, y: 20 } });
    expect(r.ok).toBe(true);
    expect(world.components.colony.get(bodyId)!.tile).toEqual({ x: 12, y: 20 });

    const restored = reconstructWorld(extractDeltas(world));
    const restoredColony = [...restored.components.colony.values()][0]!;
    expect(restoredColony.tile).toEqual({ x: 12, y: 20 });
  });

  it("clamps an out-of-range tile to a valid grid coordinate", () => {
    const world = createStartingSystem("site-clamp");
    run(world, 120);
    const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
    world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
    applyCommand(world, { kind: "FoundColony", bodyId, tile: { x: 9999, y: -5 } });
    const tile = world.components.colony.get(bodyId)!.tile!;
    expect(tile.x).toBeGreaterThanOrEqual(0);
    expect(tile.x).toBeLessThan(SURFACE_WIDTH);
    expect(tile.y).toBeGreaterThanOrEqual(0);
    expect(tile.y).toBeLessThan(SURFACE_HEIGHT);
  });

  it("founding WITHOUT a tile (headless/legacy) still succeeds with neutral modifiers", () => {
    const world = createStartingSystem("no-tile");
    run(world, 120);
    const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
    world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
    expect(applyCommand(world, { kind: "FoundColony", bodyId }).ok).toBe(true);
    const colony = world.components.colony.get(bodyId)!;
    expect(colony.tile).toBeUndefined();
    expect(colony.solarEfficiency).toBe(1); // neutral
  });
});
