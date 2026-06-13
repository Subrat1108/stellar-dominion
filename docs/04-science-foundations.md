# 04 — Science Foundations

The "grounded, not fantasy" pillar lives here. This doc defines what must be factually correct, where we simplify, and where we explicitly allow soft sci-fi. **R&D rule: when in doubt, look it up; cite the source in the data file.**

## Real data sources (free, citeable)

- **Stars (positions, distances, brightness, type):**
  - *HYG database* — a merged, ready-to-use catalog of nearby/visible stars with 3D coordinates. Best starting point.
  - *Gaia* (ESA) — vastly larger and more precise; use later if we need scale.
  - *HIPPARCOS* — classic bright-star catalog.
- **Exoplanets (real known planets & their properties):**
  - *NASA Exoplanet Archive* — confirmed planets with mass, radius, orbital period, host-star data.
- **Solar-system bodies:** NASA/JPL fact sheets for our own planets/moons — the best-characterised, ideal for the early single-system sandbox.

Plan: the **first playable system is a real, curated one** (likely a nearby star or a fictional-but-physically-consistent system seeded from real distributions). Import via a script in `/tools` into typed JSON in `/src/sim/data`.

## Real vs invented content (the honesty policy)

We don't have complete, exact data for every star, planet, and galaxy — nobody does. So:
- **Use real data wherever it exists** (the local stellar neighbourhood, known exoplanets, our own solar system are well characterised).
- **Beyond that, generate physically-plausible fictional content** — invented planets, systems, and galaxies — but *seeded from real statistical distributions* (mass functions, orbital-spacing patterns, habitable-zone math). Invented ≠ arbitrary; it must obey the same physics.
- **Tag every entity as `real`, `derived`, or `fictional`** in the data, so we always know the provenance and can swap in better real data later without breaking saves.
This keeps the game grounded and internally consistent while letting the universe be as large as gameplay needs.

## Orbital mechanics (what we model)

- Each orbiting body stores **orbital elements** (semi-major axis, eccentricity, inclination, etc.).
- Position over time from **Kepler's equation** — analytic, deterministic, cheap. No live force integration.
- **In-system transfers** approximated with patched-conic / Hohmann-style transfer logic: travel has a time and a fuel cost derived from orbital geometry. This is the same simplification mainstream space games use; it's "correct enough" and very light.
- **No real-time n-body gravity** in early phases (expensive, unstable, unnecessary for gameplay). Revisit only if a feature truly needs it.

## Habitability model

Compute a habitability score per body from physical inputs (all of these are real, measurable quantities):
- **Insolation** — energy received, from star luminosity and orbital distance → defines the **circumstellar habitable zone** ("not too hot, not too cold for liquid water").
- **Mass / gravity** — affects atmosphere retention and human viability.
- **Atmospheric pressure & composition** — breathability, greenhouse effect, toxicity.
- **Surface temperature** — derived from insolation, albedo, and greenhouse effect.
- **Liquid water** presence.
- **Magnetosphere** — radiation shielding; bodies without one (e.g. Mars) are harder to make safe.
- **Stability** — orbital/axial stability over time.

These feed the planet **stages** in `docs/02`. The model can start coarse (a weighted score) and gain fidelity later.

## Terraforming science (grounded levers)

Each terraforming lever maps to a real concept, so the game teaches real planetary science:
- **Warming:** orbital mirrors (increase insolation), greenhouse-gas production (lower the effective radiative cooling), lowering albedo (darkening the surface).
- **Atmosphere building:** releasing trapped volatiles, importing gases, outgassing — raising pressure toward human-survivable ranges.
- **Detoxifying:** scrubbing/converting hostile atmospheres (the Venus problem is genuinely extreme — reflect that with high cost).
- **Water:** melting subsurface/polar ice, importing cometary volatiles.
- **Radiation protection:** artificial magnetospheres / shielding — a real, hard, late-game proposal; price it accordingly.
- **Biosphere:** staged biological introduction (extremophile microbes → simple plants → ecosystems) only once chemistry/temperature allow.

Use real ranges as anchors (human-survivable pressure, temperature, oxygen fraction) so numbers feel earned rather than arbitrary.

## Where soft sci-fi is explicitly allowed

We are honest about the line:
- **Faster-than-light / fast interstellar travel.** Real interstellar travel takes millennia; that's not a game. We abstract travel time as a tech-gated function of distance. This is our main accepted conceit.
- **Accelerated terraforming timescales.** Real terraforming would take centuries+. We compress time for playability, but keep the *relative* difficulty and ordering scientifically faithful (Venus harder than Mars, etc.).
- **The "universe" top tier.** Scientifically there is one observable universe; "ruling universes" plural is not physical. We frame the grand endgame as dominion across galaxies / the known universe. If we ever want literal multiple universes, that becomes a deliberate, flagged sci-fi premise — not an accident.

Everything outside these flagged areas should be defensible against a real textbook. When we bend a rule, we note it here.

## R&D backlog (research before implementing)
- Pick/finalise the first system (real star vs physically-seeded fictional).
- Habitability scoring formula v1 (inputs → 0–1 score).
- Terraforming lever cost/time curves anchored to real targets.
- Star-catalog import pipeline + units convention (SI internally).
