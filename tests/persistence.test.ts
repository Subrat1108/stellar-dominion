// Tests for local save persistence (app/persistence.ts) — the fix for the bug
// where the save SYSTEM existed but was never wired up, so every refresh
// silently regenerated a fresh universe. Exercises the real LocalStorageSaveStore
// against a minimal in-memory localStorage mock (this test env has no DOM).

import { describe, it, expect, beforeEach } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { foundColony } from "../src/sim/commands/colony.ts";
import { serializeWorld } from "../src/sim/ecs/world.ts";
import type { SavePayload } from "../src/sim/save/serialize.ts";
import { SAVE_VERSION } from "../src/sim/save/serialize.ts";
import type { World } from "../src/sim/ecs/world.ts";

class FakeLocalStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.has(key) ? this.map.get(key)! : null; }
  key(index: number): string | null { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new FakeLocalStorage();
});

/** A world with one founded colony (mirrors the pattern in save-migration.test.ts). */
function foundedWorld(seed = "persist-seed"): World {
  const world = createStartingSystem(seed);
  run(world, 120);
  const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
  world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
  if (!foundColony(world, bodyId).ok) throw new Error("found failed");
  return world;
}

describe("persistence — autosave + boot-load round-trip", () => {
  it("saveGame → loadGame → tryReconstruct resumes the exact played world", async () => {
    const { saveGame, loadGame, tryReconstruct } = await import("../src/app/persistence.ts");
    const world = foundedWorld();
    await saveGame(world);

    const loaded = await loadGame();
    expect(loaded).not.toBeNull();
    const restored = tryReconstruct(loaded!);
    expect(restored).not.toBeNull();
    expect(JSON.stringify(serializeWorld(restored!))).toBe(JSON.stringify(serializeWorld(world)));
  });

  it("stamps savedAtMs on save", async () => {
    const { saveGame, loadGame } = await import("../src/app/persistence.ts");
    const before = Date.now();
    await saveGame(foundedWorld());
    const loaded = await loadGame();
    expect(loaded!.savedAtMs).toBeGreaterThanOrEqual(before);
    expect(loaded!.savedAtMs).toBeLessThanOrEqual(Date.now());
  });

  it("loadGame returns null when no save exists yet", async () => {
    const { loadGame } = await import("../src/app/persistence.ts");
    expect(await loadGame()).toBeNull();
  });

  it("clearGame erases the current save slot (the explicit New Game reset)", async () => {
    const { saveGame, loadGame, clearGame } = await import("../src/app/persistence.ts");
    await saveGame(foundedWorld());
    expect(await loadGame()).not.toBeNull();
    await clearGame();
    expect(await loadGame()).toBeNull();
  });

  it("tryReconstruct falls back to null (never throws) on a newer-than-supported save", async () => {
    const { tryReconstruct } = await import("../src/app/persistence.ts");
    const bogus: SavePayload = {
      version: SAVE_VERSION + 1,
      universeSeed: "x",
      deltas: {
        meta: { tick: 0, time: 0, rngState: 0, nextId: 1, shipId: 1 },
        ship: {},
        activeSystemId: "hyg:8087",
        discovered: ["hyg:8087"],
        systems: [],
      },
    };
    expect(() => tryReconstruct(bogus)).not.toThrow();
    expect(tryReconstruct(bogus)).toBeNull();
  });

  it("tryReconstruct falls back to null on a structurally corrupt payload", async () => {
    const { tryReconstruct } = await import("../src/app/persistence.ts");
    const corrupt = { version: SAVE_VERSION, universeSeed: "x" } as unknown as SavePayload;
    expect(tryReconstruct(corrupt)).toBeNull();
  });
});
