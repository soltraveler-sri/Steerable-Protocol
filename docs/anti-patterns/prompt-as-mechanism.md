# Prompt-as-mechanism

**Status:** Informative anti-pattern note. This document does not define requirements; use the cited `SA-*` IDs as the authority.

**Related anti-patterns:** [chatbot veneer](./chatbot-veneer.md), [DOM-automation first](./dom-automation-first.md), [plan-everything](./plan-everything.md), [unsafe magic](./unsafe-magic.md), [duplicate tool layers](./duplicate-tool-layers.md), [framework maximalism](./framework-maximalism.md), [prompt-as-mechanism](./prompt-as-mechanism.md).

## What it is

Prompt-as-mechanism is using prompt text where a mechanism belongs: enforcing a limit, a scope, an ordering, a budget, or a contract by asking the model to honor it, and treating the request as if it were the guarantee.

It shows up as an instruction that reads like configuration. A loop prompt that says "keep batches small" is a throughput setting written where nothing can test it, version it, or hold it. The model complies — that is the trap. Compliance looks like the mechanism working, until the same sentence meets a real workload and the product crawls, or meets a different conversation history and is ignored, and there is no failing test either way because the sentence was never an artifact anything checks.

The mirror-image failure is treating a prompt as harmless because it is "only text." Prompt text that reaches a model in production is production code with no type, no test, and no reviewer. It is the only part of the system where a one-line edit changes runtime behavior across every request and lands as a docs change.

This is not an argument against prompts. Guidance and examples are declared inputs (`SA-DECL-047`, `SA-DECL-048`), and prompt assembly is explicitly developer-controlled (`SA-EXEC-035`, `SA-EXEC-242`). The rule is the split: **deterministic enforcement; prompt as hint.** A prompt may make the right behavior more likely. It may never be the thing that makes the wrong behavior impossible.

## Why it happens

The gravitational pull is that prompts are the cheapest edit in the system. A limit takes one sentence and no schema, no migration, no test, no review. When the model then does the right thing in the first manual check, the change is indistinguishable from a fix.

It is also the path of least resistance at exactly the wrong moment. Prompt edits cluster around live defects, where the pressure to ship is highest and the evidence bar is lowest — the model did the right thing once, in one history, so the bug is closed.

The cost lands twice. First, behavior that should be a tested constant becomes a per-conversation lottery: the same instruction survives one history and is ignored in the next, so the defect returns as "intermittent" and resists diagnosis. Second, the instruction accretes. Because nothing fails when a prompt line stops mattering, no line is ever deleted, and the prompt becomes a sediment of past incidents that no test covers and no one dares touch.

A prompt-only fix that passes review is the specific hazard: it is evidence of one sample, presented as a contract.

## How to recognize it

Use these checks against an unfamiliar codebase:

- Search prompt text for quantities, limits, and budgets: `rg -n "keep .* small|batch|at most|no more than|only [0-9]|limit|maximum|don't exceed|one at a time|per turn" --glob '*prompt*' --glob '*.md' --glob '*.ts'`. Flag any number or bound that lives in prose rather than in a declaration, a schema, or a loop budget under `SA-EXEC-118`.
- Search for prompt text that restates a declared contract: `rg -n "you must|always|never|do not|make sure to|remember to"` inside prompt assembly. Flag instructions that repeat what a strict schema (`SA-DECL-016`, `SA-DECL-017`), a precondition (`SA-DECL-022`), a policy gate (`SA-POL-100`), or availability (`SA-DECL-085`) already enforces — the restatement is either redundant or the enforcement is missing.
- Inspect the fix history for the prompt files: `git log -p --follow` over prompt assembly. Flag prompt edits whose commit message describes a bug fix. Flag any defect closed by a prompt edit with no accompanying test, fixture, or type change; and flag the same behavior fixed by prompt text more than once, which is the signature of an instruction the model does not reliably honor.
- Inspect conformance or known-issues docs. Flag any behavior recorded as inconsistent, flaky, or intermittent whose stated remedy is a prompt example or instruction.
- Inspect prompt text for scope, authority, or eligibility rules. Flag instructions telling the model which actions it may call, which surface it is on, or what it may not touch: that is registry and policy authority (`SA-CORE-051`, `SA-DECL-032`, `SA-EXEC-001`) written where it cannot be enforced.
- Inspect prompt text for facts. Flag values, counts, totals, state, or capability descriptions written into a prompt template rather than derived from the registry and published facts (`SA-DECL-093`, `SA-DECL-095`, `SA-DECL-100`, `SA-DECL-105`, `SA-CTX-025`).
- Inspect the test suite for prompt coverage. Flag prompt fragments and default loop budgets that ship with no test asserting the behavior they exist to produce. If a prompt string is a product constant, look for the artifact that pins it; its absence is the finding.
- Inspect any framework-supplied prompt fragment or default budget. Flag defaults a framework ships to every adopter that are not versioned, documented, and tested as artifacts — an untested default is prompt-as-mechanism at the framework's blast radius rather than one app's.

