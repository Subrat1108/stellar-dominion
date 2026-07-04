# Session 21 — PLANNING — Exploration Polish B: cockpit, controls, orbital gravity

> PLANNING-room rationale for the Polish B slice. Pairs with the BUILD-room log in
> `docs/07-devlog.md` and the decision rows in `docs/09-decisions.md`.

## Goal

Make the exploration/flight leg playable *by hand*. Polish A (Sessions 19–20) made
bodies honestly scaled and fixed orbital insertion, but the leg is still hard to
fly: the cockpit isn't immersive, the control model conflates "mark a target" with
"fly there," mouse/touchpad steering is broken, and there's no gravity — so orbit
and approach have no physical feel. Polish B fixes all four.

## Decisions (with rationale)

### 1. Cockpit = immersive canopy (Direction 1), built cheap as a foreground overlay
**Call:** Rebuild the cockpit as a true first-person pilot POV looking forward,
surrounded by a **canopy frame** — but implement the frame as a static CSS/SVG
foreground **overlay**, not a modeled 3D interior. HUD (reticle, SET COURSE
direction indicator, speed/throttle + mode, nearest-body readout) is integrated
into the canopy.
**Why:** Immersion is the point (you should feel like you're *in* the ship watching
a world grow ahead), but a modeled cockpit interior is real geometry/art cost and
risks the MacBook-Air frame budget for zero simulation value. An overlay delivers
the "surround" read for pennies and keeps the center clear so bodies visibly grow.
**Logged:** `docs/09` · affects `docs/08`.

### 2. Gravity = the "middle" rung — deterministic patched-conic, tuned-μ feel model
**Call:** Add real but bounded orbital gravity using patched conics (NOT n-body,
NOT pure arcade): each body has a sphere of influence (SOI); inside it the ship
feels `a = μ/r²` toward the body; outside all SOIs gravity is negligible (free
cruise). Orbit is a real stable state; leaving a deep well needs escape velocity.
**Crucially, μ is a gameplay-tuned scene-scale constant, not `G·M`.** At honest
scale (Polish A) a low orbit sits at ~0.01 scene units; literal-SI gravity there is
~1e-8 u/s² — imperceptible, no well, free escape. So we keep the **real patched-conic
structure** (SOI, `μ/r²`, `v_circ = √(μ/r)`, `v_esc = √(2μ/r)`) and tune only the
**magnitude**: `μ = ω²·r_ins³` derived from a target low-orbit period. This is the
exact sibling of the already-logged decisions that *the ship is a non-physical
avatar* and *orbital-time / orbit-rate are feel constants* — honest structure,
avatar-scaled magnitude, because literal scale is an empty void.
**Why (determinism):** three regimes, each a pure function of state/tick:
(a) autopilot = scripted velocity, no gravity; (b) analytic held orbit = position a
pure fn of tick, with ω now **derived from μ** so the held orbit is a *true* circular
orbit whose instantaneous velocity is `v_circ` — making the autopilot→manual handoff
seamless (no fall-in, no jump); (c) manual inside an SOI = semi-implicit (symplectic)
Euler on the fixed 1/60 tick. Escape velocity is emergent, not special-cased. Drag
(the auto-stop aid) applies only *outside* SOIs so releasing thrust near a body lets
you coast/orbit — that's the "feel the well."
**Logged:** `docs/09` (revises the Session-10 "flight is pure arcade, no gravity"
row) · affects `docs/08`.

