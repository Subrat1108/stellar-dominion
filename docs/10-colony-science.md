# 05 — Colony Resource & Planetary Architecture

This document synthesizes the micro-survival logic of a single-player space colony-sim with the macro-strategy of planetary engineering. It defines how localized resource chains scale up to drive global *Civilization*-style expansion and *Terragenesis*-style environmental manipulation. **R&D rule: when in doubt, look it up; cite the source in the data file.**

## The Core Loop: Survival to Dominion

The player wakes as the commander of a damaged colony/exploration ship stranded near an unfamiliar star. The opening hours are hyper-focused on stabilizing life support with a small crew and basic starter materials. As the foothold stabilizes, the scope expands into a *Civilization*-like board. Industrial surplus is eventually funneled into planetary engineering, nudging planetary parameters over time to raise the body's habitability stage.

---

## Minimal Viable Resource Set (The "Civilization" Layer)

These are discrete items extracted, processed, and consumed by populations. Shortages here cause cascading localized failures. 

* **Power:** The universal bottleneck required for all life support, extraction, and industrial modules.
* **Water (H₂O):** Used directly for hydration and agriculture, but primarily serves as the chemical feedstock for oxygen and propellant.
* **Oxygen (O₂):** The immediate survival consumable; a zero-state results in immediate failure.
* **Biomass (Food):** Determines colony population growth; deficits cause starvation and unrest.
* **Metals / Minerals:** The foundational industrial resource used for physical expansion and infrastructure.
* **Propellant / Volatiles:** Sourced from water or atmospheric harvesting, used for in-system transfers approximated via patched-conic / Hohmann-style logic.

---

## Global Terraforming Parameters (The "Terragenesis" Layer)

These are not stockpiled items but global gauges tracked from a starting state toward a target equilibrium. Terraforming levers each map to a real concept.

* **Temperature:** Altered via orbital mirrors to increase insolation, greenhouse-gas factories to lower effective radiative cooling, or albedo changes.
* **Atmospheric Pressure:** Raised via releasing trapped volatiles, outgassing, or importing gases.
* **Toxicity / Composition:** Scrubbing or converting hostile atmospheres.
* **Hydrosphere:** Shifted by melting subsurface/polar ice or importing cometary volatiles.
* **Magnetosphere:** Artificial radiation shielding; a real, hard, late-game proposal required to protect populations.
* **Biosphere:** Staged biological introduction from extremophile microbes to simple plants and ecosystems, done only once chemistry and temperature allow.

---

## Dependency & Production Chains

The colony economy turns raw extraction into components into infrastructure. 

| Input Requirement | Facility / Process | Output Yield | Economic Layer |
| :--- | :--- | :--- | :--- |
| **Water** + **Power** | Electrolysis Plant | **Oxygen** + Hydrogen Waste | Local Survival |
| **Water** + **Power** | Biodome / Hydroponics | **Biomass (Food)** | Local Population |
| **Regolith** + **Power** | Smelter / Refinery | **Metals** | Local Expansion |
| **Metals** + **Power** | Greenhouse Gas Factory | **Temperature** (+ Tick Rate) | Global Terraforming |
| **Power** + **Metals** | Subsurface Thermal Drill | **Atmospheric Pressure** (+ Tick Rate) | Global Terraforming |

---

## In-Situ Resource Utilization (ISRU) & ECLSS

Extraction difficulty and resource abundance are dictated by the body's evolutionary stage. 

* **Barren Rock (Mercury/Luna-like):** Features extreme temperatures and no atmosphere. Excellent for metals, but oxygen must be baked from regolith at extreme power costs.
* **Toxic / Runaway (Venus-like):** Features a thick hostile atmosphere. Hostile to infrastructure, but atmospheric harvesters can pull infinite carbon and nitrogen.
* **Frozen (Mars-like, icy moons):** Water/ices are present but frozen. Highly viable early-game targets as subsurface ice solves water, oxygen, and propellant pipelines simultaneously.
* **ECLSS Water Recovery:** Advanced life support must utilize closed loops. Water is recovered from condensation and waste at a high percentage, turning it into a slow-leak resource rather than a fast-burn one.
* **Sabatier Process (CO₂ Scrubbing):** Recombining waste CO₂ with waste hydrogen from electrolysis yields reclaimed water and methane, mechanically rewarding players for mastering real chemistry.

---

## Power Scaling & Thermodynamics

Power directly ties into real, measurable quantities like orbital distance and star luminosity.

* **Solar Scaling:** Solar power is completely dependent on insolation, which defines the circumstellar habitable zone. Panel output scales via the inverse-square law. For a star with luminosity $L$ and an orbital distance $r$, the available solar energy $I$ is:
$$I = \frac{L}{4 \pi r^2}$$
* **Nuclear / Fission:** Provides high, consistent output ignoring distance and night cycles, requiring advanced mineral extraction or imported fissiles.
* **RTGs:** Provides a continuous low baseline of power to keep life support alive during grid failures. 

---

## Real vs Gameplay Pragmatism

We must be honest about where soft sci-fi is explicitly allowed to compress timelines.

* **Accelerated Timescales:** Real terraforming takes centuries or more, but we compress time for playability.
* **Relative Difficulty:** While time is compressed, the relative ordering of terraforming remains scientifically faithful, meaning a Venus-like planet is much harder to terraform than a Mars-like planet.
* **Simplified Chemistry:** Buffer gases like nitrogen are abstracted early on to keep the player focused on Oxygen as a proxy for survivability.
* **Simplified Materials:** Iron, titanium, and aluminum are pooled into a single "Metals" resource early to prevent inventory clutter, before deepening the tiered resource model later.