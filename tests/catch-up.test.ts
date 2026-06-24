// Tests for off-view lazy catch-up (docs/09, Session 18): advancing a system's
// economy on re-entry is deterministic, equivalent to having stayed, and clamped
// so a long absence can't stall a frame. Headless — pure sim.

import { describe, it, expect } from "vitest";
import { createStartingSystem } from "../src/sim/world-setup.ts";
import { run } from "../src/sim/loop.ts";
import { colonySystem } from "../src/sim/systems/colony.ts";
import { foundColony } from "../src/sim/commands/colony.ts";
import { catchUpColony, MAX_CATCHUP_ECON_TICKS } from "../src/sim/catch-up.ts";
import { setActiveSystem } from "../src/sim/galaxy.ts";
import { ECONOMY_TICK_INTERVAL } from "../src/sim/constants.ts";
import { systemIdFor, TAU_CETI_HYG_ID, YZ_CETI_HYG_ID } from "../src/sim/data/sector.ts";
import type { World } from "../src/sim/ecs/world.ts";

const TAU_CETI = systemIdFor(TAU_CETI_HYG_ID);
const YZ_CETI = systemIdFor(YZ_CETI_HYG_ID);

/** Found a powered colony on the first rocky planet. */
function withColony(seed: string): { world: World; bodyId: number } {
  const world = createStartingSystem(seed);
  run(world, 60);
  const bodyId = [...world.components.celestialBody.entries()].find(([, b]) => b.kind === "planet")![0];
  world.components.shipControl.get(world.shipId)!.landedBodyId = bodyId;
  foundColony(world, bodyId);
  world.components.colony.get(bodyId)!.buildings.solar = 20;
  return { world, bodyId };
}

describe("off-view catch-up", () => {
  it("catching up N economy-ticks equals having stayed N economy-ticks", () => {
    const stayed = withColony("catchup-eq");
    const caught = withColony("catchup-eq");
    const N = 30;

    // "Stayed": run the economy resolution N times directly.
    for (let i = 0; i < N; i++) { stayed.world.tick = ECONOMY_TICK_INTERVAL; colonySystem(stayed.world); }
    // "Caught up": one batched catch-up over N economy-ticks of elapsed time.
    caught.world.tick = ECONOMY_TICK_INTERVAL;
    catchUpColony(caught.world, N * ECONOMY_TICK_INTERVAL);

    expect(JSON.stringify(caught.world.components.colony.get(caught.bodyId)))
      .toBe(JSON.stringify(stayed.world.components.colony.get(stayed.bodyId)));
  });

  it("resolves floor(elapsed / interval) economy-ticks", () => {
    const { world } = withColony("catchup-count");
    const r = catchUpColony(world, ECONOMY_TICK_INTERVAL * 5 + 7);
    expect(r.ranEconTicks).toBe(5);
    expect(r.clamped).toBe(false);
  });

  it("clamps a very long absence to the ceiling (and flags it)", () => {
    const { world } = withColony("catchup-clamp");
    const huge = (MAX_CATCHUP_ECON_TICKS + 5000) * ECONOMY_TICK_INTERVAL;
    const r = catchUpColony(world, huge);
    expect(r.ranEconTicks).toBe(MAX_CATCHUP_ECON_TICKS);
    expect(r.clamped).toBe(true);
  });

  it("advances the home colony while away, deterministically (two runs match)", () => {
    function awayAndBack(seed: string): string {
      const { world, bodyId } = withColony(seed);
      const homeKey = world.components.celestialBody.get(bodyId)!.bodyKey!;
      setActiveSystem(world, YZ_CETI); // leave home
      run(world, 5000); // explore for a while (global tick advances)
      setActiveSystem(world, TAU_CETI); // return — home catches up
      const home = [...world.components.celestialBody.values()].find((b) => b.bodyKey === homeKey);
      return JSON.stringify({ colony: [...world.components.colony.values()][0], temp: home?.surfaceTempK });
    }
    expect(awayAndBack("away-det")).toBe(awayAndBack("away-det"));
  });
});
