# Evals

This directory defines the fixture format for checking whether a Steerable integration routes intent, resolves policy, honors reversibility, and continues across declared surfaces. The format is app-agnostic: fixtures reference a target integration's compiled registry by stable action and surface IDs, but the fixture format never defines product-specific actions.

The fixture files are YAML. The schemas are JSON Schema. Validation is local and zero-API-call by design; it checks fixture shape only and does not run a router, policy engine, executor, browser, or model.

## Layout

```text
evals/
  README.md
  package.json
  validate-fixtures.mjs
  run-fixtures.mjs
  quarantined-fixtures.json
  schemas/
    common.schema.json
    facts-context.schema.json
    intent-routing.schema.json
    policy-decisions.schema.json
    reversibility.schema.json
    cross-surface.schema.json
  intent-routing/design-studio/*.yaml
  intent-routing/samples/*.yaml
  policy-decisions/design-studio/*.yaml
  policy-decisions/samples/*.yaml
  reversibility/design-studio/*.yaml
  reversibility/samples/*.yaml
  cross-surface/design-studio/*.yaml
  cross-surface/samples/*.yaml
  facts-context/design-studio/*.yaml
  facts-context/samples/*.yaml
```

`samples/` remain illustrative format examples. Real executable suites live under a target-named directory such as `design-studio/`.

## Validation and Runner

From the Design Studio example, run:

```bash
npm run evals
```

The script validates all fixture YAML files and then runs non-sample fixtures against the Design Studio adapter. The command is wired from `examples/design-studio` rather than the repo root because this repository does not currently have a root package; the adapter is bundled from the example's installed TypeScript source before the plain Node runner imports it.

The runner is deterministic and must not make network or model-provider calls. It exits nonzero for any unquarantined schema, target, route, policy, execution, or undo mismatch. Per-fixture failures print the expected value and actual value that differed.

## Target Adapter Interface

The runner binds to a target integration through a small adapter object:

| Method | Purpose |
|---|---|
| `target` | Registry identity loaded by the adapter; fixtures must match `integrationId`, registry `id`, `version`, and `ref`. |
| `route(fixture)` | Execute an `intent-routing` fixture through the target router and return route class, actions/read tools, params, clarification, or refusal. |
| `resolve(fixture)` | Execute a `policy-decisions` fixture through the target policy resolver and return per-step modes, chain boundary, denial, and rationale text. |
| `execute(fixture)` | Execute a `cross-surface` fixture through the target execution engine and return sequence, failure, preserved undo prefix, and trace facts. |
| `undo(fixture)` | Execute a `reversibility` fixture through target ledger/undo seams and return undo outcome, attempted order, per-step results, and disclosures. |
| `context(fixture)` | Optional unless the suite contains `facts-context` fixtures. Publish a live surface's declared facts and run the fixture's declared typed read-tool calls. |

Design Studio's adapter lives at `examples/design-studio/src/steerable/evalAdapter.ts`. A new integration should implement the four core methods without changing `evals/run-fixtures.mjs`; implement `context` when it authors `facts-context` fixtures. This preserves compatibility for external adapters that only run the original four kinds.

## Running an External Target

External integrations can keep their adapter and fixtures in their own repository. Point the canonical runner at an absolute adapter module path and the fixture suite directory:

Before either validation or an external-target invocation, install the runner's own schema dependency in the Steerable checkout:

```bash
npm ci --prefix /path/to/Steerable-Protocol/evals
```

The runner intentionally resolves `ajv` from `evals/`, not from the external target. If that install is missing, it stops before adapter loading with this exact remedy; targets do not need a loader workaround or a duplicate `ajv` dependency.

```bash
node /path/to/Steerable-Protocol/evals/run-fixtures.mjs \
  --adapter=/absolute/path/to/acme-eval-adapter.mjs \
  --fixtures=/absolute/path/to/acme-fixtures
```

`STEERABLE_EVAL_ADAPTER=/absolute/path/to/acme-eval-adapter.mjs` can be used instead of `--adapter`. The fixtures directory should use the same kind-based layout as this repository, such as `intent-routing/acme/*.yaml` and `policy-decisions/acme/*.yaml`. The runner still validates every fixture's `target.integrationId`, `target.registry.id`, `target.registry.version`, and `target.registry.ref` against the external adapter's declared `target`.

Minimal external adapter module:

