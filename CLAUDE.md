# CLAUDE.md — Project Root Context

> This file is loaded automatically by Claude Code at the start of every session.
> Keep it short and stable. Detailed material lives in `/docs` and is loaded **only when relevant**.
> When something here changes, update it deliberately — this is the project's source of truth.

---

## What we are building

**Title:** *Stellar Dominion* (confirmed)

A single-player **space 4X / grand-strategy + colony-sim** game. The player begins **stranded in a damaged spaceship with a small crew and basic starter materials**, and rises to control **planets → star systems → galaxies → (eventually) the wider universe**.

Core fantasy: *from one broken ship to a civilization that rules the stars.*

Core verbs: **explore, settle, terraform, build, trade, ally, conquer, rule.**

Design constraint: **grounded, not pure fantasy.** Star data, orbital mechanics, habitability, and terraforming are based on real science (see `docs/04-science-foundations.md`). Soft sci-fi is allowed only at clearly-marked frontiers (e.g. faster-than-light travel, the top "universe" scale).

---

## Hard constraints (do not violate without an explicit decision)

- **Dev machine:** MacBook Air (Apple Silicon, integrated GPU). Early builds must run light — modest compute, modest graphics.
- **Stack:** TypeScript, web-first (Vite + Three.js for 3D map views, HTML/React for UI). Designed to be wrapped as a desktop app later (Tauri). See `docs/03-tech-stack-and-architecture.md`.
- **No heavy real-time physics.** Use Kepler / patched-conic orbital math on a fixed simulation tick. No live n-body solving in the early phases.
- **Architecture:** deterministic simulation core, decoupled from rendering. Entity-Component-System (ECS). Saves are serialisable data.
- **Monetization:** none now, but never paint us into a corner — keep game logic portable and free of anything that blocks a future Steam/itch desktop release.
- **Cost target now:** ~$0 in tooling/hosting (everything free; only the AI subscriptions you already have).

---

## How to work in this repo (read before coding)

1. **Spec before code.** For any non-trivial feature, write or update the relevant `/docs` file first, then implement against it. This saves tokens and prevents drift.
2. **Touch the minimum context.** Load only the docs relevant to the current task. Don't pull the whole `/docs` folder into context "just in case."
3. **One vertical slice at a time.** Follow `docs/05-roadmap.md`. Don't build breadth before the current slice works end to end.
4. **Log decisions.** Architectural or design decisions go in the relevant doc as a dated "Decision" note, and a one-line entry goes in `docs/07-devlog.md`.
5. **Determinism is sacred.** The simulation must produce identical results from identical inputs (needed for saves, debugging, and possible future multiplayer). Keep randomness seeded.
6. **Small commits, descriptive messages.** Git history is part of our memory.

## Division of AI labor (see `docs/06-ai-workflow-and-token-budget.md`)

- **Claude Code** → precise implementation, refactoring, architecture, debugging, anything touching the real codebase.
- **Gemini** (large context / free tier) → whole-codebase reviews, research for scientific accuracy, lore/content generation, brainstorming, summarising long material before it ever reaches Claude Code.

---

## Document index

| File | Purpose |
|---|---|
| `docs/01-project-charter.md` | Vision, pillars, roles, success criteria, scope guardrails |
| `docs/02-game-design.md` | Gameplay: scales, planet evolution, terraforming, colonies, trade, social, conflict |
| `docs/03-tech-stack-and-architecture.md` | Stack decision + rationale, IDE, ECS, repo layout, save format |
| `docs/04-science-foundations.md` | Real data sources, orbital mechanics, habitability, where soft sci-fi is allowed |
| `docs/05-roadmap.md` | Phased milestones / vertical slices, MVP definition |
| `docs/06-ai-workflow-and-token-budget.md` | Claude Code + Gemini workflow, token discipline, session protocol |
| `docs/07-devlog.md` | Running log of what was done each session |
| `docs/08-rendering-and-camera.md` | 3D open-world feel: camera scales, flight, landing, nav map, performance |

---

## Current status

- **Phase:** 0 — Foundations: **complete**. Repo scaffolded (Vite + TS strict + Vitest), headless deterministic ECS + fixed tick (determinism test passing), and a first static 3D system renders (star + 2 planets on Kepler orbits, free-look camera). Moving into Phase 1.
- **Confirmed:** title *Stellar Dominion*; stylised **3D** with an open-world cruising feel (see `docs/08`); Civ-like random start near a habitable planet; per-system difficulty levels. Phase 0 decisions: hand-rolled ECS; React deferred to Phase 1; first system seeded/stylised (real catalog data is Phase 1).
- **Next action:** Phase 1 — curate one real, physically-plausible system; add the stranded ship (crew + materials + life-support that ticks down); system map with selectable bodies.
- **Last updated:** Session 3.
