// Keyboard state tracker — purely a capture layer, no sim/render logic.
//
// keydown/keyup listeners maintain a live Set of pressed keys.
// getSimInput() converts that to an Input for the sim each frame (throttle is
// filled in by the caller from speedState). consume* helpers fire once per press.
//
// Flight is a deliberately small six-key scheme:
//   W / S ... thrust forward / back along the nose
//   A / D ... steer left / right (yaw)
//   ↑ / ↓ ... steer up / down (pitch)
// Camera:
//   C ....... cycle camera view (cockpit → chase → map)
//   M ....... toggle map view
//   right-drag (handled in the renderer) ... look around

import type { Input } from "../sim/loop.ts";

const held = new Set<string>();
let mapTogglePending = false;
let viewCyclePending = false;

window.addEventListener("keydown", (e) => {
  held.add(e.code);
  if (e.code === "KeyM" && !e.repeat) mapTogglePending = true;
  if (e.code === "KeyC" && !e.repeat) viewCyclePending = true;
  // Stop the pitch arrows from scrolling the page while flying.
  if (e.code === "ArrowUp" || e.code === "ArrowDown") e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  held.delete(e.code);
});

/** Build a sim Input from current keyboard state (throttle defaults to 1). */
export function getSimInput(): Input {
  const forward  = held.has("KeyW");
  const backward = held.has("KeyS");
  const yawLeft  = held.has("KeyA");
  const yawRight = held.has("KeyD");
  const pitchUp  = held.has("ArrowUp");
  const pitchDn  = held.has("ArrowDown");

  return {
    thrust: forward ? 1 : backward ? -1 : 0,
    yaw:    yawRight ? 1 : yawLeft ? -1 : 0,
    pitch:  pitchUp ? 1 : pitchDn ? -1 : 0,
    throttle: 1,
  };
}

/** Returns true (once) when the player presses 'M' to toggle the map view. */
export function consumeMapToggle(): boolean {
  if (mapTogglePending) { mapTogglePending = false; return true; }
  return false;
}

/** Returns true (once) when the player presses 'C' to cycle the camera view. */
export function consumeViewCycle(): boolean {
  if (viewCyclePending) { viewCyclePending = false; return true; }
  return false;
}