```js
export default {
  target: {
    integrationId: "acme",
    registry: {
      id: "acme.registry",
      version: "2026-07-09",
      ref: "npm:@acme/registry@2026-07-09",
    },
  },
  async route(fixture) {},
  async resolve(fixture) {},
  async execute(fixture) {},
  async undo(fixture) {},
  // Required only when this suite contains facts-context fixtures.
  async context(fixture) {},
};
```

## Failing Fixture Policy

Unquarantined red fixtures fail the runner. If a fixture exposes a real product bug that cannot be fixed in the same task, keep the fixture in the suite and add an entry to `evals/quarantined-fixtures.json` with the fixture `id`, linked issue URL, owner, date, and reason. The runner reports quarantined failures separately and does not count them as ambient green. If a quarantined fixture starts passing, the runner fails with a stale-quarantine error so the entry is removed.

There are currently no quarantined fixtures.

## Common Fields

Every fixture has these top-level fields:

| Field | Meaning |
|---|---|
| `fixtureFormatVersion` | Fixture format version. Current value: `"0.1.0"`. |
| `kind` | One of `intent-routing`, `policy-decisions`, `reversibility`, `cross-surface`, `facts-context`. |
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

### Facts Context

Facts-context fixtures assert the first two context-ladder rungs directly: a live surface's declared fact publisher and its typed read tools. They assert `SA-CTX-020` through `SA-CTX-045` without routing an utterance or invoking action policy/execution machinery.

`given` contains the live `surfaceId` and optional `readToolCalls`. Each call names a declared read-tool ID plus plain JSON `params`. `expected.facts` names each facts declaration expected on that live surface; its `values` use the existing `allowExtra`/`fields` matcher envelope. `expected.readTools` pins the result of each requested call using that same envelope.

This is deliberately a declaration-and-query fixture, not a second router or a matcher expansion. It must obtain facts from the declaration's publisher and read-tool results from the declared typed `query` after registry availability, precondition, and parameter validation. Keep utterance-to-answer behavior in `intent-routing`; when an answer fixture also happened to pin a read tool, move that read-tool assertion here and leave the routing assertion focused on route class and answer text.

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

Each entry in `stickyGrants` names `grantId`, `subject`, `effect`, and `expires`, plus two optional fields that carry the `SA-POL-129` / `SA-POL-130` bounds on how long a grant may live:

| Field | Meaning |
| --- | --- |
| `source` | `framework` or `developer`. Absent means `framework`, the stricter reading: a grant that does not claim developer provenance is not assumed to have it. A `framework` grant must name both a `sessionId` and an `expires`, because `SA-POL-129` requires it to expire no later than the current session; one that omits either is refused. Only a `developer` grant may persist beyond the session (`SA-POL-130`). |
| `sessionId` | Session the grant is bound to. It resolves only when it matches `sessionContext.sessionId`. |

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

1. Pick the kind. If the behavior is declared facts or typed read-tool output, use `facts-context`; if it is utterance classification, use `intent-routing`; if it is posture and grants, use `policy-decisions`; if it is undo, use `reversibility`; if it crosses declared surfaces, use `cross-surface`.
2. Bind the fixture to a registry. Fill `target.integrationId`, `target.registry.id`, `target.registry.version`, and `target.registry.ref`. Do not author a suite against an unspecified or floating registry.
3. Cite the contract. Add the `SA-*` IDs that make this fixture meaningful. Prefer the narrowest IDs, such as `SA-EXEC-025` for single action routing or `SA-LED-114` for partial undo disclosure.
4. Write `given` from declared state. Use plain JSON facts, session context, grants, runtime signals, or ledger state. If you need a value that cannot be represented as JSON, store a stable reference string instead.
5. Write `expected` using registry IDs. For actions and surfaces, use IDs from the target registry. For params, choose the strictest matcher that expresses legitimate tolerance.
6. Mark negative behavior explicitly. Set `negativeCase` to `clarification`, `refusal`, `policy-denial`, `undo-refusal`, `timeout-failure`, `capability-unavailable`, or `partial-undo`, and fill the detail field.
7. Validate locally:

```bash
npm ci --prefix evals
npm --prefix evals run validate
```

The validator must pass before a sample or suite fixture is considered well-formed. Passing validation does not prove the target integration conforms; it proves only that the fixture is shaped correctly for the future runner.
