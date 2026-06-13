// Habitability formula tests.
//
// These pin the formula's known behaviour so a future re-tuning can't silently
// break the model. They also serve as a sanity check that Earth-like inputs
// score high and extreme inputs (boiling hot, airless, irradiated) score low.

import { describe, it, expect } from "vitest";
import {
  computeHabitability,
  habitabilityLabel,
  type HabitabilityInputs,
} from "../src/sim/math/habitability.ts";

const EARTH_LIKE: HabitabilityInputs = {
  luminositySol: 1.0,
  orbitalDistanceAu: 1.0,
  surfaceTempK: 288,
  gravityMs2: 9.81,
  atmospherePressurePa: 101_325,
  atmosphereToxicity: 0,
  hasLiquidWater: true,
  magnetosphere: 1.0,
};

describe("computeHabitability", () => {
  it("Earth-like inputs score above 0.85 (garden world)", () => {
    const score = computeHabitability(EARTH_LIKE);
    expect(score).toBeGreaterThan(0.85);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("a scorching inner rock (Ferrum-like) scores below 0.20 (Hostile label)", () => {
    // Formula gives ~0.154: gravity is Earth-like so contributes, but temperature
    // and HZ factors are essentially zero. Confirmed "Hostile" classification.
    const score = computeHabitability({
      ...EARTH_LIKE,
      luminositySol: 0.488,
      orbitalDistanceAu: 0.20,
      surfaceTempK: 740,
      atmospherePressurePa: 900,
      atmosphereToxicity: 0.95,
      hasLiquidWater: false,
      magnetosphere: 0.05,
    });
    expect(score).toBeLessThan(0.20);
    expect(score).toBeGreaterThan(0); // not identically zero
  });

  it("a frozen outer world (Glacius-like) scores below 0.40 (Marginal label)", () => {
    // Formula gives ~0.32: good gravity and non-zero HZ factor push it into
    // "Marginal", which correctly reflects a terraforming-candidate frozen world.
    const score = computeHabitability({
      ...EARTH_LIKE,
      luminositySol: 0.488,
      orbitalDistanceAu: 1.35,
      surfaceTempK: 213,
      atmospherePressurePa: 28_000,
      atmosphereToxicity: 0.50,
      hasLiquidWater: false,
      magnetosphere: 0.18,
    });
    expect(score).toBeLessThan(0.40);
    expect(score).toBeGreaterThan(0.10);
  });

  it("a near-habitable world (Mira-like) scores between 0.30 and 0.80", () => {
    const score = computeHabitability({
      luminositySol: 0.488,
      orbitalDistanceAu: 0.65,
      surfaceTempK: 299,
      gravityMs2: 9.3,
      atmospherePressurePa: 52_000,
      atmosphereToxicity: 0.30,
      hasLiquidWater: true,
      magnetosphere: 0.42,
    });
    expect(score).toBeGreaterThan(0.30);
    expect(score).toBeLessThan(0.80);
  });

  it("a fully toxic atmosphere (toxicity=1) scores lower than the same world with a safe atmosphere", () => {
    // Toxicity multiplies the pressure factor to zero; safe atmosphere keeps it at 1.0.
    const withToxic = computeHabitability({ ...EARTH_LIKE, atmosphereToxicity: 1.0 });
    const withSafe  = computeHabitability({ ...EARTH_LIKE, atmosphereToxicity: 0.0 });
    expect(withToxic).toBeLessThan(withSafe);
    // The difference should be roughly the atm weight (0.15) × pressure factor (≈1.0)
    expect(withSafe - withToxic).toBeCloseTo(0.15, 1);
  });

  it("liquid water raises score by the water-factor weight (≈0.10)", () => {
    const dry = computeHabitability({ ...EARTH_LIKE, hasLiquidWater: false });
    const wet = computeHabitability({ ...EARTH_LIKE, hasLiquidWater: true });
    expect(wet - dry).toBeCloseTo(0.10, 5);
  });

  it("score is always in [0, 1]", () => {
    const extremes: HabitabilityInputs[] = [
      { ...EARTH_LIKE, surfaceTempK: 5000, atmosphereToxicity: 1, hasLiquidWater: false },
      { ...EARTH_LIKE, surfaceTempK: 0, atmospherePressurePa: 0 },
      EARTH_LIKE,
    ];
    for (const inputs of extremes) {
      const s = computeHabitability(inputs);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe("habitabilityLabel", () => {
  it("returns expected labels for boundary values", () => {
    expect(habitabilityLabel(0.90)).toBe("Garden World");
    expect(habitabilityLabel(0.70)).toBe("Habitable");
    expect(habitabilityLabel(0.50)).toBe("Near-Habitable");
    expect(habitabilityLabel(0.30)).toBe("Marginal");
    expect(habitabilityLabel(0.15)).toBe("Hostile");
    expect(habitabilityLabel(0.05)).toBe("Barren");
  });
});
