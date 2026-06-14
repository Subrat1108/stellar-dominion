# CLAUDE.md — Project Root Context

> This file is loaded automatically by Claude Code at the start of every session.
> Keep it short and stable. Detailed material lives in `/docs` and is loaded **only when relevant**.
> When something here changes, update it deliberately — this is the project's source of truth.

---

## What we are building

**Title:** *Stellar Dominion* (confirmed)

A single-player **space 4X / grand-strategy + colony-sim** game. The player begins **stranded in a damaged spaceship with a small crew and basic starter materials**, and rises to control **planets → star systems → galaxies → (eventually) the wider universe**.

Core fantasy: *from one broken ship to a civilization that rules the stars.*

Core verbs: **explore, settle, terraform, build, trade, ally, conquer, rule.**

Design constraint: **grounded, not pure fantasy.** Star data, orbital mechanics, habitability, and terraforming are based on real science (see `docs/04-science-foundations.md`). Soft sci-fi is allowed only at clearly-marked frontiers (e.g. faster-than-light travel, the top "universe" scale).

---

## Hard constraints (do not violate without an explicit decision)

- **Dev machine:** MacBook Air (Apple Silicon, integrated GPU). Early builds must run light — modest compute, modest graphics.
- **Stack:** TypeScript, web-first (Vite + Three.js for 3D map views, HTML/React for UI). Designed to be wrapped as a desktop app later (Tauri). See `docs/03-tech-stack-and-architecture.md`.
- **No heavy real-time physics.** Use Kepler / patched-conic orbital math on a fixed simulation tick. No live n-body solving in the early phases.
- **Architecture:** deterministic simulation core, decoupled from rendering. Entity-Component-System (ECS). Saves are serialisable data.
- **Monetization:** none now, but never paint us into a corner — keep game logic portable and free of anything that blocks a future Steam/itch desktop release.
- **Cost target now:** ~$0 in tooling/hosting (everything free; only the AI subscriptions you already have).

---

## How to work in this repo (read before coding)

1. **Spec before code.** For any non-trivial feature, write or update the relevant `/docs` file first, then implement against it. This saves tokens and prevents drift.
2. **Touch the minimum context.** Load only the docs relevant to the current task. Don't pull the whole `/docs` folder into context "just in case."
3. **One vertical slice at a time.** Follow `docs/05-roadmap.md`. Don't build breadth before the current slice works end to end.
4. **Log decisions.** Architectural or design decisions go in `docs/09-decisions.md` (one line, dated, with rationale) and a one-line entry goes in `docs/07-devlog.md`.
5. **Determinism is sacred.** The simulation must produce identical results from identical inputs (needed for saves, debugging, and possible future multiplayer). Keep randomness seeded.
6. **Small commits, descriptive messages.** Git history is part of our memory.

## Session logging protocol (mandatory)

The planning room and future sessions only see what's pushed to the repo. End every session by: (1) appending a `## Session N` entry to `docs/07-devlog.md` (goal, did, decisions, next, open questions); (2) updating the **Current status** block in this file — it is the canonical state snapshot; (3) appending any decisions to `docs/09-decisions.md` with a one-sentence rationale; (4) committing and pushing to GitHub — pushing is what makes work visible to the planning room.

## Long tasks & checkpointing (don't lose work to context limits)

Long jobs can run out of context before finishing. Keep every task resumable from the repo alone: (1) plan as a checklist before starting, kept in an in-progress devlog entry; (2) commit after each working step (e.g. `wip(phase1): crew components`) — small checkpoint commits are breadcrumbs; never leave hours of work uncommitted; (3) maintain a **"Resume point"** line at the top of `docs/07-devlog.md` stating what's done and the exact next step, updated as you go; (4) if context runs low, finish the current step, update the resume point, commit and push, and tell me a fresh session is needed — don't push past the limit and lose the thread; (5) on completion, replace the in-progress notes with the normal Session entry.

## Division of AI labor (see `docs/06-ai-workflow-and-token-budget.md`)

- **Claude Code** → precise implementation, refactoring, architecture, debugging, anything touching the real codebase.
- **Gemini** (large context / free tier) → whole-codebase reviews, research for scientific accuracy, lore/content generation, brainstorming, summarising long material before it ever reaches Claude Code.

---

## Document index

