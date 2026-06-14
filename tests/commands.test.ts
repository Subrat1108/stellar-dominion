// Tests for the command/event layer (Phase 2A).
//
// Headless: no renderer, no DOM. Covers validation (commands are rejected for
// the right reasons) and deterministic application (same queue → same state,
// and effects land within the tick order).

import { describe, it, expect } from "vitest";
import { serializeWorld, enqueueCommand } from "../src/sim/ecs/world.ts";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { step } from "../src/sim/loop.ts";
import { applyCommand } from "../src/sim/commands/apply.ts";
import { parkDistance } from "../src/sim/presentation.ts";
import type { World } from "../src/sim/ecs/world.ts";

/** A started world: one tick so the orbital system has written body transforms
 *  (world-setup only positions the ship; planets are placed by orbitalSystem). */
function startedWorld(): World {
  const world = createStartingSystem();
  step(world);
  return world;
}

/** Find the entity id of the first body matching a predicate. */
function findBody(world: World, pred: (b: { kind: string; name: string }) => boolean): number {
  for (const [id, body] of world.components.celestialBody) {
    if (pred(body)) return id;
  }
  throw new Error("no matching body");
}

/** Move the ship to within landing range of a body (centre + just inside park). */
function parkShipAt(world: World, bodyId: number): void {
  const body = world.components.celestialBody.get(bodyId)!;
  const bp = world.components.transform.get(bodyId)!.position;
  const d = parkDistance(body.renderRadius);
  const ship = world.components.transform.get(world.shipId)!;
  ship.position = { x: bp.x, y: bp.y, z: bp.z + d }; // d units away along +z
}

