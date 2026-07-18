# 15 — Design Pillars

> The game's design spine. Every future slice reads this to stay aligned — it's
> where the planning-room decisions that shape *why* we're building what we're
> building live, distilled from chat into something the repo remembers. Detail
> docs (`docs/12`, `docs/13`, the roadmap) implement pieces of this; this doc is
> the frame they hang on.

---

## 1. Core fantasy & the fun loop

*From one broken ship to a civilization that rules the stars.*

The player begins stranded — a damaged ship, a small crew, basic starter
materials — and rises to control planets → star systems → galaxies →
(eventually) the wider universe. That arc only stays fun if it repeats as a
loop, not a one-time story beat:

**EXPLORE** (prospect for worlds worth having) → **LAND** (choose a world +
a site) → **COLONISE** (found + grow) → **TERRAFORM** (transform
hostile→living) → **REACH FURTHER** (colony output unlocks warp to better
worlds) → prospect again.

Discovery feeds discovery: what you find while exploring gives you a reason
to colonise; what you build while colonising gives you the reach to explore
further. Each pass around the loop should leave the player with a concretely
better empire *and* a new frontier in view. If a slice doesn't close this
loop — if exploring doesn't change what's worth colonising, or colonising
doesn't change what's reachable — it's not done yet.

## 2. Player motivation stack

Player motivation is not "human nature, generically" — that's not a
mechanic, it's a hand-wave. Each drive below is a real force acclaimed
science fiction takes seriously, and the game must **instantiate** it as a
system the player feels, not just a mood:

- **Survival.** Our premise. Expand or die — the ship's consumables tick
  down from minute one (`docs/01`, `docs/02`), and every colony inherits
  that pressure (shortages cascade, population starves). *The Expanse*,
  Stephenson's *Seveneves*.
- **Growth & resource scarcity.** No single world supplies everything — the
  economy spine (§4) makes this literal: bulk resources are local, strategic
  resources are scarce and concentrated. *Dune*, *The Expanse*.
- **Curiosity / the frontier.** Discovery as its own reward — scanning,
  warping, and the multi-scale map (`docs/12`, Exploration Polish C) exist to
  make *not knowing what's out there* feel worth resolving.
- **Dominion.** The title itself. The drive to rise from stranded to ruling —
  the throughline of every phase in `docs/05`.
- **Legacy.** Terraforming a dead world into a living one is the signature,
  slowest, most durable act in the game — Kim Stanley Robinson's Mars
  trilogy is the touchstone (`docs/11`, terraforming as an actively-managed
  multi-stage loop, not a passive sink).

Every new system should be checked against this stack: which drive is it
serving, and is it actually felt, or just claimed?

## 3. Differentiated worlds

Worlds must differ in **value** — resources, habitability, hazards,
strategic yield — not just in appearance. If every world is roughly as good
as every other, exploration degenerates into sightseeing: you look at
planets because they're there, not because finding one changes your plan.

This is the direct fix to the loop's original failure mode ("explore, but
nothing you find matters"). Exploration must **reveal goals** — a world
worth prospecting is a world that changes what you do next: a habitability
tier worth colonising, a strategic resource worth building a supply line
for, a hazard worth routing around. `docs/12`'s per-system hooks (YZ Ceti's
SPI radio hazard, Epsilon Eridani's debris-disk industrial potential) and
the ESI-as-display-tier model are exactly this differentiation, kept honest
by `computeHabitability` as the one real mechanic underneath.

## 4. The economy spine

*(Design intent — the shape the economy must have when it's built, not a
mandate to build it now. `docs/12`'s anti-snowball research is the fuller
brief; this is the reconciled version.)*

- **Bulk resources** (food, water, air, basic construction materials) stay
  **local** — each world is roughly self-sufficient in the boring stuff. No
  colony should depend on a supply line for survival basics.
- **Strategic resources** (rare metals, fusion fuel, exotics, concentrated
  energy) are scarce, concentrated on particular worlds, and worth moving —
  the thing worlds genuinely depend on each other for.
- **Interdependence cuts both ways.** It's a *motive* for expansion (you
  need what only another world has) and it's the **anti-snowball brake**:
  each new world adds a dependency, not just free output. A ten-system
  empire isn't ten times as strong if none of those systems can stand alone
  and all of them compete for the same scarce strategic inputs.
- **Terraforming is a networked activity.** A world isn't truly
  self-sufficient until terraformed, and terraforming pulls resources + tech
  from other worlds. This is **soft-gated, never hard-locked**: a colony can
  always crawl forward alone on local resources (no softlocks, ever); imports
  and tech *accelerate* it and unlock higher tiers it couldn't reach solo.