| File | Purpose |
|---|---|
| `docs/01-project-charter.md` | Vision, pillars, roles, success criteria, scope guardrails |
| `docs/02-game-design.md` | Gameplay: scales, planet evolution, terraforming, colonies, trade, social, conflict |
| `docs/03-tech-stack-and-architecture.md` | Stack decision + rationale, IDE, ECS, repo layout, save format |
| `docs/04-science-foundations.md` | Real data sources, orbital mechanics, habitability, where soft sci-fi is allowed |
| `docs/05-roadmap.md` | Phased milestones / vertical slices, MVP definition |
| `docs/06-ai-workflow-and-token-budget.md` | Claude Code + Gemini workflow, token discipline, session protocol |
| `docs/07-devlog.md` | Running log of what was done each session |
| `docs/08-rendering-and-camera.md` | 3D open-world feel: camera scales, flight, landing, nav map, performance |
| `docs/09-decisions.md` | Decision log: every architectural/design choice, dated, one-sentence rationale, newest first |
| `docs/10-colony-science.md` | Colony resource & planetary architecture brief: resource set, production chains, ISRU, power scaling |
| `docs/11-terraforming-science.md` | Terraforming reference: levers, gate conditions, stage thresholds, feedback loops, 3A/3B split |

---

## Current status

- **Phase:** 3A — **complete (Session 14): terraforming core.** Three levers — **Temperature, Pressure, Hydrosphere** — as a resource sink funded by a colony, with precondition gating and the habitability payoff. Per-body gauges drive the body's **real** physical fields (`surfaceTempK`, `atmosphere.pressurePa`, new `hydrosphere`) toward Earth-like targets (288 K / 1 atm / 1.0). **Allocation** is a per-lever 0–100% share (independent levers); each econ-tick `terraformingStep` (in `colonySystem`, after flows, before population) burns `fraction × maxBurn` capped by the affordable fraction — **power from surplus generation**, metals/propellant/water from stockpile — and shifts the parameter by `fraction × maxShift × ratio`, clamped at target. Then derives `hasLiquidWater` from the hydrosphere gauge and **recomputes habitability**, which the Phase 2C population model already consumes as its growth factor — so terraforming visibly grows the colony. **Hydrosphere gate** (`math/terraforming.ts`): locked until pressure > Armstrong (0.0618 atm) AND temp > 0 °C, with the unmet condition spelled out. **`terraformStage`** → Barren/Frozen/Marginal/Habitable (docs/11 §4). **Command** `SetTerraformAllocation` (validated; rejects raising a gated lever). **UI** `TerraformingPanel` (in ColonyPanel): per-lever value→target, 0–100% slider, live burn, locked reason; header stage + habitability %. **Bug fixed:** catalog bodies were inserted by reference to shared module singletons (sim mutations leaked across worlds) — now `structuredClone`d per body in `world-setup.ts`. **98/98 tests; typecheck + build clean.**
- **Scope (Session 14):** 3A is direct lever→parameter effects + gates only (stays tunable). **Deferred to 3B:** Magnetosphere, Toxicity (Sabatier), Biosphere, and **all cross-lever feedback** (runaway greenhouse, pressure broadening, Urey drain, albedo trap). **No atmospheric stripping in 3A** — it arrives with the magnetosphere lever in 3B as a soft per-tick drain on the volatile levers.
- **Prior (Session 13):** per-building operational status (`buildingStatuses`) + bottleneck surfacing in ColonyPanel; Legibility added as Design Pillar 6.
- **Next action:** confirm in-browser (found colony on cold Glacius → allocate Temperature → watch temp + habitability climb → Hydrosphere unlocks past 0 °C → allocate it → habitability/stage improve), then **Phase 3B** — magnetosphere/toxicity/biosphere + feedback loops.
- **Last updated:** Session 14.

### Prior status — Phase 2B (Session 11)

