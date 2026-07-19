// Background-tab offline progression — applies the SAME offline fast-forward
// (sim/save/offline.ts) to a hidden→visible gap while the page stayed open, so
// leaving the tab backgrounded for a while also progresses the colony, not
// just a full close/reopen.
//
// The accumulator reset is UNCONDITIONAL (not branch-dependent) so the live
// fixed-tick loop (main.ts) can never also replay the same gap. Without this, a
// backgrounded tab (where requestAnimationFrame throttles or pauses) would
// resume with a huge accumulator; the EXISTING spiral-of-death guard
// (MAX_STEPS_PER_FRAME) would then silently replay the missed span through the
// live 1:1 loop over several frames — at the same time this module's offline
// catch-up credits that same span at the slow offline rate. Both firing is a
// double-count (docs/09 2026-07-19). Making the reset unconditional in EVERY
// branch is the testable half of that guarantee in a DOM-less test env.

import type { World } from "../sim/ecs/world.ts";
import { applyOfflineProgress, type OfflineProgress } from "../sim/save/offline.ts";

/** Minimum hidden duration before it's worth running offline catch-up (skips
 *  the overhead/noise of a brief tab switch). */
export const VISIBILITY_OFFLINE_THRESHOLD_MS = 60_000;

export interface VisibilityResumeResult {
  /** Non-null only when offline progress actually ran (elapsed ≥ threshold). */
  summary: OfflineProgress | null;
  /**
   * ALWAYS 0, in every branch. The caller MUST reset its fixed-tick accumulator
   * to this value on resume — whether or not offline progress ran — so the live
   * loop never replays the same span. See the module doc for why this can't be
   * conditional.
   */
  resetAccumulatorMs: 0;
}

/**
 * Decide + apply offline progress for a hidden→visible gap. Pure aside from the
 * `world` mutation inside applyOfflineProgress.
 */
export function handleVisibilityResume(
  world: World,
  hiddenAtMs: number,
  nowMs: number,
  paused: boolean,
  thresholdMs: number = VISIBILITY_OFFLINE_THRESHOLD_MS,
): VisibilityResumeResult {
  const elapsedMs = Math.max(0, nowMs - hiddenAtMs);
  if (elapsedMs < thresholdMs) return { summary: null, resetAccumulatorMs: 0 };
  const summary = applyOfflineProgress(world, elapsedMs, paused);
  return { summary, resetAccumulatorMs: 0 };
}
