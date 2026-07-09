# Designing Agent-Responsive Features

**Status:** Informative guide. Normative requirements live in `docs/spec/`; this guide cites requirement IDs instead of redefining them.

Use this when a feature does not exist yet. If the task is to inspect an existing application and discover what is already there, use the future [retrofit-existing-app.md](./retrofit-existing-app.md) guide instead. This guide is about feature shape: what to declare, what context to publish, where surfaces begin and end, and what rollback support must exist before the feature feels fast.

## Authority Map

- Declaration source of truth: `SA-DECL-001` through `SA-DECL-109`, especially action shape (`SA-DECL-030` through `SA-DECL-053`), facts (`SA-DECL-070` through `SA-DECL-078`), surfaces (`SA-DECL-080` through `SA-DECL-087`), and registry derivations (`SA-DECL-090` through `SA-DECL-109`).
- Policy and risk authority: `SA-POL-020` through `SA-POL-034`, `SA-POL-040` through `SA-POL-048`, `SA-POL-073`, `SA-POL-100` through `SA-POL-114`, and `SA-POL-140` through `SA-POL-172`.
- Execution and cross-surface authority: `SA-EXEC-020` through `SA-EXEC-047`, `SA-EXEC-080` through `SA-EXEC-100`, `SA-EXEC-160` through `SA-EXEC-179`, and `SA-EXEC-200` through `SA-EXEC-207`.
- Context authority: `SA-CTX-020` through `SA-CTX-047` for facts and read tools, and `SA-CTX-100` through `SA-CTX-126` for fallback boundaries.
- Ledger and rollback authority: `SA-LED-020` through `SA-LED-055`, `SA-LED-070` through `SA-LED-120`, and `SA-LED-140` through `SA-LED-146`.
- Product stance: [plan-everything](../anti-patterns/plan-everything.md), [unsafe-magic](../anti-patterns/unsafe-magic.md), and the north-star's agent-responsive design framing in [§3](../../Steerable-Protocol-NorthStar.md#3-thesis-the-missing-layer), rollback-confidence principle in [§4](../../Steerable-Protocol-NorthStar.md#4-design-principles), and framework/developer split in [§6.4](../../Steerable-Protocol-NorthStar.md#64-what-the-framework-decides-vs-what-the-developer-decides).

## Design From Declarations

Start a greenfield feature by drafting the declarations before, or at the same time as, the UI. The point is not to produce ceremony first. The point is to force the product team to name the user-meaningful outcomes the app is willing to perform through trusted app-owned executors.

For each candidate action, write this design note before implementation:

| Field | Design question | Authority |
|---|---|---|
| Outcome | What single result would the user recognize as having happened? | `SA-DECL-030`, `SA-DECL-033` |
| Parameters | What structured inputs does that result need? | `SA-DECL-016` through `SA-DECL-018`, `SA-DECL-035` |
| State | Which product state does it read and write? | `SA-DECL-019`, `SA-DECL-020`, `SA-DECL-036`, `SA-DECL-037` |
| Executor | Which trusted app-owned command, setter, endpoint, or handler owns the work? | `SA-DECL-031`, `SA-DECL-046`, `SA-EXEC-001`, `SA-EXEC-002` |
| Policy metadata | Which declared policy metadata explains the action's nature? | `SA-DECL-038` through `SA-DECL-044`, `SA-POL-020` through `SA-POL-048` |
| Recovery | What undo or snapshot path can the runtime actually execute? | `SA-DECL-049` through `SA-DECL-053`, `SA-LED-070` through `SA-LED-120` |
| Guidance | When should an agent choose this action instead of a neighbor? | `SA-DECL-047`, `SA-DECL-048`, `SA-DECL-105` |

The one-user-meaningful-outcome discipline changes feature shape. In Design Studio, `palette.set_color` changes one token, `palette.apply_preset` replaces a palette, and `template.apply_template` applies a whole starting direction. Those are separate actions because their parameters, state footprint, undo mechanism, and agent guidance differ. A single "edit design" action would blur the policy entry, hide the rollback mechanism, and make evaluation fixtures less useful.

When one implementation path can do several materially different things, treat that as a design smell. Split the user outcomes or narrow the parameters until the action can carry honest metadata under `SA-POL-020` through `SA-POL-034`. If the product intentionally keeps a broad action, the higher-risk classification follows from the policy authority; do not bury that difference in UI copy.

## Shape The Feature Around Natural Surfaces

