> **Landing & surface reference.** Reconcile with repo decisions — this doc is authored to APPLY these constraints, not to be taken past them:
> (1) **NO hex/tile/action-point surface layer, ever.** The planet is a **stylized aggregate globe** (the procedural ShaderMaterial sphere, `docs/13`), not a gridded map. There are no rovers, no build radius, no per-tile placement, no AP economy. Any "surface detail" from the research below maps onto the **existing aggregate colony model** (`docs/10`) as scalar MODIFIERS, never as a spatial layer.
> (2) **Site science → founding modifiers.** A landing "site" is a small deterministic bundle of environmental attributes; choosing one founds the colony with derived starting modifiers (head-starts, efficiencies, upfront costs). It shapes the aggregate colony; it does not create a place you walk around.
> (3) **Owner-scoped from day one.** Landing and founding are owner-scoped (`docs/15` §6): a colony is founded by AN owner (the local player is an owner id, never the owner). Every landing/founding mutation rides the command layer with an actor envelope so AI/multiplayer owners slot in with no retrofit.
> (4) **Seeds interdependence, builds none of it.** Landing is where the two-tier resource split (`docs/16`) first becomes visible — a founded colony may lack a local *strategic* resource — but no trade routes / logistics / transport are built here (that is the deferred economy slice).
> (5) **Soft, never hard.** Nothing at landing hard-gates survival or basic (3A) terraforming. Missing strategic resources and hostile EDL are *frictions and pulls*, not softlocks (`docs/15` §4).

# 14 — Landing & Surface

Slice context: the **landing arc** — the first slice of the fun loop (`docs/15` §1: EXPLORE → **LAND** → COLONISE → …). It makes landing a *meaningful choice that shapes the colony you found*, rather than a bare "you are now on the surface" transition. It builds on the existing landing transition (`docs/09` Session 10: fade+zoom to a surface deck, not a continuous descent) and the aggregate colony economy (`docs/10`, `docs/11`).

The governing move: **exploration reveals goals** (`docs/15` §3). A world is worth prospecting because *where* and *how* you land on it changes the colony you get. That is the whole point of this slice.

---

## 1. What "landing" is (and is not)

**Is:** an eased transition (fade + zoom) from the flight/orbit view onto a surface "deck" overlay, from which the player inspects the world, **chooses a landing site from a small set of candidates**, and founds a colony with modifiers derived from that site. The globe itself is the stylized aggregate sphere from the renderer — it visibly reflects the body's state (and later, terraforming), but it is a *representation*, not a playfield.

**Is not:** a continuous space-to-surface descent (a north star, never an MVP requirement — `docs/08`); a tile/hex map; a rover/build-radius/action-point layer; a place with spatial gameplay. All "surface" richness is expressed as **scalar modifiers on the aggregate colony**.

This is the deliberate, repo-consistent answer to "how do we make landing matter without building a surface game": **site science as modifiers on an aggregate globe.**

---

## 2. Candidate landing sites

On landing on a world, the game deterministically generates a **small set (~3) of candidate sites** from the body's stable seed (`bodyKey` + universe seed, the same determinism seam as system generation and scan previews, `docs/13`). Same body → same candidate sites, every visit, on every machine. Sites are **regenerated on demand, never persisted** as world state (like scan previews) — only the *chosen* site's derived modifiers persist on the founded colony.

Each candidate is a bundle of environmental attributes, derived from the body's real fields plus seeded per-site variation (so two sites on the same world genuinely differ — a polar basin vs. an equatorial plateau):

| Attribute | Derived from | Shapes (founding modifier) |
|---|---|---|
| **Latitude / insolation** | seeded latitude × body insolation (`L/r²`) | solar efficiency (persistent) |
| **Volatile / water proximity** | seeded, biased by the body's water abundance | water + oxygen head-start (starting stockpile) |
| **Terrain / slope** | seeded terrain roughness | setup cost (higher slope → more metals to establish) |
| **Radiation / hazard** | body magnetosphere + system hazard (`docs/12`) + seeded local variation | upfront shielding cost (metals) |
| **Thermal inertia** | seeded | (reserved; flavour + future 3A pacing hook) |

A handful of **options to weigh**, not a map to fill in. The choice is: *which trade-off do I want this colony founded around?* — a sun-drenched site with weak volatiles (great power, water-poor start) vs. an icy shadowed basin (water head-start, weak solar), etc.

### Site → colony founding modifiers

Selecting a site founds the colony (via the existing `FoundColony` command, now carrying a `siteIndex`) with **starting modifiers derived by a pure `siteModifiers(site)` mapping** applied to the existing aggregate colony:

- **Volatile proximity → water/oxygen head-start** (bonus starting stockpile).
- **High insolation → solar efficiency** (a persistent per-colony multiplier the economy's solar generation reads — must be applied on *every* solar-generation read path so it can't silently revert).
- **Radiation / weak magnetosphere → upfront shielding cost** (one-time metals debit at founding).
- **Steep slope → higher setup cost** (one-time metals debit at founding).

Deterministic, pure, unit-tested (same site → same modifiers). No new spatial state — just scalars on the aggregate colony.

---

## 3. EDL as a light viability gate

Atmosphere + gravity give a **landing-viability** read (Entry / Descent / Landing) — a *light affordance*, explicitly **not a descent simulation**:

- A pure `landingViability(body)` classifies the world from `atmosphere.pressurePa` + `gravityMs2` into `vacuum | thin | nominal | thick`, with a human note and a `payloadFactor`.
  - **Vacuum** — no aerobraking; heavy drops cost more propellant/setup.
  - **Thin** — hard to land heavy payloads (a real Mars-EDL problem); heavy drops later tech-gated.
  - **Nominal** — Earth-like, unremarkable.
  - **Thick** — heavy drops feasible but with risk (reserved; no failure mechanic now).
- Surfaced as a landing-UI line, with **one light hook**: `payloadFactor` nudges the founding setup cost. No descent risk, no failure, no minigame.

This is the most deferrable piece of the slice — it can drop to display-only (or out) without touching anything else. It earns its place by cheaply reinforcing that worlds differ in *how you get onto them*, not just what's on them.

---

## 4. Owner-scoping (the multi-agent seam at the landing moment)

Founding a colony is the first place the hard multi-agent rule (`docs/15` §6) bites in a player-facing mechanic:

- A colony carries an **`ownerId`**; the local player is **an** owner id (`"player"`), stored on the world as `localOwnerId`, never assumed to be the only actor.
- **The actor is a command envelope, not part of the command payload.** A `Command` is byte-identical whether issued by the player, an AI, or a network peer; the issuing actor rides *alongside* it (`{ command, actorId }`), and `applyCommand(world, cmd, actorId)` stamps ownership + enforces owner-aware checks (an actor can only build/terraform in a colony it owns). This is the canonical multi-agent mechanism every future owner-scoped slice reuses (see `docs/09`).

Single-player behaviour is unchanged; AI/multiplayer owners are a pure addition (call the same `applyCommand` with a different `actorId`).

---

## 5. Seeding interdependence (the two-tier split, first appearance)

Landing is where the bulk-vs-strategic resource split (`docs/16`) first becomes *visible*, with **none** of the economy machinery:

- **Bulk** resources stay local (the existing six — `docs/10`); a well-chosen site helps the colony be self-sufficient in them.
- A founded colony may be **strategically incomplete** — lacking a local *strategic* resource. The minimal strategic concept introduced here is **Fissiles** (the first Strategic-Core resource, `docs/16`), modelled at this slice as **presence/absence only** (a deterministic per-body property), *not* as a stockpiled/produced/consumed resource.
- Surfaced **legibly** on the colony readout: e.g. *"⚠ No local Fissiles — this colony will depend on imports for Tier-2 capability."*

This creates the **pull toward other worlds** (`docs/15` §2 growth/scarcity) the moment you found a colony, without building trade routes, logistics, or transport — those are the deferred economy slice (`docs/16`). It is deliberately just enough to make the player *feel* the dependency the economy will later formalise.

---

## 6. Soft-dependency direction (recorded as intent, built later)

Per `docs/15` §4 and `docs/16`, the intended shape (not built in this slice):

- A colony can always **crawl forward alone** on local resources — basic (3A) terraforming and survival are never import-gated (no softlocks).
- Strategic imports + developed **tech** *accelerate* terraforming and *unlock* the higher (3B) tiers a purely local colony could never reach solo.
- This slice only *seeds* the visibility of that dependency (Fissiles presence). The networked accelerant/unlock is deferred with 3B and the economy slice.

---

## 7. Scope & deferred

**In this slice:** owner-scoped colonies (actor-envelope command layer) + save v2→v3 migration; deterministic candidate sites + selection; site→founding modifiers; minimal EDL; the Fissiles-presence interdependence seed. Terraforming/economy/population otherwise untouched.

**Deferred (see `docs/05` Deferred/parked + `docs/16`):** the strategic-resource network / virtual trade routes / logistics / transport; rival/AI owners actually competing; 3B terraforming depth; any tile/AP/rover/surface-spatial layer (never); the hard-start retune; a real EDL descent/risk mechanic.
