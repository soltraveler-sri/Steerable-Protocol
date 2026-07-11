# Coding-Agent Handoff

**Status:** Informative guide. Normative requirements live in `docs/spec/`; the agent's self-check is [conformance-checklist.md](../spec/conformance-checklist.md). Use this prompt when a developer wants a coding agent to inspect an existing app, decide whether Steerable fits, propose a minimal retrofit, and stop before code.

For the agent procedure, see [retrofit-existing-app.md](./retrofit-existing-app.md). For greenfield design choices, see [designing-agent-responsive-features.md](./designing-agent-responsive-features.md). For posture archetypes and tuning, see [policy-templates.md](./policy-templates.md).

## Paste-Able Prompt

Read the Steerable docs in this repo, especially `docs/guides/retrofit-existing-app.md`, `docs/spec/conformance-checklist.md`, `docs/guides/designing-agent-responsive-features.md`, and `docs/guides/policy-templates.md`; then inspect my target app read-only, decide whether the Steerable pattern fits this app or a scoped part of it, inventory candidate actions, facts, read tools, risky operations, undo/history mechanisms, surfaces, and any existing assistant/tool layers with file-backed evidence, propose the smallest first integration in the order facts/read tools, safe reversible actions, one gated action, then posture selection, map the plan to `SA-CONF-*` checklist items, list open questions for me, and stop for my review before writing code.

## Return Contract

The agent returns this packet and then stops. The evidence and fields need to be specific enough that a second agent could execute the approved plan under `SA-CONF-005` and `SA-CONF-098`.

### 1. Fit Verdict

Fields:

- `verdict`: `fits`, `partial fit`, or `does not fit`.
- `scope`: the whole app or the named surface/module that fits.
- `existing_integration_state`: `absent`, `partial`, or `complete`, with evidence when a Steerable or Steerable-like layer already exists.
- `evidence`: file paths and short notes for app state, trusted executors, context, surfaces, policy/undo seams, and validation seams.
- `blocked_items`: checklist IDs that cannot pass yet, using `SA-CONF-005` result vocabulary.
- `anti_pattern_risks`: any observed [anti-pattern](../anti-patterns/README.md) risk with evidence.
- `no_go_reason`: present only when the verdict is `does not fit`; name the prerequisite product work and stop.

Checklist anchors: `SA-CONF-001` through `SA-CONF-005`, `SA-CONF-006` through `SA-CONF-026`, `SA-CONF-087` through `SA-CONF-089`, and `SA-CONF-090` through `SA-CONF-098`.

### 2. Inventory

Use tables. Include evidence paths for every row.

Candidate actions table:

| Field | Content | Checklist anchor |
|---|---|---|
| Candidate ID | Proposed stable action ID or temporary inventory name. | `SA-CONF-009`, `SA-CONF-010` |
| User outcome | One product outcome the user would recognize. | `SA-CONF-014` |
| Existing executor | Setter, command, mutation endpoint, service method, or handler. | `SA-CONF-015` |
| Params | Structured inputs and likely schema source. | `SA-CONF-012`, `SA-CONF-013` |
| Reads/writes | Stable product state regions and external effects. | `SA-CONF-014`, `SA-CONF-028`, `SA-CONF-030` |
| Surface/preconditions | Route, view, mode, or access condition where live. | `SA-CONF-020` through `SA-CONF-022` |
| Risk metadata | Risk, reversibility, effects, confirmation, and ambiguity. | `SA-CONF-027` through `SA-CONF-030`, `SA-CONF-042` |
| Recovery | Existing inverse, snapshot, server restore, compensation, or no-undo evidence. | `SA-CONF-029`, `SA-CONF-073` through `SA-CONF-077` |

Context table:

- Facts by surface, with keys, why useful, update trigger, schema hint, privacy note, and evidence. Anchor to `SA-CONF-017` through `SA-CONF-019`, `SA-CONF-044` through `SA-CONF-046`, and `SA-CONF-051`.
- Read tools, with params, read owner, output bounds, preconditions, and evidence. Anchor to `SA-CONF-016`, `SA-CONF-019`, and `SA-CONF-047`.

Surface table:

