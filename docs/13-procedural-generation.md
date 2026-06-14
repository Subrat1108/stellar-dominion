# 13 — Procedural Generation & Universe Content

> **Step 1A reference.** Resolved: flat-JSON deltas behind a swappable interface (not SQLite yet); procedural surfaces as Three.js ShaderMaterial; existing habitability score stands, ESI is a UI label only.

**Content Architecture & Universe Generation — Research Brief**

**Slice / context:** Step 1 (Local neighborhood generation, seeded determinism, and data architecture)
**Repo state checked:** Not accessed directly due to network constraints; state presumed based on established mandates.

## Summary

- **The Hybrid Approach:** Use the real-world HYG database for a curated set of nearby stars, and fill their planetary orbits deterministically using scientifically rigorous exoplanet occurrence rates.
- **Seeded Determinism:** Generate the universe "lazily" on demand. By passing a system's Cartesian coordinates into a high-performance, non-cryptographic hashing algorithm (like xxHash), the engine can dynamically reconstruct the exact same planetary bodies every time a player visits, meaning the universe itself requires zero disk space.
- **Save File Architecture:** Save files must strictly contain the universe seed and a database of player deltas (colonies built, resources extracted, ships moved). Using SQLite compiled to WebAssembly (WASM) with the Origin Private File System (OPFS) provides desktop-level database performance entirely in the browser/client.
- **Algorithmic Rendering:** Never store planet textures. Map physical properties (temperature, mass, water fraction) to WebGL fragment shaders, utilizing layered noise (Fractional Brownian Motion/Simplex) to calculate visual topography directly on the GPU.

## Findings

### Procedural Generation & Astrophysical Distributions

The distribution of star types across a galaxy naturally follows the Initial Mass Function (IMF). Exoplanet occurrence rates are heavily dependent on the host star's spectral classification; for example, M-type red dwarfs yield significantly different planetary demographics than G-type stars like our Sun.

To generate physically plausible planets, the game should employ the widely adopted Chen and Kipping (2017) mass-radius relations. This empirical model accurately translates a generated planetary mass into a physically realistic radius across distinct archetypes (Terran, Neptunian, Jovian).

Multi-planet systems typically exhibit a "peas in a pod" orbital architecture (Weiss et al. 2018). Planets within a single system tend to have heavily correlated sizes and regular orbital spacing. Observationally, these planets are most commonly spaced apart by $\sim 20$ mutual Hill radii.

### Seeded Determinism & Real Catalog Data

High-performance procedural generation relies on ultra-fast, non-cryptographic hashing algorithms. xxHash is highly optimized for this purpose and widely used in game development.

The HYG Database is the optimal source for real-world star data. It merges the Hipparcos, Yale Bright Star, and Gliese catalogs into a single, lightweight CSV file. The subset of stars located within 50 parsecs (160 light-years) contains approximately 32,000 stars. This is small enough to ship entirely in-memory as a flat data file.

### Property → Appearance Mapping

Modern procedural planet rendering bypasses texture storage entirely. By utilizing WebGL or canvas APIs, fragment shaders can generate planetary surfaces at 60 FPS on standard hardware.

Topography and atmospheric visuals are derived mathematically using Simplex noise or Fractal Brownian Motion (FBM). Game logic maps specific generated parameters (e.g., high heat + low moisture = desert archetype) into shader uniforms, controlling the color palette and noise frequency drawn on the GPU.

### Data Architecture at Scale

Relying solely on IndexedDB or JSON for late-game data processing creates severe performance bottlenecks.

Compiling an embedded database like SQLite to WebAssembly (e.g., wa-sqlite) and utilizing the browser's Origin Private File System (OPFS) allows for synchronous, native-speed data persistence.

### Comparable Game Paradigms

Elite Dangerous utilizes a hybrid model called the "Stellar Forge." It anchors its galaxy with roughly 160,000 real-world stars, then procedurally simulates the rest based on chemical composition and mass accretion.

No Man's Sky relies purely on mathematical formulas (cascading noise functions like "UberNoise") rather than physics-based astronomical simulation to generate its 18 quintillion planets.

## Design Implications

To achieve "open universe on a laptop," the data pipeline must flow strictly in one direction, from deterministic seed to rendered visual, with the save file intercepting only player actions.

| Generation Input (Seed Data) | Transformation Function | Game Engine Output |
|---|---|---|
| System Coordinates (x, y, z) | xxHash Algorithm | Unique System ID / RNG Seed |
| Stellar Spectral Type | Exoplanet Occurrence Rates | Number of planets & planetary masses |
| Planet Mass + Composition | Chen & Kipping (2017) Model | Planet Radius & Gravity |
| Inner Planet Orbit | Add $\sim 20$ Mutual Hill Radii | Next Planet's Orbital Spacing |
| Planet Archetype / ESI | WebGL FBM / Simplex Noise | Real-time GPU Surface Shader |

### The Step 1 Execution Plan

1. **Ship the 50-parsec HYG CSV:** Do not fetch this remotely. Bundle a stripped-down CSV containing only the coordinates, spectral types, and names of stars within 50 parsecs of Tau Ceti.
2. **Generate on Arrival:** When a player warps to a system without confirmed real-world NASA Exoplanet Archive data, the engine uses the star's ID and coordinates as an xxHash seed.
3. **Apply "Peas in a Pod":** The engine determines the innermost planet, then mathematically spaces subsequent planets outward by $\sim 20$ mutual Hill radii.
4. **Save File Architecture:** The save file stores the initial game seed and a SQLite WASM database of player deltas (e.g., `INSERT INTO colonies (system_id, planet_index, population)`).

## Open questions / decisions needed

- **→ CLAUDE:** For Step 1 (which only encompasses the local Tau Ceti neighborhood), do we want to implement the SQLite-WASM/OPFS architecture immediately to prove the late-game foundation, or use a flat JSON structure for player deltas to expedite the prototype?
- **→ CLAUDE CODE:** Needs architectural direction on whether the planetary shader generation will be handled natively by WebGL fragment shaders via HTML Canvas, or if a specific 3D rendering library wrapper (like Three.js) is required for the engine constraints.

## Sources

- Chen and Kipping (2017) — Probabilistic Forecasting of the Masses and Radii of Other Worlds.
- Weiss et al. (2018) — "Peas in a Pod: Planets in a Kepler Multi-planet System Are Similar in Size and Regularly Spaced".
- The HYG Database v3/v4.
- NASA Exoplanet Archive — Exoplanet Occurrence Rate Demographics.
- wa-sqlite (WebAssembly SQLite) OPFS benchmark paradigms.
