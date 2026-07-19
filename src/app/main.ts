// App wiring: load-or-create the world, run the fixed-tick sim, render Three.js,
// mount React, and keep it persisted.
//
// The sim advances on a fixed-dt accumulator (frame-rate independent) at exactly
// one tick per slot — real-time. Movement keys (W/S/A/D) translate the ship and
// pointer steering sets its heading; both feed the sim as Input each tick.
// After ticking, the GameBus emits; React re-renders as needed.
//
// Boot is async: it tries to load the current save (app/persistence.ts) before
// building anything, so a refresh RESUMES instead of silently regenerating a
// fresh universe (the bug this closes). A corrupt/unsupported save never
// crashes boot — it falls back to a new game with a visible notice.

import React from "react";
import { createRoot } from "react-dom/client";
import { createStartingSystem } from "../sim/world-setup.ts";
import { step, FIXED_DT } from "../sim/loop.ts";
import { createRenderer } from "../render/scene.ts";
import { GameBus } from "./game-bus.ts";
import { steerState } from "./steer-state.ts";
import { pointerToSteering } from "./steering.ts";
import { landingState } from "./landing-state.ts";
import App from "../ui/App.tsx";
import { getSimInput, consumeMapToggle, consumeViewCycle } from "./input.ts";
import {
  loadGame,
  saveGame,
  tryReconstruct,
  startAutosave,
  AUTOSAVE_EVENT_KINDS,
} from "./persistence.ts";
import type { World } from "../sim/ecs/world.ts";

async function boot(): Promise<void> {
  const saved = await loadGame();
  let world: World;
  let loadNotice: string | null = null;

  if (saved) {
    const restored = tryReconstruct(saved);
    if (restored) {
      world = restored;
    } else {
      loadNotice = "Couldn't load your save — started a new game.";
      world = createStartingSystem();
    }
  } else {
    world = createStartingSystem();
  }

  const bus = new GameBus();
  const renderer = createRenderer(world, document.body);

  // Keep the shared landing ref in sync with the sim's landing events.
  bus.onEvent((event) => {
    if (event.kind === "Landed") landingState.landedBodyId = event.bodyId;
    else if (event.kind === "TookOff") landingState.landedBodyId = null;
    // On warp arrival the active system's bodies were swapped — rebuild the scene.
    else if (event.kind === "ArrivedAtSystem") {
      landingState.landedBodyId = null;
      renderer.rebuildSystem(world);
    }
  });

  // Autosave: a timer, plus a debounced save on state-changing GameEvents, plus
  // best-effort saves when the page is about to be hidden/unloaded.
  const autosave = startAutosave(world);
  bus.onEvent((event) => {
    if (AUTOSAVE_EVENT_KINDS.has(event.kind)) autosave.onEvent();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void saveGame(world);
  });
  window.addEventListener("pagehide", () => {
    void saveGame(world);
  });

  // Mount the React UI overlay.
  const uiEl = document.getElementById("ui");
  if (uiEl) {
    createRoot(uiEl).render(React.createElement(App, { world, bus, loadNotice }));
  }

  // Fixed-timestep accumulator: catch the sim up to wall-clock in whole ticks.
  let last = performance.now();
  let accumulator = 0;
  const STEP_MS = FIXED_DT * 1000;
  const MAX_STEPS_PER_FRAME = 240; // spiral-of-death guard
  const STEER_SENSITIVITY = 0.06; // pointer-pixel → yaw/pitch Input gain

  function frame(now: number): void {
    accumulator += now - last;
    last = now;

    // Camera controls.
    if (consumeViewCycle()) renderer.cycleView();
    if (consumeMapToggle()) renderer.toggleMap();

    // Movement keys (W/S/A/D) translate the ship; the heading comes from steering.
    const input = getSimInput();

    // Mouse/touchpad steering: convert this frame's accumulated pointer delta into
    // yaw/pitch and clear the accumulator. Applied to the FIRST tick only so a given
    // pointer movement produces the same turn regardless of how many ticks the
    // frame runs (frame-rate-independent feel; the sim stays deterministic per
    // input stream). The keys carry no yaw/pitch, so steering is the sole source.
    const steer = pointerToSteering(steerState.dx, steerState.dy, STEER_SENSITIVITY);
    steerState.dx = 0;
    steerState.dy = 0;

    let steps = 0;
    while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      const tickInput =
        steps === 0 && (steer.yaw !== 0 || steer.pitch !== 0)
          ? { ...input, yaw: steer.yaw, pitch: steer.pitch }
          : input;
      const events = step(world, tickInput);
      for (const event of events) bus.emitEvent(event);
      bus.emitTick(world.tick);
      accumulator -= STEP_MS;
      steps++;
    }

    renderer.sync(world);
    renderer.render();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () =>
    renderer.resize(window.innerWidth, window.innerHeight),
  );

  requestAnimationFrame(frame);
}

void boot();
