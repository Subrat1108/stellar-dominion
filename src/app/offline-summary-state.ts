// Shared offline-progress summary — the most recent "while you were away"
// result, if any. A plain mutable ref (matches landing-state.ts / view-state.ts)
// so main.ts can set it from boot or a visibility-resume event without a React
// dependency; the UI (OfflineSummary, commit 3) reads + dismisses it directly.

import type { OfflineProgress } from "../sim/save/offline.ts";

export const offlineSummaryState: { current: OfflineProgress | null } = { current: null };
