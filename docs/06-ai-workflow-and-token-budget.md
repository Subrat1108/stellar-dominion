# 06 — AI Workflow & Token Budget

This project spans months. Tokens (and your attention) are the real budget. This doc is how we stay efficient.

## The core idea: the repo is the memory, not the chat

Every session starts fresh. We avoid re-explaining the project by keeping context **in files** (this `/docs` set + `CLAUDE.md`, which Claude Code auto-loads). A good session loads *only* the doc it needs, does focused work, and writes the outcome back to a file. Chat history is disposable; files persist.

## Division of labor: Claude Code vs Gemini

Use the right tool for each job to avoid burning premium tokens on cheap work.

**Claude Code — the engineer.** Use for anything touching the real codebase:
- Implementing features against a written spec.
- Refactoring, debugging, writing tests.
- Architecture decisions and tricky logic (orbital math, ECS systems).
- Precise, surgical edits where correctness matters.

**Gemini — the researcher/assistant.** Its large context window and generous free tier make it ideal for high-volume, lower-precision work, *before* anything reaches Claude Code:
- Researching scientific accuracy (habitability formulas, terraforming numbers, catalog formats) and producing a *summary* Claude Code can act on.
- Reviewing or summarising large amounts of code/text when you need a bird's-eye pass.
- Brainstorming design, generating lore/flavour text/names (the CCO bucket).
- First-pass drafts of data tables you'll then refine.

**Pattern:** Gemini explores and condenses → you decide → Claude Code implements precisely. Don't pay Claude-Code tokens to read a 40-page PDF; have Gemini distill it to the half-page that matters.

## Which Claude model to use

Pick by **task type**, not rigidly by phase — you'll do varied work in any phase. The cost-efficient default is to **work in Sonnet, escalate to Opus for genuinely hard reasoning, drop to Haiku for grunt work.**

| Task type | Model | Why |
|---|---|---|
| Architecture, hard algorithms (orbital math, ECS design, the 3D scale/precision problem), nasty debugging | **Opus 4.8** | Deepest reasoning; worth the cost when a wrong call is expensive |
| Day-to-day implementation, refactors, tests, UI components, content/data files | **Sonnet 4.6** | The workhorse — best balance of capability and cost |
| Boilerplate, mechanical edits, quick lookups, formatting | **Haiku 4.5** | Cheapest and fast; don't burn Opus on trivia |
| A truly thorny, project-defining problem where Opus struggles | **Fable 5** (premium tier) | Reserve for rare frontier moments; it's the top tier |

Per-phase lean:
- **Phase 0 (architecture):** Opus for the ECS/tick skeleton and the rendering-scale strategy; Sonnet for scaffolding.
- **Phases 1–4 (implementation-heavy):** Sonnet by default; Opus when you hit orbital transfers, the cruising/precision system, or a stubborn bug; Haiku for data/boilerplate/tests.
- **Phases 5–8 (complex systems — interstellar, diplomacy AI, conflict, scale):** more Opus for system *design*; Sonnet for the implementation that follows.

You can switch models mid-conversation, so escalate/de-escalate freely within a session.

## When to use Gemini — standing triggers (I will flag these)

You asked me to prompt you. **I'll drop an inline marker — `→ GEMINI:` — whenever a task is a better fit for Gemini**, so you don't have to remember. The standing triggers:
- **Large-context research** with a factual-accuracy goal (e.g. "find realistic terraforming temperature/pressure targets and summarise"). Gemini researches; brings back a short brief; Claude Code implements from it.
- **Summarising/condensing** anything long (papers, catalog docs, specs) *before* it reaches Claude Code.
- **Whole-codebase bird's-eye review** when you want a high-level pass over a lot of files at once.
- **Bulk content generation** — lore, flavour text, name lists, draft data tables (the CCO bucket) that you'll then refine.
- **Wide brainstorming** where breadth matters more than precision.
Keep precise implementation, architecture, and anything touching real code on Claude Code.

## Token-saving practices (the habits that compound)

1. **Spec-driven development.** Write the feature spec in the relevant `/docs` file first. Then ask Claude Code to implement *that*. A clear spec prevents the expensive build-wrong-thing → re-explain → rebuild cycle.
2. **Scope the context.** Tell Claude Code exactly which files/dirs to look at. Don't let it (or yourself) drag the whole repo into context every time. `CLAUDE.md` is intentionally short for this reason.
3. **One slice per session.** Match the roadmap. Finishing a small thing fully beats leaving five things half-open (which forces re-loading context next time).
4. **Commit as checkpoints.** Frequent, descriptive commits mean a new session can orient from git + devlog instead of you narrating history.
5. **Keep docs lean and current.** A bloated doc costs tokens every load. Prune. Move "someday" ideas to parking-lot sections.
6. **Prefer tests over manual re-checking.** A deterministic sim with tests lets Claude Code verify changes itself instead of round-tripping through you.
7. **Batch related questions.** Group small clarifications rather than one-at-a-time.
8. **Reuse, don't regenerate.** If content/data already exists in a file, point to it; don't have the model recreate it.

## Session protocol (a cheap, repeatable ritual)

**Start of session**
1. State the goal in one line (tie it to a roadmap phase/checkbox).
2. Name the doc(s) and code paths in scope.
3. Let `CLAUDE.md` load; pull in only the relevant `/docs` file.

**During**
- Spec first if non-trivial. Implement. Test. Keep diffs small.

**End of session**
1. One-line entry in `docs/07-devlog.md` (what changed, what's next).
2. Update `CLAUDE.md` "Current status" if the phase/next-action changed.
3. Commit.

## Guardrails against drift
- If a session balloons in scope, stop and write the overflow into the parking lot — don't keep going.
- If the model proposes a big architectural change, it goes through a written "Decision" note in the relevant doc before code.
- Re-read the pillars (`docs/01`) when a feature feels off — usually it's violating one.

## What this saves
The expensive failure modes in long AI projects are: re-explaining context, building the wrong thing from a vague ask, and losing track of decisions. Files + specs + a tight session ritual kill all three. The cheapest token is the one you don't spend re-establishing what we already knew last week.
