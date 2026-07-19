// Local save persistence — autosave + boot load/new-game. This is the LOCAL
// rung of the online ladder (docs/15 §6): a single local "current game" slot
// behind the existing swappable SaveStore interface, which later swaps
// local→server for save-sync without touching game code. No accounts, no
// login, no multiple named slots — all deferred (docs/15).
//
// This closes the bug where the save SYSTEM existed (serialize/migrate/
// SaveStore, all tested) but was never wired up, so every refresh silently
// regenerated a fresh universe. Autosaves on a timer AND on state-changing
// GameEvents (debounced) AND best-effort on page hide, so a refresh resumes.

import type { World } from "../sim/ecs/world.ts";
import { extractDeltas, reconstructWorld, type SavePayload } from "../sim/save/serialize.ts";
import { LocalStorageSaveStore } from "../sim/save/store.ts";

const SLOT = "current";
const store = new LocalStorageSaveStore();

/** Persist the world's current deltas, stamped with the save wall-clock time
 *  (offline progression on next load measures elapsed real time from this). */
export async function saveGame(world: World): Promise<void> {
  const payload: SavePayload = { ...extractDeltas(world), savedAtMs: Date.now() };
  await store.save(SLOT, payload);
}

/** Load the current save payload, if any. Null if no save exists yet. */
export async function loadGame(): Promise<SavePayload | null> {
  return store.load(SLOT);
}

/** Erase the current save (explicit "New Game" / reset — never called implicitly). */
export async function clearGame(): Promise<void> {
  await store.remove(SLOT);
}

/**
 * Try to reconstruct a world from a stored payload. NEVER throws: a corrupt or
 * unsupported (newer-than-this-build) save falls back to `null` so the caller
 * can start a fresh game instead of crashing boot — bad saves are a UX notice,
 * not a hard failure.
 */
export function tryReconstruct(payload: SavePayload): World | null {
  try {
    return reconstructWorld(payload);
  } catch (err) {
    console.warn("[save] failed to load save, starting a new game:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Autosave scheduling
// ---------------------------------------------------------------------------

const AUTOSAVE_INTERVAL_MS = 15_000;
const AUTOSAVE_DEBOUNCE_MS = 1_000;

/** GameEvent kinds that trigger a debounced autosave (state-changing player actions). */
export const AUTOSAVE_EVENT_KINDS: ReadonlySet<string> = new Set([
  "ColonyFounded",
  "StructureBuilt",
  "TerraformAllocationSet",
  "Landed",
  "TookOff",
  "ArrivedAtSystem",
]);

export interface AutosaveHandle {
  /** Call on a state-changing GameEvent; schedules a debounced save. */
  onEvent(): void;
  /** Stop the timer + cancel any pending debounced save. */
  stop(): void;
}

/** Wire a timer + debounced event-triggered autosave for `world`. */
export function startAutosave(world: World): AutosaveHandle {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const timer = setInterval(() => {
    void saveGame(world);
  }, AUTOSAVE_INTERVAL_MS);

  function onEvent(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void saveGame(world);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function stop(): void {
    clearInterval(timer);
    if (debounceTimer) clearTimeout(debounceTimer);
  }

  return { onEvent, stop };
}
