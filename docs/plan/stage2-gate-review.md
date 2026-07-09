# Stage-2 Gate Review

**Date:** 2026-07-09  
**Issue:** #66  
**Recommendation:** PASS Stage 2.

## Verdict

PASS. D9 and D10 are met as written. The example no longer owns an inline runtime: it consumes `@steerable/core` and the thin `@steerable/react` binding, while the canonical runner remains the authority for its behavior. PR #73 recorded 22/22 example tests, 49/49 executable evals (64 fixtures validated when facts-context is included), the unchanged demo script, and workspace checks; that exceeds D9's original 47-fixture threshold. The preserved Quiet Signal retrofit also passed its external-adapter fixtures after the migration, so this was not an example-only extraction. PR #71 separately proves D10 with a zero-dependency, registry-derived adapter and mock tool-loop tests for instant allow, quota approval, and policy refusal. The browser walkthrough is supporting evidence, not locally reproduced evidence in this review: a separate verification agent ran it after merge and reported all five required flows passing with zero console errors. D8 deliberately deferred the Next binding, so this gate closes the specified core-plus-React scope rather than claiming a second framework binding.

## Authority Sources

- `docs/plan/ROADMAP.md` Stage-2 addendum D8-D12 defines the gate and its intentional deferrals.
- `docs/plan/stage1-gate-review.md` supplies the Stage-2 brief and the extraction seams it asked the runtime to preserve.
- PR #73 / commit `9e4e535` is the D9 migration evidence; PR #71 / commit `097e3d1` is the D10 compile-down evidence.
- `packages/core/README.md`, `packages/react/README.md`, and `docs/guides/ecosystem-adapters.md` state the shipped package and adapter contracts.
- Local source and test inspection, plus this review's build, workspace tests, and canonical eval run, verify the checked-out implementation. The post-merge browser walkthrough is credited to its separate verification agent.

## D9 — Extraction Proof: PASS

The Design Studio migration is a real consumer of the extracted seams, not a compatibility wrapper around a still-authoritative prototype. The app imports `@steerable/core` for declarations, policy, execution, ledger, undo, and trace extraction, and `@steerable/react` for the provider and surface lifecycle binding. Its remaining `src/steerable/` files are Design-Studio-specific declarations, scripted routing, state/snapshot adapter, UI context, and eval adapter; the inline generic registry/policy/execution/ledger/undo implementation is gone.

| D9 evidence | Result |
| --- | --- |
| Inline runtime deleted; example moved to `@steerable/core` + `@steerable/react` | Met in PR #73 and locally inspectable through the example imports and package APIs. |
| Example behavior | Met: PR #73 recorded 22/22 example tests; the preserved steering demo script still specifies the safe instant/undo, quota gate, cross-surface, cautious posture, and timeout-prefix-undo flows. |
| Canonical eval threshold | Met and exceeded: D9 named 47 fixtures; PR #73 recorded 49/49 executable evals, with 64 fixture files validated including facts-context. |
| External-adapter path | Met: the orchestrator re-ran the preserved Quiet Signal retrofit after migration and reported all of its fixtures green. The local runner still exposes its documented absolute-path external adapter interface. |
| Live UI walkthrough | Supporting post-merge evidence: a separate browser-verification agent reported all five specified flows pass and zero console errors. This review does not represent that walkthrough as a local rerun. |

The D9 rule is important here: extraction feedback was allowed to change packages, not to make the canonical example accommodate an awkward API. The resulting changes show that bar was applied.

## D10 — Ecosystem Compile-Down: PASS

`createEcosystemAdapter` derives AI-SDK-shaped `{ description, inputSchema }` tools and per-tool `toolApproval` predicates from the compiled core registry. Its `canUseTool` callback validates declared parameters, resolves the same policy inputs, returns `allow`, `needs-approval`, or `deny`, and never executes a tool. `@steerable/core` has no runtime dependencies; the adapter guide is intentionally small and explains that JSON Schema is needed for provider projection while the declaration parser remains authoritative at dispatch. The mock-loop tests cover a clean safe reversible allow, a quota-gated approval, a forced policy refusal, and unknown/invalid-tool denial. This is exactly the narrow D10 claim: teams already using an ecosystem tool loop can use the policy decision without adopting a competing chat or provider runtime.

