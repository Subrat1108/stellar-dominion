// Shared mouse/touchpad steering state (Exploration Polish B).
//
// The renderer (scene.ts) owns the canvas + pointer-lock, so it writes the
// accumulated pointer delta here; the frame loop (main.ts) reads and clears it
// each frame, converting the delta into the sim's yaw/pitch Input. Kept as a
// plain mutable ref (like viewState / speedState) because the renderer and the
// loop both run outside React.
//
// `freeLook` (held modifier) routes pointer motion to the CAMERA instead of the
// ship, so steering and looking never fight; `pointerLocked` mirrors the browser
// pointer-lock so the UI can show the right prompt.

export const steerState: {
  /** Accumulated pointer delta since the last frame (device pixels). */
  dx: number;
  dy: number;
  /** True while the free-look modifier is held (motion looks, doesn't steer). */
  freeLook: boolean;
  /** True while the canvas holds a pointer lock (steering is live). */
  pointerLocked: boolean;
} = { dx: 0, dy: 0, freeLook: false, pointerLocked: false };
