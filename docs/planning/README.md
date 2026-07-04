# docs/planning — the PLANNING-room log

## Why this exists

Two "rooms" drive this project:

- The **BUILD room** (Claude Code, in the repo) — precise implementation. Its log is
  `docs/07-devlog.md`: *what changed* each session.
- The **PLANNING room** (design/architecture discussion) — *why* we're building
  what we're building, the options weighed, and the calls made. That rationale
  normally lives only in chat and evaporates.

This directory captures the PLANNING-room decisions **per session**, so the design
reasoning is durable in the repo alongside the code and the build log. It is the
"why" companion to devlog's "what" and the decision log's "one-line record."

## Convention

- One file per session: `session-N.md`, using [`session-template.md`](session-template.md).
- Write it when a session's direction is set (usually at the start, refined at the end).
- Keep it to **decisions and rationale**, not a task list — the checklist lives in
  the in-progress `docs/07-devlog.md` entry.
- When a decision here is final, also add its one-line row to `docs/09-decisions.md`
  (that stays the canonical, greppable index). This file holds the longer "why."
- Cross-link: reference `docs/07` (build log), `docs/09` (decision rows), and the
  relevant `docs/NN` reference docs.

## Relationship to the other logs

| File | Owns | Granularity |
|---|---|---|
| `progress.md` (root) | "start here" state + active next step | current only |
| `docs/planning/session-N.md` | design rationale, options weighed | per session |
| `docs/07-devlog.md` | what actually changed in the build | per session |
| `docs/09-decisions.md` | one-line record of each decision | per decision |
</content>
