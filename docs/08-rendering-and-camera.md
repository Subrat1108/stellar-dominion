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
A deliberately small six-key scheme keeps piloting legible: **W/S** thrust forward/back along the nose, **A/D** steer left/right (yaw), **↑/↓** steer up/down (pitch). You climb or dive by pitching and then thrusting — there is no separate world-vertical key. Camera: **C** cycles cockpit → chase → map, **M** toggles map, right-drag looks around. The in-flight speed buttons are a **throttle** (scale ship accel/max-speed), not time compression — see the revision note above.

## Presentation scale (one tunable place)
All scene-scale knobs live in `src/sim/presentation.ts`: AU→scene-unit distance, body render-radius scaling, and ship size. The mapping is **non-physical and compressed** — real radii span ~1:86 (rocky planet:star), too wide to render legibly together — so rocky planets scale ~linearly in Earth-radii while the gas giant and star are compressed. The goal is a believable hierarchy (ship ≪ planet ≪ star) that stays navigable (a planet reachable in a short flight, visibly growing on approach). Real physical values stay in the tagged sim data and are never edited for looks.

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
