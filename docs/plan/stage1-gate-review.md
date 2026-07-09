# Stage-1 gate review

**Date:** 2026-07-09  
**Issue:** #26  
**Recommendation:** PASS Stage 1 on the #24 re-run.

## Verdict

PASS on re-run. The frozen #24 rubric produced an honest ITERATE on first pass because B4 failed: the target agent authored local fixtures and a local probe, but the canonical Steerable runner could not load an external target adapter. That failure was filed as #53, fixed by PR #54, and re-run through the same canonical path with 11/11 unquarantined fixtures green. Under the predeclared verdict mapping, all Part A and Part B MUSTs were then met, and Part C preserved the no-coaching constraint. The first-pass ITERATE remains part of the evidence, not something to smooth over; it proves the gate caught a real kit defect before Stage 2.

## Authority Sources

- North-star §10 defines the Stage-1 gate: a coding agent retrofits at least one unrelated app to a credible first integration using the docs alone.
- `docs/plan/stage1-gate-dryrun-rubric.md` froze the operational rubric before the target-agent run.
- `docs/plan/stage1-gate-dryrun.md` records the #24 evidence: ITERATE on first pass, PASS after the #53/#54 fix and canonical-runner re-run.
- `docs/research/landscape-2026.md` supplies the date-aware landscape verification for north-star §15 anchors.
- `docs/plan/ROADMAP.md` and `docs/plan/GROUNDING.md` define the Stage-1 scope and guardrails.

## Gate Assessment

The dry-run target was Quiet Signal, an unrelated MIT React/TypeScript/Vite local-first app with real settings, privacy, backup/export, and destructive/data-management surfaces. That was a credible gate target because it avoided backend noise while still exercising bounded context, safe reversible actions, sensitive side effects, policy gating, ledger records, and eval fixtures.

The assessment below uses only the frozen #24 rubric.

| Rubric area | Result | Gate-review read |
|---|---|---|
| Part A: credible integration plan | PASS | A1-A6 all passed. The plan found no existing Steerable layer, chose a narrow Settings/Data first slice, inventoried 16-17/20 obvious candidate actions against the predeclared >=80% bar, used defensible risk classifications, followed minimal-first sequencing, asked genuine checkpoint questions, and stopped before code. |
| Part B: competent first integration | FAIL -> PASS | B1-B3 and B5 passed on first implementation; B6 was not met but was a SHOULD. B4 failed first because the canonical runner could not load an external target adapter, then passed after #53 was fixed by PR #54 and the canonical re-run reported `intent-routing` 6/6, `policy-decisions` 3/3, `reversibility` 2/2. |
| Part C: process integrity | PASS | Human input stayed within the single packet approval. There was no coaching and no doc-answerable question. The run recorded misses and filed #53 and #55. |

Secondary signal is not yet visible. The repository was created on 2026-07-08 and currently shows no public stars, forks, watchers, or external-use signal. That is not a PASS prerequisite under the gate wording; it is simply too early to claim external pull.

## Findings Consolidation

| Finding | Source | Triage | Review decision |
|---|---|---|---|
| External target adapter runner defect | #53, PR #54, dry-run B4 | Fixed | This was the first-pass gate miss. PR #54 added external adapter/fixture loading, and the re-run passed 11/11 canonical fixtures. It does not require a north-star edit. |
| `SA-DECL-012` vs. `SA-DECL-022` surface-ID tension | #41, `SA-CONF-021` | Needs spec-doc fix | Contract-level grammar ambiguity. Keep in spec docs; no north-star principle changed. |
| `SA-DECL-013` established-product-command exception not machine-checkable | #41, `SA-CONF-010` | Needs spec-doc fix | Contract/checklist ambiguity. Keep in spec docs; no north-star principle changed. |
| `SA-POL` effect-floor `applied` rationale ambiguity | #41, `SA-CONF-036` | Needs spec-doc fix | Contract-level policy rationale semantics. Keep in spec docs; no north-star principle changed. |
| No OR-style surface precondition grammar | `SA-CONF-022`; grouped under #41 pending clarifications | Needs spec-doc fix | Contract-level precondition grammar gap. It affects conformance checkability, not the north-star position. |
| External-target `ajv` dependency-resolution papercut | #55 | Needs kit/spec-doc fix | Minor eval-kit usability issue. It did not block the re-run; fix in eval runner docs or dependency handling, not the north-star. |
| No first-class facts/read-tools fixture kind | #55 | Needs kit/spec-doc fix | Minor fixture-format gap. Current intent-routing-style representation was enough for the gate; improve in eval docs/schema later. |
| MCP Apps release-status wording | `docs/research/landscape-2026.md` §15 anchors | Rises to north-star edit | The north-star should distinguish live MCP Apps materials from the scheduled 2026-07-28 core-spec release. |
| OSWorld/live-web/OSWorld-Human benchmark wording | `docs/research/landscape-2026.md` §15 anchors | Rises to north-star edit | The strategic claim holds, but the exact benchmark anchors need date-aware phrasing: OSWorld-Verified is ~83.6%, the ~61% live-web row is older, and OSWorld-Human v2 supersedes the 1.4-2.7x range with 2.7-4.3x. |
| PostHog ~34% MCP dashboard figure | `docs/research/landscape-2026.md` §15 anchors | Rises to north-star edit | PostHog MCP itself is verified; the exact percentage remains attributed rather than primary-source verified, so the north-star should say that. |
| Coding-agent retrofit quality variance now has a measured first datapoint | #24 dry-run, frozen rubric, conformance checklist | Rises to north-star edit | §14.4 asks whether coding-agent retrofits can be trusted. Stage 1 does not close the question, but it does add a narrow positive datapoint anchored by SA-CONF and the frozen rubric. |

