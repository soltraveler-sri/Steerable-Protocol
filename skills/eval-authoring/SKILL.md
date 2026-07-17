---
name: eval-authoring
description: Author deterministic Steerable eval fixtures for a target integration by deriving cases from its capability registry, validating them against the eval schemas, running them through the target adapter, and emitting coverage plus duplicate-avoidance summaries.
---

# Eval Authoring

Use this skill when a Steerable integration needs executable eval fixtures for intent routing, policy decisions, reversibility, and cross-surface execution.

## Ground Rules

- Make zero model or product API calls in the deterministic suite. Fixture authoring, validation, and execution must be local and deterministic. This rule is correct and not waivable. It is also not the definition of done: see `What A Green Suite Does Not Prove` and `Live Smoke Tier` below.
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
5. `skills/integration-audit/references/live-pass.md` before reporting a suite as done, so the live smoke tier below is run and reported as the `LP-5` it is.

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

Coverage here is coverage of the deterministic suite. It is not a conformance verdict, and it is not the last word on done.

## What A Green Suite Does Not Prove

Report this suite's result as the narrow thing it is. A green fixture run proves the target adapter reproduces the expected route, policy, execution, and undo records for these fixtures under deterministic inputs. Say that. It does not prove:

- that a live model produces the routed `{actionId, params}` the fixtures assume — a fixture supplies the route rather than earning it;
- that the registry's declared IDs and schemas survive a provider's wire format, tool-name grammar, or grammar compiler;
- that published facts describe the real surface rather than schema-valid literals that happen to parse;
- that any surface of the running product loads at all;
- that the datastore write lands, or that undo reverses it against a real store.

**Never report "evals pass" as evidence that steering works.** A real adopter self-certified `minimal` conformance with 30/30 fixtures green, 501/501 tests green, and a green build, while every authenticated page threw at load and the mandated cross-surface continuation was impossible by construction. That is what a green suite is compatible with. It is a fact about the fixtures, not about the product.

## Live Smoke Tier

The deterministic suite is not the definition of done. A conformance claim additionally depends on a live smoke tier: a handful of real calls, run outside the fixture suite.

- **Keep it out of the deterministic suite.** Do not add model or product calls to any fixture, adapter, `evals/run-fixtures.mjs` path, or `npm --prefix evals run evals`. Do not commit it as a fixture and do not run it in CI as one. The zero-call rule is unchanged and stays correct.
- **Bound it.** One to three live model-routed requests total. If the first succeeds, stop. A second only separates a transient network failure from a contract failure. Never sweep utterances, never re-run coverage cells against a live provider, never loop. This is a smoke check, not a suite. Confirm with the human before any run that exceeds three live requests.
- **Derive the utterance from the registry**, exactly as a fixture is derived: one declared example for an action whose params are non-empty.
- **Assert the wire contract, not model quality.** The request returns without a provider error; the routed action ID exists in the registry; params are populated and validate against that action's strict schema.
- **Empty params on a `200` is a failure.** It is the silent one, and no fixture can see it.
- **Record:** model ID, the provider's response identifier or usage block, the routed `{actionId, params}`, and verbatim provider error text on failure.
- **Scope:** this tier is `LP-5` of `skills/integration-audit/references/live-pass.md` and nothing more. Running it does not satisfy `LP-1` through `LP-4`; the full gate lives in that skill.
- **If no live call can be made** — no key, no provider access, no budget authorization — report the tier `Inconclusive` and name what is missing. Do not simulate it, do not stub the provider and call the result live, and do not report the deterministic suite as covering it. An honest `Inconclusive` is the correct result; it blocks a conformance claim, which is what it should do.

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
- live smoke tier result: model ID, provider response identifier, routed `{actionId, params}`, and pass/fail — or `Inconclusive` with the missing prerequisite;
- the suite's claim stated narrowly, never as "steering works";
- bugs exposed, if any.
