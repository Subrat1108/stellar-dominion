# 01 — Project Charter

## Vision

A grounded, science-respecting space 4X where a single stranded ship becomes a star-spanning civilization. The emotional arc is **scarcity → mastery → dominion**: the opening hours are about survival with almost nothing; the late game is about governing many worlds.

## Design pillars (every feature should serve at least one)

1. **Grounded wonder.** Real stars, real orbital motion, real planetary science. The awe comes from *truth*, not invented magic.
2. **Meaningful escalation of scale.** The player's frame of reference grows: a single hull → a planet's surface → a star system → a galaxy → the universe. Each tier introduces genuinely new decisions, not just bigger numbers.
3. **Transformation as the core fantasy.** Terraforming a dead rock into a living world over many stages is the signature loop.
4. **Systems over scripts.** Outcomes emerge from interacting systems (climate, economy, population, politics) rather than hand-authored events.
5. **Runs on a laptop.** Simulation depth, not graphical spectacle. Beautiful but cheap to render.

## What success looks like (this project, not commercial)

- A playable vertical slice: stranded ship → first colony → first terraforming milestone, fully working end to end.
- A codebase clean enough that new systems can be added without rewrites.
- Documentation good enough that any session (Claude or Gemini) can resume work cheaply.
- The author understands and can extend every subsystem.

## Roles (held by the AI collaborator across this project)

- **Chief Designer** — owns the game-design doc and the feel of each loop.
- **CTO** — owns the architecture, stack, and engineering standards.
- **Chief Creative Officer** — owns tone, theme, naming, and the "grounded wonder" pillar.
- **R&D Head** — owns scientific accuracy and the data pipeline.
- **Project Manager** — owns the roadmap, scope discipline, and token budget.

Decisions are proposed with rationale; the author (you) holds final veto.

## Scope guardrails (how we avoid drowning)

- **No multiplayer** until the single-player game is fun. (Architecture stays multiplayer-friendly, but we don't build it.)
- **No procedural galaxy at full scale early.** Start with one real, hand-curated star system.
- **No real-time combat.** Conflict is resolved turn/tick-based and statistical first; spectacle can come later.
- **No art-asset rabbit holes.** Use stylised primitives (spheres, orbits, icons) until gameplay is proven.
- **Defer anything that isn't in the current roadmap phase.** Write the idea into a "Later" section, then move on.

## Long-term vision / north star

The active roadmap (Phases 0–3, MVP) is the right thing to build now. Beyond it, the north-star is a **thermodynamic 4X**: an interstellar empire where energy budgets, gravity-well logistics, and the speed of light are the actual terrain of strategy — not a backdrop. In broad strokes:

- **Thermodynamic depth.** EROI-driven economy: every outpost runs an energy ledger; expansion stretches supply lines before it delivers returns. Waste heat and radiation are persistent taxes on industrial ambition.
- **Light-lag politics.** Communication delay is the primary driver of administrative decay. Distant colonies drift ideologically; governance structures (technocratic, confederal, martial, corporate) offer different trade-offs against this entropy.
- **Territory control.** Autonomous AI factions project zones of influence over Lagrange points and transit corridors; the player's role in the late game is arbitration and grand-strategic doctrine, not unit micro-management.
- **Eventual multiplayer.** The deterministic, command/event, serialisable sim is designed to accept a lockstep multiplayer layer — but no netcode is built until the single-player game is demonstrably fun.

None of this is active scope. Decisions resolving the open design questions from the research brief are logged in `docs/09-decisions.md` (2026-06-14). Detailed analysis lives in `docs/research/01-foundational-macro-loops-and-territory.md`.

## Monetization stance (later, but never blocked)

Not pursued now. Keep these paths open by keeping game logic engine-agnostic and data-driven:
- Premium desktop release (Steam / itch) — most natural fit for the genre.
- Expansion/DLC model (new sectors, mechanics) — the Stellaris pattern.
- Web demo as a funnel to a paid desktop version.
See `docs/03` for the technical choices that keep these open.
