# Progress — start here

> The single "resume here" file. Any session (BUILD room or PLANNING room) should
> read this first to rebuild context cheaply, then follow the links below.
> **Keep this current at the end of every session** (see the session-logging
> protocol in `CLAUDE.md`).

## Current state (one paragraph)

The deterministic space-4X sim runs end-to-end: a seeded content engine generates
the Tau Ceti neighborhood (Step 1A), you can warp between systems (Step 1B), land,
found colonies, run the resource economy, and terraform (Phases 2–3A). **Exploration
Polish B (Session 21) is complete + tuned** — an immersive cockpit canopy, a real
control model (SET COURSE / AUTOPILOT / ENTER ORBIT / LAND), pointer-lock steering,
deterministic patched-conic orbital gravity, a spiral orbital insertion, solid
procedural planets, and flyable rings + a Kuiper belt. **Exploration Polish C
(Session 22) is CODE-COMPLETE** (in-browser confirmation pending) — the slice that
closes the exploration leg: the **unified clickable multi-scale map** (one
continuous zoom `intra → system → sector → galactic(LOCKED) → intergalactic(LOCKED)`,
ego-centric on the active system, every node labeled + clickable → a detail popup
with valid context actions; absorbs the old Polish D panel and subsumes the separate
SectorView), a **primitive-built ship model + closer camera** (4a), a **deepened
cockpit canopy + gradual manual acceleration** (4b), and the **return-home** fix
(a UI gate, not a state bug). Shipped in six commits (docs → map core → 3a sector
map/return-home → 3b galaxy scaffold → 4a ship/camera → 4b canopy/accel). **265 tests
green** (218 baseline + 47 new pure-fn); typecheck + build + dev-boot clean;
determinism + honest-scale body math untouched.

## Active next step

**Active slice — the LANDING ARC (Session 25, in progress).** The first slice of the
fun loop proper (`docs/15` §1 LAND): make landing a meaningful choice that shapes the
colony you found. **Commits 1–3 done. Commit 3 (candidate sites + selection UI):**
`gen/sites.ts` — pure `generateCandidateSites(universeSeed, body)` (~3 deterministic
sites from `bodyKey`; latitude/insolation/volatile/slope/radiation/thermal, body-biased);
`Colony.siteIndex?`/`solarEfficiency?` (optional, additive under v3); `FoundColony` gains
optional `siteIndex` (clamped, stored, save-round-trips); `ui/SiteSelection.tsx` cards
wired into ColonyPanel's no-colony branch. **285 tests** (+8 sites, +2 founding). Modifiers
themselves land in commit 4. **Commit 2 (owner-scoping + save migration):**
`owner.ts` (`OwnerId`, `LOCAL_PLAYER_OWNER`); `Colony.ownerId`; `world.localOwnerId`; the
**actor-envelope** command layer (`QueuedCommand {command, actorId}`, `applyCommand(world,
cmd, actorId=world.localOwnerId)` — a command is identity-free, the actor rides alongside);
`foundColony` stamps the owner; `buildStructure`/`setTerraformAllocation` reject a
non-owner; `coloniesOfOwner` helper; **`SAVE_VERSION` 2→3** with a reusable migrator chain
(`save/migrate.ts`, v2→v3 backfills existing colonies to the local player) + `localOwnerId`
in save meta. **275 tests green** (265 + 6 owner-scoping + 4 save-migration), typecheck +
build clean. **Commit 1 (docs):** `docs/14-landing-and-surface.md` created
(aggregate globe, NO tile/AP/rover layer; site science → scalar founding modifiers;
owner-scoped founding; Fissiles interdependence seed) + `docs/05` (landing arc active),
`docs/09` (5 rows: candidate-sites model, the **actor-envelope** canonical multi-agent
mechanism, the **migrator-chain** canonical save-migration pattern, minimal EDL,
Fissiles seed), `CLAUDE.md` index, `docs/planning/session-25.md`. **Remaining commits:**
(2) owner-scoping — `ownerId` on Colony, `world.localOwnerId`, actor-envelope command
layer (`{command, actorId}`, `applyCommand(world, cmd, actorId)`), owner-aware
build/terraform checks, **save v2→v3 migrator chain** (existing colonies → local player);
(3) deterministic **candidate sites** (~3 from body seed) + selection UI; (4) **site →
founding modifiers** (volatile→water/O₂ head-start, insolation→persistent solar
efficiency, radiation→shielding cost, slope→setup cost) + **minimal EDL**
(`landingViability` classifier + one light setup-cost hook); (5) **interdependence seed**
— Fissiles presence/absence, surfaced legibly. Determinism sacred; all existing tests
green + new pure-fn tests each commit. Rationale: `docs/planning/session-25.md`.

**Deferred (Polish C in-browser confirmation still open):** near-plane multi-body depth,
map labels/clicks/popups, return-home, ship/cockpit/accel feel — see the Session-22
resume point in `docs/07-devlog.md`. Not blocking the landing arc.

**Earlier docs (2026-07-18):** `docs/15-design-pillars.md` (design spine; session-23),
`docs/16-economy-and-interdependence.md` (deferred economy reference; session-24).

## Links

- [`docs/07-devlog.md`](docs/07-devlog.md) — BUILD-room log: what changed each session (newest at top).
- [`docs/09-decisions.md`](docs/09-decisions.md) — decision log: every architectural/design choice, dated, newest first.
- [`docs/05-roadmap.md`](docs/05-roadmap.md) — phased vertical slices; the Exploration-polish A–D sub-phases live here.
- [`docs/15-design-pillars.md`](docs/15-design-pillars.md) — the design spine: fun loop, motivation stack, economy intent, multi-agent seam.
- [`docs/16-economy-and-interdependence.md`](docs/16-economy-and-interdependence.md) — deferred post-landing economy reference: bulk/strategic split, trade routes, anti-snowball trio.
- [`docs/14-landing-and-surface.md`](docs/14-landing-and-surface.md) — landing-arc reference: aggregate globe, candidate sites → founding modifiers, owner-scoping, Fissiles seed.
- [`docs/planning/`](docs/planning/) — PLANNING-room decisions per session (the design rationale that otherwise lives only in chat).
- [`CLAUDE.md`](CLAUDE.md) — project root context + the canonical **Current status** block + working protocols.
