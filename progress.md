# Progress — start here

> The single "resume here" file. Any session (BUILD room or PLANNING room) should
> read this first to rebuild context cheaply, then follow the links below.
> **Keep this current at the end of every session** (see the session-logging
> protocol in `CLAUDE.md`).

## Current state (one paragraph)

The deterministic space-4X sim runs end-to-end: a seeded content engine generates
the Tau Ceti neighborhood (Step 1A), you can warp between systems (Step 1B), land,
found colonies, run the resource economy, and terraform (Phases 2–3A). **Exploration
Polish B (Session 21) is code-complete:** an immersive cockpit canopy (cheap CSS
overlay, first-person POV), a real control model (SET COURSE marks / AUTOPILOT flies
a trapezoidal profile / ENTER ORBIT / LAND, with manual-vs-autopilot modes and
thrust locked in autopilot), working **mouse/touchpad pointer-lock steering** (hold
Space to free-look), two cameras only (map left the cycle), and **deterministic
patched-conic orbital gravity** — a tuned-μ feel model with real SOI/`v_circ`/`v_esc`
structure, force integration in manual inside a body's SOI, a seamless
autopilot→manual handoff, and escape velocity. 218 tests green; typecheck + build +
dev-server boot all clean.

## Active next step

**Awaiting user in-browser feel confirmation for Polish B** (steering + the
autopilot→manual gravity handoff especially — checklist in the Session 21 devlog
entry; no browser driver in this env so feel is user-verified). After that:
**Exploration Polish C** — the unified clickable multi-scale map (+ promoting the
minimap). Design rationale for Session 21 is in `docs/planning/session-21.md`.

## Links

- [`docs/07-devlog.md`](docs/07-devlog.md) — BUILD-room log: what changed each session (newest at top).
- [`docs/09-decisions.md`](docs/09-decisions.md) — decision log: every architectural/design choice, dated, newest first.
- [`docs/05-roadmap.md`](docs/05-roadmap.md) — phased vertical slices; the Exploration-polish A–D sub-phases live here.
- [`docs/planning/`](docs/planning/) — PLANNING-room decisions per session (the design rationale that otherwise lives only in chat).
- [`CLAUDE.md`](CLAUDE.md) — project root context + the canonical **Current status** block + working protocols.
</content>
</invoke>
