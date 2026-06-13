// App wiring: build the world, run the fixed-tick sim, render Three.js, mount React.
//
// The sim advances on a fixed-dt accumulator (frame-rate independent) at exactly
// one tick per slot — real-time. The speed lever is a *throttle*: it scales the
// ship's acceleration / max speed via Input.throttle (NOT sim time compression).
// After ticking, the GameBus emits; React re-renders as needed.

import React from "react";
import { createRoot } from "react-dom/client";
import { createStartingSystem } from "../sim/world-setup.ts";
import { step, FIXED_DT } from "../sim/loop.ts";
import { createRenderer } from "../render/scene.ts";
import { GameBus } from "./game-bus.ts";
import { speedState } from "./speed-state.ts";
import App from "../ui/App.tsx";
import { getSimInput, consumeMapToggle, consumeViewCycle } from "./input.ts";

const world = createStartingSystem();
const bus = new GameBus();
const renderer = createRenderer(world, document.body);

// Mount the React UI overlay.
const uiEl = document.getElementById("ui");
if (uiEl) {
  createRoot(uiEl).render(React.createElement(App, { world, bus, speedState }));
}

// Fixed-timestep accumulator: catch the sim up to wall-clock in whole ticks.
let last = performance.now();
let accumulator = 0;
const STEP_MS = FIXED_DT * 1000;
const MAX_STEPS_PER_FRAME = 240; // spiral-of-death guard

function frame(now: number): void {
  accumulator += now - last;
  last = now;

  // Camera controls.
  if (consumeViewCycle()) renderer.cycleView();
  if (consumeMapToggle()) renderer.toggleMap();

  // Throttle (speed lever) scales ship acceleration via the input.
  const input = getSimInput();
  input.throttle = speedState.value;

  let steps = 0;
  while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
    const events = step(world, input);
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
