// Tests for the Step 1B warp layer (docs/12): the FSM phase transitions, the
// deterministic arrival generation, and the single-active-system swap (ship
// persists; active/discovered update; revisits restore stashed colonies).
// Headless — pure sim, no renderer/DOM.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { enqueueCommand } from "../src/sim/ecs/world.ts";
import { step, run } from "../src/sim/loop.ts";
import { beginWarpScan, commitWarp, cancelWarp } from "../src/sim/commands/warp.ts";
import { warpSystem, SPOOL_TICKS, transitTicksForLy } from "../src/sim/systems/warp.ts";
import { setActiveSystem } from "../src/sim/galaxy.ts";
import { scanPreview } from "../src/sim/gen/scan.ts";
import { foundColony } from "../src/sim/commands/colony.ts";
import { systemIdFor, distanceLyById, TAU_CETI_HYG_ID, YZ_CETI_HYG_ID } from "../src/sim/data/sector.ts";
import type { World } from "../src/sim/ecs/world.ts";

const TAU_CETI = systemIdFor(TAU_CETI_HYG_ID);
const YZ_CETI = systemIdFor(YZ_CETI_HYG_ID);
// Distance-proportional transit (Polish C): the Tau Ceti → YZ Ceti crossing.
const YZ_TRANSIT_TICKS = transitTicksForLy(distanceLyById(TAU_CETI_HYG_ID, YZ_CETI_HYG_ID));

function bodyNames(world: World): string[] {
  return [...world.components.celestialBody.values()].map((b) => b.name).sort();
}

describe("warp FSM transitions", () => {
  it("scan → commit → spool → transit → arrive, tick-counted", () => {
    const world = createStartingSystem("warp-fsm");
    expect(beginWarpScan(world, YZ_CETI).ok).toBe(true);
    expect(world.warp.phase).toBe("scan");

    expect(commitWarp(world).ok).toBe(true);
    expect(world.warp.phase).toBe("spool");
    expect(world.warp.ticksRemaining).toBe(SPOOL_TICKS);

    // Spool down to transit.
    for (let i = 0; i < SPOOL_TICKS - 1; i++) { world.tick++; warpSystem(world); }
    expect(world.warp.phase).toBe("spool");
    world.tick++; warpSystem(world);
    expect(world.warp.phase).toBe("transit");
    expect(world.warp.ticksRemaining).toBe(YZ_TRANSIT_TICKS);

    // Transit down to arrival.
    let arrived = false;
    for (let i = 0; i < YZ_TRANSIT_TICKS; i++) {
      world.tick++;
      const events = warpSystem(world);
      if (events.some((e) => e.kind === "ArrivedAtSystem")) arrived = true;
    }
    expect(arrived).toBe(true);
    expect(world.warp.phase).toBe("idle");
    expect(world.activeSystemId).toBe(YZ_CETI);
  });

  it("rejects the current system, out-of-range systems, and warping while landed", () => {
    const world = createStartingSystem("warp-reject");
    expect(beginWarpScan(world, TAU_CETI).ok).toBe(false); // current system
    // Reachability is now distance-based + ungated: Epsilon Eridani (5.46 ly) is
    // within WARP_RANGE_LY, so it is reachable (was role-locked before Polish C).
    expect(beginWarpScan(world, "hyg:16496").ok).toBe(true); // Epsilon Eridani
    world.warp = { phase: "idle", destinationSystemId: null, ticksRemaining: 0 };
    // A star not in the catalog (or beyond range) is rejected as out of range.
    expect(beginWarpScan(world, "hyg:99999999").ok).toBe(false);
    world.components.shipControl.get(world.shipId)!.landedBodyId = 999;
    expect(beginWarpScan(world, YZ_CETI).ok).toBe(false); // landed
  });

  it("cancels during scan and spool, but transit is locked", () => {
    const world = createStartingSystem("warp-cancel");
    beginWarpScan(world, YZ_CETI);
    expect(cancelWarp(world).ok).toBe(true);
    expect(world.warp.phase).toBe("idle");

    beginWarpScan(world, YZ_CETI);
    commitWarp(world);
    expect(world.warp.phase).toBe("spool");
    expect(cancelWarp(world).ok).toBe(true);
    expect(world.warp.phase).toBe("idle");

    // Force transit, then confirm it cannot be cancelled.
    beginWarpScan(world, YZ_CETI);
    commitWarp(world);
    world.warp.phase = "transit";
    expect(cancelWarp(world).ok).toBe(false);
  });
});

