# 17 — Surface Layer

> **Surface-layer reference.** This doc supersedes `docs/14`'s "NO tile layer, ever" stance for the SPATIAL surface — a deliberate pillar change (`docs/09` 2026-07-20). The load-bearing boundary it keeps intact: **tiles are terrain + placement + site-modifiers. The colony ECONOMY stays AGGREGATE. Tiles are NOT a per-tile economy sim.** Everything below is authored to that boundary.

Slice context: the **surface layer** — the front of the fun loop (`docs/15` §1: EXPLORE → **LAND** → COLONISE → …). It replaces the static candidate-site card menu (`docs/14`) with a real gridded planet surface you land on and place your first colony on. This is the early game: land → build/expand colonies on the planet → terraform → then explore further.

---

## 0. Why this reverses `docs/14` (and what stays)

`docs/14` locked landing to "site science as scalar modifiers on an aggregate globe — NO tile/hex/AP/rover layer, ever." That call was right *for its slice*: it made landing matter without committing to a surface game before the loop was proven. With the loop now proven end-to-end (land → colonise → terraform → warp), the planning room chose to make the surface a real **place** — the early game the fun loop points at.

**What reverses:** the "never a spatial map" clause. The planet now has a 2D tile grid you land on and place colonies on.

**What stays (the boundary — do not cross it):**
- **The colony economy stays aggregate** (`docs/10`). Tiles do **not** run a per-tile resource sim, per-tile production, or per-tile population. A colony is still one aggregate `Colony` with pooled stockpiles/buildings/population.
- **No AP / build-radius / rover micro.** Tiles are *terrain to read* + *a place to put your colony* + *a source of founding modifiers*. There is no per-tile action economy.
- **Site science → founding modifiers** (`docs/14` §2) is preserved verbatim — the tile just replaces the card as the *source* of those attributes, feeding the same pure `siteModifiers()`.

`docs/14`'s deeper intent ("no second economy sim") is intact; only its "no spatial representation" restriction is lifted.

---

## 1. Immutable terrain vs. derived climate skin (the core split)

Two layers, and keeping them separate is what makes altitude-driven water work without storing per-tile state:

- **`SurfaceTile` — seed-derived, immutable, stored NOWHERE.** `{ altitude (0–1), resources[], baseTerrain }`. A pure function of the body seed (`bodyKey` + universe seed — the same determinism seam as system generation, scan previews, sites, strategic). Same planet → identical terrain, every load, on every machine. **Altitude never changes** (required now so future hydrosphere rise can flood low tiles first). Resources are fixed. `baseTerrain` is the archetype substrate (rock / regolith / sand / basalt / ice …).
- **Climate skin — derived at render from CURRENT planet state.** A pure `tileAppearance(tile, latitude, planetClimate)` computes the *visible* surface: liquid water where `altitude < waterline` (waterline rises with `hydrosphere`), vegetation (temperate + habitability), snow (cold temp / polar / high-altitude). Habitable worlds render water/vegetation/snow; hostile dry worlds render bare `baseTerrain`. Because it reads live planet fields (`surfaceTempK`, `hydrosphere`, `pressure`), it updates automatically as terraforming runs — and sets up the later gradual-fill phase (that *animation over time* is deferred; this layer renders the current state).

Terrain elevation is permanent; the climate *skin* over it changes with terraforming.

---

## 2. The deterministic surface generator (`gen/surface.ts`, pure)

`generateSurface(universeSeed, body, dims?) → SurfaceGrid { width, height, tiles[] }`. Seeded via `makeRng(xxHashString("surface:"+bodyKey, hashSeed(universeSeed)))`.

- **Grid: 96 × 48** (2:1 lat/long aspect; 4608 tiles). Tunable. **Rows = latitude** (row 0 = north pole … row H-1 = south pole, middle = equator); columns = longitude (wraps E–W for a seamless planet).
- **Altitude:** coherent multi-octave value-noise (low-res random lattices → bilinear interpolation → summed octaves, x-wrapped), so basins and highlands *cluster* rather than being white noise. Mean/roughness biased by archetype (oceanic → lower, more basins; martian/chthonian → rougher; frozen → moderate).
- **Resources: SPARSE and CLUSTERED — an absolute low count, NOT scaled by grid area.** A whole planet hosts only a handful of deposits (order ~6–14), each a small vein of 1–3 adjacent same-resource tiles. Prospecting-feel depends on resources being *found*, not sprinkled — density must never scale up with the grid. Deposit type is weighted by archetype + local altitude (metals on high/rocky; volatiles/ice on low/polar; geothermal on volcanic worlds; rare metals rare). **Fissiles** appear on 1–2 tiles **iff** `localStrategicResources(body).fissiles` (`docs/16`) — giving the existing strategic-presence seed an actual place on the map.
- `baseTerrain` from archetype + altitude + latitude.

Same seed → byte-identical grid (unit-tested).

---

## 3. Tile → founding modifiers (reuses `docs/14`'s mapping)

Selecting a tile founds the colony there. The tile's attributes (altitude, latitude, resources, plus body magnetosphere/atmosphere for radiation) are mapped to the existing `CandidateSite` attribute bundle, then fed to the **unchanged, tested `siteModifiers()`** (`docs/14` §2): volatile proximity → water/oxygen head-start; insolation (from latitude) → persistent solar efficiency; slope (from local altitude gradient) → setup cost; radiation → shielding cost. The founding path and the aggregate colony it seeds are **identical to `docs/14`** — only the *source* of the site attributes changed (tile instead of card).

---

## 4. Placement, marking, and persistence

- **`FoundColony{ bodyId, tile }`** replaces `FoundColony{ siteIndex }`. Clicking an unclaimed tile founds the (aggregate) colony there.
- **`Colony.tile?: {x,y}`** — additive-optional (no `SAVE_VERSION` bump, consistent with how `siteIndex`/`solarEfficiency` were added within v3). Owner-scoped via the existing `colony.ownerId` (the multi-agent seam, `docs/15` §6) — so rival/AI tile claims slot in later. Persists through the existing `SystemStash.colonies` — no new save plumbing. **Terrain regenerates from seed; only `colony.tile` (+ existing terraforming deltas) is saved.**
- **The map reads as a place with expansion potential:** claimable/resource tiles and the *founded* site are marked distinctly. Only **one colony per planet** is wired now; the data is structured so a future per-tile colony list is a clean extension. **Multiple-colonies-per-planet founding is deferred.**

---

## 5. Rendering — HTML5 Canvas 2D

A single `<canvas>` overlay (not per-tile React DOM — 4608 divs would be heavy; not Three.js — no 3D needed). ~4608 `fillRect` + sparse glyph ops = sub-millisecond, and the map is **static** — repainted only on open / planet-state change (throttled) / hover, never per frame. Zero steady-state cost, no GC churn, no shader compile — the cheapest option on a MacBook Air, and consistent with the existing "Three canvas + React overlays" architecture (this adds one 2D canvas overlay).

---

## 6. Scope & deferred

**In this phase:** the deterministic surface generator; the 2D canvas map (altitude + baseTerrain + resource icons + selection); tile-based first-colony placement + owner-scoped `colony.tile` persistence; the habitable-world climate skin (water/vegetation/snow derived from current planet state + altitude/latitude).

**Deferred (later phases — NOT built here):** surface movement / rovers; building structures on tiles beyond the first colony placement; landing-success probability; the gradual water-*filling* animation over time (this phase renders water from current state, not the fill animation); multiple colonies per planet; tile contests (owner-scoped now, contested when rivals exist); the economy/trade layer. **The aggregate colony economy is unchanged.**