A surface is a product boundary that changes what an agent can see or do. It may be a route, view, mode, panel, object workspace, or access point; the developer chooses the product boundary while the framework owns the declaration and runtime semantics (`SA-DECL-080` through `SA-DECL-087`, `SA-DECL-127`, `SA-EXEC-247`).

Use a declared surface when at least one of these is true:

- The live action/read/facts set changes.
- The user would describe the area as a different working context.
- A cross-surface chain needs to navigate there and wait for capabilities before continuing.
- Context that is safe and useful on one surface would be noisy, private, or misleading on another.

Do not create a surface merely because a component exists. Component names, DOM selectors, and route paths are implementation details unless they resolve to declared surface IDs under `SA-EXEC-160` through `SA-EXEC-162`.

Design Studio has three useful surfaces: `editor`, `templates`, and `settings`. The chain "apply the SaaS launch template and make the accent forest green" is not an open-ended browser-agent task. It is a known ordered chain: `template.apply_template`, then `surface.navigate_surface`, then wait for `editor`, then `palette.set_color`. That shape works because surface identity, navigation, destination readiness, failure, and preserved prefix undo are designed up front around `SA-EXEC-160` through `SA-EXEC-179`.

## Treat Facts As Public API

Facts are the surface's first context contract. Design them the way you would design a small public API: stable names, typed values, bounded scope, and enough meaning for an agent to route common intents without scraping the UI.

For each surface, draft a facts table with three columns:

| Fact key | Why an agent needs it | When it changes |
|---|---|---|
| `policy.posture` | Explain current posture-dependent behavior and route posture-change requests. | User changes posture. |
| `quota.exports_remaining` | Decide whether to answer, read more, or propose an export action. | Export quota changes. |
| `design.palette.summary` | Route color edits and answer common palette questions. | Palette changes. |

Keep the fact set curated under `SA-DECL-070` through `SA-DECL-078` and `SA-CTX-020` through `SA-CTX-030`. If a value is too large, parameter-dependent, sparse, or private for facts, design a read tool under `SA-DECL-060` through `SA-DECL-069` and `SA-CTX-040` through `SA-CTX-047`. Design Studio does this with `template.list_available` and `quota.get_status`.

Useful fact-design tests:

- Can an agent answer common "where am I / what is selected / what state matters" questions from facts alone?
- Does every fact have a likely routing, policy, answer, or evaluation use?
- Is any fact trying to be a DOM dump, object graph, screenshot transcript, or hidden framework state? If yes, redesign it under `SA-CTX-027`.
- Would a human reviewer treat the fact key as product vocabulary rather than implementation vocabulary?
- If the fact is withheld for privacy, is there a deliberate clarification, refusal, hand-off, or read-tool path instead of lower-rung guessing?

## Budget For Reversibility

Rollback confidence is a feature-design constraint, not cleanup after implementation. The north-star's "confirm-friction converts into rollback-confidence" principle means the product earns fast execution by making recovery real. The relevant authorities are `SA-POL-040` through `SA-POL-048`, `SA-DECL-049` through `SA-DECL-053`, and `SA-LED-070` through `SA-LED-120`.

Design the rollback mechanism while designing the action:

| Design Studio action | Recovery design lesson |
|---|---|
| `palette.set_color` | A small action can carry the previous token value and use a declared inverse. |
| `template.apply_template` | A wide local state change can be fast if the runtime captures the right snapshot before mutation. |
| `project.export_project` | Quota spend has no honest undo in the example, so the policy boundary carries that cost. |
| `project.reset_project` | Snapshot recovery helps, but the action is still domain-significant enough to present as destructive. |

When a feature feels like it needs repeated confirmation, first ask whether state shape is making undo expensive. Common greenfield fixes are smaller action boundaries, explicit previous-value capture, state snapshots at natural aggregate roots, soft-delete windows with recorded expiration, and activity records that can show partial undo honestly. If none of those can be made true, keep the action honest and let policy resolve the friction.

## Design Review Checklist

Use this checklist against a feature spec before implementation. The input is a feature brief, wireframe, or product requirements note. The output is a pass/fail review with cited action IDs, surface IDs, fact keys, and open questions.

### 1. Can An Agent See It?

1. Name the surface or surfaces where the feature is live.
2. List the facts that expose current state needed for common routing and answers.
3. List any read tools needed for parameterized or detailed lookup.
4. Mark any context that must be withheld, redacted, or forbidden.

Pass when the agent can satisfy ordinary information needs with facts or read tools before DOM or vision fallback, and every fallback need is a deliberate product decision under `SA-CTX-001` through `SA-CTX-126`.

