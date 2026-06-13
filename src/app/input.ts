// Keyboard state tracker — purely a capture layer, no sim/render logic.
//
// keydown/keyup listeners maintain a live Set of pressed keys.
// getSimInput() converts that to an Input for the sim each frame.
// consumeMapToggle() returns true once per 'M' keypress.

import type { Input } from "../sim/loop.ts";

const held = new Set<string>();
let mapTogglePending = false;

window.addEventListener("keydown", (e) => {
  held.add(e.code);
  if (e.code === "KeyM" && !e.repeat) mapTogglePending = true;
});

window.addEventListener("keyup", (e) => {
  held.delete(e.code);
});

/** Build a sim Input from current keyboard state. */
export function getSimInput(): Input {
  const forward  = held.has("KeyW") || held.has("ArrowUp");
  const backward = held.has("KeyS") || held.has("ArrowDown");
  const left     = held.has("KeyA") || held.has("ArrowLeft");
  const right    = held.has("KeyD") || held.has("ArrowRight");

  return {
    thrust: forward ? 1 : backward ? -1 : 0,
    yaw:    right   ? 1 : left     ? -1 : 0,
  };
}

/** Returns true (once) when the player presses 'M' to toggle the map view. */
export function consumeMapToggle(): boolean {
  if (mapTogglePending) { mapTogglePending = false; return true; }
  return false;
}
