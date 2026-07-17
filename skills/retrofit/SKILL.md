---
name: retrofit
description: Retrofit an existing product app with a Steerable integration. Use when an agent is pointed at this Steerable repo plus a target app and asked to inventory fit, produce the stop-before-code plan mapped to SA-CONF, execute the approved slice in the target app's own idiom, and self-verify with integration-audit plus eval-authoring. Defaults to a review-gated minimal first slice; supports an explicitly authorized full-build mode for pre-production targets.
---

# Retrofit

Use this skill as the Stage 1 front door for an existing app. It distills `docs/guides/retrofit-existing-app.md` into an executable agent workflow. If this skill and that guide diverge, the guide is authoritative; fix the skill, not the guide.

Runtime availability: `@steerable/core` and `@steerable/react` live in this repo's `packages/` — working and tested, not yet published to npm. Prefer consuming them (vendor the package directories, or npm once published); hand-roll the minimal contracts per spec only when that does not fit the target's stack. Either way the contracts are: declarations/registry, policy check before every action execution, trusted executor discipline, visible activity, session-level ledger, and honest undo/no-undo. Read `examples/design-studio/src/steerable/README.md` before inspecting example code; the example's local files are app-owned wiring, not a copyable runtime.

## Load Order

Read only what the phase needs, but preserve this authority order:

1. User work order, target scope, and target app docs/tests.
2. Process authority: `docs/guides/retrofit-existing-app.md` and `docs/guides/coding-agent-handoff.md`.
3. Spec orientation: `docs/spec/steerable-apps.md`, then `docs/spec/capability-declarations.md`, `docs/spec/autonomy-policy.md`, and `docs/spec/conformance-checklist.md`.
4. Guardrails before plan/posture choices: `docs/guides/designing-agent-responsive-features.md` and `docs/guides/policy-templates.md`.
5. Example-integration notice before example code: `examples/design-studio/src/steerable/README.md` (the example consumes `@steerable/core`/`@steerable/react`; its remaining local files are app-owned declarations and wiring, not a copyable runtime).
6. Verification sub-procedures only when Phase 6 starts: `skills/integration-audit/SKILL.md` and `skills/eval-authoring/SKILL.md`.

For detailed execution, context, ledger, or bridge questions, follow the `SA-CONF-*` row to the cited spec file instead of restating the rule locally.

## Hard Limits

Keep the first integration demonstrable, not complete:

- One product surface first; add one adjacent surface only to prove a required cross-surface path.
- One facts declaration per chosen surface, normally with a dozen or fewer top-level facts.
- One to three read tools.
- One to three safe reversible actions.
- Exactly one higher-friction action that exercises policy, held state, ledger, and undo/no-undo truth.
- No more than eight new action declarations before returning for review. If an existing Steerable-like layer already has more, audit or repair a representative slice capped at twelve actions and file the rest.

Do not implement door two, a provider adapter, a generic SDK extraction, a tool-loop workflow engine, durable audit storage beyond the approved scope, DOM/vision-first context, or a platform rewrite in the first slice. Do not globally add review ceremony to clean safe reversible actions; choose posture from policy evidence.

## Full-Build Mode (Pre-Production Targets)

The hard limits and the Phase-4 stop exist to keep changes to a **live product** reviewable. For a **pre-production target** — unshipped, low iteration cost — the human may lift them by stating both facts explicitly in the work order (e.g. "This app is pre-production and unshipped. Full-build mode: authorized — proceed through implementation without stopping for interim review.").

When (and only when) that authorization is present:

