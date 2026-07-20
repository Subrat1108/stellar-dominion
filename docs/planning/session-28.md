# Session 28 — PLANNING — surface UI redesign (Slice 1) + roadmap refresh

> PLANNING-room rationale for this session. The "why". Pairs with the BUILD-room
> "what" in `docs/07-devlog.md` and the one-line records in `docs/09-decisions.md`.

## Goal

Turn the boxed Phase-1 surface panel into a full-screen, zoomable/scrollable
Civ-style surface *mode* with top-bar toggle menus and a named landing/founding
flow — the front of the fun loop should BE the screen. UI/UX on the working
surface sim: no economy/determinism/terraforming changes. Also refresh
`docs/05` so the sequence (Slice 1 → Slice 2 → the layers they set up) is
recorded and nothing slips.

## Decisions (with rationale)

### 1. Full-screen surface mode; flight overlays hidden while landed
**Call:** `App` renders ONLY the surface mode + always-on chrome (`SettingsMenu`, `OfflineSummary`) while landed; the flight overlays (`HUD`/`SystemPanel`/`MapView`/`Minimap`/`Scanner`/`Cockpit`/`SteerHint`/`HazardBanner`) are not rendered. `TAKE OFF` returns to flight.
**Why:** The Phase-1 surface was a centered boxed canvas + an always-open sidebar, and the flight HUD could bleed around it — it read as an overlay, not a place. Gating at the App level (a clean binary on landing state) is the simplest "dedicated surface mode" and guarantees the flight HUD never overlays the map, rather than editing eight overlays to self-hide.
**Logged:** `docs/09` 2026-07-21 (full-screen surface mode row)

### 2. Zoomable/scrollable canvas map with pure viewport math
**Call:** The canvas fills the screen; pan (drag/edge-scroll) + zoom (wheel/+–, toward the cursor). A pure `ui/surface/viewport.ts` (`fitZoom`, `clampPan`, `tileFromScreen`, `worldRectOfTile`, `zoomAt`, `visibleTileRange`) is unit-tested; the canvas repaints on interaction only (rAF-coalesced) and culls to visible tiles.
**Why:** Tiles need to be viewable at a workable size across the whole 96×48 grid, which a fixed CSS-scaled canvas can't do. Keeping the transform math PURE + tested (screen↔tile round-trips under zoom+pan) is where the bugs would otherwise hide; keeping repaint interaction-only + culled keeps it sub-ms and smooth on a MacBook Air (no per-frame cost, no Three.js, no per-tile DOM).
**Logged:** `docs/09` 2026-07-21 (full-screen surface mode row)

### 3. Top-bar toggle panels, one at a time, default map-only
**Call:** A single `activePanel` state summoned from a top bar: TERRAFORMING (existing), ECONOMY/RESOURCES (existing `ColonyPanel`), TECH (stub), CIVIC (stub). Clicking the active button closes it; default `null` (clean map).
**Why:** The always-open sidebar competed with the map for space; on-demand panels keep the map the focus. One-at-a-time (not a set) keeps it uncluttered — a side-by-side need, if it ever appears, is a trivial later change. TECH/CIVIC are buttons + stubs only (the real trees are the progression/civic layers, deferred).
**Logged:** `docs/09` 2026-07-21 (full-screen surface mode row)

### 4. Named founding flow; second-colony path built-but-gated
**Call:** `Colony.name?` (additive-optional, no version bump) + `FoundColony{tile, name?}`. The flow (pure `ui/surface/founding.ts`): no colony → select tile → NAME → found; colony exists → ENTER it, or select a new tile to "found another" — the found-another path is fully built (select→name→confirm) but CONFIRM is gated behind `canFoundAnother` (false while a colony exists), with the command's "already exists here" rejection as the backstop.
**Why:** Builds + exercises the whole naming/selection UX now (via the first colony) while enforcing one-colony-per-planet until the economy is per-colony. Structuring it as a gate over an already-refusing command means Slice 2 flips it on by removing the gate + swapping the single-colony backend for a per-body list — the flow is unchanged, so Slice 2 is a backend + gate change, not a UI rebuild.
**Logged:** `docs/09` 2026-07-21 (second-colony gate row)

### 5. Slice 2 multi-colony model recorded now
**Call:** Per-body colony LIST; separate resource pools per colony; planet-aggregated totals per planet; terraforming funded by the planetary aggregate (more colonies → faster terraforming); save-format change + migrator. Built in Slice 2, recorded now so Slice 1 builds toward it.
**Why:** Gives founding-a-second-colony a concrete payoff (accelerated terraforming) — the missing "why expand on-planet". Recording it now keeps Slice 1's founding flow + ECONOMY panel framed per-colony so Slice 2 is clean.
**Logged:** `docs/09` 2026-07-21 (Slice 2 model row); `docs/05` Slice 2 section

## Open questions / deferred

- The Slice-2 economy itself (per-colony pools, aggregates, terraforming-from-aggregate, the migrator) — next slice, not this one.
- Real tech/civic trees, surface movement, structures-on-tiles, landing-success probability — deferred (`docs/17` §6, `docs/05`).

## Scope guard

**In (Slice 1):** full-screen surface mode; pan/zoom canvas; top-bar toggle panels (2 real + 2 stubs); named founding flow with the gated second-colony path; `Colony.name`. **Out:** the multi-colony economy (Slice 2); real tech/civic; any sim/economy/terraforming/determinism change.

## Commit split

docs/roadmap → full-screen surface mode + pan/zoom → top-bar toggle panels (remove the temp COLONY drawer) → named founding flow. New pure tests: viewport math, founding-flow actions (incl. the gated case), colony-name round-trip. All existing green; pushed to `dev` per commit.
