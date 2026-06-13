// Shared mutable throttle multiplier — scales the ship's acceleration and max
// speed (passed to the sim as Input.throttle). 1× = base thrust; 1000× = fast
// in-system cruising. The sim still ticks in real time; this is NOT time
// compression (that lever is deferred — see docs/08 / Session 6).
// The object is mutated by the HUD; the frame loop reads it each frame.

export type SpeedMultiplier = 1 | 10 | 100 | 1000;

export const speedState: { value: SpeedMultiplier } = { value: 1 };
