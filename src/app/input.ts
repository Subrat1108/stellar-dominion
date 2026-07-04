// Keyboard state tracker — purely a capture layer, no sim/render logic.
//
// keydown/keyup listeners maintain a live Set of pressed keys.
// getSimInput() converts that to an Input for the sim each frame. consume*
// helpers fire once per press.
//
// Movement is four keys that only TRANSLATE the ship (heading is set by pointer
// steering, never keys):
//   W / S ... thrust forward / back along the nose (accelerate / decelerate+reverse)
//   A / D ... strafe left / right (lateral thrust, no rotation)
// Camera:
//   C ....... toggle camera view (cockpit ↔ chase)
//   M ....... toggle map view
//   hold left mouse button / trackpad double-tap-hold (in the renderer) ... steer

import type { Input } from "../sim/loop.ts";
import { steerState } from "./steer-state.ts";

const held = new Set<string>();
let mapTogglePending = false;
let viewCyclePending = false;

window.addEventListener("keydown", (e) => {
  held.add(e.code);
  if (e.code === "KeyM" && !e.repeat) mapTogglePending = true;
  if (e.code === "KeyC" && !e.repeat) viewCyclePending = true;
  // Hold Space = free-look modifier: while steering, pointer motion swings the
  // camera instead of turning the ship. preventDefault stops page scroll.
  if (e.code === "Space") { steerState.freeLook = true; e.preventDefault(); }
});

window.addEventListener("keyup", (e) => {
  held.delete(e.code);
  if (e.code === "Space") steerState.freeLook = false;
});

/** Build a sim Input from current keyboard state. Keys only TRANSLATE the ship;
 *  yaw/pitch come from pointer steering (merged in by the caller). */
export function getSimInput(): Input {
  const forward  = held.has("KeyW");
  const backward = held.has("KeyS");
  const left     = held.has("KeyA");
  const right    = held.has("KeyD");

  return {
    thrust: forward ? 1 : backward ? -1 : 0,
    strafe: right ? 1 : left ? -1 : 0,
    yaw: 0,
    pitch: 0,
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
