# 07 — Devlog

A running, append-only log. **One short entry per work session.** New entries go at the top. This is how any future session (or AI) reconstructs "where are we and why" cheaply.

Entry template:
```
## Session N — YYYY-MM-DD
- Goal: (one line, tied to a roadmap phase)
- Did: (what actually changed — code, docs, decisions)
- Decisions: (any, with one-line rationale; link the doc updated)
- Next: (the single next action)
- Open questions: (if any)
```

---

## Session 10 — Phase 2A: command/event layer + landing transition
- **Goal:** Build the deferred sim↔UI command/event layer at the start of Phase 2 (architecture, not colony economy — that's 2B), plus a placeholder landing transition + surface view. Determinism + tests stay green.
- **Did:**
  - **Command/event layer** (`src/sim/commands/{types,apply}.ts`): typed `Command` (SetCourse, CancelCourse, LandAtBody, TakeOff, FoundColony[stub]) distinct from the per-tick flight `Input`. `applyCommand(world, cmd)` validates then mutates deterministically (no `Math.random`/`Date`); returns `CommandResult` carrying typed `GameEvent`s. Headless/testable.
  - **Tick wiring:** `World.commandQueue` (transient, not serialised) + `enqueueCommand`. `step()` now drains the queue **after `tick++`, before the systems**, and returns `GameEvent[]`; `main.ts` emits them on `GameBus`. New `GameBus` event channel (`emitEvent`/`onEvent`). UI dispatches via `src/app/command-bus.ts` → `dispatch(world, cmd)`.
  - **Routing existing actions:** SET COURSE (SystemPanel + Minimap) and cancel-autopilot (HUD) now go through `dispatch` as `SetCourse`/`CancelCourse`; continuous flight input untouched.
  - **Landing:** `ShipControl.landedBodyId` freezes flight in `shipMovementSystem` when set. `parkDistance(renderRadius)` extracted to `presentation.ts`, shared by autopilot + landing validation. SystemPanel gains a range-gated **LAND** button (rocky planets only) → `LandAtBody`.
  - **Surface view** (`src/ui/SurfaceView.tsx`): eased fade+zoom overlay (not seamless descent, docs/08) on the `Landed` event; shows name/type/**surface gravity (g)**/temp/habitability; "Found colony here" → `FoundColony` (inert until 2B) and "Take off" → `TakeOff`. `landing-state.ts` ref synced by `main.ts`; `useLandingState()` mirrors to React.
  - **Gravity-as-a-stat:** `src/sim/math/physics.ts` — `surfaceGravity`/`surfaceGravityG` (G·M/r²), first consumed in the surface view.
  - **Tests:** `tests/commands.test.ts` (13) — validation (reject land-on-star/gas-giant/too-far/takeoff-when-not-landed/found-without-landing/set-course-while-landed) + deterministic application (land freezes ship; identical queues → identical serialized world). 56/56 green; typecheck + build clean.
- **Decisions:** (a) command/event layer built now at the start of Phase 2; (b) gravity is a gameplay stat, not a flight force — flight stays arcade, Newtonian flight optional post-MVP. Both in `docs/09`.
- **Next:** confirm the landing flow in-browser (approach → LAND enables in range → fade-in surface view → stats read right → take off), then Phase 2B — colony economy (mining → resource flows → production) behind the `FoundColony` command.
- **Open questions:** surface view is a flat gradient placeholder — when does it earn a real surface render (likely alongside Phase 4 approach LOD)? Should `FoundColony` later create a Colony entity + component now or in 2B (currently pure stub)?

## Session 9 — Phase 1B approach feel & navigation UX
- **Goal:** Make planets read as real worlds on approach, improve autopilot arrival, replace the world-fixed minimap with a ship-centric compass, add a cockpit scanner, and add distance-from-ship to the system panel. Determinism + tests stay green.
- **Did:**
  - **Planet render scale 6×** (`src/sim/presentation.ts`): `PLANET_RADIUS_SCALE` 1.0→6.0, `PLANET_RADIUS_MIN` 0.7→4.0, `GAS_GIANT_SCALE` 0.26→1.5, `STAR_RENDER_RADIUS` 10→12. Earth-sized planet now ~6 u; autopilot parks at ~9 u giving ~66° apparent diameter at the park point. Orbit surface-clearances remain healthy (Ferrum/Caldor tightest at ~22 u).
  - **Autopilot park at render radius** (`src/sim/systems/ship-movement.ts`): replaced hardcoded `dist > 2` with `dist > max(bodyR * 1.5, bodyR + 3)` reading `body.renderRadius` from the ECS. Ship arrives facing the body with it filling the view.
  - **Soft surface stop** (`ship-movement.ts`): after each position integration, clamp position back to `renderRadius + 0.3` and zero inward velocity for any body the ship penetrates. Star handled via `STAR_RENDER_RADIUS` (no Transform component).
  - **Compass minimap** (`src/ui/Minimap.tsx`, rewrite): ship fixed at centre, nose pointing up. Bodies projected into ship-relative space and rotated by −heading. Four zoom levels (20/80/300/800 u) via scroll wheel or ± buttons. Clipped blips pin to edge with dashed stroke. Click blip → autopilot course. Name labels shown when not clipped.
  - **Cockpit scanner** (`src/ui/Scanner.tsx`, new; wired in `App.tsx`): visible in cockpit/chase views only; shows nearest body within 100 u: name, type, distance, surface temp, habitability label. Bottom-centre, pointer-events off so it doesn't intercept input.
  - **Distance-from-ship in SystemPanel** (`src/ui/SystemPanel.tsx`): live distance column in the body list (each row); distance-from-ship row in the inspector for both stars and planets/gas-giants. Updates every 12 ticks.
  - **Tests**: 43/43 green; typecheck + prod build clean.
- **Decisions:** planet render scale 6×; autopilot park at 1.5×renderRadius; soft surface stop; compass minimap with 4 zoom levels; cockpit scanner 100 u range — all in `docs/09`.
- **Next:** confirm approach feel in-browser (planet growth, autopilot arrival, scanner trigger, compass minimap zoom), then Phase 2 — first colony (land on a body, found a dome, resource flows).
- **Open questions:** scanner range of 100 u may need tuning once planets are visually larger; also consider whether the scanner should show the *targeted* body rather than the *nearest* one.

---

## Session 8 — Phase 1B polish: flight & navigation
- **Goal:** Polish the flight/nav feel — fix inverted yaw, spread the system to real-AU scale, add a proximity readout + system minimap, keep the orbit model moon-ready. Determinism + tests stay green.
- **Did:**
  - **Inverted yaw fixed** (`src/sim/systems/ship-movement.ts`): `Input.yaw` already contracts +1 = right, but the heading update applied it as an *increase*, and in the flight camera (behind the ship, looking down +nose) world +X renders screen-left — so pressing D turned the nose left. Flipped the heading-update sign and the autopilot's computed-yaw sign to match. Updated the two yaw-direction tests + added a turn-direction test (`yaw=+1` then thrust ⇒ ship gains −X / screen-right). Works in cockpit and chase (shared nose-based camera).
  - **Real-AU distance scale** (`src/sim/presentation.ts`): `AU_TO_SCENE` 12→200, `STAR_CLEARANCE` 8→4 → Ferrum 44 u … Titan's Eye ~704 u, planet radii still ~1 u so a planet reads as a point that grows on approach. `STAR_RENDER_RADIUS` 4.5→10. Ship spawns at z=60 (just outside Ferrum).
  - **Speed retuned** (`world-setup.ts`, `ship-movement.ts`): ship `maxSpeed` 10→0.01 (1× = fine docking, 1000× = 10 u/s → Titan's Eye reachable from start in ~1 min), `BASE_ACCEL` 4→0.03 so there's an acceleration ramp instead of snapping to the cap. `ORBITAL_TIME_RATE` 0.003→0.0015 so planets stay near-stationary at the larger radii.
  - **Renderer scaled to the bigger system** (`src/render/scene.ts`): starfield pushed to 4000–6000 u (so the ship never reaches the shell mid-flight), camera far plane 4000→12000, map camera (0,600,900) + `maxDistance` 6000, map-marker scale 6→40.
  - **Proximity readout** (`src/ui/DebugPanel.tsx`): new NEAREST row (nearest-body name + distance) for approach feel.
  - **System minimap** (`src/ui/Minimap.tsx`, new; wired in `App.tsx`): top-left top-down radar drawing star/planets/ship to scale (X/Z projection, edge-clamped); clicking a body sets an autopilot course. System-scale only.
  - **Orbit model moon-ready** (`src/sim/systems/orbital.ts`): `orbitalSystem` now composes a body's Kepler position with its parent's transform when the parent has one. Current bodies parent the transform-less star → fall back to the origin, so behaviour + determinism are unchanged. Design-only; no moons added.
  - **Docs:** `docs/05` gained a Parking-lot section (moons; surface LOD on approach; multi-scale map zoom). Decisions added to `docs/09`.
  - **Tests:** 43/43 green (added the turn-direction test); typecheck + prod build clean.
- **Decisions:** real-AU scale (`AU_TO_SCENE` 200); speed/accel retune; sim-layer yaw fix; moon-ready orbit composition; fixed system-scale minimap — all in `docs/09`.
- **Next:** confirm flight feel in-browser (yaw direction, planets growing on approach, ~1 min cruise to Titan's Eye, minimap click-to-course), then Phase 2 (first colony).
- **Open questions:** the fixed 1×–1000× throttle range makes 1× precision-only (not a system stroll); if that feels too slow in-browser, add a 10000× step.

---

## Session 7 — Phase 1B tuning: orbital time, scale, controls
- **Goal:** Three small tuning changes from playtest feel. Keep determinism + tests green.
- **Did:**
  - **Orbital time decoupled from flight time** (`src/sim/systems/orbital.ts`): planets were positioned from real-time `world.time` and whipped around their orbits as you flew, so you could never close on one. Added `ORBITAL_TIME_RATE = 0.003`; the orbital system now advances on `world.time * ORBITAL_TIME_RATE`. Innermost planet (Ferrum, ~0.2 AU) effective period ≈ 1 h → nearly stationary during a flight, visibly drifts over several real minutes. Still a pure function of tick (deterministic). New `tests/orbital.test.ts` guards it.
  - **Presentation scale centralized** (`src/sim/presentation.ts`, new): the only place for AU→scene distance (`sceneDistance`), body render-radius scaling (`planetRenderRadius`/`gasGiantRenderRadius`/`STAR_RENDER_RADIUS`), and ship size (`SHIP_RADIUS`/`SHIP_LENGTH`). Re-tuned for a believable hierarchy: ship 0.32 long, planets ~0.8–1.0, gas giant ~2.3, star 4.5; distances `8 + au*12`. `tau-ceti.ts` render radii now derive from physical radii via the helpers (physical values untouched/tagged); `world-setup.ts` uses `sceneDistance` and the ship spawns at z=11 clear of the larger star; `scene.ts` uses the ship-size constants and retuned chase/cockpit offsets + a map-marker scale.
  - **Controls simplified to six keys** (`input.ts`, `loop.ts`, `ship-movement.ts`, `DebugPanel.tsx`): W/S thrust, A/D yaw, ↑/↓ pitch. Removed Space/Shift world-vertical entirely (climb/dive by pitch-then-thrust); `Input` lost the `vertical` axis. Kept C (cycle view), M (map), right-drag look-around.
  - **Tests:** removed the now-irrelevant vertical-thrust test, added the orbital-decoupling test → **42/42 green**; typecheck + prod build clean.
- **Decisions:** orbital-time decoupling via `ORBITAL_TIME_RATE`; central presentation scale with compressed (non-physical) render radii; six-key control scheme (world-vertical removed) — all in `docs/09`. `docs/08` gained Flight-controls, Presentation-scale, and Orbital-time sections.
- **Next:** confirm feel in-browser (planets approachable, sizes believable, controls simpler), then Phase 2 (first colony).
- **Open questions:** throttle scaling (1×–1000×) vs system size still placeholder — at high throttle you cross the system near-instantly; revisit when autopilot/approach lands.

---

## Session 6 — Phase 1B fixes: flight model rework (playtest feedback)
- **Goal:** Fix three issues a playtest surfaced in the Session-5 build: (a) the star never got closer / "planets revolving around nothing"; (b) the ship could only go forward/back; (c) the speed lever felt wrong as time compression. Add debug instrumentation.
- **Did:**
  - **Floating-origin bug fixed** (`src/render/scene.ts`): root cause was `sync()` offsetting only meshes that have a `Transform` — the star (no transform) stayed pinned at render origin and the orbit rings + starfield were never moved, so the scene decohered the instant you flew. Rewrote it as the textbook pattern: star + planets + orbit rings + starfield + star-light all live in one `worldRoot` group offset by `-shipPos` each frame; the ship stays at render `(0,0,0)`. Map view sets the offset to zero (true coords) and draws the ship as an enlarged marker at its real position.
  - **Full 3D flight** (`src/sim/systems/ship-movement.ts`): added `pitch` to `ShipControl`; velocity is now a full `Vec3`. Yaw + pitch orient the nose (shared `noseVector()` used by both sim and renderer); thrust drives along the nose; Space/Shift give world-vertical thrust. Pitch clamped to ±(90°−0.05) to avoid flipping. `Input` gained `pitch`, `vertical`, `throttle`. Autopilot updated to steer in 3D.
  - **Speed → throttle** (`src/app/main.ts`, `speed-state.ts`): reverted the multi-tick time-compression loop; sim runs real-time (1 tick/frame). The 1×/10×/100×/1000× buttons now feed `Input.throttle`, scaling acceleration + max speed. HUD label → THROTTLE.
  - **Three camera views** (`scene.ts`, `src/app/view-state.ts`): cockpit (first-person, hull hidden) / chase (behind+above, racing-style) / map (OrbitControls). `C` cycles, `M` toggles map. Right-click drag = look-around in flight views.
  - **Input** (`src/app/input.ts`): W/S thrust, A/D yaw, ↑/↓ pitch, Space/Shift vertical, C cycle view, M map; prevents Space/arrows from scrolling the page.
  - **Debug overlay** (`src/ui/DebugPanel.tsx`): bottom-left live readout (view, throttle, pos, vel, speed, heading, pitch, distance-to-star, autopilot) + a throttled (~1 Hz) console log of the same, for log-based testing.
  - **Tests:** ship-movement suite rewritten for the 3D `Input` (helper fills defaults); added pitch/vertical/throttle/clamp coverage. **42/42 passing.** Typecheck + prod build clean.
- **Decisions:** speed lever = throttle not time compression; full 3D flight (supersedes XZ-only); floating origin via `worldRoot` group; three camera views; debug overlay — all in `docs/09`. `docs/08` travel-speed section annotated with the Phase 1B revision.
- **Next:** confirm the flight feel in-browser; then Phase 2 (first colony) or a polish pass on autopilot/approach.
- **Open questions:** throttle scaling values (1×–1000×) are placeholders — tune once there's a real sense of system scale. True time-compression to be reintroduced as a separate "skip travel" control alongside autopilot routes (Phase 4).

---

## Session 5 — Phase 1B: cockpit camera + in-system cruising
- **Goal:** Phase 1B per `docs/05` — chase/cockpit camera, keyboard steering, configurable speed (time compression), floating origin, autopilot stub.
- **Did:**
  - **Ship movement sim** (`src/sim/systems/ship-movement.ts`, new): `ShipVelocity` and `ShipControl` ECS components; `shipMovementSystem` applies thrust/yaw input, rotates heading, integrates velocity into position each tick. Velocity capped at `maxSpeed`. Drag (`0.98/tick`) provides natural deceleration. Deterministic: same inputs → same state. 9 new tests, 38 total passing.
  - **FIXED_DT extracted** to `src/sim/constants.ts` so both `loop.ts` and `ship-movement.ts` can import it without circular deps. `loop.ts` re-exports it for backward compatibility.
  - **Input layer** (`src/app/input.ts`): `keydown/keyup` listeners capture WASD/arrow state; `getSimInput()` builds `Input{thrust, yaw}` each frame; `consumeMapToggle()` fires once per M press.
  - **Speed multiplier** (`src/app/speed-state.ts`): shared mutable `{ value: 1|10|100|1000 }`. Main loop fires `speedState.value` sim ticks per accumulator slot. Life support depletes faster at higher speed — correct, intentional (docs/08). HUD gains 4 speed buttons.
  - **Chase camera** (`src/render/scene.ts`): two modes — `'flight'` (camera at CHASE_DIST=5 behind, CHASE_HEIGHT=2 above ship, aimed ahead) and `'map'` (OrbitControls free-look). M key toggles. Right-click drag gives mouse-look offset in flight mode. Ship mesh added (low-poly cone, pointing +Z).
  - **Floating origin**: `sync()` subtracts ship sim position from every mesh position each frame; ship always renders at `(0,0,0)`. Sim retains absolute coordinates (docs/08 pattern). Prevents float-precision jitter at large distances.
  - **Autopilot stub**: when `ShipControl.autopilotActive = true` and a `autopilotTargetId` is set, the system steers heading toward the target and throttles appropriately; manual input immediately overrides and clears autopilot. SystemPanel "SET COURSE" button activates it; HUD "CANCEL AUTOPILOT" button dismisses it.
- **Decisions:**
  - XZ-plane-only movement (yaw, no pitch) for Phase 1B — matches the orbital plane, simpler math, sufficient for cruising. Full 6-DOF deferred to a later phase.
  - DRAG=0.98/tick for natural deceleration without requiring a separate brake input — improves playability at the cost of minor non-Newtonian feel.
  - Floating origin is renderer-only; sim coordinates remain absolute — keeps serialization/saves simple.
  - `speedState` is a plain mutable object, not React state — the frame loop mutates it; React reads it on button click via local state.
- **Next:** Phase 1C or 2 — land on a body (transition to a placeholder surface/colony view); or begin Phase 2 (first colony) directly per docs/05.
- **Open questions:** sim↔UI plumbing is still direct world-ref mutation (flagged in Session 4); becomes pressing when Phase 2 introduces more player actions. Consider a command queue or event system.

---

## Session 4 — Phase 1A: Tau Ceti system, stranded ship, first React UI
- **Goal:** Phase 1A per `docs/05` — curate a real, physically-plausible system; add the stranded ship with survival clock; build the first React UI (system map + HUD).
- **Did:**
  - **Tau Ceti system** (`src/sim/data/tau-ceti.ts`): replaced the Phase 0 placeholder with 5 bodies around a real G8V star. Star tagged `real` (HYG/HIPPARCOS data); planets tagged `derived` (based on Feng et al. 2017 radial-velocity candidate signals). Each body carries full physical properties (mass, radius, gravity, surface temp, atmosphere, magnetosphere). Mira (0.65 AU) is the Civ-like "early goal in sight" — marginal/near-habitable.
  - **Habitability scoring** (`src/sim/math/habitability.ts`): weighted formula (6 inputs, docs/04) computing a 0–1 score. Helpers: `habitabilityLabel`, `habitabilityColor`. Independently tested.
  - **Richer ECS components** (`src/sim/ecs/components.ts`): replaced `Body` with `CelestialBody` (covers stars, planets, gas giants with optional fields); added `Crew`, `Inventory`, `LifeSupport`. `World` gains `shipId`.
  - **Stranded ship** (`src/sim/world-setup.ts`): ISS Prometheus entity with 5 named crew members (skills: command/engineering/science/biology/piloting/medicine), 500 metals / 200 fuel / 300 food, 100 000-unit life-support depleting at 1/tick (~28 min real time at 60fps).
  - **Life-support system** (`src/sim/systems/life-support.ts`): deterministic depletion per tick, clamped at 0.
  - **React UI** (Phase 1 Decision: added now): HUD (life-support bar + countdown, crew health, materials) + System panel (body list, click-to-inspect with physical properties + habitability bar). `GameBus` event bridge; `useGameTick` throttled hook (10Hz UI refresh).
  - **Tests: 29/29 pass.** Determinism proof extended to cover ship/life-support (7 tests). Habitability formula (8 tests). Life-support system (8 tests). Typecheck clean. Prod build clean.
- **Decisions:**
  - React added in Phase 1A (not Phase 1B) — the body inspector and HUD were natural companions to the system data work → `docs/09-decisions.md`.
  - Tau Ceti chosen as the first system: real G8V host star, 5 derived planet candidates, Mira as the habitable-zone target → `docs/09-decisions.md`.
  - `CelestialBody` replaces old `Body` — richer physical data needed for the UI and habitability model; single discriminated component is cleaner than splitting into star vs. planet types.
  - Life support in arbitrary units (100 000) at 1/tick rate; time-compression multiplier added in Part B.
- **Next:** Phase 1B — cockpit/chase camera, basic in-system cruising, configurable speed (= sim time compression).
- **Open questions:** sim↔UI plumbing is currently direct world-ref; a more decoupled command/event layer may be needed in Phase 2 when player actions mutate state.

---

## Session 3 — Phase 0 scaffold: deterministic tick + first 3D system
- **Goal:** Execute Phase 0 (`docs/05`) — scaffold the repo, prove a deterministic tick, render one static 3D star system.
- **Did:**
  - Scaffolded **Vite + TypeScript (strict) + Vitest** with the `/src` layout from `docs/03` (`sim/`, `render/`, `app/`; `tests/` at root). Added `package.json`, `tsconfig.json` (strict + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `vite.config.ts`, `index.html`, `.gitignore`.
  - Built the **headless sim core** (no DOM/Three imports): seeded PRNG (`sim/math/rng.ts`), analytic Kepler solver (`sim/math/kepler.ts`), hand-rolled ECS world + serialisation (`sim/ecs/`), orbital system, fixed-tick loop (`sim/loop.ts`, `FIXED_DT = 1/60`), and the Phase 0 seed scenario — 1 star + 2 planets (`sim/world-setup.ts`).
  - **Determinism proven:** `tests/determinism.test.ts` runs two worlds from one seed for 1000 ticks and asserts byte-identical serialised state, plus a different-seed-differs check and a resume-equals-uninterrupted check. `tests/kepler.test.ts` pins orbit geometry. **10/10 tests pass; typecheck + prod build clean.**
  - **First render** (`render/scene.ts` + `app/main.ts`): Three.js scene with the star (emissive + halo), two low-poly planet spheres on their Kepler orbits, static orbit guide-lines, instanced star-field, and **free-look OrbitControls**. Fixed-timestep accumulator drives the sim independent of frame rate. Kept light for the Air (pixel-ratio cap, low-poly, no post-processing). Dev server boots, serves 200.
- **Decisions:**
  - **ECS: hand-rolled, not a library** — Phase 0 needs little and full control over entity ids + iteration order protects determinism; revisit Miniplex/bitECS if entity counts grow → `sim/ecs/world.ts`.
  - **React deferred** — Phase 0 is a static scene + free-look only; React lands in Phase 1 with real UI panels. Keeps the scaffold lean (stack in `docs/03` unchanged).
  - **First system = seeded/stylised**, not real catalog data yet (resolves the standing open question) — real star/planet import is Phase 1 per `docs/05`. Orbital elements are scene units, not physical scale.
- **Next:** Phase 1 — curate one real, physically-plausible system; add the stranded ship entity with crew/materials/life-support that ticks down; system map with selectable bodies.
- **Open questions:** sim↔UI plumbing (event bus vs store) — decide when Phase 1 introduces the first panels.

---

## Session 2 — Vision expansion & AI workflow
- **Goal:** Lock visual direction and answer tooling/model/Gemini questions.
- **Did:** Confirmed title *Stellar Dominion* and stylised 3D. Added the open-world flight layer (cruising, autopilot, configurable speed, nav map, staged landing) to `docs/02` and the full design + engineering reality to new doc `docs/08`. Added the real-vs-invented content policy to `docs/04`. Added model-selection guidance and standing Gemini triggers to `docs/06`. Updated `CLAUDE.md` index + status.
- **Decisions:**
  - Open-world feel delivered via **layered camera scales**, not one seamless world; true space-to-surface descent is a north star, not MVP → `docs/08`.
  - Real-time flight view sits on top of the deterministic sim; **travel speed = sim time compression** → `docs/08`.
  - Civ-like random start near a habitable planet; per-system difficulty → `docs/02`, `docs/08`.
  - Content tagged `real`/`derived`/`fictional`; invented content seeded from real distributions → `docs/04`.
  - Model use: Sonnet default, Opus for hard reasoning, Haiku for grunt work, Fable 5 rare → `docs/06`.
  - Claude Cowork: not adopted now (Claude Code + docs suffice); revisit later for balance spreadsheets / research synthesis.
- **Next:** Phase 0 — scaffold Vite + TS, deterministic tick, first static 3D system render.
- **Open questions:** first system real vs seeded (decide at scaffold time).

---

## Session 1 — Project kickoff
- **Goal:** Establish the project's instruction set and foundational context (Phase 0 start).
- **Did:** Created `CLAUDE.md` + the `/docs` set (charter, game design, tech stack & architecture, science foundations, roadmap, AI workflow, this devlog).
- **Decisions:**
  - Web-first TypeScript stack (Vite + Three.js + React), wrappable to desktop via Tauri later → `docs/03`.
  - IDE: VS Code + Claude Code → `docs/03`.
  - Deterministic ECS sim decoupled from rendering; Kepler/patched-conic orbital math, no live n-body → `docs/03`, `docs/04`.
  - "Grounded, not fantasy" with FTL, compressed terraforming time, and the "universe" tier as the only flagged soft-sci-fi allowances → `docs/04`.
  - Vertical-slice roadmap; MVP = Phases 0–3 (stranded → colony → first terraforming) → `docs/05`.
  - Gemini for research/brainstorm/summarise, Claude Code for implementation → `docs/06`.
- **Next:** Confirm the open decisions (visual style 2D vs stylised 3D; first system real vs seeded; project name), then scaffold the Vite + TS repo and prove a deterministic tick + first system render.
- **Open questions:** see the kickoff summary — visual dimension, first-system choice, working title.
