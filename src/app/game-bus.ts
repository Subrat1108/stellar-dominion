// Tiny typed event bus bridging the deterministic sim loop and the React UI.
//
// The sim loop emits a "tick" CustomEvent after each step. React components
// subscribe via useGameTick() and re-render on the throttled cadence they need.
// Using EventTarget means no external dependency and no extra bundle weight.

export class GameBus extends EventTarget {
  emitTick(tick: number): void {
    this.dispatchEvent(new CustomEvent<number>("tick", { detail: tick }));
  }
}
