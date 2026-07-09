---
name: eval-authoring
description: Author deterministic Steerable eval fixtures for a target integration by deriving cases from its capability registry, validating them against the eval schemas, running them through the target adapter, and emitting coverage plus duplicate-avoidance summaries.
---

# Eval Authoring

Use this skill when a Steerable integration needs executable eval fixtures for intent routing, policy decisions, reversibility, and cross-surface execution.

## Ground Rules

- Make zero model or product API calls. Fixture authoring, validation, and execution must be local and deterministic.
- Treat `evals/README.md`, `evals/schemas/*.json`, `evals/validate-fixtures.mjs`, and `evals/run-fixtures.mjs` as the canonical fixture and runner contract.
- Treat the target integration registry as the source of truth for actions, read tools, surfaces, facts, examples, guidance, params, risk, posture, effects, and reversibility.
- Bind every fixture to the exact target `integrationId`, registry `id`, registry `version`, and registry `ref` loaded by the adapter. Do not author against a floating registry.
- Keep real executable fixtures outside `samples/`.
- Do not change schemas, the runner, target examples, or adapters while using this skill. If the dry run exposes a runner or product bug, report it with the failing fixture.

## Inputs To Read First

1. The work order or issue that asked for fixtures.
2. `evals/README.md`, all schema files under `evals/schemas/`, `evals/validate-fixtures.mjs`, `evals/run-fixtures.mjs`, and the target's existing non-sample suites.
3. The target registry declarations and adapter target metadata.
4. `docs/spec/capability-declarations.md`, especially `SA-DECL-107`, to keep fixture derivation tied to registry data.

## Authoring Procedure

1. Identify the target tuple from the adapter: `integrationId`, registry `id`, registry `version`, and registry `ref`.
2. Inventory the registry:
   - surfaces and which capabilities are live on each surface;
   - actions by risk, reversibility, effects, confirmation, params, reads, writes, guidance, and examples;
   - read tools by params, reads, guidance, and examples;
   - facts and state keys exposed by each surface;
   - shipped posture presets the integration actually exposes.
3. Scan existing non-sample fixtures before writing anything. Use `skills/eval-authoring/duplicate-avoidance-checklist.md`.
4. Derive candidate cases from the registry:
   - turn declared examples into direct intent fixtures only when they are not already covered;
   - derive sibling contrasts from guidance, such as one-token color vs full palette preset, copy update vs read-only answer, hide vs show, or metadata update vs share-link copy;
   - derive params boundary cases from strict schemas, such as enum values, empty params, required field omissions, and typed booleans;
   - derive policy cases from the action risk, reversibility, effects, confirmation, and shipped posture matrix;
   - derive reversibility cases from undoable, snapshot, and irreversible declarations plus ledger scope;
   - derive cross-surface cases from surface declarations, navigation paths, destination capability readiness, and reversible-prefix behavior.
5. Enumerate the coverage cells before selecting fixtures. Use `skills/eval-authoring/coverage-summary-template.md` as the output shape.
6. Author only fixtures that fill an uncovered cell or strengthen a weak cell with a real registry-derived contrast. Fixture count is not a goal.
7. Use normalized, schema-safe reason codes in expected disclosures and policy reason checks: lowercase ASCII snake_case from adapter output or a documented local signal. Do not invent prose-shaped reason codes.
8. Validate all fixtures with `npm --prefix evals run validate`.
9. Run all non-sample fixtures through the target adapter with `npm --prefix evals run evals -- --target=<target>`, or the repo's documented wrapper command.
10. Report outcomes faithfully. If a novel fixture fails and the fixture is correct, list the product or runner bug for issue filing instead of hiding or weakening the fixture.
11. Re-run the coverage and duplicate scan after adding fixtures. A second application of this procedure should author nothing new unless an uncovered coverage cell remains.

## Coverage Definition Of Done

A target suite is done when the coverage summary shows these cells are pinned:

- Target binding: every fixture uses the exact adapter target tuple.
- Surface coverage: every shipped surface appears in at least one relevant fixture, and every cross-surface path worth supporting has success or failure coverage.
- Intent routing: every route class the target router can emit is covered, including answer, single action, action chain, clarification, and refusal or handoff. Only require workflow-loop coverage when the target has a real loop route.
- Policy matrix: every risk level shipped by the registry is covered under every shipped posture, including effect and confirmation floors that materially change autonomy.
- Reversibility: undoable inverse, snapshot restore, irreversible refusal or disclosure, undo-all ordering, and partial undo are covered when the registry ships those mechanisms.
- Mandatory negative cases: clarification, refusal or handoff, policy denial, and undo refusal are all present.
- Params and sibling contrasts: each fixture-worthy params shape or guidance contrast has at least one direct or boundary case, without duplicating existing examples.

Stop as soon as these cells are covered. Do not add fixtures to reach a target count.

## Duplicate Avoidance

Before writing a fixture, compare the candidate against existing fixtures by:

- exact `id`;
- title and description purpose;
- target tuple;
- kind and negative case;
- route class or policy mode;
- action/read-tool sequence and params;
- surface path;
- risk, posture, reversibility, and effect cell.

If the candidate only repeats an existing cell with different wording, skip it. If it covers the same action but a new boundary, sibling contrast, posture, surface path, or negative case, record that distinction in the description.

## Required Output

At the end of a run, emit:

- validator and runner results;
- the coverage summary;
- novel fixture inventory with IDs and what each pins;
- duplicate-avoidance evidence;
- second-run result;
- bugs exposed, if any.