- Surface ID, route/view/mode evidence, live action/read/facts candidates, registration/liveness evidence, cross-surface needs, and unavailable-state behavior. Anchor to `SA-CONF-020`, `SA-CONF-066`, and `SA-CONF-068`.

Existing tool-layer table:

- Chat/tool/MCP/OpenAPI/prompt/eval homes, whether each consumes a registry today, drift risk, and proposed convergence path. Anchor to `SA-CONF-007`, `SA-CONF-008`, `SA-CONF-025`, `SA-CONF-026`, and `SA-CONF-082` through `SA-CONF-086` when door two exists.

### 3. Minimal First Integration Plan

Return a staged plan with one row per phase:

| Phase | Proposed scope | Files likely touched | SA-CONF self-check | Validation | Human stop point |
|---|---|---|---|---|---|
| Facts/read tools | One surface, bounded facts, parameterized reads. | Registry/context/test files. | `SA-CONF-016` through `SA-CONF-020`, `SA-CONF-044` through `SA-CONF-047`, `SA-CONF-051`. | Unit or route tests for fact keys, read-only behavior, and bounds. | Approve surface and context exposure. |
| Safe reversible actions | One to three actions using existing executors. | Declaration/registry/execution/ledger/undo/tests. | `SA-CONF-006` through `SA-CONF-015`, `SA-CONF-023`, `SA-CONF-028`, `SA-CONF-029`, `SA-CONF-031`, `SA-CONF-034`, `SA-CONF-038`, `SA-CONF-057` through `SA-CONF-059`, `SA-CONF-067`, `SA-CONF-069` through `SA-CONF-075`, `SA-CONF-081`. | Strict-param, policy, execution, visible result, undo, and eval-fixture tests. | Approve action boundaries and undo claims. |
| One gated action | One side-effect, mutating, destructive, costly, sensitive, or confirmation-bearing action. | Policy/execution/activity/ledger/tests. | `SA-CONF-027` through `SA-CONF-043`, `SA-CONF-057`, `SA-CONF-062` or `SA-CONF-064` or `SA-CONF-065`, `SA-CONF-067` through `SA-CONF-078`, `SA-CONF-081`. | Approval/decline, held boundary, no-undo or snapshot, failure, and redaction tests as applicable. | Approve risk classification and policy boundary. |
| Posture selection | Starting preset and any scoped override candidates. | Policy config/tests, not action declarations. | `SA-POL-140` through `SA-POL-172`, `SA-CONF-034` through `SA-CONF-041`, `SA-CONF-087`. | Policy matrix tests for selected actions and negative cases. | Approve preset and override rationale. |

Explicitly defer non-minimal work: full workflow loops, lower-rung DOM/vision context, door-two generation, model-provider adapters, durable ledger storage beyond the target scope, broad SDK extraction, and per-framework recipes. Anchors: `SA-CONF-048`, `SA-CONF-056`, `SA-CONF-063`, `SA-CONF-080`, `SA-CONF-082` through `SA-CONF-086`, `SA-CONF-088`, and `SA-CONF-089`.

### 4. Open Questions

Keep these short and decision-oriented:

- Scope boundary questions: which route/module/surface is in or out.
- Classification questions: ambiguous risk, external effect, quota/money, sensitive data, confirmation, or recovery evidence under `SA-CONF-028` through `SA-CONF-030`.
- Recovery questions: whether an inverse, snapshot root, server restore, or honest no-undo is acceptable under `SA-CONF-029` and `SA-CONF-073` through `SA-CONF-077`.
- Context questions: facts/read tools that may expose sensitive or unbounded data under `SA-CONF-019` and `SA-CONF-051`.
- Product policy questions: selected preset, overrides, user autonomy setting, grants, or runtime signals under `SA-POL-100` through `SA-POL-172`.

### 5. Stop Statement

End the packet with:

```text
I have not changed code. I am stopping here for your review before implementation.
```

## Five-Minute Human Review

Use this before saying go.

