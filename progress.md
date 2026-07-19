# Progress — start here

> The single "resume here" file. Any session (BUILD room or PLANNING room) should
> read this first to rebuild context cheaply, then follow the links below.
> **Keep this current at the end of every session** (see the session-logging
> protocol in `CLAUDE.md`).

## Current state (one paragraph)

The deterministic space-4X sim runs end-to-end: a seeded content engine generates
the Tau Ceti neighborhood (Step 1A), you can warp between systems (Step 1B), land,
found colonies, run the resource economy, and terraform (Phases 2–3A); the
exploration leg is closed (Polish A–C). **The LANDING ARC (Session 25) is
CODE-COMPLETE** (in-browser confirmation pending) — the first slice of the fun loop
proper (`docs/15` §1 LAND): landing is now a *meaningful choice that shapes the
colony you found*. Colonies are **owner-scoped** (the first player-facing use of the
multi-agent seam — the player is AN owner; commands ride an **actor envelope**
`{command, actorId}`), saves migrate **v2→v3** via a reusable migrator chain, landing
offers **~3 deterministic candidate sites** whose attributes derive **founding
modifiers** (volatile→water/O₂ head-start, insolation→persistent solar efficiency,
slope→setup + radiation→shielding costs), a **minimal EDL** classifier reads landing
viability, and a founded colony surfaces its **local strategic-resource (Fissiles)**
presence — the first appearance of the two-tier economy, creating the pull toward
other worlds with zero economy machinery. Shipped in five commits (docs →
owner-scoping+migration → sites+UI → modifiers+EDL → strategic seed). **300 tests
green** (265 baseline + 35 new pure-fn); typecheck + build + dev-boot clean;
determinism + honest-scale body math untouched.

## Active next step

**Active slice — LOCAL PERSISTENCE + OFFLINE PROGRESSION (Session 26, in progress).**
Fixes a real bug: the save system (serialize/migrate/SaveStore) existed and was tested but
was never wired into the app — every refresh silently regenerated a fresh universe.
**Commits 1–2 done. Commit 2 (offline progression + clamp):** `sim/save/offline.ts` —
`offlineEconTicks`/`applyOfflineProgress`, reusing `runColonyEconomy` (the exact call the
off-view catch-up makes) — **VERIFIED terraforming advances** via a dedicated test (a body's
surface temperature climbs during offline progress, not just population); ship life-support
deliberately excluded (frozen at save time — closing the tab must never kill the crew). Rate
is deliberately SLOWER than active play: `OFFLINE_ECON_TICKS_PER_REAL_HOUR = 240` (≈4
active-minutes-equivalent per real hour away, far below the ~3600/active-hour online rate),
elapsed clamped to `MAX_OFFLINE_ELAPSED_MS = 12h`. `app/visibility-offline.ts`
(`handleVisibilityResume`) covers a backgrounded tab — the accumulator-reset is
**unconditional in every branch** (tested directly), preventing the live loop from
double-counting a hidden→visible gap the offline catch-up already credited. `main.ts` wires
both boot-load offline progress and the visibility handler (pause hardcoded `false` pending
commit 3's settings). **323 tests green** (+17: tick conversion, determinism, clamp,
terraforming-verification, pause, no-double-count), typecheck + build clean. **Commit 1
(autosave + boot-load):** `SavePayload.savedAtMs?`; `app/persistence.ts`
(`saveGame`/`loadGame`/`clearGame`/`tryReconstruct` — never throws, bad saves fall back to
a fresh game; `startAutosave` — 15s timer + 1s-debounced state-changing events + page-hide);
`main.ts` boot is now async (load-or-new); `ui/SettingsMenu.tsx` (⚙ gear button, confirm-
guarded **New Game**, bad-save notice). **Next: commit 3 — pause toggle + summary:**
`app/settings.ts`, a persisted pause checkbox in `SettingsMenu`, and a dismissible "while you
were away" toast headlining terraforming/water alongside population + habitability deltas.
Rationale: `docs/planning/session-26.md`.

**Prior slice — the LANDING ARC (Session 25) is CODE-COMPLETE — still needs user
in-browser confirmation** (not blocking this session):
then the next roadmap slice. Confirm in-browser: land a rocky world → the ~3 candidate
site cards read clearly (attributes + effect lines + a body-level EDL line) → choosing a
site founds a colony reflecting its head-start/efficiency/setup cost → the surface view
shows local-strategic (Fissiles) presence or an import-dependent warning → a volatile-rich
vs a sun-drenched site produce visibly different colonies. No display/headless browser in
this env to screenshot; the mechanics are unit-tested (300 green). **After confirmation:**
the economy/interdependence layer (`docs/16` — the Fissiles seed's payoff: bulk-local vs
strategic split, virtual trade routes, dependency-as-brake) or 3B terraforming depth.
Feel/tuning knobs: `SITE_MOD` (gen/sites.ts), `EDL_SETUP_PENALTY` (math/edl.ts), the
Fissiles probability (gen/strategic.ts). Rationale: `docs/planning/session-25.md`.

The five commits (all pushed to `dev`): (1) **docs** — `docs/14` + `docs/05`/`docs/09`
(5 rows incl. the **actor-envelope** + **migrator-chain** reusable patterns)/`CLAUDE.md`/
`session-25.md`; (2) **owner-scoping + save v2→v3 migration** — `owner.ts`, `Colony.ownerId`,
`world.localOwnerId`, actor-envelope command layer, owner-aware build/terraform checks,
`save/migrate.ts` chain; (3) **candidate sites + selection UI** — `gen/sites.ts`,
`FoundColony{siteIndex?}`, `ui/SiteSelection.tsx`; (4) **site→modifiers + minimal EDL** —
`siteModifiers`, `math/edl.ts`, the single solar read path × `solarEfficiency ?? 1`;
(5) **interdependence seed** — `gen/strategic.ts` Fissiles presence + the surface readout.
Determinism sacred; 300 tests green + typecheck + build clean each commit.

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
