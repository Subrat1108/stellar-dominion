// App wiring: build the world, run the fixed-tick sim, render Three.js, mount React.
//
// The sim advances on a fixed-dt accumulator (frame-rate independent).
// speedState.value ticks are fired per accumulator drain, giving 1×–1000× time
// compression without changing the sim's fixed dt (docs/08).
// After the last tick per frame the GameBus emits; React re-renders as needed.

import React from "react";
import { createRoot } from "react-dom/client";
import { createStartingSystem } from "../sim/world-setup.ts";
import { step, FIXED_DT } from "../sim/loop.ts";
import { createRenderer } from "../render/scene.ts";
import { GameBus } from "./game-bus.ts";
import { speedState } from "./speed-state.ts";
import App from "../ui/App.tsx";
import { getSimInput, consumeMapToggle } from "./input.ts";

const world = createStartingSystem();
const bus = new GameBus();
const renderer = createRenderer(world, document.body);

// Mount the React UI overlay.
const uiEl = document.getElementById("ui");
if (uiEl) {
  createRoot(uiEl).render(React.createElement(App, { world, bus, speedState }));
}

// Fixed-timestep accumulator: catch the sim up to wall-clock in whole ticks.
// Each slot fires speedState.value ticks for configurable time compression.
let last = performance.now();
let accumulator = 0;
const STEP_MS = FIXED_DT * 1000;
const MAX_SLOTS_PER_FRAME = 240; // spiral-of-death guard on accumulator slots

function frame(now: number): void {
  accumulator += now - last;
  last = now;

  // Toggle camera mode when 'M' pressed.
  if (consumeMapToggle()) renderer.toggleCameraMode();

  const input = getSimInput();
  let slots = 0;
  while (accumulator >= STEP_MS && slots < MAX_SLOTS_PER_FRAME) {
    for (let i = 0; i < speedState.value; i++) {
      step(world, input);
    }
    bus.emitTick(world.tick);
    accumulator -= STEP_MS;
    slots++;
  }

  renderer.sync(world);
  renderer.render();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () =>
  renderer.resize(window.innerWidth, window.innerHeight),
);

requestAnimationFrame(frame);
