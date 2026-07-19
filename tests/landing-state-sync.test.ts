// Tests for the "stuck after reload while landed" bug fix (app/landing-state.ts
// syncLandingStateFromWorld).
//
// Root cause: SurfaceView (TAKE OFF / colony / site UI) is gated on a plain ref
// (landingState.landedBodyId) that's normally only updated by the sim's Landed/
// TookOff GameEvents (main.ts) — the LIVE TRANSITION, not the state. A save
// reload restores ctrl.landedBodyId directly without ever firing that event,
// so the ref stayed stale/null and the surface UI never appeared, even though
// MODE correctly showed LANDED (that readout — and the map/system-panel
// actions — already read ctrl.landedBodyId live, so they were never broken).
//
// The fix re-derives the ref from actual world state once at boot, covering
// both a fresh world and a restored (possibly mid-save-reload) one.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { foundColony } from "../src/sim/commands/colony.ts";
import { extractDeltas, reconstructWorld } from "../src/sim/save/serialize.ts";
import { landingState, syncLandingStateFromWorld } from "../src/app/landing-state.ts";
import type { World } from "../src/sim/ecs/world.ts";

function firstPlanetId(world: World): number {
  for (const [id, body] of world.components.celestialBody) {
    if (body.kind === "planet") return id;
  }
  throw new Error("no planet");
}

describe("syncLandingStateFromWorld — the reload-while-landed fix", () => {
  it("a fresh (not landed) world syncs the ref to null", () => {
    const world = createStartingSystem("sync-fresh");
    landingState.landedBodyId = 999; // pretend a stale value carried over
    syncLandingStateFromWorld(world);
    expect(landingState.landedBodyId).toBeNull();
  });

  it("a world whose ship is landed syncs the ref to that body id", () => {
    const world = createStartingSystem("sync-landed");
    const bodyId = firstPlanetId(world);
    world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
    landingState.landedBodyId = null; // simulate the bug: ref never updated
    syncLandingStateFromWorld(world);
    expect(landingState.landedBodyId).toBe(bodyId);
  });

  it("REGRESSION: land, save, reload (reconstructWorld) — the ref reflects the restored landed state, not null", () => {
    const world = createStartingSystem("sync-reload");
    run(world, 120);
    const bodyId = firstPlanetId(world);
    world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
    expect(foundColony(world, bodyId).ok).toBe(true);

    // Simulate a browser reload: serialize, then reconstruct fresh (this is
    // exactly what main.ts's boot-load path does — no Landed event fires).
    const payload = extractDeltas(world);
    const restored = reconstructWorld(payload);

    // Sanity: the sim state itself is correctly restored (this part already worked).
    expect(restored.components.shipControl.get(restored.shipId)!.landedBodyId).toBe(bodyId);

    // Before the fix, this ref would incorrectly stay null/stale here (the bug).
    landingState.landedBodyId = null;
    syncLandingStateFromWorld(restored);
    expect(landingState.landedBodyId).toBe(bodyId);
  });

  it("a world whose ship took off (no landedBodyId) syncs the ref back to null", () => {
    const world = createStartingSystem("sync-tookoff");
    landingState.landedBodyId = 42; // stale value from a prior landing
    // ctrl.landedBodyId is undefined (never landed / already took off).
    syncLandingStateFromWorld(world);
    expect(landingState.landedBodyId).toBeNull();
  });
});

describe("orbit state — verified NOT affected by the same class of bug", () => {
  it("ctrl.orbitingBodyId survives a save/reload round-trip, and orbit UI reads it live (no ref to desync)", () => {
    const world = createStartingSystem("orbit-reload");
    run(world, 60);
    const bodyId = firstPlanetId(world);
    const ctrl = world.components.shipControl.get(world.shipId)!;
    ctrl.orbitingBodyId = bodyId;
    ctrl.orbitAngle = 1.23;

    const restored = reconstructWorld(extractDeltas(world));
    const restoredCtrl = restored.components.shipControl.get(restored.shipId)!;

    // Unlike landedBodyId, orbit state has no gating "ref" (Cockpit/MapView/
    // SystemPanel/ship-movement all read ctrl.orbitingBodyId directly each
    // render/tick) — so a correct round-trip here is the whole guarantee.
    expect(restoredCtrl.orbitingBodyId).toBe(bodyId);
    expect(restoredCtrl.orbitAngle).toBeCloseTo(1.23, 6);
  });
});
