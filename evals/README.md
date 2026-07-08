# Evals

This directory defines the fixture format for checking whether a Steerable integration routes intent, resolves policy, honors reversibility, and continues across declared surfaces. The format is app-agnostic: fixtures reference a target integration's compiled registry by stable action and surface IDs, but the fixture format never defines product-specific actions.

The fixture files are YAML. The schemas are JSON Schema. Validation is local and zero-API-call by design; it checks fixture shape only and does not run a router, policy engine, executor, browser, or model.

## Layout

```text
evals/
  README.md
  package.json
  validate-fixtures.mjs
  schemas/
    common.schema.json
    intent-routing.schema.json
    policy-decisions.schema.json
    reversibility.schema.json
    cross-surface.schema.json
  intent-routing/samples/*.yaml
  policy-decisions/samples/*.yaml
  reversibility/samples/*.yaml
  cross-surface/samples/*.yaml
```

Full suite authoring and runtime assertions belong to a later runner issue. This directory intentionally ships only the format, schemas, samples, and schema validator.

## Common Fields

Every fixture has these top-level fields:

| Field | Meaning |
|---|---|
| `fixtureFormatVersion` | Fixture format version. Current value: `"0.1.0"`. |
| `kind` | One of `intent-routing`, `policy-decisions`, `reversibility`, `cross-surface`. |
| `id` | Stable fixture ID, unique within the suite. |
| `title`, `description` | Human-readable fixture purpose. |
| `authoredBy`, `authoredDate` | Provenance. Dates use `YYYY-MM-DD`. |
| `target` | Registry reference for the integration under test. |
| `sample` | Marker distinguishing illustrative samples from real suite fixtures. |
| `requirementRefs` | `SA-*` requirement IDs the fixture asserts against. |
| `given` | Deterministic input state for this fixture kind. |
| `expected` | Expected route, policy, undo, or cross-surface behavior. |

### Target Registry Reference

Each fixture names both the target integration and the registry version:

```yaml
target:
  integrationId: target-app
  registry:
    id: target-app.registry
    version: "2026-07-08"
    ref: path/or/package/or/opaque-registry-ref
    digest: optional-immutable-content-digest
```

A runner must refuse to run a suite unless `target.integrationId` and `target.registry.version` match the registry it loaded. `registry.ref` locates or names the registry artifact; `digest` is optional but recommended for immutable published registries.

## Given State

Fixture state is plain JSON data. `facts`, `sessionContext`, `runtimeSignals`, `policyContext`, and `ledgerState` are objects whose keys mirror the target integration's declared fact keys, state keys, policy inputs, or ledger trace fields. Do not embed app-specific classes, functions, DOM nodes, screenshots, model transcripts, or provider traces.

The registry remains the source of action schemas, surface IDs, policy metadata, titles, descriptions, examples, and undo semantics. Fixtures may assert against registry IDs and parameter values, but they must not redefine action meaning.

## Matcher Vocabulary

Matchers are intentionally small and explicit. They are only for expected action parameters. They are not a general DSL.

| Matcher | Shape | Semantics |
|---|---|---|
| `exact` | `{ kind: exact, value: <json> }` | Candidate must deep-equal `value`. |
| `oneOf` | `{ kind: oneOf, values: [<json>, ...] }` | Candidate must deep-equal one listed value. |
| `caseInsensitive` | `{ kind: caseInsensitive, value: <string> }` | Candidate string must match under ASCII case folding. |
| `numericTolerance` | `{ kind: numericTolerance, value: <number>, tolerance: <number> }` | Candidate number must be within inclusive absolute tolerance. |
| `arrayUnordered` | `{ kind: arrayUnordered, values: [<json>, ...] }` | Candidate array must contain the same multiset of JSON values, ignoring order. |

Parameter expectations use this envelope:

```yaml
params:
  allowExtra: false
  fields:
    token:
      kind: exact
      value: accent
    hex:
      kind: caseInsensitive
      value: "#0F766E"
```

`allowExtra: false` means undeclared top-level parameters fail the fixture. `allowExtra: true` permits additional top-level parameters when a fixture intentionally checks only part of a larger parameter object. Nested values should use `exact` unless a future issue extends the vocabulary.

## Negative Cases

Every kind supports `expected.negativeCase` with this vocabulary:

```text
none
clarification
refusal
policy-denial
undo-refusal
timeout-failure
capability-unavailable
partial-undo
```

Use the kind-specific detail field to make the negative expectation first-class:

| Kind | Detail field |
|---|---|
| `intent-routing` | `expected.clarification` or `expected.refusal` |
| `policy-decisions` | `expected.denial` |
| `reversibility` | `expected.disclosure` and per-step `disclosure` |
| `cross-surface` | `expected.failure` plus failure sequence events |

## Fixture Kinds

### Intent Routing

