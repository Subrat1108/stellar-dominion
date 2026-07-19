// Offline progression — deterministic fast-forward of the colony economy across
// a real-world gap (the game was closed, or a tab stayed backgrounded). Reuses
// the SAME mechanism as the off-view system catch-up (catch-up.ts): batch-run
// runColonyEconomy, which is pure with respect to wall-clock time (no
// Math.random, no Date reads inside) — a deterministic function of (world
// state, economy-ticks to run). This module is the only place that converts
// REAL elapsed milliseconds into economy-ticks; everything downstream is the
// same proven, tested loop.
//
// Offline is deliberately SLOWER than active play (docs/09 2026-07-19): it's a
// pleasant catch-up on return, not a substitute for playing. Real elapsed time
// is credited at OFFLINE_ECON_TICKS_PER_REAL_HOUR economy-ticks/hour (far below
// the ~3600 ticks/hour an actively-played hour would run), and clamped to
// MAX_OFFLINE_ELAPSED_MS before conversion so even a week-long absence only
// ever credits the clamp ceiling.

import type { World } from "../ecs/world.ts";
import { runColonyEconomy } from "../systems/colony.ts";
import { orbitalSystem } from "../systems/orbital.ts";
import { ECONOMY_TICK_INTERVAL, FIXED_DT } from "../constants.ts";

/**
 * Economy-ticks credited per real hour away. Deliberately far below the online
 * rate (~3600 econ-ticks/active-hour, since 1 econ-tick ≈ 1 active real second)
 * — 240/hour ≈ 4 minutes of active-play-equivalent progress per hour absent.
 * Tunable.
 */
export const OFFLINE_ECON_TICKS_PER_REAL_HOUR = 240;

/**
 * Real-world elapsed time is credited only up to this ceiling — a long absence
 * (days, weeks) still only fast-forwards this much. Separate from
 * MAX_CATCHUP_ECON_TICKS (catch-up.ts), which bounds PER-FRAME off-view cost;
 * this bounds a one-time boot/resume cost, so it can afford to be generous.
 * Tunable.
 */
export const MAX_OFFLINE_ELAPSED_MS = 12 * 60 * 60 * 1000; // 12h

export interface OfflineTickResult {
  /** Economy-ticks credited for this elapsed span. */
  econ: number;
  /** True if elapsedMs exceeded MAX_OFFLINE_ELAPSED_MS and was capped. */
  clamped: boolean;
}

/**
 * Pure: how many economy-ticks a real-world gap credits. `paused` (the player's
 * offline-progression setting) or a non-positive gap yields zero — no work, no
 * clamp flag.
 */
export function offlineEconTicks(elapsedMs: number, paused: boolean): OfflineTickResult {
  if (paused || elapsedMs <= 0) return { econ: 0, clamped: false };
  const clamped = elapsedMs > MAX_OFFLINE_ELAPSED_MS;
  const creditedMs = Math.min(elapsedMs, MAX_OFFLINE_ELAPSED_MS);
  const econ = Math.floor((creditedMs / 3_600_000) * OFFLINE_ECON_TICKS_PER_REAL_HOUR);
  return { econ, clamped };
}

/** Before/after snapshot for one colony's headline stats (the "while away" summary). */
export interface OfflineColonySummary {
  bodyId: number;
  name: string;
  populationBefore: number;
  populationAfter: number;
  habitabilityBefore?: number;
  habitabilityAfter?: number;
  /** Hydrosphere (surface-water) fraction, 0–1 — the terraforming payoff line. */
  hydrosphereBefore?: number;
  hydrosphereAfter?: number;
}

export interface OfflineProgress {
  elapsedMs: number;
  econTicksRun: number;
  clamped: boolean;
  colonies: OfflineColonySummary[];
}

function snapshotColonies(world: World): Map<number, { population: number; habitability?: number; hydrosphere?: number }> {
  const m = new Map<number, { population: number; habitability?: number; hydrosphere?: number }>();
  for (const [bodyId, colony] of world.components.colony) {
    const body = world.components.celestialBody.get(bodyId);
    const snap: { population: number; habitability?: number; hydrosphere?: number } = {
      population: colony.population,
    };
    if (body?.habitability !== undefined) snap.habitability = body.habitability;
    if (body?.hydrosphere !== undefined) snap.hydrosphere = body.hydrosphere;
    m.set(bodyId, snap);
  }
  return m;
}

/**
 * Deterministically fast-forward the ACTIVE system's colonies (population,
 * terraforming — runColonyEconomy's full fixed order, docs/09 2026-07-19) by
 * the economy-ticks a real-world gap credits, then advance world.tick/time to
 * match and re-derive orbital positions (mirrors reconstructWorld's post-
 * restore orbitalSystem call). Inactive/stashed systems need no extra handling:
 * advancing world.tick means their existing re-entry catch-up (catch-up.ts,
 * `world.tick − lastSimTick`) already accounts for the offline span on next
 * visit. Pure with respect to wall-clock (elapsedMs is the only time input) —
 * same (world state, elapsedMs, paused) always yields the same result.
 */
export function applyOfflineProgress(world: World, elapsedMs: number, paused: boolean): OfflineProgress {
  const { econ, clamped } = offlineEconTicks(elapsedMs, paused);
  const before = snapshotColonies(world);

  for (let i = 0; i < econ; i++) runColonyEconomy(world);

  if (econ > 0) {
    world.tick += econ * ECONOMY_TICK_INTERVAL;
    world.time = world.tick * FIXED_DT;
    orbitalSystem(world);
  }

  const colonies: OfflineColonySummary[] = [];
  for (const [bodyId, colony] of world.components.colony) {
    const b = before.get(bodyId);
    if (!b) continue; // colony founded mid-fast-forward isn't possible (no player input), but guard anyway
    const body = world.components.celestialBody.get(bodyId);
    const entry: OfflineColonySummary = {
      bodyId,
      name: body?.name ?? "Colony",
      populationBefore: b.population,
      populationAfter: colony.population,
    };
    if (b.habitability !== undefined) entry.habitabilityBefore = b.habitability;
    if (body?.habitability !== undefined) entry.habitabilityAfter = body.habitability;
    if (b.hydrosphere !== undefined) entry.hydrosphereBefore = b.hydrosphere;
    if (body?.hydrosphere !== undefined) entry.hydrosphereAfter = body.hydrosphere;
    colonies.push(entry);
  }

  return { elapsedMs, econTicksRun: econ, clamped, colonies };
}
