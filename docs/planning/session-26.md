# Session 26 — PLANNING — local persistence + offline progression

> PLANNING-room rationale for this session. The "why". Pairs with the BUILD-room
> "what" in `docs/07-devlog.md` and the one-line records in `docs/09-decisions.md`.

## Goal

Fix a real bug: the save system (serialize/migrate/SaveStore) was fully built
and tested but never wired into the app, so every browser refresh silently
regenerated a fresh universe and the player lost everything. Wire local
persistence (autosave + boot-load), then add offline progression — the colony
economy (incl. terraforming) deterministically fast-forwards for real time
spent away, reusing the existing off-view catch-up mechanism. Local-only per
`docs/15` §6's online ladder: no accounts, no server, no login — that's the
deferred rung; the `SaveStore` interface is the seam that swaps local→server
later without touching game code.

## Decisions (with rationale)

### 1. A single local "current game" slot behind the existing SaveStore, autosaved on a timer + debounced events + page-hide
**Call:** `app/persistence.ts` wraps `LocalStorageSaveStore` with one `"current"` slot. Autosave triggers: a 15 s timer, a 1 s debounce after state-changing `GameEvent`s (ColonyFounded, StructureBuilt, TerraformAllocationSet, Landed, TookOff, ArrivedAtSystem), and best-effort on `visibilitychange→hidden`/`pagehide`.
**Why:** No accounts/multiple-slots needed yet (`docs/15` §6 defers that to save-sync); a single slot is the minimum that fixes the actual bug. Layering a timer with event-triggered saves means the player is never more than ~15 s (or one meaningful action) from a safe point, without saving every single tick (wasteful, and JSON.stringify of the full delta payload isn't free).
**Logged:** `docs/09` (this session)

### 2. Boot never crashes on a bad save — corrupt/newer payloads fall back to a fresh game with a visible notice
**Call:** `tryReconstruct(payload)` wraps `reconstructWorld` in try/catch, returning `null` on any failure (including the migrator chain's "newer than supported" throw); boot then starts fresh and shows a dismissible notice via `SettingsMenu`.
**Why:** A production save layer must never turn a corrupted/incompatible save into a broken boot (`docs/15` §6 production-readiness bar). Silent data loss would be worse than a visible "couldn't load your save" notice — the player at least knows what happened.
**Logged:** `docs/09` (this session)

### 3. Explicit, confirm-guarded "New Game" — the only way the save is ever erased
**Call:** `SettingsMenu`'s New Game button requires a second confirm click before calling `clearGame()` + `location.reload()`. No other code path calls `clearGame`.
**Why:** Erasing a save is destructive and irreversible; a one-click reset risked wiping real progress by accident (the exact class of action `CLAUDE.md`'s "actions warranting confirmation" calls out).
**Logged:** `docs/09` (this session)

### 4. Offline progression is deliberately SLOWER than active play (a pleasant catch-up, not the primary way to progress)
**Call:** `OFFLINE_ECON_TICKS_PER_REAL_HOUR = 240` (tunable) — 1 real hour away credits ~4 active-play-equivalent minutes of colony economy (since 1 economy tick ≈ 1 active real second). Elapsed real time is clamped to `MAX_OFFLINE_ELAPSED_MS = 12h` before conversion, so a week-long absence still only credits 12 h worth.
**Why:** An initial 1:1-with-active-play design was rejected mid-session — it would make offline idling as productive as playing, undermining active play as the primary loop (`docs/15` §1–2). A slow, capped credit rewards returning without replacing play.
**Logged:** `docs/09` (this session); reuses `catchUpColony`'s clamp *pattern* but with its own separate constant (boot-time cost, not per-frame)

### 5. Offline progression reuses `runColonyEconomy` directly — verified terraforming advances, ship life-support does not
**Call:** `applyOfflineProgress` calls the SAME `runColonyEconomy` the off-view catch-up (`catch-up.ts`) already calls, N times for the credited economy-ticks, then advances `world.tick`/`time` to match and re-derives orbital positions (mirroring `reconstructWorld`'s post-restore `orbitalSystem` call). It does NOT call `lifeSupportSystem`.
**Why:** `runColony` (called by `runColonyEconomy`) already runs `terraformingStep` as step 6 of its fixed order — confirmed by code read AND a dedicated test (not just inspection) that a colony's terraforming lever actually advances a body's surface temperature across offline progress. This is the mechanism "come back to risen water" depends on, so it was verified explicitly before the summary UI was built on top of it, per the session brief. Ship life-support is deliberately excluded: closing the tab must never be able to kill the crew while the player is away — that would turn a bug-fix session into a nasty surprise. Advancing `world.tick` (not just running the economy loop) means inactive/stashed systems ALSO catch up correctly on next visit for free — `catchUpColony`'s existing `world.tick − lastSimTick` math already accounts for time that passed while the game was closed, with no new code needed for other systems.
**Logged:** `docs/09` (this session)

### 6. Background-tab progression reuses the same offline mechanism, with an UNCONDITIONAL accumulator reset to prevent double-counting
**Call:** `app/visibility-offline.ts`'s `handleVisibilityResume` applies offline progress for a hidden→visible gap (above a 60 s threshold) and — in EVERY branch, whether or not progress was applied — instructs the caller to reset the fixed-tick accumulator to 0. `main.ts` does so immediately, before the next frame.
**Why:** Without this, a backgrounded tab (where `requestAnimationFrame` throttles/pauses) would resume with a huge `accumulator` value, and the EXISTING spiral-of-death guard (`MAX_STEPS_PER_FRAME`) would silently replay the missed span through the live 1:1 loop over the next several frames — at the same time the new offline catch-up credits that same span at the slow rate. Both firing is a double-count. Making the reset unconditional (not "only when we decided to apply offline progress") closes the gap regardless of which branch ran, and is the one part of this guarantee that's actually unit-testable without a DOM (the contract is checked directly: both branches always return `resetAccumulatorMs: 0`).
**Logged:** `docs/09` (this session)

### 7. A dismissible "while you were away" summary, headlined by terraforming/water alongside population + habitability
**Call:** `OfflineSummary` shows elapsed real time, total population delta, max habitability delta, and — per explicit request — the max hydrosphere (water) delta across affected colonies, with a "(capped at 12h)" note when clamped.
**Why:** Silently fast-forwarding the player's colony without telling them reads as teleportation, not progress. Water/terraforming is called out specifically because it's the game's signature transformation loop (`docs/15` §2 "Legacy") — the payoff line a returning player most wants to see.
**Logged:** `docs/09` (this session)

### 8. Bugfix: UI gated on a transition EVENT (not restored STATE) desyncs across a reload — fixed with a one-time boot-time sync, not by adding more event plumbing
**Call:** User-reported after this slice shipped: reloading while landed correctly restored the sim (Cockpit's MODE readout showed LANDED) but `SurfaceView` (TAKE OFF / colony / site UI) never appeared. Root cause: `SurfaceView` reads a plain ref (`app/landing-state.ts`) that is ONLY ever written by the `Landed`/`TookOff` GameEvent listener in `main.ts` — a save reload restores `ctrl.landedBodyId` directly and never replays that event. Fix: `syncLandingStateFromWorld(world)` re-derives the ref from the actual ship state once, right after the world is built/restored and before the first UI render; `main.ts` calls it in both the fresh-world and loaded-world paths.
**Why:** The bug is a direct consequence of *this session's own change* (wiring boot-load in commit 1) exposing a pre-existing architectural gap: one piece of UI (`SurfaceView`) was quietly built event-driven while everything else in the app (Cockpit, MapView, SystemPanel, `ship-movement.ts`'s orbit hold) reads ship-control state live every render/tick. Before this session, the app always booted fresh, so the gap was invisible — nothing had ever "loaded into" an already-landed state. Checked orbit explicitly per the bug report: no equivalent gating ref exists there (confirmed by test: `ctrl.orbitingBodyId` round-trips through `reconstructWorld` and every consumer reads it live), so no fix was needed for orbit. The general principle — UI visibility should derive from state, and if an event-driven ref is unavoidable it must be synced once at boot — is recorded as a standing check in `docs/09`, not just a one-off patch, since any future event-gated UI has the same latent bug.
**Logged:** `docs/09` 2026-07-19 row

## Open questions / deferred

- Multiple named save slots, cloud/server sync, accounts/login — the deferred online-ladder rungs (`docs/15` §6), out of scope here by design.
- The tile/surface layer — explicitly deferred, and was called out as depending on this persistence fix landing first.
- Ship life-support during offline progression — deliberately left frozen (decision 5); revisit only if a future session wants offline survival pressure as a deliberate design choice, not a side effect.

## Scope guard

**In:** local persistence (autosave + boot-load, New Game reset), offline progression (deterministic fast-forward + clamp), a pause toggle, a "what happened while away" summary. Bad-save handling.
**Out:** accounts/server/login/multi-slot saves; the tile/surface layer; any change to sim mechanics, determinism, honest-scale/economy/landing work beyond persisting and fast-forwarding what already exists.
