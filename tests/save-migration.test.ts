// Tests for the save migrator chain (docs/15 §6, docs/09 2026-07-18): old saves
// load forward instead of breaking. The v2→v3 migration assigns pre-multi-agent
// colonies to the local player. Headless — pure sim, no DOM.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { foundColony } from "../src/sim/commands/colony.ts";
import {
  extractDeltas,
  reconstructWorld,
  SAVE_VERSION,
  type SavePayload,
} from "../src/sim/save/serialize.ts";
import { migrate } from "../src/sim/save/migrate.ts";
import { LOCAL_PLAYER_OWNER } from "../src/sim/owner.ts";
import type { World } from "../src/sim/ecs/world.ts";

/** A world with one founded colony (so the stash carries a colony to migrate). */
function foundedWorld(seed = "migrate-seed"): World {
  const world = createStartingSystem(seed);
  run(world, 120);
  const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
  world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
  if (!foundColony(world, bodyId).ok) throw new Error("found failed");
  return world;
}

/** Synthesize a pre-multi-agent v2 payload from a current (v3) one: strip the
 *  owner fields that v2 predates. */
function downgradeToV2(payload: SavePayload): SavePayload {
  const p = JSON.parse(JSON.stringify(payload)) as SavePayload;
  p.version = 2;
  delete (p.deltas.meta as { localOwnerId?: string }).localOwnerId;
  for (const [, stash] of p.deltas.systems) {
    for (const entry of stash.colonies) {
      delete (entry[1] as { ownerId?: string }).ownerId;
    }
  }
  return p;
}

describe("save migration (v2 → v3, the multi-agent owner backfill)", () => {
  it("migrate() assigns every un-owned colony to the local player and bumps the version", () => {
    const v2 = downgradeToV2(extractDeltas(foundedWorld()));
    // Sanity: the synthetic v2 really lacks owners.
    expect(v2.deltas.systems.some(([, s]) => s.colonies.some(([, c]) => (c as { ownerId?: string }).ownerId === undefined))).toBe(true);

    const v3 = migrate(v2, SAVE_VERSION);
    expect(v3.version).toBe(SAVE_VERSION);
    for (const [, stash] of v3.deltas.systems) {
      for (const [, colony] of stash.colonies) {
        expect((colony as { ownerId?: string }).ownerId).toBe(LOCAL_PLAYER_OWNER);
      }
    }
  });

  it("reconstructWorld transparently migrates a v2 payload and loads it", () => {
    const original = foundedWorld("rt");
    const v2 = downgradeToV2(extractDeltas(original));

    const restored = reconstructWorld(v2);
    expect(restored.localOwnerId).toBe(LOCAL_PLAYER_OWNER);
    // Every restored colony is owned by the local player.
    for (const [, colony] of restored.components.colony) {
      expect(colony.ownerId).toBe(LOCAL_PLAYER_OWNER);
    }
    // And it is the SAME world a native-v3 save reconstructs to (colonies were
    // founded by the local player either way).
    const nativeRestored = reconstructWorld(extractDeltas(original));
    expect(restored.components.colony.size).toBe(nativeRestored.components.colony.size);
  });

  it("throws on a payload NEWER than this build supports (no silent downgrade)", () => {
    const future = extractDeltas(foundedWorld());
    future.version = SAVE_VERSION + 1;
    expect(() => migrate(future, SAVE_VERSION)).toThrow(/newer/i);
    expect(() => reconstructWorld(future)).toThrow(/newer/i);
  });

  it("throws loudly if a step in the chain has no registered migrator", () => {
    const orphan = extractDeltas(foundedWorld());
    orphan.version = 1; // no v1→v2 migrator registered
    expect(() => migrate(orphan, SAVE_VERSION)).toThrow(/no save migrator/i);
  });
});
