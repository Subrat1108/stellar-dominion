# Progress — start here

> The single "resume here" file. Any session (BUILD room or PLANNING room) should
> read this first to rebuild context cheaply, then follow the links below.
> **Keep this current at the end of every session** (see the session-logging
> protocol in `CLAUDE.md`).

## Current state (one paragraph)

The deterministic space-4X sim runs end-to-end: a seeded content engine generates
the Tau Ceti neighborhood (Step 1A), you can warp between systems (Step 1B), land,
found colonies (with a site choice, owner-scoped, per the landing arc), run the
resource economy, and terraform (Phases 2–3A); the exploration leg is closed
(Polish A–C). **LOCAL PERSISTENCE + OFFLINE PROGRESSION (Session 26) is
CODE-COMPLETE** (in-browser confirmation pending) — fixes a real bug: the save system
(serialize/migrate/SaveStore) existed and was fully tested but was never wired into the
app, so every browser refresh silently regenerated a fresh universe. The game now
**autosaves** (a 15s timer + debounced state-changing events + page-hide) to a single
local save slot and **loads it on boot** (a corrupt/incompatible save never crashes
boot — it falls back to a fresh game with a visible notice); an explicit,
confirm-guarded **New Game** is the only way to erase it. Real time spent away is
credited as **offline progression** — a deterministic fast-forward of the colony
economy (incl. terraforming) reusing the existing off-view catch-up mechanism,
deliberately **slower than active play** (~4 active-minutes-equivalent per real hour
away, clamped at 12h) so idling never substitutes for playing; a backgrounded tab is
covered the same way, with an **unconditional accumulator reset** that prevents the
live tick loop from double-counting the same gap. A persisted **pause toggle** and a
dismissible **"while you were away"** toast (population/habitability/**water**
deltas — the terraforming payoff line) close the loop. Shipped in three commits
(autosave+boot-load → offline progression+clamp → pause toggle+summary), plus a
**fourth bugfix commit**: reloading while landed restored the sim correctly (MODE
showed LANDED) but the surface UI (TAKE OFF / colony / site panel) never appeared —
`SurfaceView` was gated on an event-driven ref (`landingState`) that a reload never
updates, unlike everything else (Cockpit/MapView/SystemPanel/ship-movement), which
already reads ship state live and was unaffected; fixed with a one-time
`syncLandingStateFromWorld` call at boot. **332 tests green** (300 baseline + 27 new
persistence pure-fn + 5 bugfix regression); typecheck + build clean; determinism +
sim mechanics untouched — only persisted and fast-forwarded what already existed.

## Active next step

**LOCAL PERSISTENCE + OFFLINE PROGRESSION (Session 26) is CODE-COMPLETE — next: user
in-browser confirmation,** then the tile/surface layer this fix unblocks, or the next
roadmap slice. Confirm in-browser: refresh mid-game resumes instead of resetting; land →
refresh → TAKE OFF and the colony/site panel are present (the just-fixed bug); refresh
while orbiting still shows correct MODE/actions; closing the tab, waiting real time, and
reopening shows the "while you were away" toast with sensible population/habitability/water
deltas (and the 12h-cap note on a very long gap); the ⚙ Settings pause-offline-progression
checkbox actually suppresses it; New Game is confirm-guarded and genuinely resets; a
deliberately-corrupted localStorage value falls back to a fresh game with the notice rather
than a blank screen. No display/headless browser in this env to screenshot; the mechanics
are unit-tested (332 green). Tuning knobs: `OFFLINE_ECON_TICKS_PER_REAL_HOUR`/`MAX_OFFLINE_ELAPSED_MS`
(`sim/save/offline.ts`), `VISIBILITY_OFFLINE_THRESHOLD_MS` (`app/visibility-offline.ts`),
autosave timer/debounce (`app/persistence.ts`). Rationale: `docs/planning/session-26.md`.

**Prior slice — the LANDING ARC (Session 25) is CODE-COMPLETE — still needs user
in-browser confirmation** (not blocking; unaffected by this session): land a rocky
world → the ~3 candidate site cards read clearly (attributes + effect lines + EDL) →
choosing a site founds a colony reflecting its head-start/efficiency/setup cost → the
surface view shows local-strategic (Fissiles) presence or an import-dependent warning.
After both confirmations: the economy/interdependence layer (`docs/16`) or 3B
terraforming depth. Its five commits (docs → owner-scoping+migration → sites+UI →
modifiers+EDL → strategic seed) left **300 tests green**; tuning knobs `SITE_MOD`
(gen/sites.ts), `EDL_SETUP_PENALTY` (math/edl.ts), the Fissiles probability
(gen/strategic.ts). Rationale: `docs/planning/session-25.md`.

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
