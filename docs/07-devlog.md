# 07 — Devlog

A running, append-only log. **One short entry per work session.** New entries go at the top. This is how any future session (or AI) reconstructs "where are we and why" cheaply.

> **Resume point (Session 25 — the LANDING ARC, in progress):** Building the first slice of the fun loop (`docs/15` §1 LAND) in 5 commits. **DONE: (1) docs** (`docs/14` + `docs/05`/`docs/09`/`CLAUDE.md`/`progress.md`/`session-25.md`); **(2) owner-scoping + save migration** — `owner.ts` (`OwnerId`, `LOCAL_PLAYER_OWNER`); `Colony.ownerId`; `world.localOwnerId`; actor-envelope command layer (`QueuedCommand {command, actorId}`, `enqueueCommand(world, command, actorId?)`, `applyCommand(world, cmd, actorId=world.localOwnerId)`, drain in `loop.ts`, `dispatch` optional actor); `foundColony` stamps owner; owner-aware reject in `buildStructure`/`setTerraformAllocation`; `coloniesOfOwner` helper; **`SAVE_VERSION` 2→3** + `save/migrate.ts` migrator chain (v2→v3 backfills colonies → local player) + `localOwnerId` in save meta; **275 tests** (265 + `owner-scoping` 6 + `save-migration` 4), typecheck + build clean. **Next: commit 3 — candidate sites + selection UI:** pure `generateCandidateSites(universeSeed, body)` (~3, deterministic from `bodyKey`), site attribute model, SurfaceView selection cards, `FoundColony` gains optional `siteIndex` (default 0); determinism tests. Then (4) site→modifiers + minimal EDL (audit `solarEfficiency ?? 1` on EVERY solar read path), (5) Fissiles interdependence seed. Rationale: `docs/planning/session-25.md`.
>
> **Prior resume point (Session 22 — Exploration Polish C — CODE COMPLETE, in-browser confirmation pending):** The exploration leg is closed. All six commits landed + pushed to `dev`. **265 tests green.** In-browser confirmation still open (near-plane depth, map interaction, ship/cockpit/accel feel) but NOT blocking the landing arc. See the Session-22 entry.

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

## Session 25 — 2026-07-18 — the landing arc — IN PROGRESS
- **Goal:** Make landing a meaningful choice that shapes the founded colony (`docs/15` §1 LAND) — the first fun-loop slice + the first player-facing application of the multi-agent seam (`docs/15` §6) and the production save-migration discipline.
- **Plan / commit split:** (1) docs → (2) owner-scoping (actor envelope + `ownerId` on Colony) + save v2→v3 migration → (3) candidate sites + selection UI → (4) site→founding modifiers + minimal EDL → (5) Fissiles interdependence seed. Full rationale: `docs/planning/session-25.md`.
- **Did (commit 1 — docs):** Created `docs/14-landing-and-surface.md` (reconciliation header: aggregate globe, NO tile/AP/rover layer; site science → scalar modifiers; owner-scoped founding; soft-not-hard). Updated `docs/05` (landing arc active sub-section), `docs/09` (5 rows — candidate-sites model; the **actor-envelope** as the canonical multi-agent mechanism; the **migrator-chain** as the canonical save-migration pattern; minimal EDL; Fissiles seed), `CLAUDE.md` doc index, `progress.md`, `docs/planning/session-25.md`. Docs-only this commit.
- **Decisions:** see `docs/09` 2026-07-18 landing-arc rows + `docs/planning/session-25.md`. Two are recorded as reusable PATTERNS (not one-offs): the actor-envelope multi-agent mechanism and the versioned migrator chain.
- **Next:** commit 2 — owner-scoping + save v2→v3 migration (see the resume point at the top).
- **Open questions:** none blocking; EDL is the flagged deferrable-to-display-only piece if commit 4 runs long.

## Session 24 — 2026-07-18 — economy & interdependence brief (`docs/16-economy-and-interdependence.md`)
- **Goal:** File the Gemini interstellar-economy research brief into the repo as a reference for the deferred post-landing economy/interdependence slice, reconciled against `docs/15`'s soft-terraforming-dependency rule and hard multi-agent-seam rule.
- **Did:** Added `docs/16-economy-and-interdependence.md` with a reconciliation header (soft terraforming sink, deferred socio-political/military consequences, owner-scoped resource network, corrected stale "Step 1B" label) followed by the brief's content: the local-bulk/strategic-core/strategic-exotic resource-tier table, virtual trade routes with distance-based trade-loss, the anti-snowball dependency trio (bootstrap infusion, scaling upkeep, logistical fragility), terraforming as a soft strategic sink, the forward-looking AI-competition substrate, and a minimal first version (Fissiles + one route + a static distance tax + break-route-powers-down-Tier-2). Epistemic [ESTABLISHED]/[EXTRAPOLATION] tags preserved throughout. Docs-only — no code touched.
- **Decisions:** `docs/09` 2026-07-18 row — `docs/16` landed reconciled, not adopted wholesale. `docs/05`'s Deferred/parked list now points to `docs/16` for the "dedicated economy / anti-snowball pass" entry. `CLAUDE.md` doc index updated.
- **Next:** User in-browser confirmation of Exploration Polish C (unchanged, still pending — see the Session-22 resume point), then the next roadmap slice.
- **Open questions:** none new; see `docs/planning/session-24.md`.

## Session 23 — 2026-07-18 — design spine (`docs/15-design-pillars.md`)
- **Goal:** Write the game's design spine — decisions made in the planning room (fun loop, player motivation stack, differentiated worlds, the economy spine, progression, production/architecture constraints incl. the multi-agent seam) that existed only in chat until now.
- **Did:** Added `docs/15-design-pillars.md` (7 sections: core fantasy & fun loop; player motivation stack; differentiated worlds; the economy spine — bulk-local/strategic-scarce, soft-gated networked terraforming; progression — colony output → warp reach as the tech-tree seed; production & architecture constraints incl. the HARD multi-agent command-layer seam; pointer to the Deferred/parked list). Docs-only — no code touched.
- **Decisions:** `docs/09` 2026-07-18 row — the multi-agent-seam HARD RULE (owner-scoped + command-total sim, player is AN owner never THE owner) logged as an architectural decision, generalizing the existing determinism/serializability groundwork (`docs/09` 2026-06-14) into a standing guardrail. `docs/05` now points to `docs/15` at the top. `CLAUDE.md` doc index updated.
- **Next:** User in-browser confirmation of Exploration Polish C (unchanged, still pending — see the Session-22 resume point), then the next roadmap slice.
- **Open questions:** none new; see `docs/planning/session-23.md`.

