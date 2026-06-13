# 09 — Decision Log

Newest first. One line per decision: date · decision · one-sentence rationale.
Append here whenever an architectural or design choice is made; see `CLAUDE.md` for the protocol.

---

| Date | Decision | Rationale |
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