- **Tech vs. resources, kept distinct:** TECH is a progression gate —
  developed over time, unlocks capability. RESOURCES are consumed feedstock —
  local or imported, spent not unlocked. Conflating them is a recurring 4X
  design trap; keep the two axes separate in every future system.
- **This is why 3A/3B split the way they did.** 3A (`docs/11`) is
  deliberately local and basic — direct lever→parameter effects, funded by
  one colony's own resources, no dependency on anything else. 3B (deferred)
  is where the networked, advanced levers (magnetosphere, toxicity,
  biosphere, cross-lever feedback) arrive — and it's gated specifically
  because it's the piece that should pull on the wider economy once that
  economy exists. The split isn't arbitrary scoping; it's this pillar.

## 5. Progression

Colony output is what builds the reach to further, better worlds. Warp is
currently an **ungated scaffold** ("god mode" — `docs/09` 2026-06-24,
2026-06-16) so the exploration and colony mechanics could be built and
proven before progression exists on top of them. That was always meant to be
temporary: the eventual tech/economy layer **retires** god-mode warp by
making reach something the player earns from what their colonies produce.

This is the **seed of the tech tree**, not the whole tree: one output, one
reach-unlock. The full progression graph is future scope; what's fixed now
is the shape — colony output → unlocked reach — so nothing built before the
tech tree lands has to be retrofitted to fit it.

## 6. Production & architecture constraints

*(First-class, not an afterthought. The game ships production-ready, plays
offline and online, and stays monetizable — every slice from now on is
built against these constraints, not just the ones already in `CLAUDE.md`.)*

**Production-ready discipline.** Beyond the existing bar (determinism, tests
green per commit, typed interfaces — `CLAUDE.md`), future slices also need:
a **save-version migration story** (old saves must keep loading in newer
builds — the existing `version` field on the save payload, `docs/09`
2026-06-16, is the seam this hangs on), real error handling at system
boundaries, perf budgets (the MacBook Air constraint is permanent, not just
early-build caution), and eventual desktop/mobile packaging (Tauri, per
`CLAUDE.md` — keep game logic portable, nothing OS- or browser-locked).

**Offline is already solved and stays free.** The local-first, deterministic
sim already runs fully offline — that's not a future feature, it's the
current architecture, and nothing added later should compromise it.

**Online is a ladder, built in order — do not skip rungs:**
1. **Distribution** — a browser app, already true.
2. **Save-sync across devices** — the existing swappable `SaveStore`
   interface (`docs/09` 2026-06-16: flat JSON now, SQLite-WASM/OPFS
   deferred) is the seam this plugs into. No new save architecture needed,
   just a backend behind the same interface.
3. **Online multiplayer** — the endgame of the ladder, not a parallel track.

**The hard rule — the multi-agent seam.** The sim must model "an ACTOR"
abstractly. The player is **AN** owner, never **THE** owner. From now on,
every slice — even single-player-only ones — is built **owner-scoped and
command-total**: state is scoped to an owning actor, and every mutation a
player can cause goes through the same typed command layer
(`applyCommand`/`GameEvent`, `docs/09` 2026-06-14) that any other actor
would use. **No mechanic the player uses may be one an AI opponent couldn't
also drive through the same command interface.** This is a guardrail for
reviewing new designs, not a feature to build now: if a proposed system only
makes sense with exactly one privileged player, reject or reshape it before
it ships. This generalizes the existing determinism/serializability
groundwork laid for a possible future lockstep multiplayer (`docs/09`
2026-06-14) into a standing design constraint, not just a technical one.

**AI-agent single-player.** Opponents, when they arrive, emit commands
through the exact command layer the player uses — no special-cased AI hooks
into sim internals. The strategic-resource economy (§4) is what gives an AI
opponent meaningful goals to compete over; without differentiated,
interdependent worlds, an AI has nothing worth wanting.

**Monetization stays open.** No model-blocking decisions get made now.
Monetization and the sync/multiplayer rungs of the online ladder (b/c above)
will share the same identity/server infrastructure — they get decided
together, later, not piecemeal now.

## 7. Deferred

Everything not covered above — economy/logistics depth, 3B terraforming
feedback, rival AI, trade/diplomacy, conflict/conquest, multiplayer,
monetization specifics — is intentionally not designed further here. See the
**Deferred / parked** list in `docs/05-roadmap.md`, which enumerates each
and the slice it's held for. This doc sets the direction those slices must
converge toward; it doesn't schedule them.
