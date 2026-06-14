/** Fixed simulation step in seconds. One tick = this much sim time. */
export const FIXED_DT = 1 / 60;

/**
 * Economy cadence: the colony economy runs once every this many flight ticks,
 * rather than at the 60 Hz flight rate — the same decoupling idea as the orbital
 * clock (docs/09). At 60 flight ticks/s this is one economy tick per real second,
 * so colony rates (data/colony.ts) are sized per real second and a starting
 * reserve lasts minutes, not seconds. Gated deterministically on
 * `world.tick % ECONOMY_TICK_INTERVAL === 0`.
 */
export const ECONOMY_TICK_INTERVAL = 60;
