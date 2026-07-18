// Tests for the interdependence seed (docs/14 §5, docs/16): local strategic-
// resource (Fissiles) presence is a deterministic per-body flag, varies across
// bodies, and drives the "import-dependent" signal. Pure — no world, no DOM.

import { describe, it, expect } from "vitest";
import {
  localStrategicResources,
  isStrategicallyIncomplete,
  STRATEGIC_RESOURCES,
} from "../src/sim/gen/strategic.ts";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import type { CelestialBody } from "../src/sim/ecs/components.ts";

function planet(bodyKey: string, massKg = 5.97e24): CelestialBody {
  return {
    kind: "planet", name: bodyKey, renderRadius: 1, color: 0, dataTag: "fictional", description: "",
    massKg, radiusM: 6.37e6, gravityMs2: 9.8, bodyKey,
    atmosphere: { pressurePa: 50_000, composition: "", toxicity: 0, hasLiquidWater: false },
  };
}

describe("local strategic resources — the interdependence seed", () => {
  it("is deterministic (same universeSeed + body → same availability)", () => {
    const a = localStrategicResources("seed", planet("hyg:1:0"));
    const b = localStrategicResources("seed", planet("hyg:1:0"));
    expect(a).toEqual(b);
  });

  it("varies across bodies and across universe seeds", () => {
    // Over many synthetic bodies, presence is a genuine mix (not all / none).
    const flags = Array.from({ length: 40 }, (_, i) => localStrategicResources("u", planet(`hyg:1:${i}`)).fissiles);
    expect(flags.some((f) => f)).toBe(true);
    expect(flags.some((f) => !f)).toBe(true);
    // A different universe seed reshuffles which bodies host it.
    const other = Array.from({ length: 40 }, (_, i) => localStrategicResources("v", planet(`hyg:1:${i}`)).fissiles);
    expect(JSON.stringify(flags)).not.toBe(JSON.stringify(other));
  });

  it("gas giants never host a surface strategic source", () => {
    const giant = { ...planet("hyg:1:9"), kind: "gas-giant" as const };
    expect(localStrategicResources("seed", giant).fissiles).toBe(false);
  });

  it("isStrategicallyIncomplete is true exactly when no strategic resource is present", () => {
    expect(isStrategicallyIncomplete({ fissiles: false })).toBe(true);
    expect(isStrategicallyIncomplete({ fissiles: true })).toBe(false);
  });

  it("the home system is a genuine MIX — some worlds strategic, some import-dependent", () => {
    const world = createStartingSystem("strategic-home");
    const planets = [...world.components.celestialBody.values()].filter((b) => b.kind === "planet");
    const results = planets.map((b) => localStrategicResources(world.universeSeed, b).fissiles);
    // With several planets + moons, at least one should differ from the rest —
    // exploration reveals differentiated worlds (docs/15 §3), not a uniform field.
    expect(new Set(results).size).toBeGreaterThan(1);
    expect(STRATEGIC_RESOURCES).toContain("fissiles");
  });
});
