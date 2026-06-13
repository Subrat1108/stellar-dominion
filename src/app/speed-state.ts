// Shared mutable speed multiplier — controls how many sim ticks advance per
// real-time frame. 1× = realtime; 1000× = 1000 sim ticks per frame step.
// This is the "configurable travel speed = time compression" lever (docs/08).
// The object is mutated directly by the HUD; the frame loop reads it each frame.

export type SpeedMultiplier = 1 | 10 | 100 | 1000;

export const speedState: { value: SpeedMultiplier } = { value: 1 };
