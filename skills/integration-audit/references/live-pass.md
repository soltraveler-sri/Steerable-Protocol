# Live Pass

This reference expands the `SKILL.md` workflow. It sets the evidence standard an audit must meet before reporting a conformance claim. It does not add conformance rules and does not restate checklist rows; always use `docs/spec/conformance-checklist.md` as the audit authority.

Authority for the gate is already in the checklist:

- `docs/spec/conformance-checklist.md` section 2: `Inconclusive` means "Required evidence is unavailable; this does not count as pass for a conformance claim."
- `SA-CONF-002`: a `minimal` claim passes only when no applicable Minimal+ item is Fail, Pending, or Inconclusive.
- `SA-CONF-005`: every checklist ID needs a result plus evidence, a not-applicable condition, or a pending-clarification reference.
- `SA-CONF-098`: the framework decides that conformance evidence must be item-level and reproducible; the developer decides which code paths, tests, runtime probes, screenshots, or audit artifacts supply it.

`SA-CONF-098` is the shape of this document. **What must be observed is fixed. How it is observed is chosen to fit the target.**

## The Gate

Do not report a `minimal` or `full` conformance verdict without a completed live pass against the running target.

- Every check `LP-1` through `LP-5` gets one result: `Pass`, `Fail`, `Not applicable` with a justification, or `Inconclusive` with a blocker.
- Any `Fail` blocks the claim through its mapped SA-CONF items.
- Any `Inconclusive`, missing, or artifact-less check caps `overall_verdict` at `Inconclusive` for the claim. Report the claim as unproven, not as passing.
- The gate does not lift because the static read was clean, the test suite is green, the user asked, the target is small, or time is short. Those conditions are exactly the ones under which it has already failed.

## What Does Not Satisfy The Gate

Each item below was simultaneously true of a real adopter at the moment it self-certified `minimal` — while every authenticated page threw at load and the mandated cross-surface continuation was impossible by construction:

- a green unit/integration test suite;
- a green eval fixture run — `skills/eval-authoring/` fixtures make zero model or product calls by design, so they cannot see this;
- a green build, typecheck, or lint;
- a clean static SA-CONF read;
- a static adversarial audit, however model-diverse;
- reading the code and reasoning about what would happen at runtime;
- a live pass taken against an earlier build.

None of these are the live pass. Do not enter any of them as an `artifact` for an `LP` check.

## Preflight

Record these before the first check. A live pass without them is not reproducible and does not count.

- `build_sha` — the commit the running target was built from. It must equal HEAD of the audited scope. If it does not, rebuild; if you cannot, the live pass is `Inconclusive`.
- `drive_channel` — how the target is driven, chosen per the table below.
- `datastore_identity` — the store `LP-2` will write to, named concretely (database/host/URL/file), plus how you know it is the real one the app writes through and not a mock, stub, fake, or test double.
- `datastore_authorization` — `LP-2` writes real data. Use a non-production store. If the only reachable store is production, ask the human. Without explicit authorization, `LP-2` is `Inconclusive`. It is never skipped and never simulated.
- `surface_inventory` — every surface ID enumerated from the registry's surface declarations. `LP-1` covers all of them, not a sample.

If the target cannot be started at all, stop here and file the `Inconclusive` record below. Do not continue to a conformance verdict.

Driving the target does not make this skill a fixing skill. Report-only governs the target's source: do not edit it. Starting the app, loading its surfaces, steering it, and writing to a non-production datastore under this procedure are audit evidence, not a retrofit.

## Channel Selection

The five observations are fixed. Pick the probe that fits the target's nature.

| Target shape | `drive_channel` | `LP-1` error stream is | `LP-3` navigation is |
|---|---|---|---|
| Browser app (SPA or server-rendered) | headless or real browser, authenticated as a real user | browser console, unhandled rejections, failed requests, crashed renders | a client route change or full navigation through the app's own navigation |
| CLI | spawn the real binary | stderr diagnostics and non-zero exits on the entry path | the command, mode, or context switch that makes the destination surface live |
| HTTP/API-only service | real HTTP requests to the running service | error-level server log entries emitted for the request, plus non-success statuses | the session or context change the API exposes to move between surfaces |
| TUI, desktop, or editor extension | drive the real host | the host's log/output channel at error level | the host's own view, panel, or workspace switch |
| Library with a runnable example or harness | drive that example | the example host's error stream | the example's own surface switch |
| Library with no runnable host | none available | — | — |

Two rules when the target is not a web app:

