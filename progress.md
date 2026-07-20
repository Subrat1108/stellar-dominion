# Progress — start here

> The single "resume here" file. Any session (BUILD room or PLANNING room) should
> read this first to rebuild context cheaply, then follow the links below.
> **Keep this current at the end of every session** (see the session-logging
> protocol in `CLAUDE.md`).

## Current state (one paragraph)

The deterministic space-4X sim runs end-to-end: a seeded content engine generates
the Tau Ceti neighborhood (Step 1A), you can warp between systems (Step 1B), land,
found colonies (owner-scoped), run the resource economy, and terraform (Phases 2–3A);
the exploration leg is closed (Polish A–C); local persistence + offline progression
work (Session 26). **SURFACE LAYER Phase 1 (Session 27) is CODE-COMPLETE** (in-browser
confirmation pending) — a deliberate pillar change (`docs/09` 2026-07-20, `docs/17`) that
**reverses `docs/14`'s "no tile layer, ever"**: the planet now has a real 2D tile surface
you land on and place your first colony on (the front of the fun loop). **Load-bearing
boundary held:** tiles are terrain + placement + site-modifiers; the colony ECONOMY stays
aggregate; tiles are NOT a per-tile economy sim. `gen/surface.ts` generates a 96×48 grid of
immutable seed-derived tiles (coherent value-noise altitude, sparse+clustered resource
veins with an absolute ~6–14 count, Fissiles iff the body hosts them, base terrain), stored
nowhere. On landing, a full-screen **HTML5 Canvas 2D map** (`SurfaceMap.tsx`) renders it;
clicking a tile → **SETTLE HERE** founds the colony there via `FoundColony{tile}`, its
`colony.tile` persists (owner-scoped, additive-optional, no version bump). A pure
**climate skin** (`tileAppearance`) derives water/vegetation/snow from *current* planet
state (`surfaceTempK`/`hydrosphere`/pressure) + altitude/latitude, so habitable worlds
render alive, hostile worlds stay bare, and terraforming visibly floods/greens the surface —
immutable terrain + derived skin = altitude-driven water with no per-tile save state. Shipped
in four commits (docs+generator → canvas map → tile founding+save → climate skin). **369
tests green** (332 baseline + 37 new pure-fn); typecheck + build clean; economy/terraforming/
determinism untouched.

## Active next step

**SURFACE LAYER Phase 1 (Session 27) is CODE-COMPLETE — next: user in-browser confirmation,**
then the next surface phase or another slice. Confirm in-browser (no display/headless
browser here): land a rocky world → the 96×48 surface map opens; a hostile world reads bare
(rock/regolith/ice/sand by archetype), a habitable world shows oceans in basins + vegetation
+ polar/peak snow; resources are sparse veins (not sprinkled); hover shows tile info, click
selects → SETTLE HERE founds the colony there (marked distinctly); refresh keeps the founded
tile; terraforming a world (raise temp/hydrosphere) visibly floods/greens the surface over
time. Tuning knobs: `SURFACE_WIDTH`/`SURFACE_HEIGHT`, `MIN_DEPOSITS`/`MAX_DEPOSITS`,
`ALTITUDE_OCTAVES` (`gen/surface.ts`), the palette + climate thresholds
(`render/surface-appearance.ts`), `CELL` (`SurfaceMap.tsx`). Deferred to later surface
phases (`docs/17` §6): multiple colonies per planet, structures-on-tiles, the water-FILL
animation over time, surface movement, tile contests. Reference: `docs/17`; rationale:
`docs/planning/session-27.md`.

**Prior slice — Local persistence + offline progression (Session 26) is CODE-COMPLETE,
still needs in-browser confirmation** (not blocking): refresh resumes; land→refresh→TAKE
OFF present (bugfix); away-toast shows deltas; pause checkbox suppresses; New Game resets;
corrupt save falls back. 332 tests at that point. Rationale: `docs/planning/session-26.md`.

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