describe("deterministic arrival generation", () => {
  it("warping to YZ Ceti always yields the same system", () => {
    const a = createStartingSystem("arrival-det");
    const b = createStartingSystem("arrival-det");
    setActiveSystem(a, YZ_CETI);
    setActiveSystem(b, YZ_CETI);
    expect(JSON.stringify([...a.components.celestialBody.values()])).toBe(
      JSON.stringify([...b.components.celestialBody.values()]),
    );
  });

  it("generates YZ Ceti as a distinct M-dwarf system with its 3 real planets + SPI hazard", () => {
    const world = createStartingSystem("arrival-char");
    const { system } = setActiveSystem(world, YZ_CETI);
    expect(system.star.body.spectralType?.startsWith("M")).toBe(true);
    const planets = [...world.components.celestialBody.values()].filter((b) => b.kind === "planet");
    expect(planets.map((p) => p.name)).toEqual(
      expect.arrayContaining(["YZ Ceti b", "YZ Ceti c", "YZ Ceti d"]),
    );
    // No gas giant generated (tight terrestrial system).
    expect([...world.components.celestialBody.values()].some((b) => b.kind === "gas-giant")).toBe(false);
    expect(system.hazard?.kind).toBe("spi-radio");
  });
});

describe("active-system swap", () => {
  it("preserves the ship entity + its crew/inventory across the swap", () => {
    const world = createStartingSystem("swap-ship");
    const shipId = world.shipId;
    const crewBefore = world.components.crew.get(shipId)!.members.length;
    setActiveSystem(world, YZ_CETI);
    expect(world.shipId).toBe(shipId);
    expect(world.components.crew.get(shipId)!.members.length).toBe(crewBefore);
    expect(world.components.inventory.get(shipId)).toBeDefined();
    // Ship repositioned to the inner-system start, not landed.
    expect(world.components.shipControl.get(shipId)!.landedBodyId).toBeUndefined();
  });

  it("updates active system + discovered set", () => {
    const world = createStartingSystem("swap-discover");
    expect(world.discovered).toEqual([TAU_CETI]);
    setActiveSystem(world, YZ_CETI);
    expect(world.activeSystemId).toBe(YZ_CETI);
    expect(world.discovered).toContain(YZ_CETI);
    expect(world.discovered).toContain(TAU_CETI);
  });

  it("restores a stashed home colony when warping back", () => {
    const world = createStartingSystem("swap-return");
    // Found a colony at home (land on a body first).
    const bodyId = [...world.components.celestialBody.entries()].find(
      ([, b]) => b.kind === "planet",
    )![0];
    world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
    expect(foundColony(world, bodyId).ok).toBe(true);
    const homeColonies = world.components.colony.size;
    expect(homeColonies).toBe(1);

    setActiveSystem(world, YZ_CETI);
    expect(world.components.colony.size).toBe(0); // YZ Ceti has no colony

    setActiveSystem(world, TAU_CETI);
    expect(world.components.colony.size).toBe(1); // home colony restored from stash
  });
});

describe("scan preview is coarse + never mutates the world", () => {
  it("returns counts/archetypes + hazard without materialising the system", () => {
    const world = createStartingSystem("scan-coarse");
    const before = bodyNames(world);
    const preview = scanPreview(world.universeSeed, YZ_CETI);
    expect(preview.planetCount).toBe(3);
    expect(preview.gasGiantCount).toBe(0);
    expect(preview.starSpectralType.startsWith("M")).toBe(true);
    expect(preview.hazardLabel).toBeTruthy();
    // The active world is unchanged (still Tau Ceti, same bodies).
    expect(world.activeSystemId).toBe(TAU_CETI);
    expect(bodyNames(world)).toEqual(before);
  });
});

describe("warp integration through the loop", () => {
  it("a committed warp arrives via step() and swaps the active system", () => {
    const world = createStartingSystem("warp-loop");
    enqueueCommand(world, { kind: "BeginWarpScan", systemId: YZ_CETI });
    step(world);
    enqueueCommand(world, { kind: "CommitWarp" });
    step(world);
    expect(world.warp.phase).toBe("spool");
    run(world, SPOOL_TICKS + YZ_TRANSIT_TICKS + 2);
    expect(world.activeSystemId).toBe(YZ_CETI);
    expect(world.warp.phase).toBe("idle");
  });

  it("can warp BACK home after leaving (the return-home fix — a UI gate, not state)", () => {
    const world = createStartingSystem("warp-return-home");
    const homeBodies = bodyNames(world);

    // Out to YZ Ceti.
    enqueueCommand(world, { kind: "BeginWarpScan", systemId: YZ_CETI });
    step(world);
    enqueueCommand(world, { kind: "CommitWarp" });
    step(world);
    run(world, SPOOL_TICKS + YZ_TRANSIT_TICKS + 2);
    expect(world.activeSystemId).toBe(YZ_CETI);

    // …and back home. The command layer already supported this end-to-end; only
    // the old SectorPanel UI gate hid the button (home role ≠ "reachable").
    enqueueCommand(world, { kind: "BeginWarpScan", systemId: TAU_CETI });
    step(world);
    expect(world.warp.phase).toBe("scan"); // home accepted as a scan target
    enqueueCommand(world, { kind: "CommitWarp" });
    step(world);
    const homeTransit = transitTicksForLy(distanceLyById(YZ_CETI_HYG_ID, TAU_CETI_HYG_ID));
    run(world, SPOOL_TICKS + homeTransit + 2);
    expect(world.activeSystemId).toBe(TAU_CETI);
    expect(world.warp.phase).toBe("idle");
    expect(bodyNames(world)).toEqual(homeBodies); // home restored intact
  });
});
