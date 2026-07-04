# Progress — start here

> The single "resume here" file. Any session (BUILD room or PLANNING room) should
> read this first to rebuild context cheaply, then follow the links below.
> **Keep this current at the end of every session** (see the session-logging
> protocol in `CLAUDE.md`).

## Current state (one paragraph)

The deterministic space-4X sim runs end-to-end: a seeded content engine generates
the Tau Ceti neighborhood (Step 1A), you can warp between systems (Step 1B), land,
found colonies, run the resource economy, and terraform (Phases 2–3A). The current
work is **Exploration Polish B** — making the exploration/flight leg playable by
hand: an immersive cockpit view, a real control model (SET COURSE / AUTOPILOT /
LAND with manual-vs-autopilot modes + working mouse/touchpad steering), and
**deterministic patched-conic orbital gravity** (SOI-bounded gravity well, real
orbits, escape velocity). Sessions 19–20 (Polish A + fix) made bodies honestly
scaled and fixed orbital insertion; the leg still needs a proper cockpit + controls
+ gravity, which is Polish B.

## Active next step

**Exploration Polish B (Session 21).** Commit split:
0. docs + `progress.md` scaffolding *(this commit)*
1. cockpit POV + 2-camera cleanup + SET COURSE direction indicator
2. control model (SET COURSE / AUTOPILOT / ENTER ORBIT split, thrust gating) + mouse/touchpad steering
3. gravity (SOI/μ, force integration in manual, analytic held orbit) + autopilot auto-throttle + enter-orbit

Determinism is sacred; all tests stay green (target ~200+). Design rationale for
this session is in `docs/planning/session-21.md`.

## Links

- [`docs/07-devlog.md`](docs/07-devlog.md) — BUILD-room log: what changed each session (newest at top).
- [`docs/09-decisions.md`](docs/09-decisions.md) — decision log: every architectural/design choice, dated, newest first.
- [`docs/05-roadmap.md`](docs/05-roadmap.md) — phased vertical slices; the Exploration-polish A–D sub-phases live here.
- [`docs/planning/`](docs/planning/) — PLANNING-room decisions per session (the design rationale that otherwise lives only in chat).
- [`CLAUDE.md`](CLAUDE.md) — project root context + the canonical **Current status** block + working protocols.
</content>
</invoke>
