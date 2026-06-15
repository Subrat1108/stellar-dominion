// xxHash32 — fast, non-cryptographic, machine-independent 32-bit hash (docs/13).
//
// Used to turn a star's stable identity (HYG id + galactic coordinates) plus the
// universe seed into a single deterministic per-system seed, which then drives a
// seeded RNG. Same inputs → same hash on every machine (pure 32-bit integer math
// via Math.imul), so generated systems are reproducible — determinism is sacred.
//
// This is a standard xxHash32 implementation (Yann Collet). It operates on bytes;
// `systemSeed` encodes the inputs to a UTF-8 string and hashes that.

import { hashSeed } from "../math/rng.ts";

const P1 = 2654435761;
const P2 = 2246822519;
const P3 = 3266489917;
const P4 = 668265263;
const P5 = 374761393;

const rotl = (x: number, r: number): number => (x << r) | (x >>> (32 - r));

const round = (acc: number, val: number): number => {
  acc = (acc + Math.imul(val, P2)) | 0;
  acc = rotl(acc, 13);
  return Math.imul(acc, P1) | 0;
};

const read32 = (b: Uint8Array, i: number): number =>
  (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) | 0;

/** xxHash32 of a byte buffer with an optional 32-bit seed. Returns unsigned. */
export function xxHash32(buf: Uint8Array, seed = 0): number {
  const len = buf.length;
  let i = 0;
  let h: number;

  if (len >= 16) {
    let v1 = (seed + P1 + P2) | 0;
    let v2 = (seed + P2) | 0;
    let v3 = seed | 0;
    let v4 = (seed - P1) | 0;
    const limit = len - 16;
    while (i <= limit) {
      v1 = round(v1, read32(buf, i)); i += 4;
      v2 = round(v2, read32(buf, i)); i += 4;
      v3 = round(v3, read32(buf, i)); i += 4;
      v4 = round(v4, read32(buf, i)); i += 4;
    }
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) | 0;
  } else {
    h = (seed + P5) | 0;
  }

  h = (h + len) | 0;

  while (i + 4 <= len) {
    h = (h + Math.imul(read32(buf, i), P3)) | 0;
    h = Math.imul(rotl(h, 17), P4) | 0;
    i += 4;
  }
  while (i < len) {
    h = (h + Math.imul(buf[i]!, P5)) | 0;
    h = Math.imul(rotl(h, 11), P1) | 0;
    i += 1;
  }

  h ^= h >>> 15;
  h = Math.imul(h, P2);
  h ^= h >>> 13;
  h = Math.imul(h, P3);
  h ^= h >>> 16;
  return h >>> 0;
}

const encoder = new TextEncoder();

/** Hash an arbitrary string with xxHash32 and an optional seed. */
export function xxHashString(s: string, seed = 0): number {
  return xxHash32(encoder.encode(s), seed);
}

/** Stable identity inputs for a star — what the per-system seed is derived from. */
export interface StarSeedInput {
  /** Catalog id (HYG record id). */
  id: number;
  /** Galactic cartesian coordinates in parsecs. */
  x: number;
  y: number;
  z: number;
}

/**
 * Deterministic per-system seed from (universe seed + star identity). The
 * universe seed mixes into the xxHash seed so different universes diverge, while
 * the star's id + coordinates make each system unique and reproducible.
 */
export function systemSeed(universeSeed: string | number, star: StarSeedInput): number {
  const key = `${star.id}|${star.x}|${star.y}|${star.z}`;
  return xxHashString(key, hashSeed(universeSeed));
}
