// Tests for the founding-flow logic (ui/surface/founding.ts, Slice 1) + the
// colony-name persistence round-trip. The flow decides what action a selected
// tile offers (found / enter / gated found-another / none); the gated case is
// what Slice 2 flips on. Pure logic + a save round-trip — no DOM.

import { describe, it, expect } from "vitest";
import {
  tileFoundingAction,
  defaultColonyName,
  SECOND_COLONY_GATE_REASON,
} from "../src/ui/surface/founding.ts";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { applyCommand } from "../src/sim/commands/apply.ts";
import { extractDeltas, reconstructWorld } from "../src/sim/save/serialize.ts";
import type { World } from "../src/sim/ecs/world.ts";

describe("founding-flow actions", () => {
  it("no selection → none", () => {
    expect(tileFoundingAction({ hasColony: false, foundedTile: null, selectedTile: null, canFoundAnother: false }))
      .toEqual({ kind: "none" });
  });

  it("no colony yet → found the first colony on the selected tile", () => {
    const a = tileFoundingAction({ hasColony: false, foundedTile: null, selectedTile: { x: 5, y: 6 }, canFoundAnother: false });
    expect(a).toEqual({ kind: "found", tile: { x: 5, y: 6 } });
  });

  it("selecting the existing colony's tile → enter it", () => {
    const a = tileFoundingAction({
      hasColony: true, foundedTile: { x: 3, y: 4 }, selectedTile: { x: 3, y: 4 }, canFoundAnother: false,
    });
    expect(a).toEqual({ kind: "enter", tile: { x: 3, y: 4 } });
  });

  it("colony exists + a DIFFERENT tile + gated (Slice 1) → found-blocked with the gate reason", () => {
    const a = tileFoundingAction({
      hasColony: true, foundedTile: { x: 3, y: 4 }, selectedTile: { x: 9, y: 9 }, canFoundAnother: false,
    });
    expect(a).toEqual({ kind: "found-blocked", tile: { x: 9, y: 9 }, reason: SECOND_COLONY_GATE_REASON });
  });

  it("colony exists + a DIFFERENT tile + canFoundAnother (Slice 2 forward) → found (no rebuild)", () => {
    const a = tileFoundingAction({
      hasColony: true, foundedTile: { x: 3, y: 4 }, selectedTile: { x: 9, y: 9 }, canFoundAnother: true,
    });
    expect(a).toEqual({ kind: "found", tile: { x: 9, y: 9 } });
  });

  it("defaultColonyName suggests a body-based name", () => {
    expect(defaultColonyName("Mira")).toBe("Mira Base");
  });
});

describe("colony name — founding + save round-trip", () => {
  function landOnFirstPlanet(world: World): number {
    const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
    world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
    return bodyId;
  }

  it("a named founding stores colony.name and it survives save→reconstruct", () => {
    const world = createStartingSystem("name-rt");
    run(world, 120);
    const bodyId = landOnFirstPlanet(world);
    const r = applyCommand(world, { kind: "FoundColony", bodyId, tile: { x: 10, y: 20 }, name: "New Cydonia" });
    expect(r.ok).toBe(true);
    expect(world.components.colony.get(bodyId)!.name).toBe("New Cydonia");

    const restored = reconstructWorld(extractDeltas(world));
    expect([...restored.components.colony.values()][0]!.name).toBe("New Cydonia");
  });

  it("a blank / whitespace name is not stored (falls back to the body name in the UI)", () => {
    const world = createStartingSystem("name-blank");
    run(world, 120);
    const bodyId = landOnFirstPlanet(world);
    applyCommand(world, { kind: "FoundColony", bodyId, tile: { x: 5, y: 5 }, name: "   " });
    expect(world.components.colony.get(bodyId)!.name).toBeUndefined();
  });

  it("founding without a name still works (name omitted)", () => {
    const world = createStartingSystem("name-none");
    run(world, 120);
    const bodyId = landOnFirstPlanet(world);
    expect(applyCommand(world, { kind: "FoundColony", bodyId, tile: { x: 5, y: 5 } }).ok).toBe(true);
    expect(world.components.colony.get(bodyId)!.name).toBeUndefined();
  });
});
