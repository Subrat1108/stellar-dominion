# Session 25 — PLANNING — the landing arc

> PLANNING-room rationale for this session. The "why". Pairs with the BUILD-room
> "what" in `docs/07-devlog.md` and the one-line records in `docs/09-decisions.md`.

## Goal

Pick up the fun loop at the LANDING moment (`docs/15` §1: EXPLORE → **LAND** →
COLONISE → …). Make landing a *meaningful choice that shapes the colony you
found*, and use it as the first player-facing application of the hard
multi-agent rule (`docs/15` §6) and the production save-migration discipline.
Build it owner-scoped and command-total so AI/multiplayer owners are never a
retrofit; seed (but do not build) the two-tier economy (`docs/16`).

## Decisions (with rationale)

### 1. Site science as MODIFIERS on an aggregate globe — never a tile/AP/surface layer
**Call:** Landing generates ~3 deterministic candidate sites from the body seed; choosing one founds the colony with scalar starting modifiers derived by a pure `siteModifiers()` mapping. No tiles, no rovers, no build radius, no action points. `docs/14` authored to carry this (it did not exist in the repo before this session).
**Why:** It is the repo-consistent way to make landing *matter* (`docs/15` §3, "exploration reveals goals") without building a surface game — which `docs/08` explicitly rules out as multi-year AAA scope. The aggregate colony model (`docs/10`) already exists; site science plugs into it as head-starts/efficiencies/costs, not a new spatial dimension.
**Logged:** `docs/09` 2026-07-18 (landing-arc row); `docs/14` (new)

### 2. The actor-envelope IS the canonical multi-agent mechanism
**Call:** A `Command` stays identity-free; the issuing actor rides alongside it as an envelope (`{ command, actorId }`), resolved by `applyCommand(world, cmd, actorId)`. Colonies carry `ownerId`; the local player is `world.localOwnerId = "player"`.
**Why:** `docs/15` §6 requires an AI to reuse the *exact* command layer — so a command must be byte-identical regardless of who issues it, which means the actor cannot live in the payload. The envelope is the honest seam. Recording the *pattern itself* (not just this use of it) means future owner-scoped slices reuse it rather than reinventing per-mechanic ownership. Chosen over baking `ownerId` into each command variant (couples identity to payload) and over a privileged global "current player" (violates the hard rule).
**Logged:** `docs/09` 2026-07-18 (actor-envelope row)

### 3. Save changes use a versioned migrator chain — the reusable pattern
**Call:** `reconstructWorld` runs an ordered chain of pure `vN→vN+1` migrators up to the current `SAVE_VERSION` (bumped 2→3 for the owner/site colony shape); a version *above* current still throws. The v2→v3 migrator assigns existing colonies to the local-player owner + default site fields.
**Why:** `docs/15` §6 makes "old saves load in newer builds" a first-class constraint. The old hard-throw-on-mismatch behaviour breaks saves; a migrator chain is the standard, extensible answer. Recording it as the *pattern* (every future save change adds one migrator + bumps the version) is the point — this slice is the dress rehearsal.
**Logged:** `docs/09` 2026-07-18 (migrator-chain row)

### 4. Minimal EDL — a light viability classifier, not a descent sim
**Call:** Include a pure `landingViability(body)` (vacuum/thin/nominal/thick from pressure + gravity) as a landing affordance, with one light hook (payloadFactor nudges founding setup cost). No descent simulation, no failure/risk.
**Why:** Cheap, legible reinforcement of differentiated worlds (`docs/15` §3) at the landing moment — worlds differ in *how you get onto them*, not just what's on them. Deliberately bounded and flagged as the most deferrable piece (droppable to display-only if the commit runs long) so it can't balloon into a minigame.
**Logged:** `docs/09` 2026-07-18 (EDL row)

### 5. Interdependence seed — Fissiles presence only
**Call:** Introduce Fissiles as the first Strategic-Core resource (`docs/16`) at presence/absence granularity; a founded colony lacking local Fissiles is surfaced legibly as import-dependent. No stockpile/production/consumption/routes.
**Why:** The lightest thing that creates the *pull* toward other worlds (`docs/15` §2 scarcity) the moment a colony is founded, and the first visible appearance of the bulk-vs-strategic split (`docs/16`) — with none of the economy machinery, which stays deferred. Soft, not hard: a pull, never a softlock (`docs/15` §4).
**Logged:** `docs/09` 2026-07-18 (interdependence-seed row)

## Open questions / deferred

- The strategic-resource network / virtual trade routes / logistics / transport — the economy slice (`docs/16`), deferred.
- Rival/AI owners actually competing — the actor-envelope makes them a pure addition, but they are not built here.
- 3B terraforming depth, the hard-start retune, any real EDL descent/risk mechanic — all deferred (`docs/05`).

## Scope guard

**In:** owner-scoped colonies (actor-envelope command layer) + save v2→v3 migration; deterministic candidate sites + selection UI; site→founding modifiers; minimal EDL; the Fissiles-presence interdependence seed. New pure-fn tests for each.
**Out:** terraforming/economy/population logic (untouched beyond reading a new `solarEfficiency` modifier and displaying strategic-availability); any surface-spatial layer (never); the deferred list above.

## Commit split

docs → owner-scoping + save migration → candidate sites + selection → site modifiers + EDL → interdependence seed. Each: all existing tests green + new pure-fn tests; typecheck + build clean; committed + pushed to `dev` separately.
