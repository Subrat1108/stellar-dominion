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
