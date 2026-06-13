// Tiny typed event bus bridging the deterministic sim loop and the React UI.
//
// Two channels:
//   - "tick": emitted after each step; useGameTick() subscribers re-render on
//     the throttled cadence they need.
//   - "event": typed GameEvents produced by the command layer (loop.ts). The UI
//     subscribes to react to results (e.g. a Landed event triggers the surface
//     view transition).
// Using EventTarget means no external dependency and no extra bundle weight.

import type { GameEvent } from "../sim/commands/types.ts";

export class GameBus extends EventTarget {
  emitTick(tick: number): void {
    this.dispatchEvent(new CustomEvent<number>("tick", { detail: tick }));
  }

  /** Emit a sim GameEvent (command result) to UI subscribers. */
  emitEvent(event: GameEvent): void {
    this.dispatchEvent(new CustomEvent<GameEvent>("event", { detail: event }));
  }

  /** Subscribe to GameEvents. Returns an unsubscribe function. */
  onEvent(handler: (event: GameEvent) => void): () => void {
    const listener = (e: Event) => handler((e as CustomEvent<GameEvent>).detail);
    this.addEventListener("event", listener);
    return () => this.removeEventListener("event", listener);
  }
}
