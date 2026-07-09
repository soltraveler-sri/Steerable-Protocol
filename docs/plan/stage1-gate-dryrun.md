# Stage-1 gate dry-run report

**Date:** 2026-07-09  
**Issue:** #24  
**Verdict:** ITERATE on first pass; PASS after the #53/#54 kit fix and canonical-runner re-run.

This was a measurement run, not a demo. The first-pass failure is part of the signal: the target agent produced a credible plan and a competent first slice, but the eval kit could not run that slice through the canonical external-target path until the kit defect was fixed.

## Evidence Trail

- Frozen rubric: [`docs/plan/stage1-gate-dryrun-rubric.md`](./stage1-gate-dryrun-rubric.md), committed before the target-agent run at `fef4955`.
- Preserved retrofit diff: [`docs/plan/stage1-gate-dryrun-retrofit.patch`](./stage1-gate-dryrun-retrofit.patch).
- Filed kit defects: [#53](https://github.com/soltraveler-sri/Steerable-Protocol/issues/53), fixed by [PR #54](https://github.com/soltraveler-sri/Steerable-Protocol/pull/54); [#55](https://github.com/soltraveler-sri/Steerable-Protocol/issues/55).

The orchestrator-staging notes, scout notes, packet, and run reports are summarized here as evidence, but are not repo evidence paths and should not be committed as report dependencies.

## Target Selection

The scout pass compared five small permissively licensed apps with real local mutations and non-trivial risk classes:

| Candidate | Fit notes | Ranking reason |
|---|---|---|
| Quiet Signal | MIT; React/TypeScript/Vite local-first PWA; IndexedDB via Dexie; no backend; notes, quotes, books, trash, import/export, backup, and reminder/settings surfaces. | Selected. Rich mutation surface, local privacy/sensitivity, destructive flows, export side effects, and no existing AI/Steerable layer. |
| Tally | MIT; React/Vite plus Express and SQLite; categories, tallies, undo, archive/delete, JSON export, SQLite backup. | Strong runner-up, but the local API and SQLite server added extra integration noise for a Stage-1 kit measurement. |
| Expense Tracker | MIT; React/Vite localStorage finance dashboard; transaction/category CRUD and CSV export. | Good fit, but more conventional and less varied than Quiet Signal. |
| Project Planner | MIT declared in package/README; Kanban CRUD, move, import/export, clear-all. | Useful mutation surface, but weaker license due diligence and smaller domain spread. |
| Habit Harbor | MIT; localForage PWA with optional Supabase sync. | Good local-first fit, but optional sync added avoidable noise. |

Quiet Signal beat Tally because it kept the runtime local and frontend-only while still exercising the gate's hard parts: safe preference edits, sensitive local content, destructive cleanup, import/export, and backup/download side effects. That made it a cleaner measurement of the kit rather than of target infrastructure.

## Protocol

The rubric was frozen before the run and committed at `fef4955`, with PASS/ITERATE/FAIL mapping declared in advance. The runner started from fresh context with the repository, the selected target, and the verbatim coding-agent handoff prompt. The only designed human checkpoint was the Phase-4 review packet approval.

The human input at that checkpoint approved the packet and answered the packet's six questions: use the settings surface first; expose bounded counts/status facts without raw quote text; use JSON backup as the first gated action; use `sensitive-domain` posture; allow an in-memory session ledger for the slice; and add a small local fixture/probe harness because the target app had no automated tests.

There was no coaching. No doc-answerable question was asked. The agent stopped before implementation with a clean target working tree, satisfying the mandatory stop condition.

## Run Narrative

### Phase A: Plan

The agent's fit verdict was correct and scoped: Quiet Signal fits for a first integration slice, not for whole-app conformance yet. It found `existing_integration_state` absent: no Steerable registry, assistant, tool-call, MCP, OpenAPI, prompt, eval, or fixture layer.

The selected first slice was the Settings/Data surface:

- facts/read tools for settings, backup, and export status, explicitly excluding raw quote/book text;
- safe reversible preference actions for theme and daily review settings;
- one sensitive side-effect action, JSON backup download, requiring a policy gate;
- `sensitive-domain` posture while keeping clean safe preferences ungated;
- deferral of Today/Inbox quote mutations, imports, trash emptying, local-data clearing, door two, routers, model/provider adapters, and durable audit storage.

The plan mapped to the frozen rubric's minimal-first sequence: facts/read tools, safe reversible actions, one gated action, then posture selection. Open questions were real human decisions rather than filler.

The inventory score passed, but narrowly and usefully. Against the orchestrator's independent 20-item obvious-action list, the packet found 16-17 items, meeting the frozen >=16/20 threshold. The genuine misses were `book.create`, `book.set-weight`, and reminder settings as actions. These are inventory-tactic feedback, not evidence that the plan was indefensible.

### Phase B: First Implementation

The agent implemented a hand-rolled first slice in the target app. The preserved diff shows:

- a settings-scoped registry/declaration source, policy resolver, runtime, schema, visible session ledger, and Settings pilot panel;
- bounded facts and three read tools with `rawContentIncluded: false`;
- `settings.set_theme` and `settings.set_daily_review` as safe, undoable, ungated preference actions;
- `backup.download_json` as sensitive, external, irreversible, and step-gated;
- action execution through declaration -> policy -> runtime -> ledger, with separate policy and approval records;
- a local fixture/probe harness and `.gitignore` housekeeping for generated/heavy artifacts.

Self-verification passed on the first implementation pass: `npm run steerable:probe`, typecheck, lint, and build. Lint had 20 existing warnings and no errors. The build produced the existing Vite chunk-size warning; generated `dist/` was removed after the build. The agent's audit self-fixes included finite facts, explicit `externalExposure: "none"` defaults, normalized policy reason codes, and separate policy/approval ledger records.

Orchestrator inspection found no direct store access from the panel, no proto-runtime copying, no duplicated capability facts outside declarations, and no mutation path bypassing registry -> policy -> executor. Safe preference actions remained ungated under `sensitive-domain`.

The first pass failed B4 as written. The agent authored local fixtures and a local probe, but the canonical Steerable eval runner could not load external target adapters. That failure traced to kit defect #53 rather than target-agent behavior.

### Kit Fix and Re-run

Defect #53 was fixed in PR #54. After that fix, the external-target eval path was re-run through the canonical runner and passed:

- `intent-routing`: 6/6
- `policy-decisions`: 3/3
- `reversibility`: 2/2
- total: 11/11 unquarantined fixtures

The orchestrator independently verified the re-run. B4 therefore changed from FAIL on the first pass to PASS on re-run, under the frozen verdict mapping's intended ITERATE path.

Two minor eval-kit findings remain filed as #55: external-target dependency resolution still required a target-local loader for `ajv` in the read-only Steerable checkout, and facts/read-tool pins had to be represented through intent-routing-style fixtures because there is no first-class facts/read-tools fixture kind yet.

## Scored Rubric

| Item | Bar | Result | Notes |
|---|---:|---|---|
| A1 | MUST | PASS | Correct scoped fit verdict; `existing_integration_state` handled as absent. |
| A2 | MUST | PASS | 16-17/20 against the frozen >=16/20 bar. Misses: `book.create`, `book.set-weight`, reminder settings as actions. |
| A3 | MUST | PASS | Zero indefensible classifications; at most one contestable classification. |
| A4 | MUST | PASS | Minimal-first sequencing and SA-CONF mapping were preserved; scope stayed to settings/data. |
| A5 | SHOULD | PASS | Packet questions were genuine decisions for the checkpoint. |
| A6 | MUST | PASS | Agent stopped before integration code; target working tree was clean at stop. |
| B1 | MUST | PASS | Agent ran the integration-audit skill; no unresolved Minimal+ blockers remained in approved scope. |
| B2 | MUST | PASS | Orchestrator sweep found no guardrail violations: no direct panel store access, no proto-runtime copying, no duplicated facts, no bypass around registry -> policy -> executor. |
| B3 | MUST | PASS | Undoable preference actions had executable undo; backup was honestly no-undo. |
| B4 | MUST | FAIL -> PASS | First pass failed because the canonical runner could not load external target adapters (#53). After PR #54, the canonical re-run passed 11/11 fixtures. |
| B5 | SHOULD | PASS | Target typecheck/lint/build passed; lint warnings and Vite chunk warning were existing/non-blocking. |
| B6 | SHOULD | Not met | No utterance seam in this slice. Defensible because the approved packet deferred routers/model seams. |
| C1 | MUST | PASS | Human input was confined to the single packet approval; zero coaching; zero doc-answerable questions. |
| C2 | Process | PASS | This report records the stalls/misses; #53 and #55 were filed. |

## Verdict

Per the frozen mapping:

- First pass: **ITERATE**. One MUST failed, and that failure traced to a specific, fixable kit defect: external target adapter support in the canonical runner.
- Re-run: **PASS**. After #53 was fixed by PR #54, all Part A and Part B MUSTs passed.

This is the intended success shape for an honest gate run: the kit produced a good target integration, exposed a real measurement-path defect, fixed it, and then passed the same gate through the canonical path.

## Misses and Minor Findings

- Inventory tactic gap: the packet missed `book.create`, `book.set-weight`, and reminder settings as actions. The kit should nudge agents to enumerate create/update/delete per entity, nested entity weighting/metadata actions, and settings toggles/time fields as candidate actions instead of only as facts.
- B6 was not met: no typed utterance drove a declared action. This is a SHOULD miss, not a MUST failure, and it matches the approved packet's deferral of routers.
- First B4 failure was real: local probe success was not enough under the frozen rubric. The canonical runner path had to work for external target adapters.
- Eval-kit minor findings remain in #55: target-local dependency resolution friction and no first-class facts/read-tools fixture kind.

## Kit-Quality Observations

The docs and skills got several important things right:

- The target agent did not stall.
- The target agent asked zero doc-answerable questions.
- The packet stop worked: the agent did not write implementation code before approval.
- The fit verdict was honest and scoped rather than claiming whole-app conformance.
- The privacy posture was nuanced: `sensitive-domain` for the app, while clean safe preference actions stayed ungated.
- The audit loop improved the implementation before the orchestrator sweep, especially around external exposure defaults, finite fact declarations, policy reason codes, and visible policy/approval ledger records.

The main kit feedback is inventory method, not conceptual confusion. The agent understood the policy posture and execution model; it simply under-counted a few obvious app-owned actions.

## Gate Recommendation for #26

Recommendation for #26: PASS the Stage-1 gate on the re-run. The frozen north-star sentence was "a credible integration plan and a competent first integration without a human explaining anything"; on the re-run, that sentence is satisfied: Part A passed at the mandatory checkpoint, Part B passed after the external-adapter kit defect was fixed in #54, and Part C preserved the no-coaching constraint with one packet approval, zero stalls, and zero doc-answerable questions. The evidence trail is the pre-run rubric at `docs/plan/stage1-gate-dryrun-rubric.md`, the preserved retrofit diff at `docs/plan/stage1-gate-dryrun-retrofit.patch`, the filed defects #53 and #55, and the canonical-runner re-run showing 11/11 fixtures green.
