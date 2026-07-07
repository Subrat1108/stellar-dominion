# 05 — Roadmap

Built as **vertical slices**: each phase produces something playable end-to-end, not a half-finished layer. We do not start a phase until the previous slice actually works. Phases are deliberately ordered so the hardest scope (galaxy/universe scale, conquest) comes *after* the core loop is proven fun.

> Time estimates are intentionally omitted — this is solo + AI, part-time, over months. Progress is measured by completed slices, logged in `docs/07-devlog.md`.

---

## Phase 0 — Foundations *(complete)*
- [ ] These docs reviewed and decisions confirmed.
- [ ] Repo scaffolded: Vite + TypeScript (strict) + Vitest, with the `/src` layout from `docs/03`.
- [ ] Minimal ECS skeleton + fixed-tick loop running headless (a test proves determinism).
- [ ] First render: a stylised star + a couple of orbiting bodies drawn from real-ish orbital elements.

**Slice goal:** the engine ticks deterministically and you can see one system on screen.

## Phase 1 — The stranded ship in one system
- One curated, physically-plausible star system (real data, see `docs/04`).
- The ship entity with crew + starter materials + life-support consumable that ticks down.
- System map: select bodies, inspect real properties (mass, distance, temperature, habitability score).
- Win/lose-nothing-yet, but survival pressure is real (consumables run out).

**Slice goal:** you wake stranded, scan the system, and feel the clock.

## Phase 2 — First foothold & colony basics
- Land/establish on a chosen body; found a first colony (a dome).
- Mining/extraction → basic resource flows → simple production (life support, power, food).
- Population that grows/shrinks with conditions.

**Slice goal:** turn raw scarcity into a stable, growing outpost.

## Phase 3 — Terraforming loop
- Terraforming levers (temperature, atmosphere, water) on one body, staged over ticks.
- Habitability rises through stages; higher habitability unlocks larger unenclosed population.

**Slice goal:** transform a marginal world a meaningful step toward habitable. This is the signature moment — make it satisfying.

## Exploration-first interlude (re-sequenced) — the content engine, then the expansion layer

After Phase 3A the build pivots to **exploration-first sequencing**: before deepening any single system (3B feedback, multi-colony logistics) we lay the universe foundation so there is somewhere to explore. This interlude precedes the original Phase 4/5 work, which is folded into it.

### Step 1A — the content engine *(complete — Session 17)*
- Deterministic, seeded universe generation: real stars from a bundled HYG subset + procedurally-filled planets/moons (xxHash-seeded, Chen & Kipping mass–radius, "peas in a pod" spacing). See `docs/13`.
- Scope: the **local neighborhood only**. No sector/galaxy map, no warp UI, no tech tree, no economy changes — those are later steps.
- Generated bodies keep the exact `CelestialBody` shape the colony/terraforming/population/save systems already consume; each body tagged real / derived / fictional.
- Save = universe seed + player deltas (keyed by stable semantic identity, not raw entity id), behind a swappable save/load interface (flat JSON now; SQLite-WASM/OPFS deferred).
- First-pass procedural surfaces: Three.js `ShaderMaterial` (FBM/Simplex) that is a pure function of body properties + seed, transforming as terraforming runs.

**Slice goal:** the engine can generate a large, varied, grounded neighborhood from a seed — no hand-authoring per body — and the home system is itself produced through it.

### Step 1B — exploration & expansion (warp layer) *(complete — Session 18)*
- A dedicated **SectorView** scene (separate from the system map, entered by an eased zoom-out cross-fade) showing three real, catalog-placed star nodes: **Tau Ceti** (home), **YZ Ceti** (1.60 ly), **Luyten 726-8** (3.36 ly, the Gliese 65 binary); Epsilon Eridani + the rest are dim, locked background nodes (Step 1C). See `docs/12`.
- **Warp** is **ungated** ("god mode") this phase — no tech prerequisite, no resource cost. Four phases: **SCAN** (coarse probabilistic preview only) → **SPOOL** (committed countdown) → **TRANSIT** (locked sector crossing) → **ARRIVE** (destination generated via the 1A `generateSystem`, fog lifted, drop into the new system).
- **One active system** is fully simulated at a time (single persistent world, content swapped on warp; the ship entity persists). Off-view systems are **paused and lazily caught up** on re-entry (deterministic batch of the existing economy, clamped) — not ticked per-frame.
- Save extends the 1A seed+deltas model with **active-system id + discovered set + per-system deltas (keyed by stable systemId/bodyKey) + ship position**.
- **YZ Ceti** is generated through the engine via a RealSystemDef (its three real tidally-locked terrestrial candidates + seeded fill); its Star-Planet-Interaction radio hazard is surfaced as a **legible system trait** (scan + arrival UI), not a mechanic. ESI is a **UI tier label only**; `computeHabitability` stands.

**Slice goal:** fly to a neighboring real star (YZ Ceti) and explore a freshly-generated, genuinely-different system; warp home to your colony.