Intent-routing fixtures assert the `SA-EXEC-020` route class contract and the structured output required by `SA-EXEC-021` through `SA-EXEC-030`.

`given` contains:

| Field | Meaning |
|---|---|
| `surfaceId` | Declared source surface ID. |
| `utterance` | User intent text. |
| `facts` | Optional plain JSON fact values available without a tool call. |
| `posturePreset` | Optional policy posture when routing can see it. |
| `sessionContext` | Optional plain JSON session context. |

`expected` contains `routeClass`, `negativeCase`, and optional `actions`, `readTools`, `answer`, `clarification`, `refusal`, or `escalationReason`. Route classes must be exactly:

```text
answer
single action
action chain
workflow needing the loop
clarification
refusal/handoff
```

Actions are expected registry IDs plus parameter matchers. Clarification fixtures must identify missing information. Refusal and policy-denial fixtures must include a disclosure with a reason code and required message fragments.

### Policy Decisions

Policy-decision fixtures assert `SA-POL-080` through `SA-POL-108`.

`given` contains `posturePreset`, `surfaceId`, optional `sessionContext`, optional `runtimeSignals`, `stickyGrants`, and a proposed `action` or `chain`. Proposed steps name registry action IDs and JSON params; policy metadata is read from the target registry, not copied into the fixture.

Resolved modes must be exactly:

```text
Read-only
Instant execution
Optimistic chain
Gated suffix
Plan preview
Step-gated
Refuse / hand off
```

`expected.steps` records the resolved mode per proposed step. `expected.chainMode` records the aggregate mode when the proposal is a chain. `expected.boundaries` records executed-prefix and held-suffix boundaries for `Gated suffix`. `expected.denial` records a policy denial or handoff.

### Reversibility

Reversibility fixtures assert undo behavior from `SA-LED-070` through `SA-LED-120`, including inverse undo, snapshot restore, undo-all ordering, refusal, and partial-undo disclosure.

`given.executed.steps` represents the already-recorded execution state: step ID, action ID, status, declaration reversibility kind, undo mechanism, and undo handle status. This is not a replay log; it is the minimum trace needed to evaluate the undo request.

`expected.undoOutcome` is one of:

```text
inverse-applied
snapshot-restored
undo-all-succeeded
partial-undo-with-disclosure
refused-with-disclosure
failed-with-disclosure
pending-settlement
```

`expected.order` lists the step IDs in the order undo handles must be attempted. Undo-all over a chain must use reverse execution order unless the ledger records a stricter dependency order. Full undo must not silently skip a succeeded step without an available undo handle; use `partial-undo-with-disclosure` or `refused-with-disclosure`.

### Cross Surface

Cross-surface fixtures assert `SA-EXEC-160` through `SA-EXEC-179`.

`given` contains the starting surface, ordered chain steps, target surfaces, required capabilities, and a deterministic `registrationScenario`. Surface identity is the declared surface `id`; URLs, routes, component names, DOM selectors, and visual regions are not normative identities.

`expected.sequence` is an ordered list using this event vocabulary:

```text
navigate
await-surface-registration
await-capabilities
continue
fail-timeout
fail-capability-unavailable
preserve-undo-prefix
stop-suffix
clarification
refusal
policy-denial
undo-refusal
```

The destination-readiness wait must be finite. The framework default is 5000 ms under `SA-EXEC-167` unless the integration configures another finite timeout. Timeout and capability-unavailable cases must preserve reversible prefix undo handles and mark the remaining suffix as not executed.

## Worked Authoring Walkthrough

1. Pick the kind. If the behavior is utterance classification, use `intent-routing`; if it is posture and grants, use `policy-decisions`; if it is undo, use `reversibility`; if it crosses declared surfaces, use `cross-surface`.
2. Bind the fixture to a registry. Fill `target.integrationId`, `target.registry.id`, `target.registry.version`, and `target.registry.ref`. Do not author a suite against an unspecified or floating registry.
3. Cite the contract. Add the `SA-*` IDs that make this fixture meaningful. Prefer the narrowest IDs, such as `SA-EXEC-025` for single action routing or `SA-LED-114` for partial undo disclosure.
4. Write `given` from declared state. Use plain JSON facts, session context, grants, runtime signals, or ledger state. If you need a value that cannot be represented as JSON, store a stable reference string instead.
5. Write `expected` using registry IDs. For actions and surfaces, use IDs from the target registry. For params, choose the strictest matcher that expresses legitimate tolerance.
6. Mark negative behavior explicitly. Set `negativeCase` to `clarification`, `refusal`, `policy-denial`, `undo-refusal`, `timeout-failure`, `capability-unavailable`, or `partial-undo`, and fill the detail field.
7. Validate locally:

```bash
npm --prefix evals install
npm --prefix evals run validate
```

The validator must pass before a sample or suite fixture is considered well-formed. Passing validation does not prove the target integration conforms; it proves only that the fixture is shaped correctly for the future runner.
