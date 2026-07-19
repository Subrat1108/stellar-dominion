// Persisted player settings — separate from the save (survives "New Game": a
// reset erases the played game, not the player's preferences).

const KEY = "stellar-dominion:settings";

export interface GameSettings {
  /** When true, offline progression is suppressed on load/visibility-resume —
   *  the player resumes EXACTLY where they left off, no time credited. */
  offlineProgressionPaused: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  offlineProgressionPaused: false,
};

/** Load settings from localStorage, falling back to defaults on any error
 *  (missing key, corrupt JSON, storage unavailable in e.g. private mode). */
export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist settings. Best-effort — a storage failure (quota, private mode)
 *  is swallowed rather than crashing the caller. */
export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // best-effort; ignore
  }
}