- **Phase:** 2B — **complete** (colony economy, Session 11). **Resource economy** behind a real `FoundColony` (terraforming → Phase 3, population → 2C). **6 resources** (Power, Water, Oxygen, Food, Metals, Propellant — Propellant has no sink until Phase 4) and **5 buildings** (Solar, Ice Extractor, Smelter, Electrolysis, Hydroponics), all data-driven in `src/sim/data/colony.ts`. **Decoupled cadence:** `ECONOMY_TICK_INTERVAL = 60` runs `colonySystem` ~1 Hz (gated on `world.tick % 60`), sequenced before life-support. **colonySystem** (deterministic): power gen (solar × insolation `L/r²`) → power allocation by priority (Water Extractor → Electrolysis → Hydroponics → Smelter, suppliers before consumers) → production → crew consumption → clamp + cached flows; power/water shortages cascade. **Colony** component keyed by body id (+serialised). **FoundColony** conserves ship supplies (metals/food from inventory, propellant from fuel, water+oxygen offloaded from `lifeSupport.current`). **BuildStructure** command (colony exists, landed, enough Metals). **Survival payoff:** landed at a colony with oxygen → ship reserve recovers (+3/tick), reversing the clock. **UI:** `ColonyPanel` in SurfaceView — found action, resource ledger (stockpile + net/s), Metals-gated build menu. 72/72 tests; typecheck + build clean.
- **Last updated:** Session 11.

### Prior status — Phase 2A (Session 10)

- **Phase:** 2A — **complete** (command/event layer + placeholder landing, Session 10). **Command pattern:** typed `Command` (SetCourse, CancelCourse, LandAtBody, TakeOff, FoundColony[stub]) for discrete player actions, distinct from per-tick flight `Input`. `applyCommand` validates then mutates deterministically; `World.commandQueue` is drained inside `step()` (after `tick++`, before systems), which returns typed `GameEvent[]`; `main.ts` emits them on `GameBus`'s new event channel. UI dispatches via `src/app/command-bus.ts`. **Landing:** `ShipControl.landedBodyId` freezes flight; SystemPanel range-gated **LAND** button (rocky planets) → eased fade+zoom **SurfaceView** showing name/type/**surface gravity (g)**/temp/habitability, with stubbed "Found colony" (`FoundColony`, inert until 2B) + "Take off". **Gravity-as-a-stat:** `src/sim/math/physics.ts` (G·M/r²), first used in the surface view. 56/56 tests; typecheck + build clean.
- **Confirmed (Session 10):** command layer is the seam for all discrete actions (SET COURSE / cancel-autopilot routed through it; continuous flight input unchanged); gravity is a gameplay stat, not a flight force (flight stays arcade; Newtonian flight optional post-MVP); `commandQueue` is transient (not serialised — resulting state lives in components).
- **Next action:** confirm landing flow in-browser (approach → LAND enables → surface view → take off), then Phase 2B — colony economy (mining → resource flows → production) behind `FoundColony`.
- **Last updated:** Session 10.

### Prior status — Phase 1B (Session 9)

- **Phase:** 1B — **complete** (approach feel polished, Session 9). **Six-key flight:** W/S thrust, A/D yaw, ↑/↓ pitch; yaw correct (D = right). **Three camera views** — cockpit / chase / map; `C` cycles, `M` toggles; right-drag look-around. **Floating origin** (`worldRoot` offset by −shipPos). **Real-AU scale** (`AU_TO_SCENE` 200): Titan's Eye ~704 u. **Planet render scale 6×** (`PLANET_RADIUS_SCALE` 6): Earth-sized world ~6 u; autopilot parks at 1.5×renderRadius so the body fills the view on arrival. **Soft surface stop** (clamp + velocity kill when inside renderRadius). **Speed = throttle** (maxSpeed 0.01 base, 1000× = Titan's Eye in ~1 min). **Orbital time decoupled** (`ORBITAL_TIME_RATE` 0.0015). **Compass minimap** (ship-centric, heading up, 4 zoom levels, click-to-course). **Cockpit scanner** (nearest body within 100 u: name/type/dist/temp/habitability). **Distance-from-ship** in SystemPanel body list + inspector. **Orbit model moon-ready.** 43/43 tests; typecheck + build clean.
- **Confirmed (Session 9):** planet render scale 6× keeps orbit clearances healthy; autopilot park uses ECS `renderRadius` (no render coupling); compass minimap is the only minimap (system-scale; galaxy zoom Phase 5); scanner uses `viewState` plain ref (no prop threading).
- **Next action:** confirm approach feel in-browser (planet growth, autopilot arrival, scanner, compass zoom), then Phase 2 — first colony (land on a body, found a dome, resource flows).
- **Last updated:** Session 9.