## Open Questions Ledger

1. **Portability:** Still open. Stage 1 proved one React/Vite example and one unrelated React/Vite retrofit; the cross-surface runtime still needs Stage-2 extraction work before broader framework claims are honest.
2. **Intent-router economics:** Still largely untested beyond scripted routing. Stage 1 validated the fixture shape and deterministic seams, not live-model routing cost or model-size thresholds.
3. **Undo at the edges:** Improved. The vocabulary is now written into `SA-LED`, exercised in Design Studio, and tested in the dry-run including honest irreversible disclosure for backup/export behavior.
4. **Agent-executed integration quality variance:** First datapoint is strong but narrow. The conformance checklist plus frozen gate rubric produced a credible unaided retrofit and caught a real kit defect, but variance across target stacks remains to be measured.
5. **Absorption risk:** Position holds after date-aware re-verification. Adjacent primitives are stronger than the founding sweep assumed in places, but none verified the full product-owned registry, policy, ledger/undo, cross-surface, and agent-readable integration bundle.

## Floor Assessment

The floor is moot because the gate passes on re-run. If the verdict had been floor, the concrete implication would not be "failed project"; it would be that the repo remains maintained as documentation for Spec and as an agent-readable pattern library, without Stage-2 SDK extraction until a future gate justifies it. The review would need to freeze Stage-1 artifacts, keep spec-doc fixes alive, and stop short of productizing packages or adapters.

## Stage-2 Brief

These are inputs for a later Stage-2 planning issue, not a plan.

- Proto-runtime extraction boundaries are visible: `SurfaceReadiness` isolates router/framework surface liveness and bounded cross-surface waits; `StateSnapshotAdapter` isolates host-state capture/restore from execution; `ApprovalHook` isolates app-specific approval UI from policy and execution.
- The external-adapter runner is the eval seam. PR #54 turned third-party fixture execution into a documented adapter path (`target`, `route`, `resolve`, `execute`, `undo`) instead of a Design-Studio-only path.
- SDK priorities should follow what the dry-run needed: registry/policy/execution/ledger interfaces first; surface readiness and snapshot/approval seams early; eval adapter ergonomics before provider adapters; no door-two generation until the core action model is packaged cleanly.
- Keep the Stage-1 deferrals intact: no hosted infrastructure, no workflow-platform ambition, no MCP bridge implementation, no AG-UI/AI-SDK adapter work before the smallest durable runtime exists.

## PASS Caveats

The evidence that tempers the PASS recommendation is real:

- The first pass did not pass; B4 failed until #53 was fixed and re-run.
- The target-agent inventory missed `book.create`, `book.set-weight`, and reminder settings as actions.
- B6 was not met: no typed utterance drove a declared action in the dry-run slice.
- #41 and #55 remain open.
- There is no external-pull signal yet because the repository is days old.

None of those contradict PASS under the frozen rubric: the first-pass failure followed the predeclared ITERATE path, B6 was a SHOULD, #41/#55 are contract/kit follow-ups rather than gate blockers, and secondary signal was explicitly not required for the primary Stage-1 gate.

## Appendix: North-Star v0.2 Edit Rationale

1. **§3 MCP Apps wording:** Reframe MCP Apps as launched official-extension material with a scheduled 2026-07-28 core-spec release, not already-entered core as of 2026-07-09. Rationale: landscape date-aware verification.
2. **§3 computer-use benchmark wording:** Update the benchmark sentence so ~61% is an older live-web row, OSWorld-Verified is ~84%, and OSWorld-Human v2 reports 2.7-4.3x step overhead. Rationale: landscape date-aware verification.
3. **§3 PostHog wording:** Mark the ~34% dashboard figure as attributed rather than primary-source verified. Rationale: landscape verification found PostHog MCP docs but not the exact percentage.
4. **§14.4 ledger sentence:** Add the Stage-1 measured datapoint while keeping quality variance open. Rationale: #24 produced a strong but narrow coding-agent retrofit under SA-CONF and the frozen rubric.
5. **§15 key anchors:** Align the provenance summary with the same date-aware corrections: scheduled MCP core release, current benchmark framing, OSWorld-Human v2 step overhead, and attributed PostHog percentage.