## Session 22 — 2026-07-07 — Exploration polish C (unified map + ship/camera/cockpit/feel) — IN PROGRESS
- **Goal:** Close the exploration leg. Promote the M-view into THE strategic map — one continuous, clickable, labeled multi-scale map (`intra → system → sector → galactic(LOCKED) → intergalactic(LOCKED)`, ego-centric on the active system; click → detail popup with valid context actions; absorbs Polish D; subsumes the separate SectorView) — and bundle the ship-model / camera-in / cockpit-depth / gradual-accel fixes. No new sim mechanics; determinism + honest-scale body math untouched.
- **Plan / commit split:** (1) docs → (2) map core → (3) population + drill-down + galaxy scaffold + return-home → (4a) ship model + near-plane/`CHASE_DIST` retune → (4b) cockpit deepen + gradual accel. Scope A locked (active-system interior only). Full rationale in `docs/planning/session-22.md`.
- **Did (6 commits, all pushed to `dev`):**
  - **Commit 1 — docs:** `docs/09` seven decision rows; `docs/05` (Polish C active, absorbs D); `docs/08` Session-22 subsection; `docs/12` reconciliation; `progress.md`; `docs/planning/session-22.md`; this entry; `CLAUDE.md`. (Also corrected the baseline count to the true **218**.)
  - **Commit 2 — map core:** `app/map-state.ts` (renderer-published node screen positions); `sim/map/actions.ts` pure `bodyActions()` (one source of truth for context actions, +18 tests); `ui/BodyDetails.tsx` (extracted inspector fields — SystemPanel + the map popup reuse it); `ui/MapView.tsx` (clickable labels + detail popup, system tier); `render/scene.ts` `publishMapNodes()`.
  - **Commit 3a — ego-centric sector map + return-home:** `reachableSectorNodes()` / `isWarpReachable()` / `WARP_RANGE_LY` / `MAX_MAP_NODES` (distance-based, ungated); `transitTicksForLy()` (distance-proportional locked transit); ego-centric `sector-scene.ts` (rebuilt on warp); MapView sector-tier SCAN→WARP + status; **SectorPanel deleted (folded)**. Return-home fixed (the UI gate). +10 tests incl. a warp-away→warp-home round-trip.
  - **Commit 3b — galaxy scaffold + intra tier:** `MapTier` → 5-tier union; `TIER_ORDER` + general hysteretic `nextMapTier` + per-tier framing distances; `sim/data/galaxies.ts` (LOCKED galactic + intergalactic nodes); `render/galaxy-scene.ts`; scene.ts renders per-tier + widened near/far + `maxDistance`; intra shares the system scene; scroll-in→cockpit now from the innermost tier; MapView LOCKED galaxy popup. +7 tests.
  - **Commit 4a — primitive ship + camera-in:** `buildShipMesh()` → a fuselage + swept wings + engine block + emissive glow (one Group, sized by `SHIP_LENGTH`); camera rig + depth constants centralized in `presentation.ts`; **`CHASE_DIST` 0.001→0.0001, `NEAR_PLANE` 0.0002→0.00002** in lock-step (isolated commit; honest 1:470 scale unchanged); +7 camera-invariant tests.
  - **Commit 4b — gradual accel + cockpit depth:** `math/flight.thrustAccel(speed)` (speed-shaped: gentle docking → cruise ramp; wired into the manual branch; autopilot untouched, +5 tests); `Cockpit.tsx` deepened (shaped dashboard/coaming SVG console with MODE/SPD on it, inner shadow for nearness, centre clear).
- **Return-home root cause (confirmed):** a UI gate, not a state bug — `setActiveSystem` + `isReachableSystem(home)` already support warping home; only `SectorPanel.canScan` (required `role === "reachable"`, excluding `home`) blocked it. Fixed by the map's per-node WARP action + distance reachability; locked by a round-trip test.
- **Result:** **265 tests green** (218 baseline + 47 new pure-fn); typecheck + build + dev-boot clean each commit. Determinism + honest-scale body math untouched.
- **Decisions:** see `docs/09` 2026-07-07 rows + `docs/planning/session-22.md`.
- **Next:** user in-browser confirmation (open questions below), then the next roadmap slice.
- **Open questions / to confirm in-browser (feel/visual not machine-verifiable — no display/headless browser in this env):**
  1. **Near-plane multi-body depth (the flagged regression surface):** at the new 0.00002 near plane, no body (esp. small moons) goes transparent or z-fights across the system — analysis says the soft-stop floor now sits ~40× the near plane off any surface (was ~4×), a strictly wider margin, but this wants eyeballing at several bodies.
  2. **Map:** M opens the map; labels are clickable; a body popup offers the right actions; zoom out → sector (ego-centric on the active system, neighbours populate) → galactic/intergalactic LOCKED cards; zoom back in resolves to flight.
  3. **Return-home:** warp out to YZ Ceti → open the map → warp back to Tau Ceti → arrive at the caught-up colony.
  4. **Ship + camera:** the ship reads as a small stylized craft (not a cone/dot); the body behind still fills the frame; cockpit ↔ chase stay symmetric.
  5. **Cockpit:** the dashboard/coaming reads as a console wrapped around the pilot; MODE/SPD sit on it; the centre-forward view stays clear (a body grows dead-ahead).
  6. **Accel:** a held W builds speed gradually over ~1–2 s (fine control at low speed for docking), not an instant jump.