## What to do instead

Use these requirements as the replacement contract:

- Core: `SA-CORE-051`, `SA-CORE-052`, `SA-CORE-094`.
- Declarations: `SA-DECL-016`, `SA-DECL-017`, `SA-DECL-018`, `SA-DECL-022`, `SA-DECL-032`, `SA-DECL-045`, `SA-DECL-047`, `SA-DECL-048`, `SA-DECL-093`, `SA-DECL-095`, `SA-DECL-100`, `SA-DECL-105`, `SA-DECL-107`, `SA-DECL-140`, `SA-DECL-141`.
- Policy: `SA-POL-100`, `SA-POL-101`, `SA-POL-102`, `SA-POL-105`.
- Context: `SA-CTX-004`, `SA-CTX-025`, `SA-CTX-048`, `SA-CTX-049`.
- Execution: `SA-EXEC-001`, `SA-EXEC-002`, `SA-EXEC-011`, `SA-EXEC-035`, `SA-EXEC-113`, `SA-EXEC-116`, `SA-EXEC-118`, `SA-EXEC-242`.

The shape of the replacement is the same every time: find where the intended constraint is already ownable as data or code, and put it there. A batch size is a loop budget under `SA-EXEC-118` or a parameter under `SA-DECL-016`, configured and tested. An eligibility rule is a precondition and a policy input. A limit on what may execute is registry validation and policy resolution before the executor runs (`SA-EXEC-001`). A boundedness caveat is result metadata carried into context (`SA-DECL-140`, `SA-CTX-048`). What remains — how to phrase the ask, which example to show, when to prefer one action over a neighbor — is `guidance` and `examples`, declared under `SA-DECL-047` and `SA-DECL-048`, derived under `SA-DECL-105`, and honestly labelled as a hint.

Two rules follow, and both are testable:

1. **A prompt-only fix is not a fix until a mechanism holds it.** One green manual check is one sample from a distribution. If the behavior matters, the artifact that guarantees it is a schema, a budget, a validation, or a deterministic retry — and a fixture asserts it (`SA-DECL-107`).
2. **A shipped prompt fragment or default budget is a normative, tested artifact.** If a framework or SDK emits prompt text or a loop bound on an adopter's behalf, it is versioned, documented, and covered by a test that fails when its behavior changes. Otherwise every adopter inherits an untested product constant they cannot see.

If those IDs do not cover the case, record a spec gap instead of adding a local rule here.

## Grounding

The landscape's Direction 1 review is the argument in the ecosystem's own materials: the useful primitives it catalogues — tool approvals, interrupts, typed tool schemas, structured output — are *mechanisms* the product controls, and the Steerable layer's job is to decide when they fire from declared metadata and policy rather than from an instruction the model may or may not honor: [landscape-2026.md](../research/landscape-2026.md#direction-1-in-app-copilot-and-agent-ui-sdks), [landscape-2026.md](../research/landscape-2026.md#vercel-ai-sdk).

The computer-use benchmark rows are the reason the split exists rather than being a style preference: the strongest reported agent behavior on those leaderboards is a percentage, not a guarantee, and a percentage is what a prompt instruction inherits: [landscape-2026.md](../research/landscape-2026.md#direction-3-computer-use-and-browser-agents).

## Spec gaps surfaced

The suite has no home in the declaration model for surface-scoped model guidance. `SA-DECL-095` forbids a prompt fragment from changing declared semantics "outside the declaration source", which acknowledges that prompt fragments exist while `SA-DECL-072` and `SA-DECL-081` give them no declared field on a facts or surface declaration. An integration with a pre-existing agent persona therefore has nowhere conformant to put it, and the pressure is toward patching a field into the framework's own types — which is the `duplicate-tool-layers` shape arriving through the back door. Whether surface-scoped guidance deserves a declared field is an open question for the declaration model, not a rule this note can add.
