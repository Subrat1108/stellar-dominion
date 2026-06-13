// App wiring: build the seed world, run the fixed-tick sim, render it.
//
// This is the only place the deterministic sim and the real-time renderer meet.
// The sim advances on a fixed-dt accumulator (independent of frame rate); the
// renderer reads the latest state every animation frame. See docs/03 / docs/08.

import { createPhase0System } from "../sim/world-setup.ts";
import { step, FIXED_DT } from "../sim/loop.ts";
import { createRenderer } from "../render/scene.ts";

const world = createPhase0System();
const renderer = createRenderer(world, document.body);

const tickReadout = document.getElementById("tick");

// Fixed-timestep accumulator: catch the sim up to wall-clock in whole ticks,
// so simulation speed is frame-rate independent and stays deterministic.
let last = performance.now();
let accumulator = 0;
const STEP_MS = FIXED_DT * 1000;
const MAX_STEPS_PER_FRAME = 240; // guard against spiral-of-death after a stall

function frame(now: number): void {
  accumulator += now - last;
  last = now;

  let steps = 0;
  while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
    step(world);
    accumulator -= STEP_MS;
    steps++;
  }

  renderer.sync(world);
  renderer.render();

  if (tickReadout) {
    tickReadout.textContent = `· tick ${world.tick} · t=${world.time.toFixed(1)}s`;
  }

  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => {
  renderer.resize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(frame);