**Out of scope (deferred):** tech tree + warp gating/cost; the economy/anti-snowball systems (admin latency, courier upkeep, gravity-well tax, interstellar freight); sub-light interstellar probes; Epsilon Eridani; galaxy/universe tiers; any shielding-research / hazard-damage mechanic.

### Exploration polish — making the exploration leg *feel* good *(active — C, absorbing D)*
A focused, no-new-features pass triggered by playtest verdict: the exploration leg feels unrealistic and unsatisfying. **Governing principle (see `docs/09`):** *true relative proportions + real-AU distances + NO inflated bodies, made navigable by speed, targeting, and (later) the map* — **not** literal 1:1 with no aids (that makes space an empty void). Sub-phases:
- **A — rendering & flight-feel *(complete — Sessions 19–20)*.** Star-lit hemisphere + real day/night terminator on bodies (lighting from the system star at sim-origin); remove the 6× planet inflation so bodies sit at true radius in the existing AU→scene mapping (a world is a small dot until you close on it); re-derive everything coupled to the old inflated radius (autopilot park distance, soft-surface stop, scanner, **and the ship-avatar + camera-rig scale**, which shrink with honest bodies — scale-coupling, not new camera behavior); throttle/speed rework (5 exponential gears DOCK→MAX); a minimal flight-HUD target marker (edge-chevron extension of the cockpit scanner) so real-scale flight is navigable on its own. Session-20 fix pass: shrank the ship avatar to ~1:167 of a body, and made autopilot arrival insert into a low orbit with velocity-match (bodies no longer drift relative to the ship).
- **B — controls & cameras *(active — Session 21)*.** An immersive **cockpit** view (first-person pilot POV + a cheap canopy-frame overlay, HUD integrated); a real **control model** — SET COURSE (marks target + direction indicator) / AUTOPILOT (flies a trapezoidal profile, inserts to orbit) / LAND, with MANUAL vs AUTOPILOT modes (thrust locked in autopilot); **mouse/touchpad steering** via pointer lock with a held-modifier free-look; **two cameras only** (cockpit + third-person — the map leaves the camera cycle); and **deterministic patched-conic orbital gravity** (SOI-bounded gravity well with tuned-μ feel magnitude, real orbits, escape velocity — see `docs/09`). Gravity revises the Session-10 "flight is pure arcade" decision to the "middle rung."
- **C — unified multi-scale clickable map *(active — Session 22; absorbs D)*.** Promote the M-view into THE strategic map: one continuous zoom across `intra` (body+moons) → `system` → `sector` → `galactic` (LOCKED scaffold) → `intergalactic` (LOCKED scaffold), subsuming the separate SectorView into one continuum (deepest zoom-in resolves back into the flyable **active** system). Every node **labeled + clickable**; a click opens a **detail popup** (reuses the inspector fields — the old **D** folds in here) showing only the **context actions** valid for that body + state (SET COURSE / AUTOPILOT / ENTER ORBIT / LAND / WARP / SCAN / GET DETAILS, all wiring existing commands). **Ego-centric**: centered on the active system, the full reachable catalog set within `WARP_RANGE_LY` populates around it (capped at `MAX_MAP_NODES`; both tunable; reachability shown **ungated** in god mode). **Scan-gated drill-down**: unscanned systems show only the coarse scan preview + SCAN; **interactive interior fly-through is the active system only** (remote scanned interiors = Scope B, deferred — `docs/09` 2026-07-07). **Distance-proportional travel** (ETA + warp transit duration scale with distance; fuel/cost deferred). Fixes the **return-home** UI gate. Bundled with it (flight-feel + visuals): a **primitive-built stylized ship** replacing the cone + a **closer third-person camera** (camera-distance + near-plane knob, honest scale unchanged — 4a); a **deepened cockpit canopy** (dashboard/coaming silhouette) + **gradual manual acceleration** (4b). Map stays off the `C` camera cycle (reached by `M`).
- **D — body detail UI.** *(Absorbed into C: the body-inspection / detail panel is the map's click popup.)*

### Deferred / parked (so nothing falls off)
Explicitly held back during the exploration-first interlude, to be picked up in their own slices:
- **3B terraforming depth** — magnetosphere / toxicity / biosphere levers + cross-lever feedback (runaway greenhouse, pressure broadening, Urey drain, albedo trap, atmospheric stripping).
- **Fully-honest tight-system orbit spacing** — Exploration-polish A keeps the 1B orbit-placement floors (`orbitSceneRadius`, moon spacing) untouched (they're distance placement baked into sim data; touching them risks the YZ-Ceti / save-determinism tests). At honest body scale the floors' original justification (bodies overlapping at ultra-tight separations, esp. **YZ Ceti** 0.016–0.028 AU) weakens, so revisiting/relaxing them is a deferred follow-up.
- **Start-world difficulty / hard-start retune** — Step 1A keeps the current Tau Ceti tuning (Mira near-habitable). Retuning the home system into a deliberately harsh start (no free liveable world; terraforming as the only path) is a deliberate later content pass, not done now.
- **In-system logistics / multi-colony networks** — orbital transfers (time + propellant), depots, multi-colony resource routing (original Phase 4).
- **Dedicated economy / anti-snowball pass** — admin latency, gravity-well tax, bulk-vs-strategic resource split (`docs/12`).
- **Trade, diplomacy & governance** — rival AI, trade routes/prices, policy/factions/stability (original Phase 6).
- **Conflict & conquest** — fleets, defenses, tick/statistical resolution, governing taken worlds (original Phase 7).
- **Universe tier + wormholes** — galaxy/"universe" grand-strategy scale and any FTL topology beyond warp (frontier scale, `docs/04`).
- **Victory / balancing / monetization** — victory conditions across dominion paths, balancing pass, save hardening, desktop wrapper & monetization question (original Phase 8).

## Phase 4 — A full star system *(folded into the interlude / revisit after 1B)*
- Multiple bodies in play (planets, moons, asteroids, a gas giant).
- In-system navigation & orbital logistics (transfers cost time + fuel).
- Multi-colony resource network within the system.

**Slice goal:** manage a system, not just a planet.

## Phase 5 — Interstellar: the galaxy map *(superseded by Step 1B)*
- Several star systems; abstracted (tech-gated) interstellar travel.
- A galaxy/sector view; expansion beyond the home system.

**Slice goal:** the second star system is reachable and worth reaching.

## Phase 6 — Trade, diplomacy & social structures
- Rival powers (simple AI) and neutral settlements.
- Trade routes, prices, relationships.
- Governance/policy choices on your worlds; factions & stability.

**Slice goal:** soft power exists — you can prosper without firing a shot.

## Phase 7 — Conflict & conquest
- Fleets, defenses, logistics; tick-based / statistical resolution.
- Taking a world, then governing it (rebellion as a cost).

**Slice goal:** conquest is a viable, costly path to dominion.

## Phase 8 — Scale, endgame & polish
- Galaxy/"universe" grand-strategy tier (frontier scale per `docs/04`).
- Victory conditions tuned across the dominion paths.
- Balancing pass, save/load hardening, UX polish.
- *Then* (and only then) evaluate art investment and the monetization/desktop-wrapper question.

---

## MVP definition (the bar that proves the concept)
**Phases 0–3 completed and fun:** wake stranded → survive → found a colony → terraform a world a real step forward. If that loop is compelling, the rest is expansion. If it isn't, we fix it before scaling.

## Cross-cutting, always-on
- Determinism + tests on the sim core from day one.
- Devlog entry per session.
- Keep content data-driven so balancing never requires code changes.

## Parking lot (good ideas, deliberately deferred)
Captured so they aren't lost, but **not** to be built until the slice that needs them.
- **Moons.** Bodies orbiting planets rather than the star. The orbit data model is
  already moon-ready (`Orbit.parent` + parent-composed positioning in `orbitalSystem`,
  Session 8); content + UI come later.
- **Surface characteristics on approach.** LOD planet textures / detail that resolves
  as you near a body (today a planet is a flat-shaded sphere that just grows). Pairs
  with the approach/orbit scale in Phase 4.
- **Multi-scale map zoom.** A single navigation map that zooms across moon → system →
  galaxy/interstellar scales (the Session-8 minimap is system-scale only; galaxy/
  interstellar is Phase 5).

### Post-MVP / long-term vision pointers
*These belong to Phase 4+ or beyond. Each is expanded in `docs/research/01-foundational-macro-loops-and-territory.md`.*
- **Abstracted delta-v logistics (Phase 4+).** In-system transfers cost time + propellant derived from Hohmann/patched-conic math; players manage depots and windows rather than calculating equations manually. → research doc §"Delta-V as Logistical Currency"
- **Governance, administrative decay & legitimacy (Phase 5–6).** Light-lag as abstracted friction: distant colonies accumulate unrest, tax compliance drops, local factions drift — resolved through delegation and policy, not input-lockout. → research doc §"Political Fragmentation and Light-Lag"
- **MMO-style territory control (post-MVP).** Autonomous AI factions project zones of control over gravity wells and transit corridors; player arbitrates between internal powers rather than micromanaging. → research doc §"Integrating MMO-Style Territory Control"
- **Thermal/radiation taxation.** Every habitat and foundry generates waste heat; radiator capacity gates industrial output; solar proton events force surface shutdowns without heavy shielding. → research doc §"Thermal and Radiation Taxation System"
- **EROI economy depth.** Full supply-chain tiers (Extraction → Refining → Fabrication → Synthesis) with genuine energy bottlenecks and gravity-well trade friction, including Kessler Syndrome as emergent event. → research doc §"EROI Framework"
- **Emergent event system (e.g. Kessler cascade, secession crisis, processor failure).** Events triggered by simulated conditions (orbital traffic, power shortages, distance-decay), not random modifiers. → research doc §"Event Archetypes"
- **Gravity-map navigation UX.** Topographical "gravity map" view: wells as color-coded valleys, transit corridors as energy-cost gradients, node-based supply-chain overlay with bottleneck heat maps. → research doc §"Multi-Tiered Economic Legibility"
