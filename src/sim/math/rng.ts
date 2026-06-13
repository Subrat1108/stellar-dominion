// Deterministic, seedable PRNG for the simulation core.
//
// Determinism is sacred (CLAUDE.md): NOTHING in /sim may call Math.random().
// All randomness flows through this RNG so identical seeds reproduce identical
// runs — required for saves, debugging, and a possible future multiplayer.
//
// Algorithm: mulberry32 (32-bit state, fast, good statistical quality for a
// game). The seed string is hashed with a splitmix-style mixer so that human
// seeds ("alpha-centauri") and numeric seeds both spread well across the state.

export interface Rng {
  /** Raw 32-bit state. Serialise this to save/restore the stream exactly. */
  state: number;
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
}

/** Mix a 32-bit integer into a well-distributed 32-bit hash (splitmix32). */
function mix32(x: number): number {
  x = (x + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

/** Hash an arbitrary seed (string or number) into a 32-bit unsigned int. */
export function hashSeed(seed: string | number): number {
  if (typeof seed === "number") {
    return mix32(seed | 0);
  }
  let h = 0x811c9dc5; // FNV-ish offset
  for (let i = 0; i < seed.length; i++) {
    h = mix32(h ^ seed.charCodeAt(i));
  }
  return h >>> 0;
}

/** Construct an RNG from a seed, or restore one from a saved 32-bit state. */
export function makeRng(seed: string | number): Rng {
  const rng: Rng = {
    state: hashSeed(seed),
    next() {
      // mulberry32
      this.state = (this.state + 0x6d2b79f5) | 0;
      let t = this.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, max: number) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    range(min: number, max: number) {
      return min + this.next() * (max - min);
    },
  };
  return rng;
}
