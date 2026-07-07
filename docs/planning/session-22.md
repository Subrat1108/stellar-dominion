# Session 22 — PLANNING — Exploration Polish C: the unified multi-scale map (+ ship, camera, cockpit, feel)

> PLANNING-room rationale for this session. The "why". Pairs with the BUILD-room
> "what" in `docs/07-devlog.md` and the one-line records in `docs/09-decisions.md`.

## Goal

Close the exploration leg. Promote the currently-dumb M-view into THE strategic
map — one continuous, clickable, labeled multi-scale map — and bundle the
ship-visual / camera / cockpit / flight-feel fixes that make free-flight read
right. No new sim mechanics; determinism + honest-scale body math untouched.
(Baseline: **218** tests green — the Session-21 docs' "221" was inaccurate.)

## Decisions (with rationale)

### 1. One unified in-engine map; Polish D folds into it as click-actions
**Call:** The M-view becomes a single zoom continuum `intra (body+moons) → system →
sector → galactic (LOCKED) → intergalactic (LOCKED)`, subsuming the separate
`sectorView.scene` into one map. Every node is labeled + clickable; a click opens a
**detail popup** reusing the existing `SystemPanel` inspector fields and showing only
the **context actions** valid for that body + ship state (SET COURSE / AUTOPILOT /
ENTER ORBIT / LAND / WARP / SCAN / GET DETAILS). The old **Polish D** body-detail
panel *is* this popup.
**Why:** Two disjoint surfaces exist today (the 3D M-view with bare, unclickable
spheres; two React lists — `SectorPanel` warp + `Minimap` radar). Legibility (Pillar
6) wants one place to see and act on everything. Labels/clicks are a **DOM overlay**
driven by renderer-projected node screen positions (shared `app/map-state.ts`, the
same project-to-screen pattern the flight target marker already uses) — 3D stays in
Three, interaction in React, cheap on the MacBook-Air GPU. Folding D in avoids a
second redundant detail surface. Map stays OFF the `C` cockpit↔chase cycle (reached
by `M`); two flight cameras unchanged.
**Logged:** `docs/09` 2026-07-07 · affects `docs/08`, `docs/12`, `docs/05`

### 2. Scope A — active-system interior only; remote systems are sector nodes
**Call:** The interactive interior fly-through is the **active** system alone.
Other systems are sector-tier nodes: inspect + WARP if scanned, coarse preview +
SCAN if not. Do **not** build read-only generated interiors for remote scanned
systems (Scope B).
**Why:** Scope B (generate + render any scanned system's interior for browsing)
adds real renderer scope and muddies the discovery model (`generateSystem` should
materialise on arrival). It only becomes meaningful once scouting/economy gives
that intel weight — so it's deferred. "Deepest zoom-in resolves back into the
flyable active system" stays the rule.
**Logged:** `docs/09` 2026-07-07

### 3. Distance-based, ungated reachability; ego-centric population
**Call:** Reachability = a flat distance test: all catalog stars within
`WARP_RANGE_LY` of the **active** system populate the sector tier, capped at
`MAX_MAP_NODES` (both tunable). The map recenters on the active system on warp.
Curated stars keep clean names/notes; others get catalog-derived labels. Galactic
+ intergalactic are LOCKED scaffold (`data/galaxies.ts`: Milky Way + a few named
nodes), labeled but not explorable.
**Why:** Today only 3 curated nodes are reachable and the SectorView hard-centers on
home. God-mode ungated reachability (the tech gate is deferred, `docs/09`
2026-06-24) means the player can see + reach the real neighborhood now; the cap
keeps it legible + cheap. Ego-centric centering is what makes "warp there, its
neighbours populate" work.
**Logged:** `docs/09` 2026-07-07 · affects `docs/12`

### 4. Return-home is a UI gate, not a state bug
**Call:** Fix return-home via the unified map's per-node WARP action; no change to
the warp/state path.
**Why:** Root-caused: `setActiveSystem` + the warp command layer already support
warping home end-to-end (`isReachableSystem` returns true for the `home` role). The
only block was `SectorPanel.canScan` requiring `role === "reachable"`, excluding the
`home` role, so the button never rendered. Distance-based reachability + a per-node
WARP action offers home like any reachable system when it isn't active. Verify
in-browser (warp away → warp home → colony caught up).
**Logged:** `docs/09` 2026-07-07

### 5. Distance-proportional travel — duration + ETA only
**Call:** Warp TRANSIT duration scales with light-year distance
(`transitTicksForLy(ly) = clamp(base + k·ly)`, pure + tested); in-system ETA shown
from distance. No fuel/cost.
**Why:** The constant `TRANSIT_TICKS` made every hop feel identical. Distance weight
is cheap and grounded; the fuel/cost/economy layer on travel stays deferred with the
rest of the anti-snowball macroeconomics. Determinism holds — duration is a pure
function of the committed distance.
**Logged:** `docs/09` 2026-07-07

### 6. Ship "zoom-in" = closer camera + lower near plane, not a scale change
**Call:** The cone avatar becomes a primitive-built stylized ship (fuselage + wings
+ engine block + emissive dots, one merged Group, size = the single `SHIP_LENGTH`).
The third-person camera moves closer; because honest scale (ship ≈ 1.5e-5 u) already
sits `CHASE_DIST` at its ~5×-near-plane floor, "closer" requires also dropping the
render near plane (~0.0002 → ~0.00002; log-depth covers the range). Honest 1:470
ship:body ratio unchanged. FPP `COCKPIT_FWD` nudged to match.
**Why:** The user wants the ship to read as a real craft ("zoom into the ship"), but
without inflating it (honest-scale principle, `docs/09` 2026-06-24). Camera distance
is the intended knob; the near-plane drop is the physical prerequisite. **Isolated in
commit 4a** so any depth artifacts (z-fighting / see-through — the main regression
surface) are cleanly revertable, and **verified across multiple bodies** (not just
Mira). A true hero-shot framing still needs the deferred dedicated ship near-camera
layer (2-pass render); this gets a clearly-a-craft result without it.
**Logged:** `docs/09` 2026-07-07 · affects `docs/08`

### 7. Gradual manual acceleration
**Call:** Manual thrust becomes a speed-shaped curve `thrustAccel(currentSpeed)` —
gentle near zero (precise docking), ramping to a healthy cruise when held — so speed
builds over ~1–2 s; capped at `MAX_SPEED`. Pure change to the manual branch of
ship-movement; autopilot/orbit untouched; unit-tested.
**Why:** Manual thrust jumped to high speed in one press (flat `THRUST_ACCEL`),
uncontrollable for docking. A shaped curve gives fine low-speed control and a
natural build-up without breaking determinism.
**Logged:** `docs/09` 2026-07-07 · affects `docs/08`

## Open questions / deferred

- **Scope B** (remote scanned-system interiors) — deferred until scouting/economy.
- **Dedicated ship near-camera layer** (2-pass render for a true hero framing) —
  still deferred; 4a gets a clearly-a-craft result via camera distance + near plane.
- **Tech-tree gate on warp** + travel fuel/cost/economy — deferred (reaffirmed).
- **Real galaxy/universe CONTENT** — scaffold + locked nodes only this slice.

## Scope guard

**In:** the unified clickable multi-scale map (tiers/zoom/labels/click/popup,
ego-centric population, scan-gated drill-down, galaxy LOCKED scaffold, return-home
fix, distance-proportional ETA/duration); primitive ship model + closer camera +
near-plane drop; deepened cockpit canopy; gradual manual acceleration. New pure-fn
tests only wire to deterministic helpers.
**Out:** honest-scale body math, determinism, and any economy/terraforming/colony/
warp-FSM sim change beyond wiring existing commands to map clicks; a modeled 3D
cockpit interior; real galaxy content; Scope B interiors.
