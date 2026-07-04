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
import { maxSpeedForGear } from "../sim/presentation.ts";
import { createRenderer } from "../render/scene.ts";
import { GameBus } from "./game-bus.ts";
import { speedState } from "./speed-state.ts";
import { steerState } from "./steer-state.ts";
import { pointerToSteering } from "./steering.ts";
import { landingState } from "./landing-state.ts";
import App from "../ui/App.tsx";
import { getSimInput, consumeMapToggle, consumeViewCycle } from "./input.ts";

const world = createStartingSystem();
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
const STEER_SENSITIVITY = 0.06; // pointer-pixel → yaw/pitch Input gain

function frame(now: number): void {
  accumulator += now - last;
  last = now;

  // Camera controls.
  if (consumeViewCycle()) renderer.cycleView();
  if (consumeMapToggle()) renderer.toggleMap();

  // Throttle (speed lever): the gear's max speed (u/s) feeds the sim as throttle.
  const input = getSimInput();
  input.throttle = maxSpeedForGear(speedState.value);

  // Mouse/touchpad steering: convert this frame's accumulated pointer delta into
  // yaw/pitch and clear the accumulator. Applied to the FIRST tick only so a given
  // pointer movement produces the same turn regardless of how many ticks the
  // frame runs (frame-rate-independent feel; the sim stays deterministic per
  // input stream). Keyboard yaw/pitch apply on every tick as before.
  const steer = pointerToSteering(steerState.dx, steerState.dy, STEER_SENSITIVITY);
  steerState.dx = 0;
  steerState.dy = 0;

  let steps = 0;
  while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
    const tickInput =
      steps === 0 && (steer.yaw !== 0 || steer.pitch !== 0)
        ? {
            ...input,
            yaw: Math.max(-1, Math.min(1, input.yaw + steer.yaw)),
            pitch: Math.max(-1, Math.min(1, input.pitch + steer.pitch)),
          }
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