### 3. Control model = SET COURSE / AUTOPILOT / LAND, with manual vs autopilot modes
**Call:** Split today's single "SET COURSE flies you there" into three actions:
- **SET COURSE** — only marks the target + draws a direction indicator; does not move the ship.
- **AUTOPILOT** — flies to the marked target with a trapezoidal speed profile (accelerate out → cruise → decelerate) and inserts to orbit on arrival. Thrust is **locked** while engaged.
- **LAND** — from orbit/close approach, as today.
Two modes: **MANUAL** (keyboard thrust + mouse steering + free-look; ENTER ORBIT
prompt when near a body) and **AUTOPILOT** (ship flies itself, thrust disabled).
Default is manual. Reaching orbit under autopilot holds; the player can then LAND or
switch to manual (control handed back under gravity).
**Why:** "Mark" and "commit to fly" are different intents; conflating them removes
player agency and makes the direction indicator impossible. Locking thrust in
autopilot (vs today's "any key cancels") makes the mode a real state you leave
deliberately (the ✕ AUTOPILOT button), not something you fall out of by nudging a
key. This is also the seam the gravity model needs: autopilot = scripted regime,
manual = gravity regime.
**Logged:** `docs/09` · affects `docs/08`.

### 4. Two cameras only (cockpit + third-person); the map leaves the camera cycle
**Call:** `C` toggles just cockpit ↔ third-person (chase). The map is removed from
the camera cycle. The existing dumb minimap/sector stays reachable (for warp) but
the real clickable multi-scale map is **Polish C**, not this session.
**Why:** A camera cycle should cycle *camera POVs*. The map is a different kind of
thing (a navigation surface), and cycling through it mid-flight is a papercut.
Deferring the real map to C keeps this slice focused.
**Logged:** `docs/09` · affects `docs/08`.

### 5. Mouse/touchpad steering = pointer-lock, free-look on a held modifier
**Call:** In MANUAL, click the canvas to capture (pointer lock); trackpad/mouse
deltas then steer the ship (dx→yaw, dy→pitch); hold a modifier for free-look
(camera only, heading unchanged); `Esc` releases. Keyboard steering keeps working.
**Requirement:** clicking HUD controls (SET COURSE / AUTOPILOT / LAND / ENTER ORBIT)
must NOT trigger capture, and entry/exit must be clean and discoverable — treated as
part of in-browser verification, not just "deltas move the ship."
**Why:** Relative-delta pointer lock is the standard flight/FPS pattern and is the
most reliable option on a MacBook trackpad (no persistent "button held" needed).
The held-modifier free-look keeps steering and looking from fighting.
**Logged:** `docs/09` · affects `docs/08`.

### 6. The progress.md + planning-log convention itself
**Call:** Add root `progress.md` (the single start-here file) and `docs/planning/`
(per-session PLANNING rationale) as durable context scaffolding; wire maintaining
both into the session-logging protocol in `CLAUDE.md`.
**Why:** Both rooms start cold each session and re-derive context from the repo.
A start-here file + a "why" log per session makes that rebuild cheap and keeps the
planning rationale from living only in ephemeral chat.
**Logged:** `docs/09` · affects `CLAUDE.md`.

## Open questions / deferred

- **μ from real mass (density-varied wells).** μ = ω²·r³ gives every low orbit the
  same period (well depth ∝ R³). Deriving μ from real mass with a global gain (so a
  dense body pulls harder than a puffy one at equal radius) is a tuning follow-up,
  not built now.
- **Dedicated ship near-camera layer.** If the ship still reads chunky in low orbit,
  a separate near-camera render layer (from Session 20's follow-up list) would let it
  shrink toward true scale — still deferred.

## Scope guard

**In:** cockpit canopy overlay + HUD integration; 2-camera cleanup; control-model
split (SET COURSE / AUTOPILOT / ENTER ORBIT) + thrust gating; pointer-lock mouse/
touchpad steering + free-look; deterministic patched-conic gravity (SOI/μ, force
integration in manual, analytic held orbit, escape velocity); autopilot trapezoidal
auto-throttle.

**Out:** Polish C (the unified clickable multi-scale map — minimap stays dumb, just
leaves the camera cycle); Polish D (body detail panel); any economy/tech/warp-gating
change; n-body gravity; a modeled 3D cockpit interior; anything touching the sim
(colony/terraforming/population), the warp FSM, or the honest-scale body math.
</content>
