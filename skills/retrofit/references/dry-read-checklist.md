# Retrofit Dry-Read Checklist

Run this before declaring the skill-driven task done or before handing the work to a fresh agent.

## Skill Procedure Check

- Can a fresh agent identify the six phases and the abort condition for each?
- Can it name which source is authoritative when `skills/retrofit/SKILL.md` and `docs/guides/retrofit-existing-app.md` disagree?
- Can it produce the stop-before-code packet without reading hidden conversation context?
- Can it explain how to handle `existing_integration_state: absent`, `partial`, and `complete`?
- Can it identify the runtime-availability guidance and the Design Studio proto-runtime no-copy rule?
- Can it state the first-slice hard limits and what to do when the approved scope exceeds them?
- Can it locate a non-colocated target path by explicit request, conservative repo-root heuristics, or human question, without guessing?
- Can it establish the authoritative remote/branch, run the sync check, and name the exact unsafe-sync abort?
- Can it distinguish whole-packet approval, partial approval, ambiguity, and silence?

## Rule Text Check

- Scan the skill and references for copied spec/checklist rule text beyond IDs, short labels, table headings, and evidence shapes.
- Replace duplicated rule detail with citations to `docs/spec/conformance-checklist.md`, `docs/guides/retrofit-existing-app.md`, or the relevant spec file.
- Confirm policy guidance does not introduce a global review default for clean safe reversible work.

## Phase Walk

1. Ground: sources, target path, authoritative branch, sync state, and target constraints are identified.
2. Inventory: all tables can be filled from file-backed evidence.
3. Fit: `fits`, `partial fit`, and `does not fit` each have a clear return path.
4. Plan: the mandatory stop is unavoidable before code.
5. Execute: implementation guidance is by invariants and target idiom, not reference-code copy.
6. Verify: `integration-audit` and `eval-authoring` are mandatory, Phase 6 authorizes confirmed in-scope audit fixes, a fresh target adapter is present for eval execution, and failures are fixed, filed, or reported.

## Acceptance Check

- `SKILL.md` has only `name` and `description` frontmatter fields.
- Supporting files are referenced from `SKILL.md` and load only when needed.
- The audit skill's fix-ready finding fields are consumed directly.
- Phase 6 is explicit that retrofit supplies the separate ask for fixing confirmed in-scope blockers from report-only audit findings.
- Eval-authoring is mandatory, not optional polish; the definition-of-done step is the integration-audit live pass, and a green fixture run is not a conformance verdict.
- Fresh targets implement the `evals/README.md#target-adapter-interface` contract without changing `evals/run-fixtures.mjs`.
- Final reporting forbids unearned minimal conformance claims.
