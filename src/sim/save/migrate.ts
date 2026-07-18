// Save-format migration — the versioned migrator chain (docs/15 §6 production
// save-migration rule; docs/09 2026-07-18). This is the REUSABLE pattern for
// every future save-shape change: bump SAVE_VERSION (serialize.ts) and register
// ONE migrator `vN → vN+1` here. Old saves are then walked forward step by step
// to the current version, so they always load instead of breaking.
//
// A payload NEWER than the running build (version > current) throws — a newer
// build wrote it and we can't safely downgrade. A gap in the chain (no migrator
// for some version below current) also throws, loudly, rather than silently
// loading a half-migrated payload.

import type { SavePayload } from "./serialize.ts";
import { LOCAL_PLAYER_OWNER } from "../owner.ts";

/** One in-place-safe transform from version N to N+1. Must be pure (clones). */
type Migrator = (payload: SavePayload) => SavePayload;

/**
 * v2 → v3: colonies gained `ownerId` (the multi-agent seam) + optional site
 * fields. Assign every existing colony (in every system stash) to the local
 * player — the only owner that existed before multi-agent scoping. Site fields
 * are optional-with-runtime-defaults, so nothing else needs backfilling here.
 */
const migrateV2toV3: Migrator = (payload) => {
  const systems = payload.deltas.systems.map(([systemId, stash]) => {
    const colonies = stash.colonies.map(([key, colony]) => {
      const c = colony as typeof colony & { ownerId?: string };
      return [key, { ...c, ownerId: c.ownerId ?? LOCAL_PLAYER_OWNER }] as typeof stash.colonies[number];
    });
    return [systemId, { ...stash, colonies }] as typeof payload.deltas.systems[number];
  });
  return {
    ...payload,
    version: 3,
    deltas: { ...payload.deltas, systems },
  };
};

/** Registered migrators, keyed by the FROM version. Add one per SAVE_VERSION bump. */
const MIGRATORS: Record<number, Migrator> = {
  2: migrateV2toV3,
};

/**
 * Walk `payload` forward to `targetVersion` through the registered chain.
 * Throws if the payload is newer than target, or if a step has no migrator.
 */
export function migrate(payload: SavePayload, targetVersion: number): SavePayload {
  if (payload.version > targetVersion) {
    throw new Error(
      `save version ${payload.version} is newer than this build supports (${targetVersion}) — update the app`,
    );
  }
  let p = payload;
  while (p.version < targetVersion) {
    const m = MIGRATORS[p.version];
    if (!m) throw new Error(`no save migrator registered for version ${p.version}`);
    const next = m(p);
    // Guard against a migrator that fails to advance the version (would loop).
    if (next.version <= p.version) {
      throw new Error(`save migrator for version ${p.version} did not advance the version`);
    }
    p = next;
  }
  return p;
}
