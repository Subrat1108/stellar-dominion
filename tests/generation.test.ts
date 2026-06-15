// Tests for the Step 1A content engine (docs/13): deterministic seeded
// generation, provenance tagging, real-body verbatim injection, and the
// scientific primitives (xxHash, Chen & Kipping mass–radius, Hill spacing).
// Headless — pure sim, no renderer.

import { describe, it, expect } from "vitest";
import { xxHashString, systemSeed } from "../src/sim/gen/hash.ts";
import { radiusEarthFromMassEarth } from "../src/sim/gen/mass-radius.ts";
import { nextSemiMajorAxisAu } from "../src/sim/gen/spacing.ts";
import { generateSystem } from "../src/sim/gen/system.ts";
import { starById, starByHd, catalogStars } from "../src/sim/gen/catalog.ts";
import { realSystemFor, TAU_CETI_HYG_ID } from "../src/sim/data/real-planets.ts";
import { ferrum, mira, glacius } from "../src/sim/data/tau-ceti.ts";

const tauCeti = () => starById(TAU_CETI_HYG_ID)!;

describe("xxHash32 + system seed", () => {
  it("is deterministic for the same input", () => {
    expect(xxHashString("hello")).toBe(xxHashString("hello"));
    expect(xxHashString("hello", 42)).toBe(xxHashString("hello", 42));
  });

  it("diverges on different input, seed, or coordinates", () => {
    expect(xxHashString("a")).not.toBe(xxHashString("b"));
    expect(xxHashString("a", 1)).not.toBe(xxHashString("a", 2));
    const base = { id: 1, x: 1, y: 2, z: 3 };
    expect(systemSeed("u", base)).not.toBe(systemSeed("u", { ...base, x: 1.0001 }));
    expect(systemSeed("u1", base)).not.toBe(systemSeed("u2", base));
  });

  it("returns an unsigned 32-bit integer", () => {
    const h = xxHashString("stellar-dominion");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe("Chen & Kipping mass–radius", () => {
  it("anchors near 1 Earth radius at 1 Earth mass", () => {
    expect(radiusEarthFromMassEarth(1)).toBeCloseTo(1.008, 2);
  });

  it("is monotonic increasing across the Terran/Neptunian regimes", () => {
    const masses = [0.1, 0.5, 1, 2, 5, 20, 80];
    for (let i = 1; i < masses.length; i++) {
      expect(radiusEarthFromMassEarth(masses[i]!)).toBeGreaterThan(
        radiusEarthFromMassEarth(masses[i - 1]!),
      );
    }
  });

  it("is continuous at the regime boundaries", () => {
    const eps = 1e-6;
    for (const M of [2.04, 131.6]) {
      const lo = radiusEarthFromMassEarth(M - eps);
      const hi = radiusEarthFromMassEarth(M + eps);
      expect(Math.abs(hi - lo)).toBeLessThan(1e-3);
    }
  });
});

describe("peas-in-a-pod spacing", () => {
  it("places the next planet farther out than the inner one", () => {
    const a2 = nextSemiMajorAxisAu(0.4, 1, 1, 0.95, 20);
    expect(a2).toBeGreaterThan(0.4);
  });
});

describe("catalog", () => {
  it("bundles the local neighborhood including Tau Ceti", () => {
    expect(catalogStars.length).toBeGreaterThan(50);
    const tc = starByHd(10700);
    expect(tc).toBeDefined();
    expect(tc!.id).toBe(TAU_CETI_HYG_ID);
    expect(tc!.spect?.startsWith("G")).toBe(true);
  });
});

describe("generateSystem — determinism", () => {
  it("same (seed, star) → byte-identical system", () => {
    const a = generateSystem("seed-x", tauCeti(), realSystemFor(TAU_CETI_HYG_ID));
    const b = generateSystem("seed-x", tauCeti(), realSystemFor(TAU_CETI_HYG_ID));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different seed changes the generated fill but never the real planets", () => {
    const a = generateSystem("seed-1", tauCeti(), realSystemFor(TAU_CETI_HYG_ID));
    const b = generateSystem("seed-2", tauCeti(), realSystemFor(TAU_CETI_HYG_ID));
    // Real planets (provenance real/derived) are identical across seeds.
    const realA = a.bodies.filter((x) => x.provenance !== "fictional").map((x) => x.body);
    const realB = b.bodies.filter((x) => x.provenance !== "fictional").map((x) => x.body);
    expect(JSON.stringify(realA)).toBe(JSON.stringify(realB));
    // The generated gas giant differs (mass/name/colour seeded).
    const giantA = a.bodies.find((x) => x.body.kind === "gas-giant")!.body;
    const giantB = b.bodies.find((x) => x.body.kind === "gas-giant")!.body;
    expect(giantA.massKg).not.toBe(giantB.massKg);
  });
});

describe("generateSystem — provenance + verbatim real bodies", () => {
  const system = generateSystem("tau-ceti-alpha", tauCeti(), realSystemFor(TAU_CETI_HYG_ID));

  it("tags the star real and gives every body a stable bodyKey", () => {
    expect(system.star.provenance).toBe("real");
    expect(system.star.body.bodyKey).toBe(`hyg:${TAU_CETI_HYG_ID}:star`);
    for (const gb of system.bodies) {
      expect(gb.body.bodyKey).toBe(gb.bodyKey);
      expect(gb.bodyKey.startsWith(`hyg:${TAU_CETI_HYG_ID}:`)).toBe(true);
    }
  });

  it("injects the real candidate planets verbatim (Ferrum/Mira/Glacius)", () => {
    const byName = new Map(system.bodies.map((b) => [b.body.name, b]));
    for (const real of [ferrum, mira, glacius]) {
      const gb = byName.get(real.name)!;
      expect(gb).toBeDefined();
      expect(gb.provenance).toBe(real.dataTag);
      expect(gb.body.surfaceTempK).toBe(real.surfaceTempK);
      expect(gb.body.massKg).toBe(real.massKg);
    }
  });

  it("generates only the gas giant + its moons (all fictional)", () => {
    const fictional = system.bodies.filter((b) => b.provenance === "fictional");
    expect(fictional.length).toBeGreaterThanOrEqual(3); // 1 giant + ≥2 moons
    const giants = fictional.filter((b) => b.body.kind === "gas-giant");
    expect(giants.length).toBe(1);
    const moons = fictional.filter((b) => b.parentKey === giants[0]!.bodyKey);
    expect(moons.length).toBeGreaterThanOrEqual(2);
    // No real/derived body was procedurally generated.
    expect(fictional.every((b) => b.body.kind === "gas-giant" || b.parentKey)).toBe(true);
  });
});