- The first-slice caps above are lifted. Scope becomes judgment-driven fit coverage: implement the aspects of the protocol that fit this product well, and exclude poor fits with stated reasons in the design document. Coverage is an outcome of fit judgment, never a quota.
- The Phase-4 stop converts from a gate into a record: still produce the full design document **before** implementing (it is the plan of record and the reviewer's audit trail), but the work-order authorization stands as approval — do not wait.
- Everything else is unchanged and never waivable: the fit assessment may still conclude `does not fit` or `partial fit`; every conformance guardrail holds (mutation only via trusted executors, one declaration source of truth, no review ceremony on clean safe reversible actions, executable undo or honest no-undo); Phase-6 self-verification (integration-audit + eval-authoring) remains mandatory before declaring done; all abort criteria remain in force.

Default remains the review-gated flow. A deployed or user-facing product should not use full-build mode; the iterative review is what protects it.

## Six Phases

### 1. Ground

Establish the target path, requested scope, branch/sync constraints, validation commands, and whether the task is plan-only or already has an approved packet. Read the process/spec files above at the granularity needed for the next decision. Record that the retrofit guide is authoritative on divergence.

Locate the target path before inventory. Use an explicit path in the user's request first. If none is given and the target is not colocated, try only conservative repo-root heuristics: current working directory, a named sibling worktree/repo, or a target package/app directory that matches the work order and has its own manifest/docs/tests. If those do not identify one target, ask the human; never guess or inspect broad unrelated directories as the target.

Establish branch/sync constraints for the Steerable repo and the target repo if separate. The authoritative remote/branch is the one the user names; otherwise use the current branch's upstream; otherwise use `origin/HEAD` or `origin/main` only if the repo makes that unambiguous. Run `git status --short --branch`, `git remote -v`, `git branch -vv`, `git fetch --prune <remote>` when Git writes are allowed, then `git rev-parse HEAD`, `git rev-parse <remote>/<branch>`, and `git merge-base --is-ancestor <remote>/<branch> HEAD`. If fetching is blocked, use `git ls-remote --symref <remote> HEAD` and `git ls-remote --heads <remote> <branch>` and report that sync was checked by remote comparison only.

Safe to proceed means the local work branch contains the authoritative ref, scoped local changes are either absent or explicitly accepted as existing work, and no user/parallel-agent scope fence is crossed. If the branch is behind, diverged, or the authoritative ref cannot be established, abort with: `Repo sync is unsafe to start: <remote>/<branch> at <sha-or-unknown>, local <branch> at <sha>, state <behind|diverged|unverified>. Catch up or choose an explicit branch before retrofit edits.`

Abort if required Steerable authority docs are missing, the target app cannot be located or read, the user forbids the needed read-only inspection, or repo sync/scope constraints make the work unsafe to start.

### 2. Inventory

Run the read-only discovery procedure in `docs/guides/retrofit-existing-app.md#inventory-procedure`, including its risk-classification walkthrough for every candidate action. Package the handoff inventory using `references/review-packet-template.md`: product skeleton, candidate actions, facts, read tools, risky operations, undo/history, surfaces, existing assistant/tool layers, validation seams, and evidence paths. Track `existing_integration_state` as `absent`, `partial`, or `complete`; an existing layer is evidence to converge or repair, not permission to rewrite broadly.

Answer these runtime-architecture questions in the same inventory, before any declaration is designed. They are cheap now and expensive to reverse once declarations exist, and none of them is answered by the capability inventory:

- **Where does the chat turn run?** Client, server, edge, worker. Which process calls the model, and which one holds the registry it derives tool schemas from.
- **Where does the session host mount?** Name the component, layout, or scope that owns the panel, the activity trail, pending continuations, and undo scope — and verify it encloses the app's navigable region. A host mounted inside a per-page shell is unmade by every route change, which makes `SA-CONF-066` unsatisfiable by construction while it still reads clean statically. `SA-EXEC-180` and `SA-CONF-099` are the contract.
- **Is the ledger durable, and does undo survive the round trip?** Session memory, browser storage, or a real store. If handles must serialize, they cannot be closures. `SA-CONF-073`, `SA-CONF-079`.
- **How is the registry scoped?** Per request, per user, per session, or one process-wide singleton. A mutable singleton on a server makes one user's surface liveness visible to another's concurrent request and corrupts the `SA-POL-105` availability input.
- **Where do terminal errors land?** Name each steering process's operator diagnostic stream. `SA-CONF-104`.

Record each answer with evidence in the review packet. An unanswered question is an open question for Phase 4, not an assumption.

Abort if the inventory cannot produce reproducible evidence under `SA-CONF-005` and `SA-CONF-098`, if the target cannot run or be inspected enough to validate the claimed scope, or if the only mutation paths are model/DOM/external authority with no app-owned executor seam.

### 3. Fit Assessment

Return `fits`, `partial fit`, or `does not fit` using `docs/guides/retrofit-existing-app.md#fit-assessment`. Map evidence to the first applicable SA-CONF ranges: registry/declarations, policy/execution, facts/read tools, surfaces, ledger/undo, and framework/developer boundary. Use the anti-pattern notes only as probes; cite them through the checklist mapping instead of adding local rules.

Abort on `does not fit`: produce the no-go report, blocked `SA-CONF-*` items, prerequisite product work, and stop. For `partial fit`, continue only inside the named surface/module and list exclusions.

### 4. Integration Plan And Mandatory Stop

Before editing code, return the review packet from `references/review-packet-template.md`. The plan must settle the Phase-2 runtime-architecture answers first — where the chat turn runs, where the session host mounts, ledger durability and undo serializability, registry scoping, and where terminal errors land — because declarations built over the wrong answer are expensive to unwind. Then order the capability work as facts/read tools, safe reversible actions, one gated action, then posture selection. Map every step to `SA-CONF-*` self-checks, name files likely touched, validation commands, open questions, and deferred scope. End with the exact stop statement from the template and wait.

If the user says "just do it" before this packet exists, still produce the packet and stop. An unambiguous affirmative from the human on the packet as a whole is sufficient approval. Partial approval authorizes only the approved subset; execute that subset and return the rest to Phase 4. Silence, time passing, or ambiguous responses are not approval.

Abort if the plan cannot satisfy the hard limits, cannot make mutation executor-only without deep refactoring, cannot name an executable undo/snapshot or honest no-undo path, or depends on copying Design Studio example internals instead of using the packages or the spec.

### 5. Execute Approved First Integration

Implement only the approved slice in the target's own patterns. Runtime choice, in preference order: (a) consume the in-repo packages `@steerable/core` and `@steerable/react` (`packages/` in this repo — working and tested but not yet published to npm, so vendor the two package directories into the target or reference them via a git/workspace mechanism the target already uses); (b) hand-roll the minimal contracts per the spec when vendoring TypeScript packages does not fit the target's stack. Either way the contracts are the same: one registry source, strict params, bounded facts/read tools, surface liveness, policy before each invocation, trusted executors, visible activity, ledger records, and undo/no-undo records. Use `docs/guides/designing-agent-responsive-features.md` for greenfield feature shape when the target needs a small missing seam, and `docs/guides/policy-templates.md` for posture selection.

Run the policy-template contrast check before coding posture behavior: compare the chosen action set against `docs/guides/policy-templates.md#same-registry-three-products` and confirm declarations stay stable while only policy inputs change. If the implementation starts to gate clean safe reversible work by default, stop and redesign the action boundary, recovery, or posture choice.

Abort if implementation pressure expands beyond the approved scope, requires a second registry/tool layer, turns model output into execution authority, hides failures in console-only state, or needs unapproved deep refactoring.

### 6. Self-Verify, Fix Or File, Report

Run the target's agreed tests first. Then invoke `skills/integration-audit/` against the implemented scope and consume its findings directly: `id`, `severity`, `result`, `SA-CONF`, `evidence`, `fix_direction`, and `verification` are the fix queue. Integration audit is report-only unless the user separately asks for fixes; retrofit Phase 6 is that separate ask for confirmed in-scope blockers and claim-blocking inconclusive items. Fix those findings inside the approved scope; file or report out-of-scope findings without hiding them. Re-run the relevant audit checks after fixes.

Invoke `skills/eval-authoring/` for the deterministic fixture suite. The definition-of-done step is the integration-audit live pass (`skills/integration-audit/references/live-pass.md`); a green fixture run is not a conformance verdict. Add only registry-derived fixtures that fill coverage cells, validate them, run them through the target adapter or documented wrapper, re-run the duplicate scan, and report failures faithfully. For a fresh retrofit, implement the small target adapter contract from `evals/README.md#target-adapter-interface` so the runner can execute the target fixtures: `target`, `route(fixture)`, `resolve(fixture)`, `execute(fixture)`, and `undo(fixture)`, without changing `evals/run-fixtures.mjs`. Use `references/dry-read-checklist.md` before declaring done.

Abort if audit or eval tooling cannot run, if the target cannot be driven so that the live pass reports `Inconclusive` rather than `complete`, if a correct fixture exposes a product/runner bug outside the approved slice, or if a Minimal+ blocker remains. Report the blocker, commands attempted, evidence, and the next fix path. An `Inconclusive` live pass is an honest, complete outcome: report what is unproven and what would prove it; never substitute a green test, eval, or build run for it.

## Final Report

Report only after Phase 6 or an abort. Include:

- Fit verdict and `existing_integration_state`.
- Implemented scope and file changes.
- Validation commands and results.
- Audit summary with remaining finding IDs and severity.
- Eval-authoring summary with fixture IDs, coverage cells, duplicate-scan result, and runner result.
- Deferred scope and open issues.

Never claim minimal conformance unless the applicable `SA-CONF` Minimal+ MUST items pass for the stated scope **and** the integration audit reports `live_pass: complete`. A passing static read with the live pass `partial`, `not run`, or `Inconclusive` is an unproven claim, not a minimal one.