### 2. Can An Agent Act On It?

1. List each user-meaningful outcome as a candidate action.
2. For each action, write the proposed ID, params, reads, writes, preconditions, executor owner, guidance, and one example.
3. Reject any action whose params are a flattened natural-language string hiding distinct fields.
4. Reject any action whose executor would be controlled by the model rather than trusted app-owned code.

Pass when every mutation, navigation, side effect, remote write, and destructive operation has a declaration-shaped home under `SA-DECL-030` through `SA-DECL-053` and an execution path under `SA-EXEC-001` through `SA-EXEC-012`.

### 3. Can It Cross Surfaces Without Guessing?

1. For every multi-surface request, list the ordered action chain.
2. Identify any navigation action or app-owned transition mechanism.
3. Identify the destination surface ID and the capability that must be available before continuation.
4. Write the user-visible failure and retry outcome for a destination-readiness timeout.

Pass when cross-surface continuation can be described with declared surface IDs and capability readiness under `SA-EXEC-160` through `SA-EXEC-179`, without treating DOM state as the authority.

### 4. Can The Runtime Undo It?

1. For each action, write the recovery mechanism: declared inverse, runtime snapshot, soft-delete restore, compensating action, partial recovery, or honest no-undo.
2. Identify what data the ledger must preserve for the recovery path.
3. For chains, identify which prefix can be undone together and which steps cannot be represented as undone.
4. If recovery is partial, write the disclosure users will see.

Pass when every reversible claim has an executable app-owned or runtime-owned mechanism under `SA-LED-070` through `SA-LED-120`, and no irreversible step is hidden behind "undo all" language.

### 5. Is The Risk Class Obvious?

1. For each action, point to the evidence used for classification: state writes, external effects, quota or money, sensitive data, deletion or overwrite paths, and recovery mechanism.
2. Cite the applicable risk and reversibility authority from `SA-POL-020` through `SA-POL-048`.
3. If two classifications remain plausible, split or narrow the action; if that is deferred, record the higher-risk assumption.
4. Cross-link the future risk walkthrough in [retrofit-existing-app.md](./retrofit-existing-app.md) when the work becomes discovery in an existing codebase.

Pass when a reviewer can predict policy resolution from declaration metadata and cited policy IDs, without reading UI copy or prompt text.

### 6. Is The Policy Boundary Product-Shaped?

1. Pick the closest posture preset from `SA-POL-140` through `SA-POL-172`.
2. List any per-action, per-role, or per-surface overrides and the product reason for each.
3. Check that clean safe reversible actions are not gated by template default.
4. Check that destructive, sensitive, cost, external, and confirmation boundaries are visible in activity or gates when policy resolves them there.

Pass when the policy shape follows the app's domain rather than a plan-everything or unsafe-magic reflex.

### 7. Is The Outcome Inspectable?

1. List the visible activity states the feature can produce.
2. Confirm that held suffixes, plan previews, cross-surface waits, failures, skips, declines, and undo states have user-visible representations.
3. Confirm that each policy decision and action attempt can be recorded with action IDs, params or redacted references, statuses, rationale, errors, and undo handles.

Pass when the feature can explain what happened and what can still be undone using `SA-EXEC-200` through `SA-EXEC-207` and `SA-LED-020` through `SA-LED-055`.

## Framework / Developer Boundary Audit

This guide was checked against the north-star [§6.4](../../Steerable-Protocol-NorthStar.md#64-what-the-framework-decides-vs-what-the-developer-decides) and the spec boundary tables (`SA-DECL-120` through `SA-DECL-137`, `SA-POL-180` through `SA-POL-190`, `SA-EXEC-240` through `SA-EXEC-250`, `SA-CTX-140` through `SA-CTX-149`, `SA-LED-160` through `SA-LED-168`).

Audit changes made while drafting:

- Reworded surface guidance from "make each route a surface" to product-boundary criteria, because the developer decides which views count as surfaces.
- Moved posture selection and override detail to [policy-templates.md](./policy-templates.md), because the framework defines policy vocabulary and presets while developers choose product posture.
- Kept risk classification as cited evidence and a placeholder cross-link to [retrofit-existing-app.md](./retrofit-existing-app.md), rather than writing a discovery procedure here.
- Replaced any "confirm before risky work" phrasing with rollback-first design plus policy-resolution citations, preserving the anti-pattern stance from [plan-everything](../anti-patterns/plan-everything.md).
