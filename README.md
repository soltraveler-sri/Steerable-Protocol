# Steerable

> **Make your app steerable by agents — without handing them the browser.**

Steerable is an **open standard** — colloquially, *the Steerable protocol* — for making software applications operable through natural language. An app declares its real capabilities as **typed, policy-governed actions**; users then drive the whole product by stating intent ("make the accent forest green and rebuild it"), and external agents can operate it through the same governed surface. The app never surrenders control to fragile DOM automation, and the experience never degrades into a read-only chatbot.

Expose your product's real capabilities through typed actions, policy, and trusted execution — not a chatbot veneer, and not DOM automation.

**What this is NOT:** not a chatbot kit, not browser/computer-use automation, not a maximalist agent framework. It is the missing layer *between* those things and a real product — the layer where an app's capabilities, policies, and feedback loops live. The discipline it names is **agent-responsive design**: as responsive design adapted apps to a new class of devices, agent-responsive design adapts them to a new class of users — agents acting on humans' behalf.

## The reference experience

This pattern was proven in production in **[Spec](https://design-spec.xyz)**, a website mockup builder whose in-app assistant closes the full intent → multi-action → visible-result loop in ~2–5 seconds — including across page navigations — with confirmation gates only where an action's nature demands them (quota-spending builds, destructive resets). Spec is the UX benchmark for everything here: if an integration built on Steerable feels slower or more ceremonial than Spec's assistant for equivalent actions, the design has failed.

## Two founding decisions

These define the project's character; every document in this repo is bound by them:

1. **Execution posture is policy, not workflow.** The standard never hard-codes a plan-first / approval-first flow. Instant execution with undo is the natural mode for most actions in most apps; planning ceremony and approval gates are policy outcomes the integrating developer tunes to their domain. Safety lives in the policy engine and in reversibility mechanisms — not in universal friction.
2. **Coding agents are a first-class developer audience.** The expected adoption path: a developer points a coding agent at this repo plus their own app; the agent determines fit, proposes an integration plan, and executes the retrofit. Every spec, guide, and checklist here is written to be *executed by an agent against an unfamiliar codebase* — the docs are part of the product.

## Project status — honest version

**Design/spec phase.** There are no installable packages yet, and none are planned until the spec has proven itself (see the staged plan in the north-star). What exists or is in flight: the normative spec documents, an agent-readable integration kit (guides, skills, conformance checklist), a small in-repo example app that every spec concept is exercised against, and eval fixtures. Work is organized as sprint milestones of PR-scoped issues in this repo's tracker.

## Orientation

| Read | To get |
|---|---|
| [`Steerable-Protocol-NorthStar.md`](./Steerable-Protocol-NorthStar.md) | The canonical design document. Everything traces back to it. |
| [`docs/plan/ROADMAP.md`](./docs/plan/ROADMAP.md) | The Stage-1 plan: structural decisions, epics, sprints, gates. |
| [`docs/plan/GROUNDING.md`](./docs/plan/GROUNDING.md) | The condensed mission, principles, and risks. |
| [Issues](../../issues) / [Milestones](../../milestones) | PR-scoped work items, bundled into sprint milestones, labeled by epic (`epic:spec`, `epic:example`, `epic:kit`, `epic:evals`, `epic:meta`). |

**If you are a coding agent assigned an issue here:** read the north-star in full, then `docs/plan/ROADMAP.md`, then your issue — in that order. Your issue's *References* section lists the exact north-star sections and roadmap decisions that govern it; its *Guardrails* section lists the constraints you must not violate. When your work and the north-star conflict, the north-star wins — or forces a considered, explicit edit to it, never a silent divergence.

## License

[MIT](./LICENSE)