## Session 21 — 2026-07-04 — Exploration polish B (cockpit, controls, orbital gravity)
- **Goal:** Make the exploration/flight leg playable by hand: immersive cockpit view, a real control model (SET COURSE / AUTOPILOT / LAND + manual-vs-autopilot modes + working mouse/touchpad steering), and deterministic patched-conic orbital gravity (the "middle rung"). Render + control + flight-physics only; the sim (colony/terraforming/population), the warp FSM, and the honest-scale body math untouched. Determinism sacred.
- **Did (4 commits):**
  - **Commit 0 — scaffolding:** root `progress.md` (single start-here file) + `docs/planning/` (README on the BUILD-log vs PLANNING-log convention, `session-template.md`, and `session-21.md` capturing this session's five planning decisions). Wired maintaining `progress.md` + `docs/planning/session-N.md` into the `CLAUDE.md` session-logging protocol; `docs/05` (A complete, B active); `docs/09` decision rows.
  - **Commit 1 — cockpit POV + 2 cameras + course indicator:** new `ui/Cockpit.tsx` — immersive first-person canopy as a **cheap static CSS overlay** (frame + A-pillar struts + vignette + boresight + MODE/THROTTLE HUD), center left clear so a body grows on approach. `C` now toggles **cockpit ↔ chase only** (map left the cycle; still on `M`). The renderer target marker now reads a SET COURSE target as a distinct amber pipper + edge chevron (the direction indicator), dim cyan nearest-body hint otherwise.
  - **Commit 2 — control model + steering:** `SetCourse` now only **marks** the target; new `EngageAutopilot` (flies it; optional bodyId) and `EnterOrbit` (analytic low-orbit insertion when within `enterOrbitRange`); `CancelCourse` disengages but keeps the mark. ship-movement: **thrust LOCKED during autopilot** (input ignored, not a cancel); a held orbit is broken by manual input, handing control back. Mouse/touchpad: `steer-state.ts` + pure `steering.ts` (`pointerToSteering`); **pointer-lock** steering in `scene.ts` (click canvas to capture, deltas steer; **hold Space = free-look** camera-only; `Esc` releases; map drops the lock; camera eases back after a look). HUD-button clicks never capture (`#ui` is pointer-events:none except `.interactive`). `main.ts` applies the frame's accumulated delta to the **first tick only** (frame-rate-independent turn; sim stays deterministic per input stream). SystemPanel gains SET COURSE / AUTOPILOT / ENTER ORBIT / LAND; a "click to fly" hint.
  - **Commit 3 — gravity + auto-throttle:** `math/gravity.ts` (pure) — **tuned-μ patched-conic** (real SOI/`μ/r²`/`v_circ`/`v_esc` structure, magnitude `μ = ω²·r³` from `LOW_ORBIT_PERIOD_S`=40, so `ORBIT_RATE` is now derived). **μ is derived so the held orbit's tangential speed EQUALS `v_circ`** → the autopilot→manual handoff is seamless (unit-tested identity). `gravityAccel` sums bodies whose SOI (=12R) contains the ship; zero outside all SOIs (free cruise). ship-movement three regimes: AUTOPILOT = scripted **trapezoidal** auto-throttle (`math/flight.ts`, turn-in-place then accelerate→cruise→decelerate, insert on arrival), HELD ORBIT = analytic (now a true circular orbit), MANUAL = thrust + gravity-in-SOI (semi-implicit Euler on the fixed tick), **drag only in open space** so orbits persist and the well is felt. Escape velocity is emergent.
  - **Tests:** +31 → **218** (steering math; SetCourse-marks-only / EngageAutopilot / EnterOrbit / CancelCourse; autopilot thrust-lock; SOI/μ/v_circ/v_esc + seamless-handoff identity + gravityAccel; trapezoidal profile + moveToward; manual-gravity fall-in; open-space drag; gravity-flight determinism). typecheck + build clean; dev-server boot smoke-tested (all new modules transform, root 200).
- **Decisions (see `docs/planning/session-21.md` + `docs/09` 2026-07-04 rows):** gravity = tuned-μ patched-conic feel model (sibling of the ship-avatar decision), **revising the Session-10 "flight is pure arcade, no gravity"**; control model = SET COURSE/AUTOPILOT/LAND + manual/autopilot modes, thrust locked in autopilot; two cameras only (map leaves the cycle); cockpit = canopy overlay (cheap); pointer-lock steering + held-modifier (Space) free-look; the `progress.md` + planning-log convention.
- **In-browser feel/fix arc (6 commits, post-base, same session):** the base slice was correct but the *feel* needed several rounds of playtest-driven fixes (all render/flight-feel only; determinism + sim untouched; **221 tests green** at the end):
  1. **Watchable approach + disc framing + UI gating** — replaced the instant-park with a two-phase **body-scaled `approachSpeed`** (`math/flight.ts`, cruise → long slow zone) and **velocity-matched the target body** during approach (inner planets drift ~0.03 u/s, as fast as a slow approach, so they were never caught); AUTOPILOT button **toggles** engage/cancel; ENTER ORBIT enabled only in manual + in range; landing reach re-derived so you can LAND from orbit.
  2. **Closer, realistic orbit + slower + reversed** — orbit insertion `4 R → 2 R` (a large curved world you can't take in at once, not a distant disc) with a **left framing bias** (clear of the right panel); `LOW_ORBIT_PERIOD_S 40 → 300` (stately sweep); `ORBIT_DIRECTION = -1` (the sweep read "clockwise/backwards"); **ship shrunk** (`SHIP_LENGTH 0.00005 → 0.000015`, ~1:470 of a planet).
  3. **Planet see-through FIXED (real cause) + eased entry** — the body looked translucent because its **custom shader didn't write logarithmic depth** (the renderer uses a log depth buffer; every built-in material does it automatically, so the planet failed to occlude the starfield). Added the `logdepthbuf` chunks → solid bodies. Also raised the night-side floor + added an all-round limb, and **eased the orbit-entry heading** (~¾ s glide, cosmetic) so the framing doesn't snap.
  4. **Flyable icy rings + Kuiper belt** (`render/debris-field.ts`) — deterministic instanced icy/rocky chunks (seeded mulberry32, render-only), a ring on each gas giant (parented to the body) + a Kuiper belt beyond the outer orbit; chunks sized between the ship and the planet so you fly *through* them — the intended sense of scale.
  5. **Spiral orbital insertion** — the biggest fix: velocity-matching made the ship **station-keep just outside the arrival radius and never insert** ("approaches, stops, doesn't orbit — I had to ENTER ORBIT manually"). Rewrote the endgame so the scripted velocity **blends from radial approach into the orbit tangent** within 5×arriveDist (a spiral), capped below 1 so it always closes, with a small capture band → reliable, seamless, single continuous slide into orbit. Regression test locks it (off-axis start → stable orbit min==max==rIns).
- **Next:** user in-browser feel confirmation of the spiral slide + orbit direction (below), then **Exploration polish C** — the unified clickable multi-scale map (+ promoting the minimap).
- **Known nuance (report honestly):** after a held-orbit→manual handoff the orbit persists (velocity continuous, `v = v_circ`), but manual gravity pulls toward the body's *instantaneous* position rather than a co-moving frame, so over long **unattended** manual coasting a low orbit slowly drifts — corrected with thrust (that's the point of manual). Autopilot and the analytic held orbit do not drift. The tuning constants (`ORBIT_INSERTION_MULT`, `ORBIT_FRAME_YAW_BIAS`, `ORBIT_DIRECTION`, `LOW_ORBIT_PERIOD_S`, `SHIP_LENGTH` in `presentation.ts`; `AUTOPILOT`/`ORBIT_BLEND_*` in `ship-movement.ts`; ring/belt density in `debris-field.ts`) are the feel knobs.
- **Open questions / to confirm in-browser (feel not machine-verifiable — no browser driver in this env):**
  1. **Steering:** click captures the pointer and trackpad/mouse motion turns the ship; hold Space = look around without changing heading; `Esc` releases; clicking SET COURSE / AUTOPILOT / LAND / ENTER ORBIT does **not** capture the pointer; entry/exit feels clean & discoverable.
  2. **Gravity handoff:** AUTOPILOT to a body → holds a low orbit; switch to MANUAL (any thrust) → the ship keeps orbiting rather than dropping straight in (seamless), and cutting thrust near a body visibly pulls you in; leaving needs real throttle (escape velocity).
  3. **Cockpit:** the canopy reads as a cockpit surround, a body visibly grows dead-ahead on approach, MODE/THROTTLE + course chevron are legible.
  4. **Autopilot profile:** SET COURSE marks (no motion) → AUTOPILOT accelerates out, cruises, decelerates, arrives in a low orbit (no ram/instant-park).

## Session 20 — 2026-06-25 — Exploration polish A FIX (ship scale + orbital insertion)
- **Goal:** Fix the still-wrong exploration feel from polish A. Diagnosis-first (measured before changing): ship avatar 1:11 of a body (too big), autopilot parked at 2.75R = 1.75R altitude (distant marble, not a wall), bodies drift faster than the DOCK throttle (Mira 0.016 u/s > 0.004) so the body slid away / the ship rammed-and-bounced, and a range-dependent transparency. Render + autopilot-arrival behaviour only; determinism/sim untouched.
- **Did:**
  - **Diagnosis (reported, no guesses):** Mira R 0.00835 u; ship len 0.0015 u → 1:11; park 2.75R; Mira drift 0.016 u/s (≈1.9 body-radii/s) **> DOCK 0.004 u/s** — the key finding, manual can't hold station, velocity-match required; transparency = near-plane (0.0002 u) clipping a FrontSide sphere when the camera is within it. Corrected the prior read: no ship size-floor exists (fixed avatar); ship apparent size = `SHIP_LENGTH/CHASE_DIST` is scale-invariant, so the lever is ship-vs-body size + ship-lengths of camera setback.
  - **Slice 1 — ship/camera scale** (`presentation.ts`, `render/scene.ts`): `SHIP_LENGTH` 0.0015→0.00005, `SHIP_RADIUS`→0.000011 → **ship:body ≈ 1:167** (len:radius) / 1:334 (len:diameter), still a visible speck. `CHASE_DIST` 0.008→0.001 (~20 ship-lengths back so the ship reads tiny, ≪ a body radius so the body stays a wall, ≥5× the near plane); other rig offsets + `MAP_MARKER_SCALE` rescaled (framing angle unchanged).
  - **Slice 2 — orbital insertion + velocity-match** (the heart; `presentation.ts`, `ecs/components.ts`, `systems/ship-movement.ts`, `systems/orbital.ts`): autopilot arrival now **inserts into a low orbit** (`orbitInsertionRadius=1.2R`) instead of stopping at 2.75R. New `ShipControl.orbitingBodyId`+`orbitAngle`. Orbit-hold each tick holds the insertion altitude in the body's XZ plane, advances the angle (slow deterministic orbit, `ORBIT_RATE` ≈150 s/rev), sets `velocity = body heliocentric velocity` (finite-difference of the new moon-safe analytic `bodyWorldPosition`) **+ tangential orbit velocity** — so the body stops drifting relative to the ship (no ram/bounce) and the planet fills the view as a curved wall; ship faces its orbit tangent. Any manual input drops the orbit. LAND still reaches from orbit.
  - **Slice 3 — soft-stop + transparency** (`presentation.ts`, `systems/ship-movement.ts`): soft-stop re-derived as pure `softStopRadius(R)=R+max(10%·R, MIN_SURFACE_ALTITUDE=0.0008)` — proportional for big bodies, an absolute altitude floor for tiny ones. **Transparency reproduction:** measured home-system — at the old soft-stop the cockpit camera cleared the near plane for all bodies, smallest margin the gas-giant moons (R≈0.0033) at only 1.28×; **persistent transparency did NOT reproduce**, but the margin was unsafe. The floor keeps the camera ~4× the near plane off any surface (and soft-stop is same-tick, clamping before render), closing the mechanism. Did **not** add DoubleSide (couldn't reproduce; floor prevents the approach).
  - **Tests:** +10 → **187** (ship:body ratio, orbitInsertionRadius, orbit-hold holds radius while body drifts, manual breaks orbit, autopilot inserts on arrival, softStopRadius proportional/floor/near-plane-safe). Updated none broken. typecheck + build clean.
- **Decisions:** (a) slow deterministic orbit on arrival (angle advances as a pure fn of ticks-since-entry), not a pure hold — reads alive, stays deterministic; (b) accept **ship:body ~1:167** now; a **dedicated ship near-camera layer** (multi-scale rendering) is the tool if it still feels chunky in orbit — **known follow-up option, not built**.
- **Next:** in-browser confirmation (below), then Exploration polish B (cameras / mouse-steering).
- **Known follow-up option (not scheduled):** if the ship still reads chunky in low orbit, add a **separate near-camera render layer** for the ship so it can shrink toward true scale (~1:1000) without falling below the shared near plane. Deferred per decision (b).
- **Open questions / to confirm in-browser (feel not machine-verifiable):** on SET COURSE the ship settles into a low orbit with the planet as a curved **wall** (not a distant marble); the body no longer slides/drifts relative to the ship; **no ram/bounce**; the ship reads as a small craft (~1:167), not a co-equal object; the slow orbit looks alive, not a spin; LAND works from orbit; no transparency when close to small bodies (gas-giant moons).

## Session 19 — 2026-06-24 — Exploration polish A (rendering & flight-feel)
- **Goal:** Make the exploration leg feel real & navigable without new features. Governing principle (docs/09): true relative proportions + real-AU distances + no inflated bodies, navigable via speed/targeting/(map). Three fixes only — render + input-to-speed; determinism, colony, terraforming, population and the warp FSM untouched.
- **Did:**
  - **Docs:** `docs/05` (Step 1B complete; new **Exploration polish A/B/C/D** sub-phase, A active; fully-honest tight-system spacing logged as deferred). `docs/09` (governing principle + ship-is-an-avatar corollary). `docs/08` (presentation scale now physical for bodies; ship+camera rig the only non-physical avatars; log depth buffer; 5 gears).
  - **Lighting** (`render/planet-material.ts`): star-lit hemisphere — fixed a normal-space bug (Lambert mixed a view-space normal with a world-space light dir). Bodies are unrotated, so the OBJECT normal (== world) drives `ambient + (1-ambient)·max(dot(n, dirToStar), 0)`: a real cosine day/night terminator with a tunable starlight floor (`AMBIENT_STARLIGHT=0.05`) so the night side is dark-but-legible. Atmospheric haze (Fresnel limb, separate view-space normal) now masked by `dayness` → reads on the lit limb, fades to night. `uLightDir` already refreshed per-frame (`normalize(-bodyPos)`), so the terminator tracks orbit + ship motion. Star untouched (MeshBasic emitter).
  - **Real scale** (`presentation.ts`): bodies render at TRUE radius via one factor `physicalRadiusToScene(m)=m·AU_TO_SCENE/AU_METERS` (Earth-r ≈ 0.0085 u, Tau Ceti ≈ 0.74 u); dropped the 6× inflation, the radius floor and per-class scales (planet/gasGiant/starRenderRadius alias the one factor). `AU_TO_SCENE` + the orbit-placement floors kept (distances stay real-AU). `parkDistance = 2.75·R` (no additive floor → body fills the same FOV fraction at any size); soft-surface stop re-derived off real radius (+ ship length); scanner now always reports the nearest body. Ship avatar + camera rig (`SHIP_*`, `CHASE_*`, `COCKPIT_FWD`, chase look-at) shrink in lock-step so framing is unchanged while ship ≪ planet ≪ star becomes true; **logarithmic depth buffer** + 0.0002 near plane handle the ~0.001–12000 u range; map-marker scale bumped.
  - **Throttle** (`presentation.ts`, `systems/ship-movement.ts`, `app/*`, `ui/HUD`+`DebugPanel`): 5 exponential gears DOCK→MAX (`maxSpeedForGear`, pure); `input.throttle` now carries the gear's absolute max speed (u/s); accel tracks it so the ramp feel is gear-independent.
  - **Flight target marker** (`app/nav.ts` pure: `nearestBodyId` + `markerScreenPosition`; drawn in `render/scene.ts`): a DOM reticle on the selected/nearest body when on-screen, an edge chevron pointing toward it when off-screen/behind — updated per-frame (smooth, decoupled from React) so honest-scale free-flight is navigable on its own.
  - **Tests** (+20 → **177**): `presentation` (honest radii + ordering + linearity, park ratio invariance, gear curve monotonic/geometric/clamped/endpoints), `nav` (nearest + edge-clamp + behind-flip). Updated the throttle-cap test to the absolute-speed model. Typecheck + build clean.
- **Decisions:** see `docs/09` 2026-06-24 governing-principle row.
- **Next:** in-browser confirmation (below), then **Exploration polish B** (cameras / mouse-steering).
- **Open questions / to confirm in-browser (GLSL + feel not machine-verifiable):** day/night terminator tracks the planet's orbit and reads as a real line; night side dark-but-visible; haze only on the lit limb; bodies are small dots that grow on approach and the star looks small from an orbit; set-course/autopilot still frames a body filling the view on arrival; DOCK gives fine docking control and MAX crosses the system in a few seconds; the target chevron points correctly (on-screen reticle ↔ off-screen edge chevron) during turns.

## Session 18 — 2026-06-24 — Step 1B exploration / warp layer
- **Goal:** Turn the 167-star catalog into places the player can fly to: a dedicated sector map, a four-phase ungated warp FSM, single-active-system swap with deterministic lazy catch-up for off-view systems, arrival generation reusing the 1A engine (YZ Ceti via a RealSystemDef), and the save extended with active-system + discovered + ship. Determinism + all existing tests green.
- **Did:**
  - **Docs/decisions:** `docs/05` 1A complete / 1B active (scope + out-of-scope); `docs/09` Session-18 cluster; `docs/12` Luyten 726-8 = 3.36 ly note.
  - **Sector map** (`data/sector.ts`, `render/sector-layout.ts` + `sector-scene.ts`): curated neighbour table (Tau Ceti home; YZ Ceti + Luyten 726-8 reachable; Epsilon Eridani locked) with catalog-honest distances (verified YZ 1.60 ly, Luyten 3.36 ly); a **dedicated SectorView scene** (colour-by-spectral-type nodes, full-catalog background, "you are here" ring) entered from the map view by a zoom-out threshold with an eased cross-fade (`viewState.mapTier`/`transitionT`); **pure** zoom-tier hysteresis + node placement (tested). `SectorPanel` lists systems + drives warp.
  - **Active-system swap** (`galaxy.ts`, `instantiate.ts`): single persistent world; `setActiveSystem` stashes the departed system's deltas (keyed by stable `bodyKey` + `lastSimTick`), clears bodies (ship entity persists), regenerates+instantiates the destination via the 1A engine, re-applies any prior stash, repositions the ship. Shared `instantiateSystem` adds an orbit-spacing floor + physical-scaled star radius (`presentation.ts`) so YZ Ceti's 0.016–0.028 AU planets render legibly — **Tau Ceti's layout stays byte-identical** (floors never bind).
  - **Warp FSM** (`systems/warp.ts`, `commands/warp.ts`): tick-counted scan→spool→transit→arrive, deterministic; `warpSystem` runs first in the loop + emits `ArrivedAtSystem`; transit is locked. `gen/scan.ts` returns a **coarse, never-persisted** preview. Renderer `rebuildSystem` swaps the scene graph on arrival.
  - **YZ Ceti** (`data/yz-ceti.ts`): three real tidally-locked terrestrial candidates verbatim + the **SPI radio hazard** as a system trait (`GeneratedSystem.hazard`, surfaced by `HazardBanner`); no gas giant. `esiTierLabel` (display-only) shown in SurfaceView.
  - **Off-view catch-up** (`catch-up.ts`): on re-entry, the colony economy is batch-run for the elapsed economy-ticks (`runColonyEconomy` extracted from `colonySystem`), **clamped** to `MAX_CATCHUP_ECON_TICKS` (logs on clamp), deterministic.
  - **Save** (`save/serialize.ts` v2): universe seed + activeSystemId + discovered + per-system stash map (every visited system) + ship; `reconstructWorld` restores stashes, makes the saved system active (in-place for home → byte-identical; swap otherwise). SCAN data never enters the save.
  - **Tests** (+28 → **157**): `sector` (table/distances/geometry/zoom hysteresis), `warp` (FSM, reject/cancel, deterministic arrival, ship-persists swap, active/discovered, stash restore, coarse scan, loop integration), `save` multi-system (active/discovered, semantic warped round-trip, no pre-arrival data), `catch-up` (equals staying, count, clamp, deterministic away-and-back). Typecheck + build clean.
- **Decisions:** see `docs/09` 2026-06-24 cluster.
- **Next:** confirm in-browser (zoom out to sector → scan YZ Ceti → warp → arrive in the scorched red-dwarf system with the SPI banner → warp home to a caught-up colony), then **Step 1C** — Epsilon Eridani + sub-light probes / the economy/tech layer that gates warp.
- **Open questions:** warp transit currently has no in-flight visual (the ship just leaves the system view); a sector-map transit animation is a polish follow-up. Multi-warp histories reconstruct **semantically** (not byte-identically) since entity ids are per-visit — the documented save guarantee.

---

## Session 17 — 2026-06-16 — Step 1A content engine + procedural surfaces
- **Goal:** Build the deterministic seeded content engine (Step 1A) so the universe is generated from a seed rather than hand-authored, regenerate the home system through it, and add first-pass procedural planet surfaces. Determinism + all existing tests green.
- **Did:**
  - **docs:** re-sequenced `docs/05` to exploration-first (Step 1A engine + Step 1B warp; original Phase 4/5 folded in; **Deferred / parked** list incl. start-world hard-start retune, 3B depth, in-system logistics, economy/anti-snowball, trade/diplomacy/governance, conflict, universe tier + wormholes, victory/balancing). Logged the Session-17 decision cluster in `docs/09`.
  - **Engine** (`src/sim/gen/`): `hash.ts` (pure-TS **xxHash32** → per-system seed from universe seed + star id + galactic coords); `mass-radius.ts` (**Chen & Kipping 2017** piecewise, continuous); `occurrence.ts` (spectral-type → planet count / mass / stellar params); `spacing.ts` (**peas-in-a-pod** ~20 mutual Hill radii, closed form); `archetype.ts` (docs/04 archetypes → surface temp / atmosphere / colour); `names.ts`; `system.ts` (`generateSystem` — real bodies verbatim where a `RealSystemDef` exists, generated fill otherwise; every body tagged real/derived/fictional + stable `bodyKey`; lazy + deterministic).
  - **Catalog:** `tools/import-hyg.mjs` fetches the astronexus HYG CSV and writes a stripped **local ~25 ly subset** → `data/hyg-neighborhood.json` (167 stars incl. Tau Ceti = HYG 8087; no runtime fetch). `gen/catalog.ts` loads it.
  - **Real systems** (`data/real-planets.ts`): Tau Ceti's real candidates (Ferrum/Caldor/Mira/Glacius) injected verbatim from `tau-ceti.ts`; only the outer gas giant + its moons are generated (fictional). Current tuning kept (hard-start retune parked).
  - **Save model** (`src/sim/save/`): `SaveStore` interface (Memory + localStorage); `extractDeltas`/`reconstructWorld` — a save = universe seed + **player deltas keyed by stable `bodyKey`** (not entity id); body transforms re-derived from time on load. Flat JSON now; SQLite deferred. Added `CelestialBody.bodyKey?` and `World.universeSeed` (non-breaking).
  - **Integration** (`world-setup.ts`): home system now built **through** `generateSystem`; bodies `structuredClone`d at insertion (Session-14 isolation); moons orbit their planet in scene units just outside its render radius.
  - **Renderer** (`render/planet-material.ts` + `scene.ts`): procedural **ShaderMaterial** (4-octave 3D-simplex FBM) for planets/gas-giants; `bodyToVisualParams` is a **pure** property→uniform mapping (ocean←hydrosphere, ice←temperature, vegetation←habitability, haze←pressure, seed←bodyKey); uniforms refreshed each frame from live state so terraforming transforms the globe; light toward the star at worldRoot origin; orbit rings only for star-orbiters.
  - **Tests** (+31 → **129**): `generation.test.ts` (xxHash, mass-radius, spacing, determinism, provenance, verbatim real bodies), `home-system.test.ts` (engine integration), `save.test.ts` (byte-identical seed+delta round-trip incl. colony + terraforming, stable-key deltas, SaveStore, version guard), `planet-visual.test.ts` (mapping purity + terraforming-driven look). Typecheck + build clean.
- **Decisions:** see `docs/09` 2026-06-16 cluster.
- **Next:** confirm in-browser (procedural globes, gas giant + moons, terraforming visibly reshaping a world), then **Step 1B** — exploration/warp layer (multi-scale map, fly to a neighboring real star, generate its system on arrival).
- **Open questions:** moon orbit rings not drawn (placed visually around the gas giant; first pass); generated gas giant replaces the old hand-authored "Titan's Eye" identity — revisit naming/flavour for generated outer bodies in 1B.

---

## Session 16 — 2026-06-15 — Step 1A procedural-generation brief landed
- **Goal:** Bring the planning-room "Content Architecture & Universe Generation" research into the repo as a Step 1A reference (precursor to procedural neighborhood generation), with the architectural questions resolved up front.
- **Did:** Saved the brief verbatim as `docs/13-procedural-generation.md` with a resolved-decisions header. Brief covers: hybrid real-HYG-catalog + seeded procedural fill, xxHash coordinate-seeded lazy generation (zero disk for the universe), Chen & Kipping (2017) mass-radius relations, "peas in a pod" ~20-mutual-Hill-radii spacing (Weiss 2018), property→shader appearance mapping (Simplex/FBM on GPU), and the SQLite-WASM/OPFS vs flat-JSON save-architecture question. The doc's two inline open questions (`→ CLAUDE`, `→ CLAUDE CODE`) are preserved for provenance but answered by the header.
- **Decisions:** Header overrides the doc's two asks — **flat-JSON player deltas behind a swappable persistence interface** (defer SQLite-WASM/OPFS until the late-game data layer is actually needed), **procedural surfaces as Three.js `ShaderMaterial`** (not raw Canvas WebGL — stays inside the established engine), and **the existing `computeHabitability` score stands as the mechanic with ESI as a UI label only** (consistent with the Session 15 Step 1B reconciliation) → `docs/09`, `docs/13`.
- **Next:** Confirm Phase 3A in-browser, then Phase 3B (magnetosphere/toxicity/biosphere + feedback loops). The procedural-generation brief is a forward reference for the eventual Step 1A neighborhood-generation slice, not the current phase.
- **Open questions:** none — both doc questions resolved in the header.

---

## Session 15 — 2026-06-15 — Step 1B exploration brief landed
- **Goal:** Bring the planning-room interstellar-expansion research into the repo as a Step 1B reference (precursor to Phase 4/exploration), reconciled with current repo decisions.
- **Did:** Fetched the Google Doc "Interstellar Exploration and Expansion Framework" and saved it verbatim as `docs/12-exploration-science.md` with a reconciliation header. Doc covers: multi-scale map tiers (galactic/sector/system/surface) + floating-origin, sub-light-vs-warp propulsion (4-phase warp jump), the real Tau Ceti neighborhood (YZ Ceti 1.6 ly, Luyten 726-8 3.1 ly, Epsilon Eridani 5.5 ly with astrophysical hooks), ESI habitability tiers, and anti-snowball macroeconomics (admin latency, gravity-well tax, bulk/strategic split). Inline `→ CLAUDE CODE` directives preserved verbatim, **not acted on** (save-only).
- **Decisions:** Reconciliation header overrides three doc asks — warp **ungated for now** (gate later), anti-snowball economics **deferred**, keep existing **habitability score** as the mechanic with **ESI only as a UI tier label** → `docs/09`, `docs/12`.
- **Next:** Confirm Phase 3A in-browser, then start Phase 3B (magnetosphere/toxicity/biosphere + feedback loops). The exploration brief is a forward reference for the eventual Step 1B / interstellar slice, not the current phase.
- **Open questions:** Doc proposes YZ Ceti + Luyten 726-8 as the first warp destinations and a separate Sector Map scene/data-layer — both to be revisited when the interstellar slice is actually scoped.

---

## Session 14 — Phase 3A: terraforming core (Temperature / Pressure / Hydrosphere)
- **Goal:** Ship the minimal tunable terraforming loop — three levers as a resource sink funded by a colony, precondition gating (Hydrosphere), and the habitability/stage payoff wired into the Phase 2C population model. Determinism + all tests green.
- **Did:**
  - **Data** (`data/colony.ts`): `TerraformLever` (temperature/pressure/hydrosphere), `TERRAFORM_LEVER_DEFS` (per-lever maxBurn, maxShift, target, unit — balance lives here), and thresholds `ARMSTRONG_PA = 6262`, `FREEZING_K = 273.15`, `ONE_ATM_PA`, `HYDRO_LIQUID_THRESHOLD = 0.5`. Levers drive the body's **real** fields toward Earth-like targets (288 K / 1 atm / hydrosphere 1.0).
  - **Component** (`ecs/components.ts`): new `Terraforming` (per-lever 0–1 `allocations`, keyed by body id), added to the registry; new `hydrosphere?` gauge on `CelestialBody`. Both serialised (`ecs/world.ts`).
  - **Math** (`math/terraforming.ts`, new): `hydrosphereGate(pressure, temp)` → locked + spelled-out reason; `terraformStage(pressure, temp, water)` → Barren/Frozen/Marginal/Habitable per docs/11 §4 (Barren defined by sub-Armstrong pressure).
  - **System** (`systems/colony.ts`): `terraformingStep` runs each econ-tick after flows, before population. Per lever: burn = fraction × maxBurn capped by the affordable fraction (power from **surplus generation**, others from stockpile); shift = fraction × maxShift × ratio, clamped at target; levers share the running power surplus in fixed order. Then derives `hasLiquidWater` from the hydrosphere gauge and calls `recomputeHabitability` (exported) so the population model sees the new score that same tick.
  - **Command** (`commands/types.ts`, `commands/colony.ts`, `commands/apply.ts`): `SetTerraformAllocation { bodyId, lever, fraction }` — validates colony+landed+fraction range, rejects raising a gated lever (names the reason), creates the `Terraforming` component on first use; emits `TerraformAllocationSet`.
  - **UI** (`ui/TerraformingPanel.tsx`, new; rendered in `ColonyPanel`): per-lever current value → target, 0–100% slider, live burn, locked state with the unmet prerequisite; header shows resulting stage + habitability %.
  - **Bug fix** (`world-setup.ts`): catalog bodies were inserted into the world **by reference** to shared module constants; terraforming mutations leaked across worlds. Now `structuredClone`d per body.
  - **Tests** (`tests/terraforming.test.ts`, +10 → 98 total): shift scales with allocation, affordable-fraction cap + target clamp, zero-alloc no-op, hydrosphere gate locked/unlocks, habitability rises on warming, stage thresholds, population payoff (higher hab → faster growth), serialization round-trip.
- **Decisions:** Phase 3 split 3A/3B; levers drive real body fields; per-lever independent 0–100% allocation; deep-clone bodies at setup. See `docs/09` 2026-06-14.
- **Next:** confirm in-browser (found colony on cold Glacius → allocate Temperature → watch temp/habitability climb → Hydrosphere unlocks past 0 °C), then Phase 3B — magnetosphere/toxicity/biosphere + feedback loops.
- **Open questions:** none.

---

## Session 13 — Phase 2C legibility: per-building status + bottleneck surfacing
- **Goal:** Make the colony UI answer "why isn't this working?" for every building — per-building status with reason (running / idle: no power / idle: insufficient water), bottleneck tagging on the resource ledger, and a logged Legibility design pillar. Determinism + tests green.
- **Did:**
  - **`BuildingStatus` type** (`ecs/components.ts`): `state ∈ {running, idle-no-power, idle-no-input}`, `running/total` counts, human-readable `reason`, machine-readable `limitingResource?`. Added `buildingStatuses: Record<string, BuildingStatus>` to `Colony` (transient/derived, like `popLimitingFactor`). Initialized as `{}` in `foundColony`.
  - **`colonySystem`** (`systems/colony.ts`): solar always `running`. After power allocation (step 2), each POWER_PRIORITY building with `canRun < total` marked `idle-no-power`. During production (step 3), tracked the argmin resource across inputs; if a fully-powered building's ratio < 1, upgraded its status to `idle-no-input` with `limitingResource` set. Assigned `colony.buildingStatuses` at end of tick (step 5).
  - **`ColonyPanel`** (`ui/ColonyPanel.tsx`): `BuildingStatusLine` subcomponent below each built structure — green "running" / amber "idle: no power" / amber "idle: insufficient water"; shows "3/4 running — idle: no power" for partial-power cases. Resource ledger: computed `bottlenecks` set from `buildingStatuses`; bottleneck resources tagged amber with "↑ needed" label.
  - **Tests** (`tests/colony.test.ts`): 6 new cases (88 total) — solar running, power-starved idle-no-power, partial-power running/total, water-starved hydroponics idle-no-input (limiting resource = water), water-starved electrolysis, fully-supplied reports running. Restructured building-status tests into their own top-level `describe` blocks.
  - **`docs/01`**: added Legibility as Design Pillar 6 — any system with dependencies must surface inputs, live status with reason, and current bottleneck; governs buildings now and Phase 3 terraforming levers next.
  - **`docs/09`**: logged Legibility principle decision.
- **Decisions:** Legibility as Pillar 6 — governs Phase 3 (terraforming levers show locked with unmet prerequisite named). See `docs/09` 2026-06-14.
- **Next:** confirm in-browser (found colony → build hydroponics with no water → see "idle: insufficient water" → build water extractor → see "running"; check bottleneck tag on Water row), then Phase 3 — terraforming loop.
- **Open questions:** none new.

## Session 12 — Phase 2C: population dynamics
- **Goal:** Add aggregate population to the colony — seeded from crew at founding, grows when resources/housing allow, declines (proportionally) under oxygen/water/food shortages. No factions/politics (Phase 5–6), no migration (Phase 4). Determinism + tests green.
- **Did:**
  - **`Colony` component** (`ecs/components.ts`): added `population` (float, rendered as `Math.floor`), `popGrowthRate` (last tick delta), `popLimitingFactor` (human-readable driver string). Serialises automatically via the existing spread in `serializeWorld`.
  - **Habitation Module** (`data/colony.ts`): new `BuildingType` added to `BUILDING_TYPES` and `POWER_PRIORITY` (between hydroponics and smelter). 80 Metals, 3 pw draw, 10 colonists per module. FoundColony grants 1 free module (the landing dome). Housing capacity = `buildings.habitation × HOUSING_PER_MODULE`.
  - **`FoundColony` command** (`commands/colony.ts`): seeds `population = crew.members.length`; sets `buildings.habitation = 1`. Known debt: crew counted as both ship crew and colony population — cosmetic until the Phase 5–6 crew arc (logged in `docs/09`).
  - **Consumption scaling** (`systems/colony.ts`): renamed `CREW_CONSUMPTION_PER_MEMBER` → `POPULATION_CONSUMPTION_PER_PERSON`; step 4 now uses `colony.population` instead of hardcoded ship-crew count. Rates unchanged (O₂ 0.1, water 0.08, food 0.06 per person per econ-tick).
  - **`populationStep()`** (step 6 after flows finalised each economy tick): proportional death rates — oxygen critical (stockpile < 10 AND net < 0): −1.5 %/tick; water: −1.0 %/tick; food: −0.4 %/tick. All three require net < 0 (recovering stockpile ≠ shortage). Growth = `GROWTH_RATE_BASE × max(0.1, habitability) × housingMultiplier`; housing power multiplier = `0.5 + 0.5 × poweredFraction` — unpowered habitation halves growth. Capped at housing headroom. Dominant limiting factor cached in `popLimitingFactor`.
  - **ColonyPanel** (`ui/ColonyPanel.tsx`): POPULATION section above resources — count / capacity / rate/s / limiting-factor label (colour-coded red for decline).
  - **`housingCapacity(colony)`** exported helper used by UI and tests.
  - **Tests** (`tests/colony.test.ts`): 10 new cases (82 total) — founding pop/housing, growth, housing cap, habitability speed difference, housing power penalty, O₂/water/food deaths, food-low-net-positive no starvation.
  - **Decisions** (`docs/09`): proportional death rates; food requires net < 0; housing power penalty; aggregate population seeded from crew; founding crew double-counted (known debt).
- **Decisions:** see `docs/09` — 2026-06-14 cluster of 5 population-model decisions.
- **Next:** confirm in-browser (land Mira → found → colonists = 5, housing = 10 → build solar + water + electrolysis → watch pop grow → starve O₂ → see rapid decline), then Phase 3 — terraforming loop.
- **Open questions:** population balancing (growth rates, building counts to sustain 10+ colonists) untested in-game; `RESOURCE_CRITICAL_THRESHOLD = 10` may need tuning once Habitation Module and real play reveal edge cases.

## Session 11 — Phase 2B: colony economy
- **Goal:** Build the resource economy behind the `FoundColony` stub — data-driven resources/buildings, a deterministic colony system, the `BuildStructure` command, the survival-clock payoff, and the colony UI. Terraforming (Phase 3) and population (2C) explicitly out of scope. Determinism + tests stay green.
- **Did:**
  - **Data** (`src/sim/data/colony.ts`): full 6-resource set (Power, Water, Oxygen, Food, Metals, Propellant) + 5 buildings (Solar Array, Ice Extractor, Regolith Smelter, Electrolysis Plant, Hydroponics Biodome) with inputs/outputs/costs, crew demand, founding seed, and all tuning. Rates are per economy-tick.
  - **Economy cadence:** `ECONOMY_TICK_INTERVAL = 60` (constants.ts) — colonySystem runs ~1 Hz (gated `world.tick % 60 === 0`), decoupled from the 60 Hz flight tick so reserves last minutes. Sequenced in `loop.ts` before life-support.
  - **colonySystem** (`src/sim/systems/colony.ts`): deterministic, fixed order — power gen (solar × insolation `L/r²`) → power allocation by priority → extraction/production (suppliers before consumers; water replenished before drawn) → crew consumption → clamp + cached per-resource flows. Power deficit sheds low-priority modules; water shortage starves consumers in order. Body physics feed it (insolation, `waterAbundance`).
  - **Colony component** keyed by body id; added to the registry + serialization.
  - **Commands** (`src/sim/commands/colony.ts`, delegated from `apply.ts`): `FoundColony` made real — creates the colony **conserving** ship supplies (metals/food from inventory, propellant from fuel, water+oxygen offloaded from `lifeSupport.current`), rejected if short. `BuildStructure { bodyId, building }` — validates colony exists, ship landed, enough colony Metals; deducts cost, increments count, emits `StructureBuilt`.
  - **Survival payoff** (`life-support.ts`): while landed at a colony with oxygen, the ship's reserve **recovers** (+3/flight-tick) instead of depleting — founding + sustaining a colony reverses the clock.
  - **UI** (`src/ui/ColonyPanel.tsx` in SurfaceView): found action when no colony; once founded, a resource ledger (stockpile + net/s, green/red) and a structures list with a Metals-gated build menu. Live via `useGameTick`.
  - **Tests:** `tests/colony.test.ts` (12 — founding conservation, cadence, flows, power/water cascades, relief, determinism) + 4 BuildStructure cases in `commands.test.ts`. 72/72 green; typecheck + build clean.
- **Decisions** (`docs/09`): full 6-resource set with Propellant's sink deferred to Phase 4; decoupled economy cadence; founding conserves supplies; supplier-before-consumer power priority; multiplayer deferred but determinism/serialisation preserved for a possible future lockstep.
- **Next:** confirm the loop in-browser (land Mira → found → build solar+water+electrolysis → watch O₂ go net-positive and the survival clock recover), then Phase 2C — population dynamics (growth/shrink with food, housing, conditions).
- **Open questions:** balance is untuned by playtest (building counts to reach equilibrium feel plausible on paper); should low/zero oxygen or food trigger crew-health effects now or wait for 2C's population model?

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