1. **Map the check; do not drop it.** Every runtime that declares surfaces has all five observations in some form. "There is no console" is not a `Not applicable` for `LP-1` — it means this target's error stream is stderr, or a log file, or an output channel. Name which, capture it, and read it.
2. **`Not applicable` requires a structural absence, justified from a declaration.** Not from inconvenience, and not from the check being hard to run.
   - `LP-3` is `Not applicable` only when the registry declares exactly one surface and no capability is listed by a second surface. Quote the surface declarations.
   - `LP-5` is `Not applicable` only when the target declares no model-routed path at all. Then say what does route intent — and note that such a target does not satisfy `SA-CONF-053`/`SA-CONF-054` by inspection either, which is a finding.
   - A library with no runnable host is `Inconclusive` for `LP-1` through `LP-4`, not `Not applicable`. An integration that never runs cannot support a conformance claim about a running product.

## The Five Checks

### LP-1 — every declared surface loads clean

- **Proves:** no declared surface crashes on the path a real user takes to it.
- **Run:** load every surface in `surface_inventory` through `drive_channel`, authenticated exactly as a real user, on `build_sha`.
- **Record per surface:** surface ID, entry route/path/command, the capture method, and the verbatim error-stream output. The literal `no errors` is acceptable only when the stream was actually captured and was empty.
- **Fail when:** any error-level diagnostic, unhandled rejection, or crashed render occurs on any declared surface.
- **Do not** sample. Cover every declared surface, or declare partial coverage and record `Inconclusive`.
- **Do not** filter the error stream to make it read clean. If the target suppresses or swallows its own error stream, that is a finding under `SA-CONF-068`, not a clean read.

### LP-2 — one action executes against a real datastore and its undo reverses it

- **Proves:** the write reaches the store and the declared recovery mechanism actually recovers.
- **Choose:** a declared action with `undoable` or `snapshot` reversibility whose write lands in `datastore_identity`.
- **Run:** read the target record from the datastore, execute the action through the product's real path, read again, invoke undo through the product's own undo control, read a third time.
- **Record:** three verbatim reads (before / after / after-undo) taken from the datastore itself — not from the UI, not from the ledger — plus the ledger's undo-handle status for that step.
- **Fail when:** the after-read is unchanged (the action never wrote), the after-undo read does not match the before read, or undo reports `unavailable`.
- **Do not** substitute an in-memory double for the store. If the reachable store is in-process memory while the target claims a durable backend under `SA-CONF-079`, this check is `Inconclusive` for that claim: closure-held undo handles survive an in-memory ledger and do not survive a round trip through storage.

### LP-3 — one cross-surface continuation completes across a real navigation

- **Proves:** the steering session outlives navigation, which is the unstated precondition for `SA-CONF-066`.
- **Choose:** an action declared available on a surface other than the one the request is made from.
- **Run:** steer from surface A, let the app navigate to surface B through its own navigation, and observe the continuation resume and execute on B.
- **Record:** source surface ID, destination surface ID, the navigation event observed, the ledger record for the resumed step, and whether the session survived the navigation.
- **Fail when:** navigation destroys the session or its pending continuation, the continuation does not resume, the bounded wait times out, or the destination capability is not live when the step runs.
- **Do not** satisfy this with a chain that never leaves one surface, and do not reload or remount the app between steps. A session host mounted inside the navigable region will pass a static read and fail here; that is the point.

### LP-4 — published facts match what is rendered

- **Proves:** facts describe reality rather than plausible literals. Schema-valid, finite, correctly ordered facts can still lie, and no static check sees it.
- **Run:**
  1. Snapshot the published facts for a live surface as the model receives them — from the context/prompt assembly path, not by calling the publisher in isolation.
  2. Change that surface's state through the product's own UI or controls, never through the steering path, in a way at least one declared fact must reflect.
  3. Snapshot the published facts again.
- **Record:** both verbatim snapshots, the exact change made, and the diff between them.
- **Fail when:** the two snapshots are identical, or a fact's value contradicts the rendered state at either snapshot.
- **Do not** accept a single snapshot. A hardcoded literal matches reality once; the second snapshot is what exposes it.
- **Do not** read facts from the declaration or the publisher source. Read what the assembly path emits. If no assembly path consumes the declared facts, they are dead weight and this check is a `Fail` under `SA-CONF-046`.

### LP-5 — the first live model-routed request succeeds

