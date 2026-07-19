// Tests for persisted player settings (app/settings.ts) — the offline-
// progression pause toggle, separate from the save (survives New Game).

import { describe, it, expect, beforeEach } from "vitest";

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

describe("settings — offline-progression pause", () => {
  it("defaults to not-paused when nothing is stored", async () => {
    const { loadSettings } = await import("../src/app/settings.ts");
    expect(loadSettings().offlineProgressionPaused).toBe(false);
  });

  it("round-trips a saved setting", async () => {
    const { loadSettings, saveSettings } = await import("../src/app/settings.ts");
    saveSettings({ offlineProgressionPaused: true });
    expect(loadSettings().offlineProgressionPaused).toBe(true);
  });

  it("falls back to defaults on corrupt stored JSON (never throws)", async () => {
    const { loadSettings } = await import("../src/app/settings.ts");
    localStorage.setItem("stellar-dominion:settings", "{not json");
    expect(() => loadSettings()).not.toThrow();
    expect(loadSettings().offlineProgressionPaused).toBe(false);
  });

  it("survives being read after a save is cleared (settings ≠ save)", async () => {
    const { loadSettings, saveSettings } = await import("../src/app/settings.ts");
    saveSettings({ offlineProgressionPaused: true });
    // Simulate "New Game": only the save slot key would be removed, not settings.
    localStorage.removeItem("stellar-dominion:save:current");
    expect(loadSettings().offlineProgressionPaused).toBe(true);
  });
});
