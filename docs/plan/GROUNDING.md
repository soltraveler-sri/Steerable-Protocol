# Grounding — how the founding planning agent read the north-star

**Status:** committed artifact of the founding planning turn (July 2026).
**Canonical source:** [`Steerable-Protocol-NorthStar.md`](../../Steerable-Protocol-NorthStar.md). If this summary and the north-star ever disagree, the north-star wins.

---

## The mission, in my own words

Most apps meet AI in one of two failure modes: a chatbot that can *talk about* the product but not *operate* it, or an outside agent that operates it *badly* — by clicking pixels, slowly, fragilely, outside the app's own rules. Steerable is the missing layer between those: **the app itself declares its real capabilities as typed, policy-governed actions**, and an agent (the app's own, or an external one, through the same door) drives the product through that declared surface. The user states intent; the app does it; the result is visible in seconds; mistakes are cheap because reversal is a mechanism, not a promise.

The product, in priority order, is: (1) **the spec** — the Steerable App contract; (2) **the agent-readable integration kit** — guides, skills, checklists written to be *executed by a coding agent* against an unfamiliar codebase; (3) eventually, (3) **a thin reference runtime**, extracted only after the pattern proves itself. It is deliberately not a framework in the maximalist sense — not LangChain, not CopilotKit, not a UI kit, not MCP. It is the layer between those things and a real product.

The category name for the discipline: **agent-responsive design** — as responsive design adapted apps to new devices, agent-responsive design adapts them to a new class of users: agents acting on humans' behalf.

## The reference experience

Spec ([design-spec.xyz](https://design-spec.xyz)) is the UX prototype and the emotional benchmark: short natural messages → typed app-declared actions → visible results in **2–5 seconds**, including across page navigations, with confirmation only where an action's *nature* demands it (quota-spending builds, destructive resets). **If an integration built on Steerable feels slower or more ceremonial than Spec's assistant for equivalent actions, the design has failed.** Spec's codebase is not in this repo and its architecture is not the product boundary; we build from the north-star, proving concepts against an in-repo example app.

## The two founding decisions (owner-made; never dilute)

1. **Execution posture is policy, not workflow.** The framework never hard-codes plan-first / approval-first. Instant execution with undo is the natural mode for most actions in most apps. Planning ceremony, approval gates, and conservative posture are *policy outcomes* the integrating developer tunes to their domain. Every design decision and every issue in this repo must resist the gravitational pull of "AI safety best practice" toward adding steps, latency, or confirmation theater to trivially reversible actions. Safety lives in the policy engine and in reversibility mechanisms — not in universal friction.
2. **Coding agents are a first-class developer audience.** The expected adoption path is: a developer points a coding agent at this repo plus their app; the agent determines fit, proposes an integration plan, and executes the retrofit. Every spec, guide, and checklist is written to be executed by an agent against an unfamiliar codebase. The docs *are* the product.

## Non-negotiable principles (north-star §4, condensed)

1. Speed is the soul; safety is a policy, not a ceremony.
2. The declaration is the framework — one declaration compiles into tool schema, policy entry, executor, undo handle, UX copy, guidance, docs, evals, and (optionally) the external tool.
3. The model proposes; the runtime disposes — model output is an untrusted proposal, validated against registry + policy; only trusted app-owned executors mutate.
4. Chat is one surface, not the product.
5. Reversibility is a mechanism, not metadata — "reversible" must be executable.
6. Curated context beats raw context — facts → read tools → annotated DOM → vision, in that order; vision is the escape hatch, never the foundation.
7. Two doors, one registry — in-app steering and external agent access generate from the same declarations; duplicate tool layers drift, and drift kills trust.
8. Built for coding agents as integrators — a doc that can't survive agent execution isn't done.
9. Ride the ecosystem; own the layer — consume native tool calling, MCP, AI SDK, AG-UI; own declarations, policy, trusted execution, cross-surface runtime, ledger, integration kit.

## Normative vs. developer-choice (the meta-principle)

At every design decision, classify: **(a) decided by the standard** because the right answer is universal (declaration shape, risk/reversibility/effects vocabulary, that a policy engine runs on every invocation, that mutation goes only through trusted executors, ledger model, the distinct kinds of read/write/navigation/external capabilities, conformance) — or **(b) left to the integrating developer** with a sane default because it depends on the product's nature (posture, per-action gating, plan-preview usage, primary UX surface, latency budgets, what counts as reversible in their domain, whether door two opens). When in doubt: **(b) with a sane default**. The north-star's §6.4 table is the model; every spec doc must carry its own version of it.

## What this repo does now vs. later

- **Stage 0** (pressure-test in Spec) happens in the Spec repository, in parallel — not here. This repo's local proving ground is a small, honest example app that every spec concept must be exercised against.
- **Stage 1** (this repo, now): the normative spec, the integration kit (skills, handoff prompt, policy templates, conformance checklist), the example app, eval fixtures, the category essay. Gate: *a coding agent retrofits an unrelated app to a credible first integration using the docs alone.*
- **Stage 2+ (deferred):** packages/ extraction (core/react/next/mcp), ecosystem adapters, the MCP tab bridge implementation, hosted anything, runtime naming.

## Top 5 risks I can see

1. **Ceremony creep.** Dozens of agents writing safety-adjacent docs will each independently rediscover "best practice" friction and re-add it. This is the most likely failure mode and the reason every issue carries explicit guardrails against it. The plan-everything anti-pattern must be structurally hard to commit.
2. **Spec drift from the proving ground.** If spec docs are written but never exercised against the example app (or the example lags the spec), the spec becomes aspirational fiction — the exact four-places-duplication disease the declaration model exists to kill. Sequencing and acceptance criteria must force the round trip.
3. **Premature productization.** The pull toward writing packages/, TypeScript tooling, and adapters before the spec has survived contact with an integration. The north-star is explicit: the spec, the skills, and one serious example are worth more than four half-finished packages.
4. **Docs written for humans, not agents.** Prose that reads well but doesn't execute — missing decision criteria, unstated preconditions, no observable acceptance checks. The Stage-1 gate (an agent retrofits an unfamiliar app unaided) is the test; every guide/skill must be written against it.
5. **Absorption by incumbents.** CopilotKit ships weekly on $27M; AG-UI is circling approval semantics. If an incumbent ships risk taxonomy + plan objects first, the center of gravity shifts to the spec/skill/category layer — which is why spec, skills, and the category essay front-load in the staging, and why speed of Stage-1 execution matters.
