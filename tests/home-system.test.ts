// Tests for the home system produced THROUGH the content engine (Step 1A
// integration): every body gets a stable bodyKey, the universe seed is recorded
// for save reconstruction, and the real Tau Ceti candidates survive intact.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { glacius, mira } from "../src/sim/data/tau-ceti.ts";

describe("createStartingSystem — engine integration", () => {
  it("assigns bodyKeys to every celestial body in the world", () => {
    const world = createStartingSystem("key-check");
    for (const [, body] of world.components.celestialBody) {
      expect(body.bodyKey).toMatch(/^hyg:\d+:/);
    }
  });

  it("records the universe seed for save reconstruction", () => {
    const world = createStartingSystem("seed-record");
    expect(world.universeSeed).toBe("seed-record");
  });

  it("keeps the real candidate planets' tuning intact through the engine", () => {
    const world = createStartingSystem();
    const byName = new Map(
      [...world.components.celestialBody.values()].map((b) => [b.name, b]),
    );
    for (const real of [mira, glacius]) {
      const body = byName.get(real.name)!;
      expect(body).toBeDefined();
      expect(body.surfaceTempK).toBe(real.surfaceTempK);
      expect(body.dataTag).toBe(real.dataTag);
    }
  });

  it("includes a procedurally generated outer gas giant", () => {
    const world = createStartingSystem();
    const giants = [...world.components.celestialBody.values()].filter(
      (b) => b.kind === "gas-giant",
    );
    expect(giants.length).toBe(1);
    expect(giants[0]!.dataTag).toBe("fictional");
  });
});
