> Economy/interdependence reference. Reconcile with repo decisions: (1) Terraforming is a strategic-resource SINK but SOFT-gated per docs/15 — imports/tech ACCELERATE and unlock higher tiers (3B); they NEVER hard-gate survival or basic 3A terraforming (no softlocks). The brief's "terraforming requires importing" = accelerant, not lock. (2) Socio-political consequences (civilian unrest, black markets, rebellion, piracy) and military upkeep are DEFERRED (Phase 6/7) — the economy is DESIGNED TOWARD them, not built with them first. (3) The AI-competition section is forward-looking (rivals deferred) — but the resource network must be built OWNER-SCOPED per the docs/15 hard multi-agent rule so AI/multiplayer owners slot in with no retrofit. (4) The brief's "Step 1B" label is stale — this is the POST-LANDING economy slice, not roadmap 1B. Buildable core to carry forward: the two-tier local-bulk vs strategic split, virtual trade routes with distance trade-loss, dependency-as-brake (bootstrap cost + scaling upkeep + logistical fragility), and terraforming-as-strategic-sink (soft).

# 16 — Economy & Interdependence

Slice context: the post-landing economy/interdependence layer — deferred, parked in `docs/05`'s Deferred/parked list ("dedicated economy / anti-snowball pass"). Not roadmap Step 1B (that label in the source brief refers to the interstellar exploration/warp milestone, already shipped — see `docs/12`). This document is the reference brief for whichever future slice actually builds resource interdependence between colonies.

## Design Thesis: Scarcity as the Engine of Expansion

[ESTABLISHED] The current economic model treats each colony as a largely self-contained unit, producing what it needs for survival and growth locally. This is correct and should remain correct for the *baseline* case — see the reconciliation header: local bulk self-sufficiency is a design pillar (`docs/15` §4), not a gap to close.

[EXTRAPOLATION] What's missing once multiple colonies exist is a reason for them to *need* each other. Without interdependence, expansion is purely additive — each new colony is a free, independent multiplier on the empire's total output, with nothing pulling colonies into relationship with one another. This is the mechanical root of the 4X "snowball" problem: an empire's power should not scale linearly (or worse, super-linearly) with its territory, or the mid-to-late game becomes a foregone conclusion the moment the player crosses some early threshold.

The fix proposed here is not a tax or a penalty bolted onto growth. It's a resource topology: split what a colony needs into what it can always get locally, and what it can only get from specific other places. That split, honestly modeled, produces both the *motive* for an empire to network its colonies together and the *brake* that keeps the network fragile — interdependence is one mechanism serving two purposes at once.

## The Two-Tier Resource Split

[ESTABLISHED — extends the existing 6-resource colony economy, `docs/10`] The colony economy already distinguishes resources functionally (Power, Water, Oxygen, Food, Metals, Propellant). The interdependence layer proposes a topological split layered on top of — not replacing — that functional one:

- **Local-Bulk resources.** Heavy, low-value-per-unit, needed continuously, and (per `docs/15` §4) intended to be producible by any reasonably developed colony from its own local conditions: food, water, breathable air, basic construction metals, ordinary propellant. These are **bound to the planet** — moving them between star systems is never worth the energy/logistics cost of lifting them out of a gravity well and crossing interstellar distance. A colony that cannot produce enough Local-Bulk locally is a colony in genuine trouble; the answer is never "import bread from three light-years away," it's "fix the local production chain or its power/water bottleneck" (the existing Legibility pillar, `docs/09` 2026-06-14, already surfaces exactly this kind of local bottleneck).