describe("command validation", () => {
  it("rejects landing on the star", () => {
    const world = startedWorld();
    const starId = findBody(world, (b) => b.kind === "star");
    const result = applyCommand(world, { kind: "LandAtBody", bodyId: starId });
    expect(result.ok).toBe(false);
  });

  it("rejects landing on a gas giant (no surface)", () => {
    const world = startedWorld();
    const giantId = findBody(world, (b) => b.kind === "gas-giant");
    parkShipAt(world, giantId);
    const result = applyCommand(world, { kind: "LandAtBody", bodyId: giantId });
    expect(result.ok).toBe(false);
  });

  it("rejects landing when too far from the body", () => {
    const world = startedWorld();
    const planetId = findBody(world, (b) => b.kind === "planet");
    // Ship starts at z=60; push the planet far via the ship being at origin-ish.
    const ship = world.components.transform.get(world.shipId)!;
    ship.position = { x: 0, y: 0, z: 100000 };
    const result = applyCommand(world, { kind: "LandAtBody", bodyId: planetId });
    expect(result.ok).toBe(false);
  });

  it("lands on a rocky planet when parked within range", () => {
    const world = startedWorld();
    const planetId = findBody(world, (b) => b.kind === "planet");
    parkShipAt(world, planetId);
    const result = applyCommand(world, { kind: "LandAtBody", bodyId: planetId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.events[0]).toMatchObject({ kind: "Landed", bodyId: planetId });
    expect(world.components.shipControl.get(world.shipId)!.landedBodyId).toBe(planetId);
  });

  it("rejects take-off when not landed", () => {
    const world = startedWorld();
    const result = applyCommand(world, { kind: "TakeOff" });
    expect(result.ok).toBe(false);
  });

  it("take-off clears the landed body", () => {
    const world = startedWorld();
    const planetId = findBody(world, (b) => b.kind === "planet");
    parkShipAt(world, planetId);
    applyCommand(world, { kind: "LandAtBody", bodyId: planetId });
    const result = applyCommand(world, { kind: "TakeOff" });
    expect(result.ok).toBe(true);
    expect(world.components.shipControl.get(world.shipId)!.landedBodyId).toBeUndefined();
  });

  it("rejects founding a colony when not landed on that body", () => {
    const world = startedWorld();
    const planetId = findBody(world, (b) => b.kind === "planet");
    const result = applyCommand(world, { kind: "FoundColony", bodyId: planetId });
    expect(result.ok).toBe(false);
  });

  it("allows founding a colony (stub) once landed", () => {
    const world = startedWorld();
    const planetId = findBody(world, (b) => b.kind === "planet");
    parkShipAt(world, planetId);
    applyCommand(world, { kind: "LandAtBody", bodyId: planetId });
    const result = applyCommand(world, { kind: "FoundColony", bodyId: planetId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.events[0]).toMatchObject({ kind: "ColonyFounded", bodyId: planetId });
  });

  it("rejects setting course while landed", () => {
    const world = startedWorld();
    const planetId = findBody(world, (b) => b.kind === "planet");
    parkShipAt(world, planetId);
    applyCommand(world, { kind: "LandAtBody", bodyId: planetId });
    const result = applyCommand(world, { kind: "SetCourse", bodyId: planetId });
    expect(result.ok).toBe(false);
  });
});

describe("BuildStructure", () => {
  /** Land + found a colony on a rocky planet, returning its body id. */
  function landAndFound(world: ReturnType<typeof startedWorld>): number {
    const planetId = findBody(world, (b) => b.kind === "planet");
    parkShipAt(world, planetId);
    applyCommand(world, { kind: "LandAtBody", bodyId: planetId });
    applyCommand(world, { kind: "FoundColony", bodyId: planetId });
    return planetId;
  }

  it("builds a structure, deducting metals and incrementing the count", () => {
    const world = startedWorld();
    const pid = landAndFound(world);
    const colony = world.components.colony.get(pid)!;
    const m0 = colony.stockpiles.metals!;
    const result = applyCommand(world, { kind: "BuildStructure", bodyId: pid, building: "solar" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.events[0]).toMatchObject({ kind: "StructureBuilt", building: "solar" });
    expect(colony.buildings.solar).toBe(1);
    expect(colony.stockpiles.metals).toBe(m0 - 50);
  });

  it("rejects building when there is no colony", () => {
    const world = startedWorld();
    const planetId = findBody(world, (b) => b.kind === "planet");
    parkShipAt(world, planetId);
    applyCommand(world, { kind: "LandAtBody", bodyId: planetId });
    const result = applyCommand(world, { kind: "BuildStructure", bodyId: planetId, building: "solar" });
    expect(result.ok).toBe(false);
  });

  it("rejects building without enough metals", () => {
    const world = startedWorld();
    const pid = landAndFound(world);
    const colony = world.components.colony.get(pid)!;
    colony.stockpiles.metals = 10; // below any building cost
    const result = applyCommand(world, { kind: "BuildStructure", bodyId: pid, building: "solar" });
    expect(result.ok).toBe(false);
  });

  it("rejects building after take-off (no longer landed)", () => {
    const world = startedWorld();
    const pid = landAndFound(world);
    applyCommand(world, { kind: "TakeOff" });
    const result = applyCommand(world, { kind: "BuildStructure", bodyId: pid, building: "solar" });
    expect(result.ok).toBe(false);
  });
});

describe("command application within the tick", () => {
  it("step() drains the queue and emits a Landed event the same tick", () => {
    const world = startedWorld();
    const planetId = findBody(world, (b) => b.kind === "planet");
    parkShipAt(world, planetId);
    enqueueCommand(world, { kind: "LandAtBody", bodyId: planetId });
    const events = step(world);
    expect(events.some((e) => e.kind === "Landed")).toBe(true);
    expect(world.commandQueue.length).toBe(0);
  });

  it("step() emits CommandRejected for an invalid command", () => {
    const world = startedWorld();
    enqueueCommand(world, { kind: "TakeOff" }); // not landed
    const events = step(world);
    expect(events.some((e) => e.kind === "CommandRejected")).toBe(true);
  });

  it("landing freezes the ship — it does not drift after landing", () => {
    const world = startedWorld();
    const planetId = findBody(world, (b) => b.kind === "planet");
    parkShipAt(world, planetId);
    enqueueCommand(world, { kind: "LandAtBody", bodyId: planetId });
    step(world);
    const before = { ...world.components.transform.get(world.shipId)!.position };
    step(world); // thrust input given to autopilot? no input → still frozen
    const after = world.components.transform.get(world.shipId)!.position;
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
    expect(after.z).toBeCloseTo(before.z, 10);
  });

  it("is deterministic: identical command queues produce identical state", () => {
    const a = startedWorld();
    const b = startedWorld();
    const planetA = findBody(a, (x) => x.kind === "planet");
    const planetB = findBody(b, (x) => x.kind === "planet");
    parkShipAt(a, planetA);
    parkShipAt(b, planetB);
    for (const w of [a, b]) {
      const pid = w === a ? planetA : planetB;
      enqueueCommand(w, { kind: "LandAtBody", bodyId: pid });
      enqueueCommand(w, { kind: "FoundColony", bodyId: pid });
    }
    for (let i = 0; i < 30; i++) { step(a); step(b); }
    expect(JSON.stringify(serializeWorld(a))).toBe(JSON.stringify(serializeWorld(b)));
  });
});
