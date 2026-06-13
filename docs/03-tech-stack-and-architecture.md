# 03 — Tech Stack & Architecture

## Headline decisions (with rationale)

### Decision: Web-first in TypeScript, wrappable to desktop later
**Chosen.** The game is a data-heavy simulation with a map view and a lot of UI — not a graphically demanding action game. A web stack is the lightest thing to develop on a MacBook Air, iterates fastest, runs anywhere, and is trivial to playtest (share a URL). When a desktop/Steam build is wanted later, we wrap the same code in **Tauri** (Rust-backed, tiny binaries, far lighter than Electron) — no rewrite. This keeps the monetization door open without paying any cost now.

**Why not a full game engine (Unity/Unreal)?** Unreal is AAA-graphics overkill and heavy on the Air. Unity is heavier than we need and carries licensing baggage; its strengths (3D scenes, asset pipeline) aren't our bottleneck.

**Viable alternative — Godot 4 (kept on the table):** free, no royalties, Apple-Silicon-native, light, exports to web + desktop. If at some point we want real engine tooling (scene editor, built-in UI nodes), Godot is the fallback. Trade-off: Claude Code is stronger and faster at TypeScript/React than at GDScript, which matters for our AI-assisted workflow and token efficiency. **We start web/TS; revisit only if a concrete need appears.**

### Decision: IDE = VS Code + Claude Code
**Chosen.** VS Code is free, light on the Air, and is where Claude Code integrates most cleanly. (If we ever switch to Godot, use the Godot editor for scenes + VS Code for scripts.) Cursor/Zed are fine alternatives but add nothing over VS Code given we're driving with Claude Code.

### Decision: Stylised 3D for space views + HTML/React for UI
Space/system/galaxy views use **Three.js** with cheap primitives (instanced points for stars, line orbits, simple spheres for planets) — looks good, costs almost nothing to render. All the heavy "game" surface (panels, tables, build menus, colony management) is **plain DOM/React**, which is cheap, accessible, and fast to build. *Assumption flagged: if you'd prefer a pure-2D look, say so — it's even lighter, and the architecture below doesn't change.*

### Decision: Deterministic ECS simulation, decoupled from rendering
The simulation is the product; rendering is a view of it.

## Architecture overview

```
┌────────────────────────────────────────────────┐
│  Rendering / UI layer (Three.js + React)         │  reads state, sends commands
├────────────────────────────────────────────────┤
│  Command / intent layer                          │  player actions -> validated commands
├────────────────────────────────────────────────┤
│  Simulation core  (deterministic, headless)      │
│   - ECS world (entities = stars, planets, ships, │
│     colonies, populations, fleets…)              │
│   - Systems run on a fixed tick:                 │
│       orbital, economy, population, terraform,   │
│       diplomacy, conflict                        │
│   - Seeded RNG only                              │
├────────────────────────────────────────────────┤
│  Data layer                                      │
│   - Static science/content data (JSON)           │
│   - Save/load (serialised world state)           │
└────────────────────────────────────────────────┘
```

Key principles:
- **The simulation core has no dependency on the renderer.** It can run in a test/headless context. This is what makes saves, debugging, and a possible future server reliable.
- **Fixed-tick simulation, interpolated rendering.** The sim advances in discrete ticks; the renderer can interpolate for smoothness.
- **Determinism:** identical inputs → identical state. All randomness goes through one seeded RNG. No `Math.random()` in the sim.
- **Data-driven content:** planet types, buildings, resources, terraforming levers, tech are defined in data files, not hardcoded — so balancing and expansion are edits, not code.

## Suggested repo layout

```
/space-game
  CLAUDE.md
  /docs                 # the context files in this set
  /src
    /sim                # deterministic core (no DOM/Three imports here)
      /ecs              # world, entities, components, systems
      /systems          # orbital, economy, population, terraform, ...
      /data             # static content as typed JSON/TS
      /math             # orbital mechanics, rng, units
    /render             # Three.js scene(s)
    /ui                 # React components, panels, HUD
    /app                # wiring: load data, tick loop, save/load
    /assets             # minimal icons, fonts
  /tests                # sim is unit-testable precisely because it's headless
  /tools                # scripts: import star catalogs, build data
  vite.config.ts
  package.json
```

## Physics / navigation approach
- **Orbital motion:** Kepler's laws — each body has orbital elements; position is computed analytically per tick. Cheap, exact-enough, deterministic.
- **In-system travel:** patched-conic / transfer approximations (the simplification real games like Kerbal Space Program use). Not live n-body.
- **Interstellar travel:** abstracted (travel time as a function of distance + tech). FTL is the explicit soft-sci-fi allowance — see `docs/04`.
- Details and formulas live in `docs/04-science-foundations.md`.

## Saves
World state serialises to JSON (compressed if needed). Because the sim is deterministic and data-driven, a save is just the entity/component state + RNG seed + tick count.

## Tooling baseline (all free)
- **Runtime/build:** Node.js (LTS) + Vite.
- **Language:** TypeScript (strict mode).
- **Rendering:** Three.js. **UI:** React. **ECS:** start with a small library (e.g. Miniplex/bitECS) or a hand-rolled minimal ECS — decide when we scaffold.
- **Testing:** Vitest (pairs with Vite) — used heavily on the sim core.
- **Hosting for playtests:** GitHub Pages or itch.io (free).
- **Version control:** Git + GitHub.

## Open technical decisions to make at scaffold time
- ECS library vs hand-rolled (lean: start minimal/hand-rolled, swap if needed).
- State/command plumbing between sim and React (event bus vs store).
- Star-catalog import format (see `docs/04`).
