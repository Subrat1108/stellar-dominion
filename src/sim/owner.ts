// Owner (actor) identity — the multi-agent seam (docs/15 §6, docs/09 2026-07-18).
//
// The sim models "an ACTOR" abstractly. The player is AN owner id, never THE
// owner. Every actor-owned entity (colonies today; fleets/territory later)
// carries an `ownerId`, and every state-mutating command rides the command
// layer with an actor envelope (`{ command, actorId }`, see commands/types.ts)
// resolved by applyCommand. A command is byte-identical whoever issues it —
// player, AI, or network peer — so identity CANNOT live in the payload; it rides
// alongside. This module is the dependency-free home of that identity type so
// the rest of the sim can share one definition.

/** Stable identity of an actor that can own entities + issue commands. */
export type OwnerId = string;

/** The local human player's owner id. AN owner among (future) many, never THE owner. */
export const LOCAL_PLAYER_OWNER: OwnerId = "player";
