// Pure steering math (Exploration Polish B).
//
// No DOM / Three.js here — a deterministic mapping from an accumulated pointer
// delta (device pixels) to the sim's yaw/pitch Input axes, so it is unit-tested
// in isolation. The renderer accumulates the delta and the frame loop calls this
// once per frame; the result feeds the ship-movement turn integrator.

/** Steering axes, each clamped to the Input contract range [-1, 1]. */
export interface Steering {
  /** Yaw: +1 = steer right. Mouse +x (right) → steer right. */
  yaw: number;
  /** Pitch: +1 = nose up. Mouse +y is screen-down, so up-motion pitches up. */
  pitch: number;
}

function clamp1(v: number): number {
  const c = v < -1 ? -1 : v > 1 ? 1 : v;
  return c + 0; // normalise -0 → 0 (Object.is(-0, 0) is false; keeps tests clean)
}

/**
 * Map an accumulated pointer delta to steering axes. `sensitivity` is per-pixel
 * gain; the result is clamped to [-1, 1]. Sign conventions:
 *  - dx > 0 (pointer moved right) → yaw > 0 (steer right), matching Input.yaw.
 *  - dy > 0 (pointer moved down)  → pitch < 0 (nose down); moving up pitches up.
 */
export function pointerToSteering(dx: number, dy: number, sensitivity: number): Steering {
  return {
    yaw: clamp1(dx * sensitivity),
    pitch: clamp1(-dy * sensitivity),
  };
}
