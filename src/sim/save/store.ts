// Save/load persistence interface (docs/09, docs/13).
//
// A save is the universe SEED + player DELTAS (see serialize.ts) — the universe
// itself is regenerated from the seed, so saves stay tiny. The storage backend
// lives behind this small interface so it can be swapped without touching game
// code: flat JSON now (in-memory for tests/headless, localStorage in the
// browser); SQLite-WASM/OPFS is deferred until late-game data volume demands it.

import type { SavePayload } from "./serialize.ts";

export interface SaveStore {
  save(name: string, payload: SavePayload): Promise<void>;
  load(name: string): Promise<SavePayload | null>;
  list(): Promise<string[]>;
  remove(name: string): Promise<void>;
}

/** In-memory store — the default for tests and headless runs. */
export class MemorySaveStore implements SaveStore {
  private readonly slots = new Map<string, string>();

  async save(name: string, payload: SavePayload): Promise<void> {
    // Round-trip through JSON so the store behaves like a real serialised backend.
    this.slots.set(name, JSON.stringify(payload));
  }
  async load(name: string): Promise<SavePayload | null> {
    const raw = this.slots.get(name);
    return raw ? (JSON.parse(raw) as SavePayload) : null;
  }
  async list(): Promise<string[]> {
    return [...this.slots.keys()];
  }
  async remove(name: string): Promise<void> {
    this.slots.delete(name);
  }
}

/** Browser store backed by localStorage. Same flat-JSON shape. */
export class LocalStorageSaveStore implements SaveStore {
  constructor(private readonly prefix = "stellar-dominion:save:") {}

  async save(name: string, payload: SavePayload): Promise<void> {
    localStorage.setItem(this.prefix + name, JSON.stringify(payload));
  }
  async load(name: string): Promise<SavePayload | null> {
    const raw = localStorage.getItem(this.prefix + name);
    return raw ? (JSON.parse(raw) as SavePayload) : null;
  }
  async list(): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(this.prefix)) out.push(k.slice(this.prefix.length));
    }
    return out;
  }
  async remove(name: string): Promise<void> {
    localStorage.removeItem(this.prefix + name);
  }
}
