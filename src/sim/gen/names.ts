// Deterministic name generation for fictional bodies (docs/13).
//
// Real stars and real planets carry their catalog/lore names; procedurally
// generated worlds need plausible, pronounceable designations that are stable
// for a given seed (so a body keeps its name across visits and saves). Pure
// function of the passed seeded RNG.

import type { Rng } from "../math/rng.ts";

const ONSETS = ["b", "c", "d", "f", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "v", "z", "th", "ph", "kr", "dr"];
const NUCLEI = ["a", "e", "i", "o", "u", "ae", "ei", "io", "ou"];
const CODAS = ["", "", "n", "r", "s", "l", "th", "x", "rn", "lis", "dor", "ar"];

/** A pronounceable proper name, e.g. "Theron", "Kaelis". */
export function generateBodyName(rng: Rng): string {
  const syllables = rng.int(2, 3);
  let s = "";
  for (let i = 0; i < syllables; i++) {
    s += ONSETS[rng.int(0, ONSETS.length - 1)]!;
    s += NUCLEI[rng.int(0, NUCLEI.length - 1)]!;
    if (i === syllables - 1) s += CODAS[rng.int(0, CODAS.length - 1)]!;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** A moon designation from its parent's name + index, e.g. "Theron III". */
export function moonName(parentName: string, index: number): string {
  return `${parentName} ${ROMAN[index] ?? String(index + 1)}`;
}
