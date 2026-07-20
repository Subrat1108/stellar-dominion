# Session 27 — PLANNING — the surface layer (Phase 1)

> PLANNING-room rationale for this session. The "why". Pairs with the BUILD-room
> "what" in `docs/07-devlog.md` and the one-line records in `docs/09-decisions.md`.

## Goal

Replace the static candidate-site card menu (`docs/14`) with a real gridded
planet surface you land on and place your first colony on — the front of the
fun loop (`docs/15` §1 LAND/COLONISE). This is the biggest feature since the
content engine. Phase 1 only: deterministic surface generator → 2D canvas map →
tile-based first-colony placement + persistence → habitable climate skin.

## Decisions (with rationale)

### 1. PILLAR CHANGE — reverse `docs/14`'s "no tile layer, ever"; hold the economy boundary
**Call:** The planet now has a 2D tile surface you land on and place colonies on (`docs/17`). The load-bearing boundary, stated plainly: tiles are **terrain + placement + site-modifiers**; the colony ECONOMY stays **aggregate**; tiles are **NOT** a per-tile economy sim (no per-tile production/population/stockpiles, no AP/build-radius/rover micro).
**Why:** `docs/14` locked landing to scalar modifiers on an aggregate globe with no spatial map — the right call *then*, before the loop was proven, to avoid committing to a surface game prematurely. With the loop now proven end-to-end (land → colonise → terraform → warp), the planning room chose to make the surface the real *place* the loop points at. `docs/14`'s deeper "no second economy sim" intent is fully preserved; only its "no spatial representation" restriction is lifted. The boundary is load-bearing: cross it and the surface becomes a second economy to balance, which is exactly what `docs/14` was right to avoid.
**Logged:** `docs/09` 2026-07-20; full reference `docs/17`; `docs/14` header + `docs/05` reconciled.

### 2. Immutable terrain vs. derived climate skin
**Call:** `SurfaceTile` stores immutable, seed-derived `{ altitude, resources, baseTerrain }` (stored nowhere — regenerated from seed). The *visible* surface (water/vegetation/snow) is a SEPARATE pure `tileAppearance(tile, latitude, planetClimate)` derived from current planet state at render time.
**Why:** This split is what makes altitude-driven water work without per-tile save state: altitude never changes, so a later hydrosphere rise floods low tiles first purely by re-deriving the skin — no stored per-tile water. It also keeps the save tiny (only `colony.tile` persists) and terraforming's effect on the surface automatic (the skin reads live `surfaceTempK`/`hydrosphere`).
**Logged:** `docs/17` §1

### 3. Reuse `docs/14`'s `siteModifiers()` — feed it from the tile
**Call:** `tileToCandidateSite(grid, x, y, body)` maps a tile (altitude/latitude/resources + body magnetosphere/atmosphere) to the existing `CandidateSite` attribute bundle, then the unchanged, tested `siteModifiers()` produces the founding modifiers.
**Why:** The founding path and the aggregate colony it seeds should be identical to the landing arc — only the *source* of the attributes changed (tile instead of card). Reusing the tested mapping means no new founding-economics surface area and no re-tuning.
**Logged:** `docs/17` §3

### 4. Resources SPARSE + CLUSTERED — absolute count, not scaled by area
**Call:** A whole planet hosts only ~6–14 deposits, each a 1–3-tile vein; the count is independent of grid size. Fissiles appear iff `localStrategicResources(body).fissiles`.
**Why:** Prospecting-feel depends on resources being *found*, not sprinkled. If density scaled with the 96×48 grid, every screen would be littered and discovery would evaporate. Tying Fissiles to the existing strategic-presence seed gives that seed an actual place on the map (the "Local strategic: Fissiles" readout now has coordinates).
**Logged:** `docs/17` §2; grid `96×48` (user call — trivially cheap on canvas).

### 5. One colony now, but the map reads as a place with expansion potential
**Call:** Wire only single-colony founding, but mark claimable/resource tiles and the founded site distinctly; structure `Colony.tile` (owner-scoped, additive-optional, no version bump) so a future per-tile colony list is a clean extension.
**Why:** The surface should *read* as somewhere you'll expand into, even though multi-colony founding is deferred — otherwise it's a one-shot placement screen, not a place. Additive-optional `colony.tile` (consistent with how `siteIndex`/`solarEfficiency` were added within v3) keeps the save story trivial and owner-scoping free (via existing `colony.ownerId`).
**Logged:** `docs/17` §4

### 6. HTML5 Canvas 2D for the map
**Call:** A single `<canvas>` overlay, repainted only on open / planet-state change / hover — not per frame, not per-tile React DOM, not Three.js.
**Why:** ~4608 `fillRect` + sparse glyph ops is sub-millisecond and static; per-tile React DOM (4608 nodes) would be heavy and Three.js is needless 3D. Cheapest option on a MacBook Air, consistent with the existing Three-canvas + React-overlay architecture.
**Logged:** `docs/17` §5

## Open questions / deferred

- Surface movement/rovers; structures on tiles beyond first-colony placement; landing-success probability; the gradual water-FILLING animation; multiple colonies per planet; tile contests; the economy/trade layer — all deferred to later surface phases (`docs/17` §6).

## Scope guard

**In (Phase 1):** deterministic surface generator + the 2D canvas map + tile-based first-colony placement + owner-scoped `colony.tile` persistence + the habitable climate skin. **Out:** everything in the deferred list; any change to the aggregate colony economy, terraforming, or determinism beyond adding the tile placement + terrain rendering.

## Commit split

docs + generator + tests → 2D canvas map → tile selection + founding + save → habitable climate skin. Terrain pure-fn-of-seed; only `colony.tile` persists; all tests green + new pure-fn tests each commit; pushed to `dev` per commit.
