// App wiring: build the world, run the fixed-tick sim, render Three.js, mount React.
//
// The sim advances on a fixed-dt accumulator (frame-rate independent).
// After each tick the GameBus emits an event; React UI components subscribe
// and re-render on their own throttled cadence. See docs/03 / docs/08.

import React from "react";
import { createRoot } from "react-dom/client";
import { createStartingSystem } from "../sim/world-setup.ts";
import { step, FIXED_DT } from "../sim/loop.ts";
import { createRenderer } from "../render/scene.ts";
import { GameBus } from "./game-bus.ts";
import App from "../ui/App.tsx";

const world = createStartingSystem();
const bus = new GameBus();
const renderer = createRenderer(world, document.body);

// Mount the React UI overlay.
const uiEl = document.getElementById("ui");
if (uiEl) {
  createRoot(uiEl).render(React.createElement(App, { world, bus }));
}

// Fixed-timestep accumulator: catch the sim up to wall-clock in whole ticks.
let last = performance.now();
let accumulator = 0;
const STEP_MS = FIXED_DT * 1000;
const MAX_STEPS_PER_FRAME = 240; // spiral-of-death guard

function frame(now: number): void {
  accumulator += now - last;
  last = now;

  let steps = 0;
  while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
    step(world);
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
