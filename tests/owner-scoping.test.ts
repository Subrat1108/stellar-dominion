// Tests for owner-scoping — the multi-agent seam (docs/15 §6, docs/09 2026-07-18).
// A colony is owned by the actor that founds it; the actor rides the command
// envelope (applyCommand's actorId), not the command payload; owner-aware
// commands (build/terraform) reject a non-owner. Headless — pure sim, no DOM.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { step } from "../src/sim/loop.ts";
import { applyCommand } from "../src/sim/commands/apply.ts";
import { foundColony, buildStructure, setTerraformAllocation } from "../src/sim/commands/colony.ts";
import { coloniesOfOwner } from "../src/sim/systems/colony.ts";
import { LOCAL_PLAYER_OWNER } from "../src/sim/owner.ts";
import type { World } from "../src/sim/ecs/world.ts";

function startedWorld(seed = "owner"): World {
  const world = createStartingSystem(seed);
  step(world); // populate body transforms
  return world;
}

function planetIds(world: World): number[] {
  const out: number[] = [];
  for (const [id, body] of world.components.celestialBody) if (body.kind === "planet") out.push(id);
  return out;
}

/** Land the ship on a body (so founding / building / terraforming is allowed). */
function landOn(world: World, bodyId: number): void {
  world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
}

/** Restock the ship so it can afford another founding (founding conserves supplies). */
function restock(world: World): void {
  world.components.inventory.set(world.shipId, { metals: 5000, fuel: 5000, food: 5000 });
  const ls = world.components.lifeSupport.get(world.shipId)!;
  ls.current = ls.capacity;
}

describe("owner-scoping — the multi-agent seam", () => {
  it("stamps the founding actor as the colony owner (defaults to the local player)", () => {
    const world = startedWorld();
    const bodyId = planetIds(world)[0]!;
    landOn(world, bodyId);
    expect(foundColony(world, bodyId).ok).toBe(true);
    expect(world.components.colony.get(bodyId)!.ownerId).toBe(LOCAL_PLAYER_OWNER);
  });

  it("world.localOwnerId is the local player, and it is AN owner id (a string), not privileged state", () => {
    const world = startedWorld();
    expect(world.localOwnerId).toBe(LOCAL_PLAYER_OWNER);
    expect(typeof world.localOwnerId).toBe("string");
  });

  it("a non-local actor founds a colony it owns (identical command, different envelope)", () => {
    const world = startedWorld();
    const bodyId = planetIds(world)[0]!;
    landOn(world, bodyId);
    // The SAME command value, issued by a different actor — identity rides the
    // envelope (the actorId arg), not the command.
    const r = applyCommand(world, { kind: "FoundColony", bodyId }, "ai-1");
    expect(r.ok).toBe(true);
    expect(world.components.colony.get(bodyId)!.ownerId).toBe("ai-1");
  });

  it("rejects BuildStructure issued by a non-owner", () => {
    const world = startedWorld();
    const bodyId = planetIds(world)[0]!;
    landOn(world, bodyId);
    foundColony(world, bodyId, "ai-1"); // owned by the AI
    world.components.colony.get(bodyId)!.stockpiles.metals = 10_000; // afford it
    // The local player (default actor) cannot build in the AI's colony.
    const r = applyCommand(world, { kind: "BuildStructure", bodyId, building: "solar" });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.reason).toMatch(/do not own/i);
    // The owner can.
    expect(buildStructure(world, bodyId, "solar", "ai-1").ok).toBe(true);
  });

  it("rejects SetTerraformAllocation issued by a non-owner", () => {
    const world = startedWorld();
    const bodyId = planetIds(world)[0]!;
    landOn(world, bodyId);
    foundColony(world, bodyId, "ai-1");
    const r = setTerraformAllocation(world, bodyId, "temperature", 0.5, LOCAL_PLAYER_OWNER);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.reason).toMatch(/do not own/i);
    expect(setTerraformAllocation(world, bodyId, "temperature", 0.5, "ai-1").ok).toBe(true);
  });

  it("coloniesOfOwner returns only that owner's colonies", () => {
    const world = startedWorld();
    const [a, b] = planetIds(world);
    restock(world); landOn(world, a!); expect(foundColony(world, a!, LOCAL_PLAYER_OWNER).ok).toBe(true);
    restock(world); landOn(world, b!); expect(foundColony(world, b!, "ai-1").ok).toBe(true);
    expect(coloniesOfOwner(world, LOCAL_PLAYER_OWNER).map(([id]) => id)).toEqual([a]);
    expect(coloniesOfOwner(world, "ai-1").map(([id]) => id)).toEqual([b]);
  });
});
