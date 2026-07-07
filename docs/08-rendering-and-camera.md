# 08 — Rendering, Camera & the Open-World Feel

This doc owns the *moment-to-moment 3D experience*: cruising through space, seeing ships/planets/asteroids, approaching and landing, the nav map, and travel speed. It's separated from `docs/03` because it carries the project's biggest technical risk and will accumulate detail.

## The experience goal (north star)

The player should *feel* like they're piloting a ship through a living star system: stars and planets in real 3D, asteroids drifting, other ships approaching, a sense of distance and speed. They can fly manually or hand off to autopilot, pull up a navigation map, set travel speed, and approach a planet to "land" (transition to its surface/colony view).

## The honest engineering reality (read this before promising anything)

A truly *seamless* space-to-surface open world (continuous descent from orbit to a walkable surface, like No Man's Sky) is a multi-year AAA-scale feature involving procedural planetary terrain, atmospheric rendering, terrain LOD streaming, and brutal floating-point-precision problems at astronomical scales. On a MacBook Air, with a solo+AI team, attempting that first would stall the project indefinitely.

**Our strategy: deliver the *feeling* in layers, fake the expensive transitions convincingly, and treat true seamless descent as a north star we approach over time — never as an MVP requirement.** Autopilot actually helps us here: scripted/eased camera moves are far cheaper and more reliable than full free-flight physics everywhere.

## Camera / control "scales" (the core idea)

Instead of one impossible continuous world, we use a small set of camera/control scales the player moves between with smooth transitions. Each is independently cheap to render. The *strategy simulation underneath is continuous and deterministic* — these are just views/controls onto it.

1. **Cockpit / chase (flight scale).** Real-time piloting near the ship: see nearby ships, asteroids, the planet you're approaching. Small local bubble of high detail around the player. This is where "cruising" lives.
2. **System scale.** Pull back to see the whole star system — planets on their orbits, your ship as a marker. Used for picking a destination.
3. **Approach / orbit scale.** Coming up on a planet: it grows from a dot to a sphere; you orbit; you choose to land.
4. **Surface / colony scale.** "Landing" transitions (fade/zoom/dock animation) into the planet's surface & colony-management view. Initially this is a *transition*, not a continuous descent.
5. **Galaxy / map scale.** The navigation map (see below) and interstellar travel.

Transitions between scales are eased camera moves + load/swap — they read as seamless without being a single monstrous scene. Over time we can make specific transitions (e.g. orbit → surface) progressively more continuous.

## Real-time view vs deterministic sim (how they coexist)

- The **strategy simulation** (economy, population, orbits, politics) runs on a fixed deterministic tick — see `docs/03`.
- The **flight/cruise view** is a real-time *presentation + control* layer that reads sim state and lets the player pilot.
- **Travel speed = time compression.** Cruising at higher speed advances the sim clock faster; piloting actions resolve into sim outcomes (you arrive at body X at tick T). This keeps one source of truth and makes "configurable speed" a clean, single lever.
  - **Phase 1B revision:** the in-flight speed buttons are currently a **throttle** (they scale the ship's acceleration / max speed), not time compression. The sim runs real-time. Reason: during playtesting, time-compression made piloting feel disconnected (the world raced while you nudged the stick). True time-compression returns as a *separate* control (autopilot / "skip travel") once autopilot routes land in Phase 4. See `docs/09` (Session 6).
- **Autopilot / auto-mode** = the sim/pathing moves the ship along a computed route while the player watches or skips ahead.

## Flight controls (Phase 1B)
A deliberately small six-key scheme keeps piloting legible: **W/S** thrust forward/back along the nose, **A/D** steer left/right (yaw), **↑/↓** steer up/down (pitch). You climb or dive by pitching and then thrusting — there is no separate world-vertical key. Camera: **C** cycles cockpit → chase → map, **M** toggles map, right-drag looks around. *(Superseded in Polish B — see the Session-21 section below: **C toggles cockpit ↔ chase only**, the map leaves the cycle, and mouse/touchpad **steers** via pointer lock with **Space** to free-look.)* The in-flight speed buttons are a **throttle** (set ship max-speed), not time compression — see the revision note above. **Exploration-polish A (Session 19):** the throttle is **5 exponential gears** spanning a wide dynamic range — `DOCK` (very slow, fine control onto a ~0.0085 u body) → `MAX` (fast enough to cross the ~700 u system in a few seconds), since honest distances are large. The curve is a pure function (`maxSpeedForGear`, unit-tested).

## Presentation scale (one tunable place)
All scene-scale knobs live in `src/sim/presentation.ts`: AU→scene-unit distance, body render-radius scaling, and ship size.

**Exploration-polish A revision (Session 19) — bodies are now PHYSICAL.** Body render radii were `6×`-inflated (a believable-but-fake hierarchy); playtesting showed that inflation, plus a too-close arrival framing, made the exploration leg feel unreal. They now use a **single honest factor** — `physicalRadiusToScene(m) = m × AU_TO_SCENE / AU_METERS` — so planet/gas-giant/star sizes are in true proportion to each other *and* to the real-AU distances. Consequence: a world is a small dot until you close on it (Earth-radius ≈ 0.0085 u; Tau Ceti ≈ 0.74 u), exactly per the `docs/09` governing principle.

**The ship + camera rig are the only non-physical avatars.** A literally-to-scale ship would be ~1e-7 u (invisible), so the ship stays a small-but-visible mote whose size (`SHIP_RADIUS/LENGTH`) and camera offsets (`CHASE_DIST/HEIGHT`, `COCKPIT_FWD`) shrink in lock-step *with* honest bodies — every camera **ratio** is preserved, only the absolute scale changes, so chase/cockpit framing behaves identically while the ordering ship ≪ planet ≪ star becomes physically true. Park / soft-stop / scanner / landing-reach are all re-derived off the real radius (park ≈ a fixed multiple of R so a body fills the same fraction of the FOV on arrival regardless of its size). Real physical values stay in the tagged sim data and are never edited for looks.

Because the scene now spans ~0.001 u (ship) to ~12 000 u (starfield), the renderer uses a **logarithmic depth buffer** + a small near plane so the huge dynamic range doesn't z-fight. The **orbit-placement floors** (`orbitSceneRadius`, moon spacing) are deliberately left as-is for now (distance placement baked into sim data; see `docs/05` deferred list).

> ⚠️ **Log-depth is a standing shader rule.** Because `logarithmicDepthBuffer: true` is on, **every custom `ShaderMaterial` must include the `logdepthbuf` chunks** (`#include <common>` + `logdepthbuf_pars_vertex`/`logdepthbuf_vertex` and `logdepthbuf_pars_fragment`/`logdepthbuf_fragment`) or it writes linear depth, mismatches the built-ins, and renders with wrong occlusion (the Session-21 "translucent planet / stars showing through" bug). Built-in materials do this automatically. See `docs/09` (2026-07-05).

## Exploration-polish B (Session 21) — controls, cameras, gravity, orbit, debris
A no-new-mechanics pass to make the exploration leg playable by hand (full detail in `docs/07` Session 21, rationale in `docs/planning/session-21.md`):
- **Two cameras** — `C` toggles **cockpit ↔ chase** only; the map left the camera cycle (still on `M`; the real clickable map is Polish C). The **cockpit** is an immersive first-person canopy drawn as a cheap **CSS overlay** (`ui/Cockpit.tsx`), not modeled geometry.
- **Control model** — SET COURSE *marks* a target (draws a heading indicator, no motion); AUTOPILOT flies it (thrust locked while engaged; the button toggles); ENTER ORBIT inserts when close in manual; LAND unchanged. **Mouse/touchpad steering** via pointer lock (click canvas to capture; hold **Space** to free-look; `Esc` releases), fed to the sim as yaw/pitch input.
- **Gravity** — deterministic patched-conic (`math/gravity.ts`): a tuned-μ feel model with real SOI / `v_circ` / `v_esc` structure; force-integrated in manual inside an SOI, analytic held orbit, escape velocity. See `docs/09` (2026-07-04).
- **Autopilot approach + orbit** — a two-phase **body-scaled** approach (`math/flight.approachSpeed`, ~20 s cinematic growth) that **velocity-matches** the drifting target, ending in a **spiral insertion** (blend radial→tangential) that slides seamlessly into a **close low orbit** (insertion 2 R, body biased left, slow reversed sweep). Constants in `presentation.ts` (`ORBIT_INSERTION_MULT`, `ORBIT_FRAME_YAW_BIAS`, `ORBIT_DIRECTION`, `LOW_ORBIT_PERIOD_S`) + `ship-movement.ts` (`AUTOPILOT`, `ORBIT_BLEND_*`) are the feel knobs.
- **Ship scale** — shrunk to ~1:470 of a planet (`SHIP_LENGTH`), a tiny craft against huge worlds.
- **Debris fields** — flyable **icy planetary rings** (per gas giant) + a **Kuiper belt** (system outer edge) as deterministic instanced fields (`render/debris-field.ts`, render-only, seeded by a render-only PRNG). Chunks sit between the ship and planet in size, so you fly *through* the ice — the sense of scale. See `docs/09` (2026-07-05).

## Exploration-polish C (Session 22) — the unified map, the ship model, camera-in, cockpit depth
Closes the exploration leg (full detail in `docs/07` Session 22, rationale in `docs/planning/session-22.md`):
- **Unified multi-scale map** — the M-view becomes THE strategic map: one continuous zoom across **`intra` (body + its moons) → `system` → `sector` → `galactic` (LOCKED) → `intergalactic` (LOCKED)**, subsuming the old separate SectorView into a single continuum; deepest zoom-in resolves back into the flyable **active** system. Node **labels + clicks are a DOM overlay** driven by renderer-projected node screen positions (shared `app/map-state.ts`, the same project-to-screen pattern as the flight target marker) — 3D stays in Three, interaction in React; cheap on integrated GPUs. A click opens a **detail popup** (reuses the `SystemPanel` inspector fields) with only the **context actions** valid for that body + ship state. **Ego-centric**: centered on the active system; the reachable catalog set within `WARP_RANGE_LY` populates around it (capped `MAX_MAP_NODES`; both tunable). Galactic/intergalactic tiers are **LOCKED scaffold** (Milky Way + a few named nodes, `data/galaxies.ts`), labeled but not explorable. The corner `Minimap` radar stays as the always-on flight compass; `SectorPanel` folds into the map popup.
- **Ship model** — the cone avatar (`buildShipMesh`) becomes a **primitive-built stylized ship**: fuselage (capsule/cylinder + cone nose), two swept wing boxes, a rear engine-block cylinder, 1–2 emissive engine dots — one merged `Group`, two-tone hull so the star-lighting/terminator gives it form as it turns. Still a single avatar object sized by the one `SHIP_LENGTH` constant; honest 1:470 ratio unchanged.
- **Camera "zoom-in"** — the third-person camera moves **closer** so the ship reads as a real craft (and the fixed-distance body behind it fills more frame). Because honest scale puts the ship below the old near plane at close range, this is a **camera-distance change plus a lower render near plane** (`~0.0002 → ~0.00002`; log-depth covers the range), NOT a scale change. Isolated in its own commit (4a) so depth artifacts are cleanly revertable; verified across multiple bodies. `CHASE_DIST` + the near plane are the feel knobs. A true hero-shot still needs the deferred **dedicated ship near-camera layer** (2-pass render).
- **Cockpit depth** — `ui/Cockpit.tsx` gains a **dashboard/coaming silhouette** across the bottom third (a shaped CSS/SVG console) with the MODE/SPD readouts sitting **on** it, plus an inner-shadow / slight strut perspective for a wrapped-around feel; center forward view stays clear. Still a 2D overlay (no modeled 3D interior).
- **Gradual manual acceleration** — thrust is a **speed-shaped** curve (`thrustAccel(currentSpeed)` — gentle near zero for docking, ramping to a healthy cruise when held) so speed builds over ~1–2 s instead of jumping; capped at `MAX_SPEED`. Pure, deterministic, unit-tested. See `docs/09` (2026-07-07).

## Orbital time vs flight time
Orbital motion runs on a **much slower clock** than the real-time flight view (`ORBITAL_TIME_RATE` in `src/sim/systems/orbital.ts`). At real-time rates planets whip around their orbits faster than you can close on them; slowed, the innermost planet has an effective period of ~an hour, so it's nearly stationary during a flight yet visibly drifts over several real minutes. Still a pure function of tick (deterministic). A player-facing time-compression lever (skip-travel) is deferred to Phase 4.

## Floating-point precision & scale (the unavoidable problem)

Space distances overflow normal 32-bit float precision and cause jitter. Standard solutions we'll adopt as needed:
- **Floating origin** — keep the player near coordinate 0 and move the world around them.
- **Scaled units / multiple coordinate spaces** — render distant objects in a compressed "far" space; only the local bubble uses true scale.
- **LOD (level of detail)** — planets are billboards/dots when far, low-poly spheres when near, detailed only on close approach.
We introduce these *only when a phase needs them*, not preemptively.

## Performance budget (MacBook Air)
- Stylised, low-poly, instanced rendering. Instanced points for star fields and asteroid belts; simple shaded spheres for planets; a handful of detailed models only for nearby ships.
- Hard cap on simultaneously-detailed objects; everything else is LOD'd down or culled.
- No expensive global effects early (no volumetric atmospheres, no real-time global illumination). Cheap shaders, baked looks.
- Target a smooth, modest frame rate at 1080p on integrated graphics — if a feature can't hit that, it's LOD'd or deferred.

## Navigation map
A dedicated map view (system and galaxy scale) for plotting destinations: select a body/system, see route, time, and fuel cost, then engage manual flight or autopilot. This is mostly 2D/overlay UI on top of a simple 3D backdrop — cheap and high-value.

## Starting conditions (Civ-like)
New game starts the player's stranded ship near a **randomly chosen star system that has at least one habitable (or near-habitable) planet within visible proximity** — so there's always an early goal in sight. Star systems carry a **difficulty level** (resource scarcity, hazards, distance to neighbours, hostile presence) that tunes the challenge of that start. See `docs/02`.

## Build order for this layer (maps onto the roadmap)
- **Phase 0:** static 3D system scene; free-look camera; planets on orbits as simple spheres. No piloting yet.
- **Phase 1:** cockpit/chase camera; basic cruising in-system; nearby asteroids/bodies visible; configurable speed (= time compression). Landing = simple transition to a placeholder surface view.
- **Phase 4:** polished approach/orbit scale; autopilot routes; nav map.
- **Phase 5:** galaxy-scale map + interstellar travel transitions.
- **Later/north star:** progressively more continuous orbit→surface descent; richer ships/encounters in flight.

## Parking lot (do not build yet)
- Continuous procedural planet surfaces; walking on planets.
- Real-time ship-to-ship dogfighting.
- Volumetric atmospheres / advanced graphics.