## Extraction-Feedback Triage

| Consumer-forced change | What it established | Triage |
| --- | --- | --- |
| `ActionLedger.getRecords()` and `subscribe()` | Trail state must observe both runtime-dispatched and externally written durable-ledger records; a parallel React-only read model would diverge. | Kept in core. |
| Registry live-surface queries | The React route lifecycle needs a framework-neutral readiness/availability contract for cross-surface work. | Kept in core; React only registers actual mounted surfaces. |
| `extractLedgerTrace()` | Canonical eval adapters need a portable, redaction-aware ledger projection rather than app-private trace parsing. | Kept in core. |
| Core snapshot capture before reversible writes | Evals caught a real behavior divergence: snapshot undo must capture before the write, not rely on host timing afterward. | Fixed in core and covered by execution tests. |
| JSON-Schema smoke test | Provider-shaped output needs a serializable schema while strict declaration parsing remains the dispatch authority. | Kept as optional declaration metadata and exercised by D10. |

These are extraction feedback, not scope creep: each was required by a real consumer, repaired the package boundary, and left product UI, routing, storage, and approval presentation app-owned.

## §14.1 Portability Verdict

Stage 2 now supports the narrowed claim that Steerable is a steering layer for React apps with a framework-agnostic core. The core is free of React, DOM, router, and provider dependencies and documents three host seams—`SurfaceReadiness` for cross-surface liveness, `StateSnapshotAdapter` for app-owned reversible state, and `ApprovalHook` for product-owned consent—while `@steerable/react` only connects those contracts to mount/unmount lifecycle, facts publication, and event-driven state. The Design Studio migration demonstrates that the React binding is thin enough to keep routing out of the core, but one React/Vite consumer is not proof of full framework portability. A second binding must still show that these seams transfer without redesign; until then, “framework-agnostic core” is evidence-backed and “framework-agnostic runtime across applications” is not.

## Stage-3 Readiness: Door Two

Door two is materially prepared but not implemented. The registry already preserves materialized `externalExposure` metadata, and the normative `SA-BRIDGE` contract already requires one-registry generation, same-policy enforcement, declared-schema fidelity, and fail-closed behavior. That makes a Stage-3 bridge generation work rather than a declaration redesign.

What remains is intentionally substantial: an MCP generator and reversible tool-name mapping; deployment publication and authorization; external identity/session binding; live-tab/session routing; trusted invocation/result transport; external facts/context rules; host compatibility and consent UX; and end-to-end fail-closed tests for unavailable sessions, ineligible capabilities, denied policy, and execution failures. The D10 adapter is a provider-loop compile-down, not an MCP server or tab bridge, and must not be presented as either.

## Caveats and Follow-Ups

- The browser walkthrough was performed by a separate verification agent post-merge; this review reports that result as provided evidence and does not collapse it into the local test evidence.
- A new issue filed today tracks the failure-path toast copy, `Chain complete.` It is a wording defect after a legible timeout disclosure and prefix undo path, not a D9/D10 gate failure.
- Direct example development needs the workspace packages compiled first. The root README now says to run `npx tsc -b` before the example dev server.
- Constructor-only registry and external durable-ledger ergonomics remain the Stage-3 portability feedback recorded by #63. They do not invalidate the current React binding, but they are the next package-boundary questions to test.

## Verification Recorded for This Review

Using `npm_config_cache=${TMPDIR:-/tmp}/npm-cache-66`, the local battery passed: `npm run build`; `npm run test` (core 21/21, React 4/4, Design Studio 22/22); and the canonical runner (23 intent-routing + 14 policy-decisions + 6 reversibility + 4 cross-surface + 2 facts-context = 49/49 executable fixtures, after 64 fixture files validated). An external-adapter self-test also passed by loading a temporary Design Studio adapter bundle through the runner's documented `--adapter` path and running the same 49/49 suite. All of these checks are deterministic and make no model or provider calls.