- **Strategic resources.** Low-volume, high-value-per-unit, and — critically — **not present everywhere**: concentrated on specific worlds by their particular geology, stellar environment, or industrial history. These are worth the cost of interstellar transport precisely because they're scarce and light. [EXTRAPOLATION] Two strategic sub-tiers are useful to distinguish by how exotic (and how narrow) their source is:

  - **Strategic-Core** — scarce but not vanishingly rare; a handful of worlds in a settled neighborhood might produce it. Example: **Fissiles** (enriched radioactive material for reactors/weapons — see the minimal first version below).
  - **Strategic-Exotic** — vanishingly rare, tied to a specific astrophysical circumstance (a young debris disk, a flare star's magnetic environment, a gas giant's atmosphere). This is where `docs/12`'s per-system hooks plug in directly: YZ Ceti's SPI-charged particles, Epsilon Eridani's helium-3/exotic industrial yield.

| Tier | Bound to planet? | Transport rationale | Example |
|---|---|---|---|
| **Local-Bulk** | Yes — never worth shipping | N/A (produce locally or the colony suffers) | Food, water, oxygen, basic Metals, ordinary Propellant |
| **Strategic-Core** | No — concentrated but not unique | Worth interstellar transport; several worlds could plausibly produce it | Fissiles (enriched reactor/weapons material) |
| **Strategic-Exotic** | No — effectively singular sources | Worth transport at almost any cost; the whole reason to hold that system | SPI-charged particles (YZ Ceti), He-3/exotic gas-giant yield (Epsilon Eridani) |

## Virtual Trade Routes & Distance Trade-Loss

[EXTRAPOLATION] Rather than simulating individual freighters flying scripted courier missions (expensive to compute, low strategic payoff — echoing the `docs/12` "abstract, don't literally simulate" logistics stance already adopted for warp transit), a **trade route** is a persistent, player-established link between two colonies that own or need a given Strategic resource. Once linked, resource flow along the route is computed abstractly each economy tick (the existing `ECONOMY_TICK_INTERVAL` cadence, `docs/09` 2026-06-14) rather than through per-unit physical transport.

The key friction mechanic is **distance-based trade-loss**: a fixed or distance-scaling percentage of the resource shipped along a route is lost in transit — friction, decay, administrative overhead, the abstracted cost of crossing a gravity well and light-years of vacuum (the same "gravity well tax" concept `docs/12` raises for bulk freight, but scoped here specifically to the Strategic tier, since Local-Bulk should never be shipped at all). A short intra-sector route loses little; a route stretched across the reachable neighborhood loses a meaningful cut. This makes route topology a real strategic decision — a hub-and-spoke network through a central, well-defended colony behaves very differently from a long daisy-chain — without requiring the game to simulate a single moving freighter.

## The Anti-Snowball Trio: Dependency as Brake

[EXTRAPOLATION] Three mechanisms, all falling directly out of the two-tier split + trade-route model above, combine to make an empire's *fragility* scale with its *size* — the actual anti-snowball lever, not an artificial cap on growth:

1. **Bootstrap infusion.** A new colony cannot produce its own Strategic resources from day one (by definition — Strategic sources are concentrated elsewhere). Founding a colony on a world with no local Strategic-Core/Exotic source means it depends on an imported infusion to reach the tech/infrastructure tier where its own economy can stand up. This mirrors — and should reuse the resource-conservation logic of — the existing `FoundColony` mechanic (`docs/09` 2026-06-14: founding already draws down ship supplies rather than creating resources from nothing).

2. **Scaling upkeep.** The more colonies (and more trade routes) an empire runs, the more aggregate Strategic-resource throughput it needs simply to keep every route serviced — administrative/logistics upkeep that scales with network size, not just territory. This is the direct mechanical expression of `docs/15` §4's "each new world adds a dependency, not just free output."

3. **Logistical fragility.** A route can be broken — by distance, by an enemy (once conflict exists, Phase 7), by losing control of a hub world. Breaking a route doesn't just stop growth; it can strand colonies that had come to rely on imported Strategic-Core/Exotic supply for their higher-tier capabilities. **An empire of 20 worlds strung across a fragile network is more brittle than an empire of 3 tightly-linked ones** — size without resilient topology is a liability, not a strength. This is the trio's payoff: bigger is not automatically stronger.

## Terraforming as a Strategic Sink (SOFT)

