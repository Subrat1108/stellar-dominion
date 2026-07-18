// UI-facing command dispatch. The React panels already hold the `world` ref, so
// dispatching is just enqueuing onto the world's command queue; the sim drains
// and applies it deterministically at the start of the next tick (loop.ts), and
// any resulting GameEvents come back via the GameBus "event" channel.
//
// Kept as a named seam (rather than calling enqueueCommand directly in the UI)
// so all player-action plumbing routes through one place.

import type { World } from "../sim/ecs/world.ts";
import { enqueueCommand } from "../sim/ecs/world.ts";
import type { Command } from "../sim/commands/types.ts";
import type { OwnerId } from "../sim/owner.ts";

/**
 * Enqueue a player action, tagged with the issuing actor (defaults to the local
 * player). The `actorId` seam means the UI dispatches identical commands to what
 * an AI/network owner would — identity rides the envelope (docs/15 §6), not the
 * command. The sim drains + applies deterministically next tick (loop.ts).
 */
export function dispatch(world: World, command: Command, actorId?: OwnerId): void {
  enqueueCommand(world, command, actorId);
}
