# Session 24 — PLANNING — economy & interdependence brief (`docs/16`)

> PLANNING-room rationale for this session. The "why". Pairs with the BUILD-room
> "what" in `docs/07-devlog.md` and the one-line records in `docs/09-decisions.md`.

## Goal

File the Gemini interstellar-economy research brief into the repo as
`docs/16-economy-and-interdependence.md` — a reference for the deferred
post-landing economy/interdependence slice — reconciled up front against
decisions already made in `docs/15` (the soft terraforming-dependency rule,
the hard multi-agent-seam rule) and `docs/09`/`docs/12` (the existing
bulk-vs-strategic / gravity-well-tax framing). Docs-only: no code, no plan.

## Decisions (with rationale)

### 1. Land the brief with a reconciliation header, not verbatim
**Call:** Same pattern as `docs/12`'s reconciliation header (Session 15) — the brief is filed as a forward reference with a header at the very top correcting the points where it conflicts with decisions already made, so a future BUILD session can't take it literally where it's stale.
**Why:** The brief's source material predates `docs/15` and describes terraforming-requires-import as a hard requirement; `docs/15` §4 already settled that terraforming dependency is soft (accelerant + unlock, never a lock, no softlocks). Filing without correction would contradict a decision already logged.
**Logged:** `docs/09` 2026-07-18 row; header verbatim at the top of `docs/16`

### 2. Terraforming-as-sink stays SOFT, not hard-gated
**Call:** The brief's "terraforming requires importing" language is corrected to "imports/tech accelerate and unlock higher (3B) tiers; 3A and basic survival are never import-gated."
**Why:** Directly enforces `docs/15` §4's no-softlocks rule. This is also *why* the existing 3A/3B terraforming split (`docs/09`, 2026-06-14) is shaped the way it is — 3A proves the ungated local loop, 3B is reserved for when the networked economy actually exists to feed it. Getting this wrong would retroactively contradict a shipped decision.
**Logged:** `docs/16` §"Terraforming as a Strategic Sink (SOFT)"

### 3. Socio-political consequences and military upkeep are explicitly deferred, not designed here
**Call:** Unrest, black markets, rebellion, piracy, and military-upkeep draw on this same resource network in principle, but none of that is built or even lightly specified in `docs/16` — it's named as a future hook.
**Why:** Matches the existing phase ordering in `docs/05` (trade/diplomacy/governance = Phase 6, conflict/conquest = Phase 7) — the economy is built toward those systems having something real to hook into, not built with them bundled in, which would balloon scope for a reference doc.
**Logged:** `docs/16` §"Explicitly Deferred"

### 4. The resource network must be owner-scoped from day one, per the `docs/15` hard multi-agent-seam rule
**Call:** Even though rival AI/multiplayer owners are out of scope for this brief, `docs/16` specifies that routes, stockpiles, and upkeep are tracked per-owner and mutated only through the existing typed command layer (`applyCommand`/`GameEvent`).
**Why:** `docs/15` §6 already made this a hard rule for every future slice — this is the first reference doc written *after* that rule landed, so it has to demonstrate compliance rather than silently assume a single-player-only resource pool that would need retrofitting later.
**Logged:** `docs/16` §"Scarcity as the AI-Competition Substrate"

### 5. The brief's "Step 1B" label is corrected
**Call:** `docs/16` is explicitly scoped as the post-landing economy/interdependence slice (`docs/05`'s Deferred/parked "dedicated economy / anti-snowball pass"), not roadmap Step 1B (the interstellar exploration/warp milestone, already shipped per `docs/12`).
**Why:** The source brief was generated with a stale understanding of the roadmap's phase numbering; leaving the label uncorrected risks a future session conflating this doc with a milestone that's already done.
**Logged:** reconciliation header point (4); `docs/16` intro line

## Open questions / deferred

- The full distance-loss function (currently: a flat static tax in the minimal first version, not yet a continuous function of light-year distance) — tuning work for whenever the slice is scheduled.
- The Strategic-Exotic resource roster beyond the single "Fissiles" example — content work, deferred.
- Route pathing / hub topology — deferred; the minimal first version is a single linkable route only.

## Scope guard

**In:** `docs/16-economy-and-interdependence.md` (new, with reconciliation header), one `docs/09` decision row, a `docs/05` pointer, a `CLAUDE.md` doc-index row, `progress.md` updates, this file.
**Out:** No code changes. No scheduling commitment — this remains a deferred/parked reference until a future session actually picks up the economy slice.
