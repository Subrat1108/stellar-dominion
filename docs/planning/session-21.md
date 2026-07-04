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

### 7. Per-change logging + push (not batched to session end)
**Call:** `CLAUDE.md` protocol amended — **every prompt that changes files** is a
checkpoint that must update `progress.md`, add context to this session file, and
**commit + push to GitHub before the response ends**. Docs/trivial changes still
get pushed, but only need a progress/session touch if they change state or plan.
**Why:** This session exposed the failure mode — I batched the docs to "when the
feel settles", so ~6 commits of real change sat undocumented in `progress.md`/the
planning log until asked. Continuous logging + push keeps the repo the single
source of truth at all times and makes any hand-off cheap.
**Logged:** `CLAUDE.md` (Session logging protocol).

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
auto-throttle. *(Extended during the session by the tuning arc below.)*

**Out:** Polish C (the unified clickable multi-scale map — minimap stays dumb, just
leaves the camera cycle); Polish D (body detail panel); any economy/tech/warp-gating
change; n-body gravity; a modeled 3D cockpit interior; anything touching the sim
(colony/terraforming/population), the warp FSM, or the honest-scale body math.

## Control-model redesign (post-tuning, same session) — thrust-strafe + hold-to-steer

Playtest verdict on the Polish-B controls: the gear throttle + yaw-by-keyboard
model is wrong; the player wants a **thrust/strafe** ship where **the mouse (or a
trackpad gesture) aims** and the keyboard only translates. Decisions:

- **Speed gears removed.** No more DOCK…MAX buttons / `maxSpeedForGear` /
  `speedState`. **W accelerates forward, S decelerates then reverses** — the ship
  builds up speed over time toward a max (thrust + light drag), rather than
  snapping to a selected gear. One `THRUST_ACCEL` + `MAX_SPEED` in `presentation.ts`.
- **A/D are STRAFE, not yaw.** `A` = thrust left, `D` = thrust right (along the
  ship's local right vector, no rotation). **↑/↓ pitch keys removed.** So the four
  movement keys W/S/A/D only *translate*; the ship's heading is set only by steering.
- **Steering is HOLD-to-engage** (not click-to-lock). Mouse: hold the **left
  button** to steer (deltas → yaw/pitch), release to disengage. Trackpad: a
  **double-tap-and-hold** engages (the OS keeps the "button" down during a
  drag-lock, so the browser sees a sustained primary-button press — same code
  path), lifting disengages. Removed the single-click→pointer-lock toggle.
- **Two-finger scroll = zoom the map scales** (star system ↔ sector/galaxy) when
  steering is inactive — a `wheel` handler that steps the view/tier out and in.
- **Why:** this is a standard 6-DOF-lite flight scheme (translate on keys, aim
  with the pointer) and matches how people expect a trackpad to behave (gesture to
  aim, two-finger scroll to zoom). Determinism unaffected — the sim `Input` still
  carries `yaw`/`pitch`; only their *source* (steering, not keys) and the new
  `strafe` axis change. Feel constants (`THRUST_ACCEL`, `MAX_SPEED`, `DRAG`) tuned
  in-browser.

## Fix-pass addendum — the in-browser tuning arc (post-base, same session)

The base slice was mechanically correct but the *feel* took ~6 playtest rounds to
land. Rationale worth keeping for future feel work:

- **Honest scale is the recurring antagonist.** A planet is a sub-pixel dot until
  you're close, and the system is huge — so "watch the planet grow on approach"
  and "cross the system quickly" fight each other. Resolution: a **two-phase,
  body-scaled** approach (fast cruise, then a long slow zone measured in body
  radii). Any new "approach/zoom" feel should be body-scaled, not absolute.
- **Velocity-matching is mandatory near a body.** Inner planets drift ~0.03 u/s —
  as fast as a slow approach. Both the approach and the orbit hold must match the
  body's heliocentric velocity or the target slides away. But velocity-matching a
  *radial* approach also makes the ship **station-keep and never insert** — which
  forced the **spiral** insertion (blend radial→tangential) so it always closes
  and hands to the orbit moving tangentially. Logged as a `docs/09` decision.
- **"Realistic orbit" = close + slow + can't-see-the-whole-planet**, not a small
  distant disc. Framing knobs (insertion radius, left bias, period, direction) are
  irreducibly subjective — keep them as named constants and tune in-browser.
- **Log-depth is a standing shader rule** (`docs/09`): the translucent-planet bug
  was a custom shader not writing logarithmic depth. Every future custom shader
  must include the `logdepthbuf` chunks.
- **Debris fields sell scale cheaply** and are render-only + deterministic via a
  render-only PRNG (never the sim RNG). Rings/belt are decoration now; making them
  a *place* (mining, hazards) is a later slice.
- **No browser driver in this environment** → all "feel" is user-verified. The
  loop that worked: change one or two named constants, keep 220+ tests green +
  build + dev-boot, ship, get the playtest verdict, repeat.
</content>
