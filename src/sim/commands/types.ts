// Command / event layer types (Phase 2A, docs/09 Session 10).
//
// A Command is a discrete, state-mutating player INTENT — distinct from the
// per-tick continuous flight `Input` (loop.ts). Commands are plain serializable
// data: they are enqueued by the UI, then validated + applied deterministically
// at a fixed point inside the tick (see loop.ts). Results emit back as typed
// GameEvents through the GameBus. Nothing here imports the renderer or DOM.

import type { BuildingType, TerraformLever } from "../data/colony.ts";

/** A discrete player action queued for deterministic application in the tick. */
export type Command =
  | { kind: "SetCourse"; bodyId: number }
  | { kind: "CancelCourse" }
  | { kind: "LandAtBody"; bodyId: number }
  | { kind: "TakeOff" }
  | { kind: "FoundColony"; bodyId: number }
  | { kind: "BuildStructure"; bodyId: number; building: BuildingType }
  | { kind: "SetTerraformAllocation"; bodyId: number; lever: TerraformLever; fraction: number }
  // Warp (Step 1B): select + preview a destination, commit the jump, or abort.
  | { kind: "BeginWarpScan"; systemId: string }
  | { kind: "CommitWarp" }
  | { kind: "CancelWarp" };

/** Result of applying a command (events emitted on success; reason on reject). */
export type GameEvent =
  | { kind: "CourseSet"; bodyId: number; tick: number }
  | { kind: "CourseCancelled"; tick: number }
  | { kind: "Landed"; bodyId: number; tick: number }
  | { kind: "TookOff"; bodyId: number; tick: number }
  | { kind: "ColonyFounded"; bodyId: number; tick: number }
  | { kind: "StructureBuilt"; bodyId: number; building: BuildingType; tick: number }
  | { kind: "TerraformAllocationSet"; bodyId: number; lever: TerraformLever; fraction: number; tick: number }
  // Warp (Step 1B). WarpPhaseChanged also fires from warpSystem on timed transitions.
  | { kind: "WarpScanStarted"; systemId: string; tick: number }
  | { kind: "WarpCommitted"; systemId: string; tick: number }
  | { kind: "WarpCancelled"; tick: number }
  | { kind: "WarpPhaseChanged"; phase: "idle" | "scan" | "spool" | "transit"; systemId: string | null; tick: number }
  | { kind: "ArrivedAtSystem"; systemId: string; tick: number }
  | { kind: "CommandRejected"; command: Command; reason: string; tick: number };

/** Outcome of validating + applying one command. */
export type CommandResult =
  | { ok: true; events: GameEvent[] }
  | { ok: false; reason: string };
