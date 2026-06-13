# 09 — Decision Log

Newest first. One line per decision: date · decision · one-sentence rationale.
Append here whenever an architectural or design choice is made; see `CLAUDE.md` for the protocol.

---

| Date | Decision | Rationale |
| 2026-06-13 | Orbital time decoupled from flight time via `ORBITAL_TIME_RATE` (0.003) | Planets advanced on real-time `world.time` and whipped around as you flew; a slow orbital clock keeps them nearly stationary during a flight while staying a deterministic function of tick. |
| 2026-06-13 | All scene-scale constants centralized in `src/sim/presentation.ts`; render radii compressed (non-physical) | One tunable place for AU→scene distance, body render-radius, and ship size; physical radii span ~1:86 so a compressed mapping is needed for a legible ship≪planet≪star hierarchy. Real sim data stays untouched/tagged. |
| 2026-06-13 | Flight simplified to six keys (W/S thrust, A/D yaw, ↑/↓ pitch); world-vertical removed | Space/Shift world-vertical was redundant with pitch-then-thrust and cluttered the scheme; climb/dive via pitch is enough and reads more like piloting. |
| 2026-06-13 | Speed lever is a **throttle** (scales ship accel/max-speed), not sim time compression | Playtesting showed time-compression made piloting feel disconnected; throttle gives direct control. Time compression returns separately with autopilot (Phase 4). Supersedes the Session-5 "throttle vs time" note. |
| 2026-06-13 | Full 3D flight (yaw + pitch + world-vertical thrust); supersedes XZ-plane-only | Playtester needed to move in every direction; pinning to the orbital plane felt broken. Pitch clamped near ±90° to avoid gimbal flip. |
| 2026-06-13 | Floating origin via a single `worldRoot` group offset by -shipPos | Per-mesh offsetting left transform-less objects (the star) and static geometry (orbit rings, starfield) pinned, decohering the scene; one group moves everything together. |
| 2026-06-13 | Three camera views (cockpit / chase / map), C cycles, M toggles map | "Racing-style" inside + outside views per playtester; map kept for navigation. Cockpit hides the hull and looks down the nose. |
| 2026-06-13 | On-screen DebugPanel + throttled console log of ship telemetry | Lets bugs be diagnosed from a single screenshot/log during the flight-model bring-up. |
| 2026-06-13 | XZ-plane movement only (yaw, no pitch) for Phase 1B *(superseded same day)* | Matches the orbital plane; full 6-DOF adds complexity without payoff at this stage. |
| 2026-06-13 | Drag = 0.98/tick on ship velocity | Natural deceleration without a dedicated brake key; small non-Newtonian feel is an acceptable trade for playability. |
| 2026-06-13 | Floating origin is renderer-only; sim keeps absolute coordinates | Keeps serialization/saves simple; float-jitter only matters in the render layer. |
| 2026-06-13 | speedState is a plain mutable object, not React state | The frame loop mutates it synchronously; React only needs to read it on button click — React state would add unnecessary overhead. |
| 2026-06-13 | FIXED_DT extracted to src/sim/constants.ts | ship-movement.ts needs it but can't import from loop.ts (which imports the system) without a circular dep; shared constants file breaks the cycle. |
|---|---|---|
| 2026-06-13 | React added in Phase 1A (not deferred to 1B) | Body inspector + HUD are natural companions to the system-data work; the UI is minimal enough to not add risk. |
| 2026-06-13 | Tau Ceti (τ Ceti / HD 10700) chosen as the first star system | Real G8V star 11.9 ly away, well-characterised by HYG/HIPPARCOS, with 5 known radial-velocity candidate planets including a habitable-zone target (Mira). |
| 2026-06-13 | `CelestialBody` component replaces old `Body` — single type covering stars, planets, gas giants | Rich physical data is needed by the habitability model and UI; a unified discriminated type is cleaner than splitting. |
| 2026-06-13 | Life support stored as arbitrary units (100 000 / 1 per tick); time-compression multiplier deferred to Part B | Keeps the depletion rate simple and deterministic now; Part B wires it to the speed lever. |
| 2026-06-13 | First system seeded/stylised (not real catalog data) until Phase 1 | Real star/planet import is Phase 1 work; Phase 0 only needs orbits that look plausible. |
| 2026-06-13 | React deferred to Phase 1 | Phase 0 is a static scene with no UI panels, so adding React now would be pure overhead. |
| 2026-06-13 | Hand-rolled ECS (not Miniplex/bitECS) | Phase 0 needs little, and full control over entity ids + iteration order keeps determinism fully under our control. |
| 2026-06-13 | `vite.config.ts` doubles as Vitest config | Keeps one config file and pairs naturally with the Vite build pipeline. |
| 2026-06-13 | Fixed simulation `dt = 1/60`; accumulator in app/main.ts | Decouples sim speed from frame rate so determinism holds regardless of display refresh. |
| 2026-06 | Model-usage policy: Sonnet default / Opus for hard reasoning / Haiku for boilerplate / Fable rare | Balances capability against cost and speed; Opus reserved for problems that actually need it. |
| 2026-06 | Content tagged real / derived / fictional | Makes scientific accuracy auditable and keeps soft sci-fi confined to labelled frontier zones. |
| 2026-06 | Stylised 3D via layered camera scales, not a single seamless open world | A truly seamless space-to-surface world is multi-year AAA scope; layered scales deliver the feeling cheaply. |
| 2026-06 | Civ-like random start + per-system difficulty | Ensures there is always a visible early goal (habitable planet nearby) while allowing variable challenge. |
| 2026-06 | Deterministic ECS sim decoupled from rendering | Renderer is a read-only view of sim state; decoupling enables headless testing, saves, and eventual server use. |
| 2026-06 | Kepler/patched-conic orbital math, no live n-body | Analytic position is cheap, exact enough, and fully deterministic; n-body is expensive and unnecessary for this scope. |
| 2026-06 | IDE: VS Code + Claude Code | Free, light on the MacBook Air, and where Claude Code integrates most cleanly. |
| 2026-06 | Web-first TypeScript stack (Vite + Three.js + React); Tauri for desktop later | Fastest iteration on the Air, easy playtesting via URL, no engine licensing risk; Tauri wraps it for desktop with no rewrite. |
