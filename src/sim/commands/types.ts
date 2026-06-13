// Command / event layer types (Phase 2A, docs/09 Session 10).
//
// A Command is a discrete, state-mutating player INTENT — distinct from the
// per-tick continuous flight `Input` (loop.ts). Commands are plain serializable
// data: they are enqueued by the UI, then validated + applied deterministically
// at a fixed point inside the tick (see loop.ts). Results emit back as typed
// GameEvents through the GameBus. Nothing here imports the renderer or DOM.

/** A discrete player action queued for deterministic application in the tick. */
export type Command =
  | { kind: "SetCourse"; bodyId: number }
  | { kind: "CancelCourse" }
  | { kind: "LandAtBody"; bodyId: number }
  | { kind: "TakeOff" }
  | { kind: "FoundColony"; bodyId: number };

/** Result of applying a command (events emitted on success; reason on reject). */
export type GameEvent =
  | { kind: "CourseSet"; bodyId: number; tick: number }
  | { kind: "CourseCancelled"; tick: number }
  | { kind: "Landed"; bodyId: number; tick: number }
  | { kind: "TookOff"; bodyId: number; tick: number }
  // Stub for Phase 2B — validated + routed, no colony sim yet.
  | { kind: "ColonyFounded"; bodyId: number; tick: number }
  | { kind: "CommandRejected"; command: Command; reason: string; tick: number };

/** Outcome of validating + applying one command. */
export type CommandResult =
  | { ok: true; events: GameEvent[] }
  | { ok: false; reason: string };
