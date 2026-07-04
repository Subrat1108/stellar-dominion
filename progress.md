# Progress — start here

> The single "resume here" file. Any session (BUILD room or PLANNING room) should
> read this first to rebuild context cheaply, then follow the links below.
> **Keep this current at the end of every session** (see the session-logging
> protocol in `CLAUDE.md`).

## Current state (one paragraph)

The deterministic space-4X sim runs end-to-end: a seeded content engine generates
the Tau Ceti neighborhood (Step 1A), you can warp between systems (Step 1B), land,
found colonies, run the resource economy, and terraform (Phases 2–3A). **Exploration
Polish B (Session 21) is complete + tuned:** an immersive cockpit canopy (cheap CSS
overlay, first-person POV); a real control model (SET COURSE marks / AUTOPILOT flies
/ ENTER ORBIT / LAND, manual-vs-autopilot modes, thrust locked in autopilot, the
AUTOPILOT button toggles); **mouse/touchpad pointer-lock steering** (hold Space to
free-look); two cameras only (map left the cycle); **deterministic patched-conic
orbital gravity** (tuned-μ, real SOI/`v_circ`/`v_esc`, seamless autopilot→manual
handoff, escape velocity); a **spiral orbital insertion** that slides in and orbits
seamlessly; **solid procedural planets** (fixed the log-depth see-through); and
**flyable icy planetary rings + a Kuiper belt** for a dramatic sense of scale (tiny
ship, huge worlds). 221 tests green; typecheck + build + dev-boot clean.

## Active next step

**Final in-browser feel confirmation for Polish B** (the spiral-insertion slide +
orbit direction are the last things to eyeball; debris + solid bodies already
confirmed by the user). All feel is user-verified — there's no browser driver in
this environment. The tuning knobs are listed at the end of the Session 21 devlog
entry. After confirmation: **Exploration Polish C** — the unified clickable
multi-scale map (+ promoting the minimap). Design rationale for Session 21 is in
`docs/planning/session-21.md`.

## Links

- [`docs/07-devlog.md`](docs/07-devlog.md) — BUILD-room log: what changed each session (newest at top).
- [`docs/09-decisions.md`](docs/09-decisions.md) — decision log: every architectural/design choice, dated, newest first.
- [`docs/05-roadmap.md`](docs/05-roadmap.md) — phased vertical slices; the Exploration-polish A–D sub-phases live here.
- [`docs/planning/`](docs/planning/) — PLANNING-room decisions per session (the design rationale that otherwise lives only in chat).
- [`CLAUDE.md`](CLAUDE.md) — project root context + the canonical **Current status** block + working protocols.
</content>
</invoke>
