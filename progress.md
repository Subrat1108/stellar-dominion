# Progress — start here

> The single "resume here" file. Any session (BUILD room or PLANNING room) should
> read this first to rebuild context cheaply, then follow the links below.
> **Keep this current at the end of every session** (see the session-logging
> protocol in `CLAUDE.md`).

## Current state (one paragraph)

The deterministic space-4X sim runs end-to-end: a seeded content engine generates
the Tau Ceti neighborhood (Step 1A), you can warp between systems (Step 1B), land,
found colonies, run the resource economy, and terraform (Phases 2–3A). **Exploration
Polish B (Session 21) is complete + tuned** — an immersive cockpit canopy, a real
control model (SET COURSE / AUTOPILOT / ENTER ORBIT / LAND), pointer-lock steering,
deterministic patched-conic orbital gravity, a spiral orbital insertion, solid
procedural planets, and flyable rings + a Kuiper belt. **Exploration Polish C
(Session 22) is now IN PROGRESS** — the slice that closes the exploration leg:
the **unified clickable multi-scale map** (one continuous zoom `intra → system →
sector → galactic(LOCKED) → intergalactic(LOCKED)`, ego-centric on the active
system, every node labeled + clickable → a detail popup with valid context actions;
absorbs the old Polish D body-detail panel and subsumes the separate SectorView),
plus a bundled **primitive-built ship model + closer camera** (4a), a **deepened
cockpit canopy + gradual manual acceleration** (4b), and the **return-home** fix
(a UI gate, not a state bug). **218 tests green** at the start of the slice
(the prior docs' "221" was inaccurate — `vitest run` reports 218).

## Active next step

**Building Polish C in five commits:** (1) docs *(this commit)* → (2) **map core**
(shared `app/map-state.ts` ref, `ui/MapView.tsx` labels/clicks/popup, pure
`bodyActions` valid-actions fn, renderer node-projection, fold `SectorPanel`) →
(3) **population + drill-down + galaxy scaffold + return-home** (ego-centric
recenter, distance-based reachability `WARP_RANGE_LY`/`MAX_MAP_NODES`, 5-tier
hysteresis, `data/galaxies.ts` locked scaffold, scan-gating, `transitTicksForLy`
+ ETA) → (4a) **primitive ship + near-plane/`CHASE_DIST` retune** (isolated so the
near-plane drop is cleanly revertable; multi-body in-browser depth check) → (4b)
**cockpit deepen + `thrustAccel` gradual accel**. New pure-fn tests: `bodyActions`,
tier/placement, `transitTicksForLy`, `thrustAccel` ramp, camera-constant invariants.
Determinism + honest-scale body math untouched; all 218 tests stay green. Design
rationale in `docs/planning/session-22.md`. **Scope decision (locked): A** —
interactive interior fly-through is the active system only; remote scanned-system
interiors (Scope B) deferred.

## Links

- [`docs/07-devlog.md`](docs/07-devlog.md) — BUILD-room log: what changed each session (newest at top).
- [`docs/09-decisions.md`](docs/09-decisions.md) — decision log: every architectural/design choice, dated, newest first.
- [`docs/05-roadmap.md`](docs/05-roadmap.md) — phased vertical slices; the Exploration-polish A–D sub-phases live here.
- [`docs/planning/`](docs/planning/) — PLANNING-room decisions per session (the design rationale that otherwise lives only in chat).
- [`CLAUDE.md`](CLAUDE.md) — project root context + the canonical **Current status** block + working protocols.
