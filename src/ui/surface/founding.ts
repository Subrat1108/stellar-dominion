// Founding-flow logic (Slice 1, docs/17) — PURE. Decides, for the currently
// selected tile + world state, which action the surface UI should offer:
//   found        — no colony yet → found the first colony here (select→name→confirm)
//   enter        — the selected tile is the existing colony → open its panel
//   found-blocked — a NEW tile while a colony exists → the "found another" path,
//                   which is built but GATED in Slice 1 (canFoundAnother = false;
//                   the command layer also rejects a second colony as a backstop).
//                   Slice 2 flips canFoundAnother on (per-body colony list) and
//                   this same flow creates additional colonies — no UI rebuild.
//   none         — nothing selected.
//
// No React/DOM here so the state machine is unit-tested directly.

import type { TileCoord } from "../../sim/gen/surface.ts";

export type TileFoundingAction =
  | { kind: "none" }
  | { kind: "found"; tile: TileCoord }
  | { kind: "enter"; tile: TileCoord }
  | { kind: "found-blocked"; tile: TileCoord; reason: string };

export interface FoundingContext {
  /** A colony already exists on this planet. */
  hasColony: boolean;
  /** The existing colony's tile, if any. */
  foundedTile: TileCoord | null;
  /** The tile the player has selected on the map. */
  selectedTile: TileCoord | null;
  /** Whether founding a SECOND colony is allowed (Slice 1: false; Slice 2: true). */
  canFoundAnother: boolean;
}

export const SECOND_COLONY_GATE_REASON =
  "Multiple colonies per planet arrive with the economy slice (Slice 2).";

function sameTile(a: TileCoord, b: TileCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Resolve the founding action for the selected tile given world state. */
export function tileFoundingAction(ctx: FoundingContext): TileFoundingAction {
  const { hasColony, foundedTile, selectedTile, canFoundAnother } = ctx;
  if (!selectedTile) return { kind: "none" };
  if (!hasColony) return { kind: "found", tile: selectedTile };
  if (foundedTile && sameTile(foundedTile, selectedTile)) {
    return { kind: "enter", tile: selectedTile };
  }
  if (canFoundAnother) return { kind: "found", tile: selectedTile };
  return { kind: "found-blocked", tile: selectedTile, reason: SECOND_COLONY_GATE_REASON };
}

/** Suggested default name for a new colony (the UI pre-fills this; editable). */
export function defaultColonyName(bodyName: string): string {
  return `${bodyName} Base`;
}
