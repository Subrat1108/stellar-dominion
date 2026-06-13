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
4. **Log decisions.** Architectural or design decisions go in `docs/09-decisions.md` (one line, dated, with rationale) and a one-line entry goes in `docs/07-devlog.md`.
5. **Determinism is sacred.** The simulation must produce identical results from identical inputs (needed for saves, debugging, and possible future multiplayer). Keep randomness seeded.
6. **Small commits, descriptive messages.** Git history is part of our memory.

## Session logging protocol (mandatory)

The planning room and future sessions only see what's pushed to the repo. End every session by: (1) appending a `## Session N` entry to `docs/07-devlog.md` (goal, did, decisions, next, open questions); (2) updating the **Current status** block in this file — it is the canonical state snapshot; (3) appending any decisions to `docs/09-decisions.md` with a one-sentence rationale; (4) committing and pushing to GitHub — pushing is what makes work visible to the planning room.

## Long tasks & checkpointing (don't lose work to context limits)

Long jobs can run out of context before finishing. Keep every task resumable from the repo alone: (1) plan as a checklist before starting, kept in an in-progress devlog entry; (2) commit after each working step (e.g. `wip(phase1): crew components`) — small checkpoint commits are breadcrumbs; never leave hours of work uncommitted; (3) maintain a **"Resume point"** line at the top of `docs/07-devlog.md` stating what's done and the exact next step, updated as you go; (4) if context runs low, finish the current step, update the resume point, commit and push, and tell me a fresh session is needed — don't push past the limit and lose the thread; (5) on completion, replace the in-progress notes with the normal Session entry.

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
| `docs/09-decisions.md` | Decision log: every architectural/design choice, dated, one-sentence rationale, newest first |

---

## Current status

- **Phase:** 1B — **complete**. Chase/cockpit camera follows ship (M toggles to system map view). WASD/arrow keys steer; ship thrusts in heading direction. Speed multiplier (1×/10×/100×/1000×) on HUD advances sim ticks per real frame — life support depletes faster at higher speed (intentional). Floating origin keeps ship at render (0,0,0). Autopilot stub: "SET COURSE" in SystemPanel → ship steers to target; manual input overrides; "CANCEL AUTOPILOT" on HUD. 38/38 tests passing.
- **Confirmed:** XZ-plane movement (yaw only) for Phase 1B; drag=0.98/tick for natural deceleration; floating origin is renderer-only; `FIXED_DT` lives in `src/sim/constants.ts`.
- **Next action:** Phase 2 — first colony: land on a body, found a dome, start resource flows.
- **Last updated:** Session 5.
