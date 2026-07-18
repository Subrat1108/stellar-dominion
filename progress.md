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

**Docs:** `docs/15-design-pillars.md` added (design-pillars authoring session, 2026-07-18) — the design spine (fun loop, player motivation stack, differentiated worlds, the economy spine, progression, and the production/architecture constraints incl. the multi-agent command-layer seam). Docs-only; no code changed. Rationale: `docs/planning/session-23.md`.

**Docs:** `docs/16-economy-and-interdependence.md` added (economy-brief authoring session, 2026-07-18) — the deferred post-landing economy/interdependence reference brief (two-tier local-bulk/strategic split, virtual trade routes + distance trade-loss, the anti-snowball dependency trio, terraforming as a SOFT strategic sink, owner-scoped per the `docs/15` multi-agent seam), landed with a reconciliation header against `docs/15`/`docs/09`/`docs/12`. Docs-only; no code changed. Rationale: `docs/planning/session-24.md`.

**User in-browser confirmation of Polish C**, then the next roadmap slice. Confirm:
(1) the **near-plane multi-body depth check** — nothing goes transparent / z-fights
at the new 0.00002 near plane (the flagged regression surface; analysis says the
margin only widened, but there's no display/headless browser in this env to
screenshot); (2) the map — labels/clicks/popups, ego-centric sector population,
LOCKED galaxy tiers, zoom-in resolves to flight; (3) **return-home** (warp out → map
→ warp back to the caught-up colony); (4) the ship reads as a craft + cockpit ↔ chase
symmetry; (5) the deepened cockpit console; (6) gradual accel (held W builds over
~1–2 s, not an instant jump). Feel knobs: `CHASE_DIST`/`NEAR_PLANE`/`SHIP_LENGTH`/
`THRUST_ACCEL*`/`THRUST_RAMP_SPEED` (`presentation.ts`), `WARP_RANGE_LY`/
`MAX_MAP_NODES` (`sector.ts`), tier thresholds (`sector-layout.ts`). After
confirmation: **3B terraforming depth** or the **economy/tech layer that gates warp**
(both parked in `docs/05`). Rationale: `docs/planning/session-22.md`. **Scope A**
(active-system interior only) shipped; remote scanned interiors (Scope B) deferred.

## Links

- [`docs/07-devlog.md`](docs/07-devlog.md) — BUILD-room log: what changed each session (newest at top).
- [`docs/09-decisions.md`](docs/09-decisions.md) — decision log: every architectural/design choice, dated, newest first.
- [`docs/05-roadmap.md`](docs/05-roadmap.md) — phased vertical slices; the Exploration-polish A–D sub-phases live here.
- [`docs/15-design-pillars.md`](docs/15-design-pillars.md) — the design spine: fun loop, motivation stack, economy intent, multi-agent seam.
- [`docs/16-economy-and-interdependence.md`](docs/16-economy-and-interdependence.md) — deferred post-landing economy reference: bulk/strategic split, trade routes, anti-snowball trio.
- [`docs/planning/`](docs/planning/) — PLANNING-room decisions per session (the design rationale that otherwise lives only in chat).
- [`CLAUDE.md`](CLAUDE.md) — project root context + the canonical **Current status** block + working protocols.