- **Proves:** the wire contract between the registry and the provider holds. This is where provider 4xx errors and silently empty params live.
- **Run:** one real request end to end, from a cold start — the target's real router, the real provider, the real registry, no cached prompt, no replayed transcript. Derive the utterance from a declared registry example for an action with non-empty params.
- **Record:** model ID, the provider's response identifier or usage block, the routed `{actionId, params}` actually produced, whether params were populated, and verbatim provider error text on failure.
- **Fail when:** the request errors with a provider **4xx** (tool-name grammar, schema shape, malformed request), the router emits an action ID absent from the registry, or params arrive empty for an utterance that supplied them. A 4xx is a `Fail`, not an environment problem: it means the integration sent something the provider's contract rejects, which is exactly what this check exists to catch.
- **Empty params on a `200` is a `Fail.`** It is the silent one, and a green fixture suite cannot see it.
- **A provider `5xx` is not a `Fail`** — `429` (rate limit), `503`, and `529` (overloaded) are capacity and availability, not contract. The integration sent nothing wrong. Retry once within the cost bound; if it persists, record `Inconclusive` with the status code as the `blocker`, not `Fail`. Do not report a conformance defect the target does not have, and do not let a busy provider bully the audit into a verdict — `Inconclusive` is the honest answer when the provider never adjudicated the request.
- **Distinguish the two before deciding.** The status code is the discriminator and it is in the response; record it verbatim. If you cannot tell contract from capacity, that is `Inconclusive`, not a coin flip.
- **Cost bound:** one request. A second only to separate a transient failure (`5xx`/network) from a contract failure. Three is the ceiling — and retrying a `529` counts against it, so a persistently overloaded provider yields `Inconclusive` rather than a retry loop. Never loop, never sweep utterances, never run a matrix — that is an eval suite, and the deterministic suite makes zero model calls on purpose (`skills/eval-authoring/SKILL.md`). Confirm with the human before exceeding three live requests.

## Item Binding

These checks are the runtime evidence for items the static read cannot decide. When an `LP` check is not `Pass`, its mapped items cannot be `Pass` on static evidence alone; record them `Inconclusive` per `SA-CONF-005` and section 2, and let `SA-CONF-002` do the rest.

| Check | Items that require its evidence |
|---|---|
| `LP-1` | `SA-CONF-017`, `SA-CONF-020`, `SA-CONF-067`, `SA-CONF-068` |
| `LP-2` | `SA-CONF-029`, `SA-CONF-042`, `SA-CONF-073`, `SA-CONF-075`, `SA-CONF-079` |
| `LP-3` | `SA-CONF-022`, `SA-CONF-066`, `SA-CONF-099` |
| `LP-4` | `SA-CONF-017`, `SA-CONF-018`, `SA-CONF-019`, `SA-CONF-025`, `SA-CONF-046` |
| `LP-5` | `SA-CONF-012`, `SA-CONF-025`, `SA-CONF-053`, `SA-CONF-054`, `SA-CONF-104` |

This mapping routes evidence. It does not add rules to those rows or change their assertions; the checklist row stays the authority on what each item asserts.

## Recording The Live Pass

Emit a `## Live Pass Record` section in the report, before the item table, using the fields in `references/report-format.md`.

`artifact` is an observation, not an assertion. "Verified working", "confirmed the page renders", and "the code cannot throw here" are not artifacts. Verbatim captured output, the three datastore reads, the two fact snapshots, and the provider response identifier are artifacts. **A check whose artifact is a claim about the code rather than a record of the run is `Inconclusive`, not `Pass`.**

Artifacts are bound to `build_sha`. Re-run any check whose drive path a later fix touched, and record the new SHA. Do not carry an artifact forward across a fix.

## Inconclusive Is A Correct Result

An audit that cannot drive the target reports `Inconclusive`, and that is the right answer. It is a complete, honest, useful outcome: it tells the human exactly what is unproven and what would prove it. It is not a failure of the audit, and it is not something to route around.

Do not:

- infer a pass from static evidence to avoid recording `Inconclusive`;
- weaken or reinterpret a check until it becomes runnable;
- mark a check `Not applicable` because it is inconvenient rather than structurally absent;
- report a conformance claim as passing with any check unproven.

An `Inconclusive` check records:

- `blocker` — the specific reason: no credentials, no reachable datastore, cannot build, no provider key, production-only store with no authorization, no runnable host, or a provider that never adjudicated the request (`429`/`503`/`529` after a retry).
- `attempted` — the commands run and their output.
- `unblock` — exactly what a human would have to supply.
- `verdict_effect` — the mapped SA-CONF items and the conformance claim this blocks.

Severity for the finding is `claim-blocking-inconclusive` per `references/report-format.md`.
