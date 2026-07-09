# Stage-1 gate dry-run — rubric (FROZEN before the run)

**Frozen:** 2026-07-09, prior to target-agent launch. Committed to the issue-24 branch before the run starts, per issue #24 decision point 2. Anchored to the conformance checklist's minimal level (SA-CONF), not invented percentages — except A2's coverage threshold, which operationalizes the north-star's "credible plan" in a measurable way and is declared here, in advance.

**Target:** Quiet Signal (github.com/ES-92/quiet-signal, MIT) — selected from a five-candidate scouted shortlist recorded in the dry-run report.

## Part A — Credible integration plan (scored on the Phase-4 review packet, at the mandatory stop)

- **A1 (MUST)** Fit verdict is correct for the target and evidence-backed (file-referenced), per the retrofit guide's fit assessment.
- **A2 (MUST)** Inventory coverage: before reading the packet, the orchestrator independently lists the target's obvious candidate actions (from its UI and README, ~10–20 items). The packet's inventory must contain ≥80% of that list. Misses are examined: an item the agent found but judged out-of-scope with stated reasoning counts as found.
- **A3 (MUST)** Risk/reversibility classifications in the planned slice are defensible under SA-POL's classification criteria: zero indefensible classifications; at most one contestable one (contestable = the orchestrator can argue either side using the criteria).
- **A4 (MUST)** The plan maps to SA-CONF items, respects the skill's over-scoping limits, and follows minimal-first sequencing (facts/read tools → safe reversible actions → exactly one gated action → posture selection with rationale).
- **A5 (SHOULD)** Open questions are genuine decisions for the human (not filler, not questions the docs answer).
- **A6 (MUST)** The agent stops at the checkpoint having written no integration code.

## Part B — Competent first integration (scored on the executed slice, after approval)

- **B1 (MUST)** The slice passes minimal conformance: the agent runs the integration-audit skill on its own work; zero unresolved Minimal+ blockers in the approved scope.
- **B2 (MUST)** Zero guardrail violations on orchestrator inspection: no ceremony defaults on clean safe+reversible actions; no mutation path bypassing registry→policy→executor; no proto-runtime copying; no duplicated capability facts outside declarations.
- **B3 (MUST)** Reversibility is executable: what the slice claims undoable can actually be undone (test or demonstrable flow).
- **B4 (MUST)** Eval fixtures authored via the eval-authoring skill for the new integration, schema-valid, and green through a target adapter implemented per evals/README.md.
- **B5 (SHOULD)** The target app's own build/tests remain green after the retrofit.
- **B6 (SHOULD)** End-to-end demonstrability: a typed utterance drives at least one declared action through the integration with zero model API calls (scripted/deterministic seam acceptable, mirroring the reference example).

## Part C — Process integrity

- **C1 (MUST)** No coaching: human input confined to the single checkpoint approval (wording: approval of the packet as a whole, or the minimal clarification "proceed per the docs"). Any question the agent asked that the docs should have answered is answered only with "proceed per the docs" and filed as a kit defect.
- **C2** Every stall, ambiguity, and wrong turn is recorded in the report; each kit defect becomes a tracker issue.

## Verdict mapping (declared in advance)

- **PASS** — all Part A and Part B MUSTs met.
- **ITERATE** — one or more MUSTs failed, and each failure traces to a specific, fixable kit defect (doc/skill/checklist), warranting fix-and-rerun.
- **FAIL** — failures trace to the pattern or spec itself rather than kit articulation.
- The floor outcome (work stands as documentation) is assessed separately in #26 regardless of verdict.
