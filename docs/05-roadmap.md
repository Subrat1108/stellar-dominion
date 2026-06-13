# 05 — Roadmap

Built as **vertical slices**: each phase produces something playable end-to-end, not a half-finished layer. We do not start a phase until the previous slice actually works. Phases are deliberately ordered so the hardest scope (galaxy/universe scale, conquest) comes *after* the core loop is proven fun.

> Time estimates are intentionally omitted — this is solo + AI, part-time, over months. Progress is measured by completed slices, logged in `docs/07-devlog.md`.

---

## Phase 0 — Foundations *(current)*
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

## Phase 4 — A full star system
- Multiple bodies in play (planets, moons, asteroids, a gas giant).
- In-system navigation & orbital logistics (transfers cost time + fuel).
- Multi-colony resource network within the system.

**Slice goal:** manage a system, not just a planet.

## Phase 5 — Interstellar: the galaxy map
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