1. Check fit first. If the verdict is `does not fit`, accept the stop unless the evidence is wrong. A minimal claim cannot be rescued by optimism under `SA-CONF-002` and `SA-CONF-005`.
2. Check evidence paths. Every action, fact, read tool, surface, risk, and undo claim points to code or tests, not only product intuition, under `SA-CONF-005` and `SA-CONF-098`.
3. Check scope. The first slice names one surface, a small context set, one to three safe reversible actions, and one gated action; broader work is deferred under the phase anchors above.
4. Check classifications. Risk comes from executor evidence and called systems, and ambiguous cases classify upward or split under `SA-POL-020` through `SA-POL-023` and `SA-CONF-028`.
5. Check recovery. Do not approve a reversible claim without an executable inverse or snapshot path under `SA-CONF-029`, `SA-CONF-073`, `SA-CONF-074`, and `SA-CONF-075`.
6. Check ceremony. Clean safe reversible actions stay out of universal review by default under `SA-POL-073`, `SA-POL-146`, `SA-CONF-038`, and `SA-CONF-087`.
7. Check tool-layer drift. Existing chat, MCP, OpenAPI, prompt, docs, and eval surfaces converge on one declaration source under `SA-CONF-007`, `SA-CONF-025`, and `SA-CONF-026`.
8. Check validation. The plan includes tests or probes for strict params, policy decision, execution result, visible activity, ledger record, undo/no-undo truth, and eval traces under `SA-CONF-012`, `SA-CONF-031`, `SA-CONF-067`, `SA-CONF-069` through `SA-CONF-081`.

Say go after the agent can name the approved scope, action boundaries, classification evidence, stop points, and validation commands under `SA-CONF-005` and `SA-CONF-098`.

## Sprint-Mode Handoff (Alternate Entry)

The prompt above produces one reviewed first slice. Teams that instead want a **planned, tracker-backed integration** — a master design document plus PR-scoped GitHub issues that other agents then execute — can paste this variant. It reuses the retrofit skill's grounding, inventory, and fit phases, but its deliverable is a sprint, not code.

> Read the Steerable protocol repo at https://github.com/soltraveler-sri/Steerable-Protocol — specifically, in order: `docs/guides/coding-agent-handoff.md`, `docs/guides/retrofit-existing-app.md`, `docs/spec/capability-declarations.md`, `docs/spec/autonomy-policy.md`, `docs/spec/conformance-checklist.md`, `skills/retrofit/SKILL.md` (Phases 1–4 govern your analysis), `docs/guides/ecosystem-adapters.md` (model-loop wiring), and `examples/design-studio/` (reference integration). Runtime note: `@steerable/core` and `@steerable/react` live in that repo's `packages/` (tested, not yet on npm) — plan to vendor them or hand-roll per spec. Then inspect THIS app read-only, run the retrofit skill's inventory and fit assessment, and produce: (1) `STEERABLE_INTEGRATION.md` — the master design: fit verdict with evidence, full capability inventory (actions with honest risk/reversibility classifications, read tools, facts per surface, surfaces), posture selection with rationale, undo strategy, chat-agent/model-loop wiring plan via the ecosystem adapter, eval plan (target adapter + fixture kinds), and the conformance mapping (`SA-CONF-*`); (2) a GitHub milestone of PR-scoped issues sequenced minimal-first (slice 1: facts/read tools + safe reversible actions + one gated action + posture; later slices: remaining coverage waves, chat surface, evals/audit as definition-of-done), each issue with intent, in/out scope, guardrails (no gating of clean safe+reversible actions by default; one declaration source; model proposes/runtime disposes), and observable acceptance criteria citing `SA-CONF-*` items. Stop after creating the document and issues for my review before any implementation.

The Five-Minute Human Review above applies to the master document the same way it applies to a review packet.

**Pre-production variant.** For an unshipped, pre-production target where interim review gates add cost without protecting users, append the full-build authorization to the prompt above: *"This app is pre-production and unshipped. Full-build mode: authorized — after producing `STEERABLE_INTEGRATION.md` and the issues, proceed through implementation in the same engagement without stopping for interim review."* See `skills/retrofit/SKILL.md` → Full-Build Mode for exactly what that lifts (the slice caps and the stop) and what it never lifts (fit honesty, the conformance guardrails, and mandatory self-verification). Live products should keep the review-gated default.