[ESTABLISHED, reconciled per the header] Terraforming is the game's signature transformation loop (`docs/11`, `docs/15` §4) and a natural, thematically strong sink for Strategic resources — 3B's deferred networked levers (magnetosphere, toxicity, biosphere, cross-lever feedback) are exactly where a colony's terraforming would draw on imported Fissiles, exotic particles, or other Strategic inputs to push past what 3A's purely local resource sink can fund.

**This is soft-gated, never hard-gated.** Per `docs/15` §4 and the reconciliation header: a colony can always progress its **basic 3A levers** (Temperature, Pressure, Hydrosphere) on local resources alone — no import requirement, no softlock. Strategic imports and tech from the wider network **accelerate** terraforming and **unlock the higher 3B tiers** a purely local colony could never reach on its own. The brief's original framing ("terraforming requires importing") is corrected here: imports are an accelerant and an unlock, not a lock. This is precisely *why* the 3A/3B split exists (`docs/09` decision, 2026-06-14): 3A proves the local, ungated loop; 3B is reserved for the moment the networked economy exists to feed it.

## Scarcity as the AI-Competition Substrate (forward-looking)

[EXTRAPOLATION — explicitly deferred, per the reconciliation header] None of this requires rival AI to be interesting for a single-player empire managing its own network. But it is *designed toward* a future where it does: Strategic-resource scarcity is what would give an AI opponent (or another human player) something concrete and legible to compete over — a contested Strategic-Exotic world, a chokepoint trade route, a rival's bootstrap-fragile new colony. `docs/15` §6's hard multi-agent-seam rule is the reason this document specifies the resource network be built **owner-scoped** from the start: routes, stockpiles, and upkeep must be tracked per-owner and mutated only through the typed command layer (`applyCommand`/`GameEvent`), so that when rivals or multiplayer owners eventually exist, they compete over the same resource network through the same commands — not a bolted-on parallel system.

## Minimal First Version (when this slice is actually built)

[EXTRAPOLATION — a deliberately small buildable core, in the spirit of the existing Step 1B "recommended minimal scope" pattern in `docs/12`] When this slice is picked up, the smallest version that proves the model end-to-end:

1. **Two resource tiers only** — the existing Local-Bulk set (unchanged) plus **one** new transportable Strategic resource: **Fissiles**.
2. **One linkable trade route** between two colonies, each capable of producing or needing Fissiles.
3. **A static distance-based trade-loss percentage** on that route (not yet a full continuous function of light-year distance — a flat tax proves the friction concept before it's tuned).
4. **Breaking the route powers down that colony's Tier-2 capability** — i.e., whatever Fissiles-dependent building/output tier exists (a reactor-tier building, or a 3B terraforming lever once it exists) goes idle/unpowered when the import stops, using the same "operational status + bottleneck reason" Legibility mechanism the colony economy already has (`docs/09` 2026-06-14, buildingStatuses).

This minimal version is enough to validate: the two-tier split feels right, trade-loss makes route topology a real decision, and a broken route has a visible, legible consequence — without building the full Strategic-Exotic roster, AI rivals, or any socio-political layer.

## Explicitly Deferred (per the reconciliation header)

- **Socio-political consequences** of scarcity or broken routes — civilian unrest, black markets, rebellion, piracy. These belong to Phase 6 (trade/diplomacy/governance) and Phase 7 (conflict/conquest), per `docs/05`. This economy layer is designed so those systems have something real to hook into later (a broken route *should* eventually cause unrest) — it does not build them now.
- **Military upkeep** drawing on this same Strategic-resource network — Phase 7 territory.
- **Rival AI / multiplayer owners actually competing** over this network — the network is built owner-scoped (see above) so this is a pure addition later, not a retrofit.
- **Full distance-loss function, route pathing/hubs, and the broader Strategic-Exotic roster** beyond the single Fissiles example — tuning and content work for whenever this slice is actually scheduled.

See `docs/05`'s Deferred/parked list ("dedicated economy / anti-snowball pass") for how this slice sits relative to the rest of the roadmap.
