// Tests for tile-based colony founding (the surface layer, docs/17): a colony's
// claimed tile is owner-scoped, drives the founding modifiers (via the tile→
// siteModifiers mapping), and persists through a save round-trip. Terrain itself
// is never saved — only colony.tile. Headless — pure sim, no DOM.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { foundColony } from "../src/sim/commands/colony.ts";
import { extractDeltas, reconstructWorld } from "../src/sim/save/serialize.ts";
import { generateSurface, tileModifiers, type TileCoord } from "../src/sim/gen/surface.ts";
import { COLONY_SEED } from "../src/sim/data/colony.ts";
import { LOCAL_PLAYER_OWNER } from "../src/sim/owner.ts";
import type { World } from "../src/sim/ecs/world.ts";

function landOnFirstPlanet(world: World): number {
  const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
  world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
  return bodyId;
}

describe("tile-based founding", () => {
  it("founding on a tile stamps colony.tile (owner-scoped) and it survives save→reconstruct", () => {
    const world = createStartingSystem("tile-rt");
    run(world, 120);
    const bodyId = landOnFirstPlanet(world);
    const tile: TileCoord = { x: 40, y: 18 };
    expect(foundColony(world, bodyId, LOCAL_PLAYER_OWNER, tile).ok).toBe(true);

    const colony = world.components.colony.get(bodyId)!;
    expect(colony.tile).toEqual(tile);
    expect(colony.ownerId).toBe(LOCAL_PLAYER_OWNER); // tile claim is owner-scoped

    const restored = reconstructWorld(extractDeltas(world));
    const restoredColony = [...restored.components.colony.values()][0]!;
    expect(restoredColony.tile).toEqual(tile);
    expect(restoredColony.ownerId).toBe(LOCAL_PLAYER_OWNER);
  });

  it("the founded colony's modifiers match the chosen tile's tileModifiers (deterministic from seed)", () => {
    const world = createStartingSystem("tile-mods");
    run(world, 120);
    const bodyId = landOnFirstPlanet(world);
    const body = world.components.celestialBody.get(bodyId)!;
    const tile: TileCoord = { x: 22, y: 24 };
    const expected = tileModifiers(generateSurface(world.universeSeed, body), tile.x, tile.y, body);

    foundColony(world, bodyId, LOCAL_PLAYER_OWNER, tile);
    const colony = world.components.colony.get(bodyId)!;
    // The tile's insolation-derived solar efficiency is persisted on the colony.
    expect(colony.solarEfficiency).toBe(expected.solarEfficiency);
    // Water head-start reflects the tile (may be 0; equality is what matters).
    expect(colony.stockpiles.water).toBe(COLONY_SEED.water + expected.startWaterBonus);
  });

  it("two different tiles on the same planet generally give different founding modifiers", () => {
    const world = createStartingSystem("tile-differ");
    run(world, 120);
    const bodyId = landOnFirstPlanet(world);
    const body = world.components.celestialBody.get(bodyId)!;
    const grid = generateSurface(world.universeSeed, body);
    const equator = tileModifiers(grid, 10, 24, body);
    const pole = tileModifiers(grid, 10, 0, body);
    // Latitude drives solar efficiency, so an equatorial vs polar tile differ.
    expect(equator.solarEfficiency).not.toBe(pole.solarEfficiency);
  });

  it("terrain is NOT in the save — only colony.tile is (terrain regenerates from seed)", () => {
    const world = createStartingSystem("tile-nosave");
    run(world, 120);
    const bodyId = landOnFirstPlanet(world);
    foundColony(world, bodyId, LOCAL_PLAYER_OWNER, { x: 5, y: 5 });
    const payload = JSON.stringify(extractDeltas(world));
    // No tile grid / altitude arrays leak into the save; the claimed coord does.
    expect(payload).not.toContain("altitude");
    expect(payload).not.toContain("baseTerrain");
    expect(payload).toContain('"tile"');
  });
});
