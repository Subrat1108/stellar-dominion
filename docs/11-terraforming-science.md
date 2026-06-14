# 11 — Terraforming Science Brief

> Phase 3 reference. Built in stages: 3A = temperature/pressure/hydrosphere + gates; 3B = magnetosphere/toxicity/biosphere + feedback loops.

---

## 1. Terraforming Levers & Real Mechanisms

Six primary control levers, each grounded in a real physical or chemical mechanism:

| Lever | Mechanism(s) |
|-------|-------------|
| **Temperature (warm)** | Orbital mirrors at L1; engineered aerosols; surface albedo modification |
| **Temperature (cool)** | L1 sunshades |
| **Pressure (increase)** | Release endogenous CO₂/H₂O; import N₂/Ar buffer gas |
| **Pressure (decrease)** | Urey reaction — calcium silicate weathering binds atmospheric CO₂ into solid carbonates |
| **Toxicity (scrub)** | Sabatier reaction — import H₂ to convert CO₂ into CH₄ + H₂O |
| **Hydrosphere** | Melt existing planetary ice; cometary bombardment |
| **Magnetosphere** | Deploy a 1–2 Tesla artificial magnetic dipole shield at the planet–star L1 Lagrange point |
| **Biosphere** | Sequential seeding: extremophiles (cyanobacteria) → complex flora |

---

## 2. Gate Conditions (strict prerequisites)

Three hard prerequisites control unlock order — these are not suggestions:

1. **Magnetosphere before Pressure increase.** Pumping volatiles without the L1 shield results in rapid atmospheric stripping via solar wind. The shield must be active before any volatile campaign begins.

2. **Pressure before Hydrosphere.** Atmospheric pressure must exceed the Armstrong limit (0.0618 atm). Below this threshold water boils at human body temperature — liquid oceans cannot exist.

3. **Marginal state before Biosphere.** Requires Temperature > 0 °C, Pressure > 0.0618 atm, and liquid water present.

---

## 3. Cross-Lever Interactions & Feedback Loops

### Temperature ↔ Hydrosphere & Pressure
Raising temperature melts polar ice → adds to hydrosphere and releases trapped CO₂ → raises pressure (beneficial feedback). But extreme temperature boils the hydrosphere into water vapour, creating a **runaway greenhouse** loop.

### Pressure → Temperature (pressure broadening)
Increasing absolute atmospheric pressure amplifies the effectiveness of all existing greenhouse gases — a multiplier on every warming agent already present.

### Hydrosphere → Toxicity & Pressure (Urey reaction)
A liquid hydrosphere is mandatory for silicate weathering. Active weathering is a **continuous drain** on both atmospheric CO₂ (toxicity) and pressure. Requires significant mining infrastructure.

### Toxicity scrubbing (Sabatier) → Hydrosphere & Temperature
The Sabatier reaction produces liquid water (raises hydrosphere) but generates methane — an extreme greenhouse gas that must be sequestered or consumed to avoid temperature runaway. Power cost: ~17 MWh per tonne of converted propellant/water.

### Magnetosphere → all volatile levers
Without the L1 shield active, the solar wind is a **constant negative modifier** draining Pressure and Hydrosphere scores every tick. The magnetosphere is the containment baseline for all atmospheric work.

### Biomass → Toxicity, Pressure, Hydrosphere
- Captures CO₂ → reduces toxicity.
- Sequesters gaseous carbon → **reduces atmospheric pressure** over time.
- Consumes liquid water for oxygenic photosynthesis → reduces surface water while increasing atmospheric O₂.

---

## 4. Stage Thresholds (habitability states)

| State | Hab score | Key conditions |
|-------|-----------|---------------|
| **Barren** | 0.0–0.2 | Pressure < 0.0618 atm; Temp < −50 °C; vacuum or trace gases |
| **Toxic / Runaway** | 0.1–0.3 | High pressure; Temp > 100 °C; stable greenhouse runaway |
| **Frozen** | 0.2–0.4 | Pressure > 0.0618 atm; Temp < 0 °C; ice present, no liquid water |
| **Marginal** | 0.4–0.7 | Pressure > 0.5 atm; Temp > 0 °C; liquid water present; O₂ < 19.5 % or CO₂ > 2 % (breather masks required) |
| **Garden** | 0.7–1.0 | Pressure ≈ 1.0 atm; Temp 10–30 °C; O₂ > 19.5 %; CO₂ < 2 % — breathable without suits |

---

## 5. Instability & Feedback Risks

**Runaway greenhouse.** Melting polar caps too fast releases water vapour, traps heat, temperatures spike past habitable limits, new oceans boil.

**Refreezing (albedo trap).** Over-aggressive biomass sequestration drops atmospheric density. New ice (50–85 % reflectivity) cools the planet further — a self-reinforcing collapse.

---

## 6. Resource Cost & Pacing

- Resource burn is **massive** — the Urey reaction requires immense mining infrastructure; Sabatier requires ~17 MWh/tonne.
- Per-tick burns produce microscopic fractional parameter shifts (e.g. +0.0001 atm/tick). Players scale infrastructure to compress real-world centuries into gameplay weeks.

### Archetype difficulty

**Mars-type (cold/thin):** J-class minimum energy investment for O₂ production; massive buffer-gas imports needed.

**Venus-type (hot/dense):** Immensely difficult. L1 sunshades first (halt insolation), then massive silicate mining to trigger Urey reaction and bleed extreme CO₂ pressure.

---

## 7. Phase 3 Implementation Matrix

| Lever | Primary mechanism | Primary cost | Target parameter | Gates / preconditions |
|-------|-------------------|-------------|------------------|-----------------------|
| Magnetosphere | L1 dipole generator | Power, Metals | Prevents solar stripping | **Base prerequisite** for retaining any atmospheric gains |
| Pressure ↑ | Volatile import / buffer gas | Power, Volatiles | Atmospheric mass | Must have Magnetosphere; gates Hydrosphere (clears Armstrong limit) |
| Pressure ↓ | Urey reaction | Metals, Silicates | Atmospheric mass | Must have Magnetosphere |
| Temperature | L1 mirrors / aerosols / shades | Metals, Power | Heat retention | Gates Hydrosphere (must clear 0 °C) |
| Hydrosphere | Cometary ice import | Water (Volatiles) | Liquid surface water | Pressure > 0.0618 atm AND Temperature > 0 °C |
| Toxicity | Sabatier scrubbing | Hydrogen (Volatiles) | CO₂ reduction | Drop CO₂ < 2 % to unlock advanced Biosphere |
| Biosphere | Extremophile seeding → complex flora | Food, Organics, Water | O₂ increase; Pressure/Water decrease | Marginal habitability (Temp > 0 °C, Pressure > 0.0618 atm, liquid water) |

---

## 8. Implementation notes for Phase 3A / 3B split

**Phase 3A** implements: Temperature, Pressure, Hydrosphere levers + all gate checks. Magnetosphere is a prerequisite displayed as locked until built; Biosphere and Toxicity deferred.

**Phase 3B** adds: Magnetosphere lever (buildable, power-hungry), Toxicity (Sabatier), Biosphere (sequential seeding), and the feedback loops (pressure broadening, albedo trap, runaway greenhouse).

Per the Legibility pillar (docs/01 §6): every lever in the UI must display its current value, its resource burn rate, and — when locked — the specific unmet prerequisite (e.g. "requires: magnetosphere active" or "requires: pressure > 0.0618 atm").
