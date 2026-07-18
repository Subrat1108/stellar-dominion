# Session 23 — PLANNING — the design spine (`docs/15-design-pillars.md`)

> PLANNING-room rationale for this session. The "why". Pairs with the BUILD-room
> "what" in `docs/07-devlog.md` and the one-line records in `docs/09-decisions.md`.

## Goal

Capture design decisions made in the planning room — the core fantasy/fun
loop, the player motivation stack, why worlds must be differentiated, the
economy spine's intended shape, and the production/architecture constraints
(including a hard multi-agent-seam rule) — that currently exist nowhere in
the repo. Docs-only: write `docs/15-design-pillars.md` so every future slice
has a stable spine to read against, instead of re-deriving intent from chat
each time.

## Decisions (with rationale)

### 1. The fun loop is EXPLORE → LAND → COLONISE → TERRAFORM → REACH FURTHER → prospect again
**Call:** Name the loop explicitly as the thing every slice must close, not just imply it via phase names.
**Why:** The original playtest complaint ("no goals, no payoff") traced to exploration not feeding back into anything — discovery has to feed discovery, or the loop reads as busywork between the phases.
**Logged:** `docs/15` §1

### 2. Player motivation is a named stack (survival, growth/scarcity, curiosity, dominion, legacy), each grounded in specific SF touchstones
**Call:** Reject "human nature" as a design justification; require each drive to be an actual system the player feels.
**Why:** A vague appeal to motivation doesn't constrain design — naming the five drives and tying each to a mechanic already in the repo (life-support ticking, the resource split, scanning/warp, the phase progression, terraforming) makes the stack checkable against future work.
**Logged:** `docs/15` §2

### 3. Differentiated worlds fixes the "exploration = sightseeing" problem
**Call:** Worlds must differ in value (resources/habitability/hazards/strategic yield), not just appearance — exploration must be prospecting.
**Why:** This is the direct fix to the original goal/payoff complaint: if every world is roughly as good as every other, finding one changes nothing. `docs/12`'s per-system hooks (YZ Ceti's SPI hazard, Epsilon Eridani's debris disk) already do this; §3 makes it an explicit standing requirement for future systems too.
**Logged:** `docs/15` §3

### 4. The economy spine: bulk-local / strategic-scarce, with terraforming as a networked, soft-gated activity
**Call:** Bulk resources stay local (near self-sufficiency per world); strategic resources are scarce and worth moving; interdependence is both a growth motive and the anti-snowball brake; terraforming pulls on the wider economy but never hard-locks a colony that's crawling alone on local resources; tech (progression gate) and resources (consumed feedstock) are kept as distinct axes.
**Why:** This is design intent for later, not a build order — but it retroactively explains and locks in *why* the existing 3A/3B terraforming split is shaped the way it is (3A = local/basic, no dependency; 3B = networked/advanced, gated). Without writing this down, a future session could "simplify" 3B into something local and quietly erase the reason the split exists.
**Logged:** `docs/15` §4; affects `docs/11`, `docs/12`

### 5. Progression is colony-output-unlocks-reach; this is explicitly the SEED of a tech tree, not the tree itself
**Call:** Warp's current "god mode" (`docs/09` 2026-06-24, 2026-06-16) is temporary scaffolding meant to be retired by a later gate tied to colony output.
**Why:** Names the shape (one output → one reach-unlock) without committing to the full tech graph, so nothing built now needs retrofitting once the tech tree lands — but also stops "ungated forever" from becoming the accidental default.
**Logged:** `docs/15` §5

### 6. HARD RULE: the sim must be owner-scoped and command-total (the multi-agent seam)
**Call:** The player is AN owner, never THE owner. Every slice from now on — even single-player-only ones — is built so any mutation the player can cause goes through the same typed command interface (`applyCommand`/`GameEvent`) an AI opponent or remote player would also use. Reject designs baking in single-actor assumptions.
**Why:** The repo already laid determinism/serializability groundwork for a *possible* future lockstep multiplayer (`docs/09` 2026-06-14) but that was framed as an incidental nice-to-have. This session promotes it to a standing design guardrail, because retrofitting owner-scoping after mechanics are built single-actor-first is far more expensive than building it in from the start. Logged as a decision (not just doc prose) so it's checkable in future reviews.
**Logged:** `docs/09` 2026-07-18 row; `docs/15` §6

### 7. Production-readiness and the online ladder are named explicitly as first-class constraints
**Call:** Save-version migration, error handling at boundaries, perf budgets, and packaging join the existing determinism/tests bar; online capability is explicitly staged (distribution → save-sync → multiplayer) and monetization stays open/undecided.
**Why:** These were implicit assumptions (the swappable `SaveStore` interface, the Tauri desktop path in `CLAUDE.md`) that hadn't been stated as a coherent ladder. Writing the order down prevents skipping straight to multiplayer or bolting on monetization before the identity/server infrastructure it shares with save-sync is decided.
**Logged:** `docs/15` §6

## Open questions / deferred

- The actual tech-tree shape beyond "one output, one reach-unlock" — deferred to the economy/tech slice (`docs/05` Deferred list).
- Full anti-snowball macroeconomics (admin latency, courier upkeep, gravity-well tax) — deferred per `docs/12` reconciliation and `docs/05`.
- Multiplayer/AI-opponent implementation itself — the seam rule only constrains *how future mechanics must be built*, not when multiplayer ships.

## Scope guard

**In:** `docs/15-design-pillars.md` (new), one `docs/09` decision row, a `docs/05` pointer, a `CLAUDE.md` doc-index row, `progress.md` updates, this file.
**Out:** No code changes. No new mechanics. No scheduling commitment for anything marked deferred.
