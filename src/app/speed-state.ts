// Shared mutable throttle GEAR — an index into the exponential speed curve
// (presentation.maxSpeedForGear). The frame loop reads it each frame and passes
// the gear's MAX SPEED (u/s) to the sim as Input.throttle. The sim still ticks in
// real time; this is NOT time compression (that lever is deferred — docs/08).
// The object is mutated by the HUD; the frame loop reads it.

import type { SpeedGear } from "../sim/presentation.ts";

export type { SpeedGear };

// Default to CRUISE — meaningful open-space motion, still controllable.
export const speedState: { value: SpeedGear } = { value: 2 };
