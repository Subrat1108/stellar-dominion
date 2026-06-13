# 02 — Game Design

This is the living game-design doc. It describes *what the game is*, not how it's coded.

## The opening (the hook)

The player wakes as the commander of a **damaged colony/exploration ship** stranded near an unfamiliar star, with:
- a **small crew** (each crew member has skills: engineering, science, command, biology, etc.),
- **basic starter materials** (limited metal, fuel, life-support consumables, a fabricator),
- a **partly broken ship** (some modules offline).

First-hour goals: stabilise life support, scan the local system, identify a body you can land on or mine, and establish the first foothold. Survival pressure teaches the core systems before scale opens up.

**Starting conditions (Civilization-like).** Each new game drops the ship near a **randomly selected star system that has at least one habitable or near-habitable planet within visible proximity**, so the player always has an early goal in sight. Each star system carries a **difficulty level** (resource scarcity, environmental hazards, distance to neighbours, hostile presence) that tunes how hard that particular start is.

## The moment-to-moment experience (open-world space)

Above the strategy layer sits a real-time 3D experience: the player **pilots their ship through the star system** and should *feel* the open world — stars and planets in true 3D, asteroids drifting past, other ships approaching, a real sense of distance and speed. They can:
- **Fly manually or hand off to autopilot** (auto-mode plots and flies the route).
- **Set travel speed**, which doubles as time compression on the simulation clock.
- **Open a navigation map** to pick destinations and see route, travel time, and fuel cost.
- **Approach and land** on a planet — initially a polished transition into its surface/colony view, becoming progressively more continuous over time.

This experience is delivered in *layered camera scales* rather than one seamless world, and seamless space-to-surface descent is treated as a north star, not an MVP feature. The full design and the (significant) engineering reality live in `docs/08-rendering-and-camera.md`.

## Scales of play (the escalation ladder)

Each tier is a distinct "board" with its own decisions. The player unlocks tiers by progression, not all at once.

1. **Ship / Crew** — manage modules, crew, consumables. Always present as the player's "home base" early.
2. **Planet surface** — colonies, infrastructure, terraforming, local population & society.
3. **Star system** — multiple bodies (planets, moons, asteroids), in-system navigation, orbital logistics.
4. **Galaxy / Sector** — many star systems, interstellar travel, trade routes, diplomacy, rival powers.
5. **Universe (frontier tier)** — the grand-strategy endgame across galaxies. *This is where we allow soft sci-fi* (see `docs/04`). Scientifically there is one observable universe; we frame this top tier as galactic-supercluster / "known universe" dominion rather than literal parallel universes, unless we later choose a deliberate sci-fi conceit.

## Planets: evolutionary & habitability stages

Every body has a **type** and a **stage**, derived from real planetary science (details and formulas in `docs/04`). Stage determines what the player can do and how hard terraforming is.

Habitability is scored from physical properties: distance from star (insolation / habitable zone), mass & gravity, atmospheric pressure & composition, surface temperature, presence of liquid water, magnetosphere (radiation shielding), and axial/orbital stability.

Indicative stages (a body moves through these via natural state + player terraforming):
1. **Barren rock** — no atmosphere, extreme temps (e.g. Mercury-like, Luna-like).
2. **Toxic / runaway** — thick hostile atmosphere (Venus-like).
3. **Frozen** — water/ices present but frozen (Mars-like, icy moons).
4. **Marginal** — thin atmosphere, partial water, survivable only in domes.
5. **Habitable** — supports unenclosed human life with infrastructure.
6. **Garden** — self-sustaining biosphere; the terraforming endpoint.

Bodies can also be **gas giants** (not terraformable; valuable for fuel/resources and orbital habitats) and **asteroids** (mining, low-gravity industry).

## Terraforming (the signature loop)

Terraforming is **staged, slow, and multi-variable** — you nudge planetary parameters over time and wait for systems to respond. Levers, each grounded in real terraforming science:
- **Temperature** — orbital mirrors, greenhouse-gas factories, albedo changes.
- **Atmosphere** — pressure and composition (outgassing, importing volatiles, scrubbing toxins).
- **Hydrosphere** — releasing/importing water, melting ice.
- **Magnetosphere / radiation** — artificial shielding (a known hard problem; expensive late-game tech).
- **Biosphere** — introducing engineered microbes → plants → ecosystems once chemistry allows.

Each lever has cost, time, prerequisites, and side effects (e.g. raising temperature too fast triggers instability). The payoff: rising habitability unlocks larger unenclosed populations and new economy.

## Colonies & infrastructure

A colony is a settlement on a body with:
- **Population** (grows/shrinks based on habitability, food, housing, morale),
- **Buildings** (habitation, life support, power, mining/extraction, fabrication, research, agriculture/biodomes, spaceport),
- **Resource flows** (inputs → production → outputs; shortages cause cascading problems).

Early colonies are fragile domes; late colonies are open cities on terraformed worlds.

## Resources & economy

Tiered resource model (kept simple early, deepened later):
- **Survival:** life support (air/water), food, energy.
- **Industrial:** metals, rare elements, volatiles (for fuel & atmosphere), fissiles.
- **Advanced:** manufactured components, research output, exotic materials (late-game).

Production chains turn raw extraction into components into infrastructure. Scarcity drives the early game; surplus enables trade and expansion.

## Trade

Once multiple settlements/powers exist: trade routes move surpluses to deficits. Prices respond to supply/demand. Trade with rival powers builds relationships (and dependencies). Trade is also a soft-power alternative to conquest.

## Social structures

As populations grow, the player shapes **how worlds are governed**: policies, social/economic models, and factions that emerge from the population. Choices affect productivity, growth, stability, and unrest. This is the "create social structures" pillar — civilizations have an internal politics, not just an economy. (Designed in depth in a later phase; kept light until colonies matter.)

## Conflict & conquest

Conquest is one path to "ruling" worlds (trade/diplomacy/colonisation are others). Conflict is **resolved by simulation, not twitch reflexes**: fleets, defenses, logistics, and morale determine outcomes. Taking a world means controlling it *and* governing its population afterward (rebellion is a real cost). Combat spectacle is deliberately deferred — mechanics first.

## Victory / endgame

Multiple dominion paths: settle and terraform a critical mass of worlds; dominate galactic trade; conquer rivals; or some hybrid. Exact win conditions are tuned late, once the systems exist.

## Later / parking lot (do not build yet)

- Procedural galaxy generation at scale.
- Deep diplomacy & AI rivals with personalities.
- Crew/character narrative arcs.
- Ship/fleet designer.
- Multiplayer.
- Real-time or 3D tactical combat.
