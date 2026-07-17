# Steerable Apps Action Ledger Specification (Normative)

**Status:** Draft v0.1
**Spec code:** SA-LED
**Role:** Ledger entries, audit depth, undo-handle recording, replay/debug data, and storage expectations
**Canonical project source:** `Steerable-Protocol-NorthStar.md`

## 1. Introduction (Informative)

The action ledger is the record of meaningful steering activity in a Steerable App. It is the layer that turns "the runtime disposes" into an inspectable fact: user intent, proposed capability use, policy decisions, approvals where applicable, execution results, errors, repairs, state references, and undo handles are recorded in one ordered trail.

The ledger exists to support trust first. Its minimum job is to make current activity visible, make claimed reversibility executable, and give evals a trace of what the runtime chose and did. Additional uses such as replay, saved workflows, analytics, compliance audit, and debugging are valuable, but they are extensions over the same record model rather than reasons to make every integration heavyweight.

This document specifies the ledger record model and undo semantics. It consumes the declaration semantics in `SA-DECL`, including ID stability and undo derivation, and the policy outputs in `SA-POL`, including the recordable rationale required by `SA-POL-108` and the recording requirement in `SA-POL-109`. It does not define routing, execution-path behavior, chain scheduling, surface behavior, or user-interface presentation; those subjects belong to `SA-EXEC`.

## 2. Scope and Dependencies (Informative)

This document depends on the core vocabulary from `SA-CORE`, the declaration contract from `SA-DECL`, and the policy contract from `SA-POL`. In particular:

1. Capability IDs recorded in the ledger rely on the stability rule in `SA-DECL-011`.
2. Undo handling is derived from `reversibility` and `undo` as required by `SA-DECL-049` through `SA-DECL-053` and `SA-DECL-103`.
3. Policy decisions recorded by the ledger must accommodate the rationale fields required by `SA-POL-108`, and every policy decision must be recorded once the ledger layer is present as required by `SA-POL-109`.

This document intentionally defines conceptual record shapes rather than a storage backend, database schema, TypeScript API, event bus, or analytics product.

## 3. Ledger Model and Scope (Normative)

- **SA-LED-001:** A conforming implementation MUST provide a ledger layer capable of recording meaningful steering activity for the current conformance scope.
- **SA-LED-002:** Meaningful steering activity MUST include each user intent submitted for steering, each policy decision returned for proposed action use, each approval or refusal outcome when applicable, each trusted action execution attempt, each execution result, each recorded repair attempt, and each undo attempt.
- **SA-LED-003:** A ledger record MUST be append-only for historical facts after those facts become true, but a record MAY be updated to attach later facts such as completion status, approval outcome, execution result, undo result, expiration, redaction, or repair linkage.
- **SA-LED-004:** A ledger record MUST preserve ordering sufficient to reconstruct the sequence of policy decisions, action attempts, execution results, held steps, repairs, and undo attempts within the current ledger scope.
- **SA-LED-005:** A ledger scope MAY be an in-memory session, a browser tab, a user session, a project, an account, or a durable audit domain, provided that the implementation's storage and retention policy honestly matches the conformance claim and product policy.
- **SA-LED-006:** The ledger model MUST be storage-independent; a conforming implementation MUST NOT require a specific database, queue, analytics vendor, hosted service, or durable storage backend.
- **SA-LED-007:** A creative-tool integration MAY conform with an in-memory session ledger when its product policy only claims session-scoped activity, session-scoped undo, and session-scoped eval trace extraction.
- **SA-LED-008:** A sensitive-domain or durable-audit integration MUST use storage depth and availability sufficient for its policy claims; if a selected policy preset or developer policy requires recording before execution, recording unavailability MUST prevent the affected action from being represented as executable under that policy.
- **SA-LED-009:** The ledger MUST record action and capability identifiers using the stable declaration IDs defined by `SA-DECL-010` through `SA-DECL-013`; it MUST NOT invent alternate action IDs for ledger use.
- **SA-LED-010:** The ledger MUST NOT become a second source of truth for action meaning, schemas, policy metadata, executor semantics, or undo semantics; those facts remain derived from declarations and the registry as required by `SA-DECL-093`.

## 4. Minimal Steering Invocation Record (Normative)

- **SA-LED-020:** The minimal steering invocation record MUST contain only the fields required to support undo, visible activity trails, and eval-trace extraction.
- **SA-LED-021:** A minimal steering invocation record MUST contain a stable `recordId` unique within the ledger scope.
- **SA-LED-022:** A minimal steering invocation record MUST contain a `schemaVersion` or equivalent version marker sufficient to interpret the record shape.
- **SA-LED-023:** A minimal steering invocation record MUST contain ordered timing metadata sufficient to determine when the invocation was recorded and how its steps order relative to other records in the same ledger scope.
- **SA-LED-024:** A minimal steering invocation record MUST contain a `surfaceRef` or equivalent reference to the surface context in which steering was requested when that context is available.
- **SA-LED-025:** A minimal steering invocation record MUST contain a user-intent field as either text, a redacted text value, or a stable reference to the intent text.
- **SA-LED-026:** A minimal steering invocation record MUST contain an actor or initiator reference sufficient to distinguish user-initiated steering, system-initiated repair, and external-agent-initiated steering when those initiator classes exist.
- **SA-LED-027:** A minimal steering invocation record MUST contain the proposed or resolved action set as ordered step records; a read-only, refused, or hand-off outcome MAY have an empty action-step list if no action was proposed for execution.
- **SA-LED-028:** Each minimal action-step record MUST contain a stable `stepId`, its order within the invocation, and the declared `actionId`.
- **SA-LED-029:** Each minimal action-step record MUST contain the action parameters as values, redacted values, or stable references sufficient for eval trace extraction and undo execution where parameters are part of the undo handle.
- **SA-LED-030:** Each minimal action-step record MUST contain a status value sufficient to distinguish at least proposed, held, running, succeeded, failed, skipped, and undone states.
- **SA-LED-031:** Each minimal action-step record MUST contain the declared writes or affected state-key references needed to associate the action with state changes and undo handles; those state keys MUST use the developer-owned taxonomy declared under `SA-DECL-019` and `SA-DECL-020`.
- **SA-LED-032:** Each minimal action-step record MUST contain either an undo handle, an undo-handle reference, a pending snapshot-capture marker, or an explicit no-undo reason.
- **SA-LED-033:** Each minimal action-step record MUST contain execution result metadata once execution settles, including success or failure and any error code or redacted error summary when execution fails.
- **SA-LED-034:** Each minimal action-step record MUST contain repair linkage when the step is a repair of, replacement for, or follow-up to an earlier failed or partially failed step.
- **SA-LED-035:** A minimal steering invocation record MUST contain a policy decision record for every policy decision associated with the invocation.
- **SA-LED-036:** A minimal steering invocation record MUST contain approval-state metadata when policy resolved any gate, including at least not-required, pending, approved, declined, expired, or canceled.
- **SA-LED-037:** A minimal steering invocation record MUST contain disclosure metadata when any action, suffix, undo attempt, or partial undo has user-relevant limitations that would make a plain "done" or "undone" activity statement misleading.
- **SA-LED-038:** A minimal steering invocation record MUST contain enough observation, state-reference, or result-reference metadata to extract an eval trace showing the intent, action IDs, parameters or redacted parameters, policy result, execution status, errors, repairs, and undo outcome.
- **SA-LED-039:** A minimal steering invocation record MUST NOT require raw prompts, raw model responses, full state snapshots, latency histograms, provider trace IDs, analytics dimensions, compliance signatures, or durable storage references unless those values are required by the app's chosen storage or policy profile.
- **SA-LED-040:** A steering invocation whose intent answers an earlier `clarification` outcome under `SA-EXEC-037` MUST contain clarification linkage identifying the invocation record that recorded the pending proposal, mirroring the repair linkage required by `SA-LED-034` at invocation scope because no step of the pending proposal executed. Linkage MUST be recorded on the resuming invocation rather than by rewriting the clarifying invocation's historical facts.
- **SA-LED-041:** A resuming invocation MUST carry its own policy decision record under `SA-LED-035`. The policy decision recorded for the clarifying invocation MUST NOT be represented as authorizing the resuming invocation's execution, consistent with `SA-EXEC-038` and `SA-LED-053`.

The following conceptual shape is illustrative:

```ts
type SteeringInvocationRecord = {
  recordId: string
  schemaVersion: string
  order: { sequence: number; recordedAt: string }
  surfaceRef?: string
  initiator: { kind: "user" | "system" | "external_agent"; ref?: string }
  intent: { text?: string; redactedText?: string; ref?: string }
  clarificationOfRecordId?: string
  policyDecisions: PolicyDecisionRecord[]
  approval: ApprovalRecord
  steps: ActionStepRecord[]
  disclosures: DisclosureRecord[]
}
```

## 5. Policy Decision Records (Normative)

- **SA-LED-050:** A policy decision record MUST record the resolved autonomy mode returned by the policy engine as required by `SA-POL-106`.
- **SA-LED-051:** A policy decision record MUST represent all minimum rationale fields required by `SA-POL-108`: action IDs, relevant declaration metadata, selected posture preset, applicable overrides, effect floors, confirmation floor, grant use or non-use, runtime-signal demotions, final mode, and reason codes.
- **SA-LED-052:** For an action chain, a policy decision record MUST represent any per-action mode, chain-level mode, executed-prefix boundary, held-suffix boundary, refusal reason, or required policy gate returned under `SA-POL-107`.
- **SA-LED-053:** A policy decision record MUST distinguish the policy decision from the later execution result; approval, execution failure, undo failure, or repair MUST NOT rewrite what the policy engine decided.
- **SA-LED-054:** A policy decision record MUST be recordable before or at the time the associated execution is allowed to proceed when developer policy or a posture preset requires recording availability.
- **SA-LED-055:** If a policy decision cannot be recorded but policy requires recordability, the ledger MUST expose that failure to the runtime as a recordability failure rather than allowing the action to appear successfully authorized.

## 6. Extended Records and Derived Uses (Normative)

- **SA-LED-060:** An implementation MAY extend ledger records with fields for replay, saved workflows, debugging, analytics, observability, compliance, billing, model traces, latency measurement, or product-specific audit.
- **SA-LED-061:** Extended record fields MUST NOT be required for minimal conformance unless a later conformance level or developer-selected policy profile explicitly requires them.
- **SA-LED-062:** Extended record fields MUST NOT contradict minimal record fields or registry-derived declaration facts.
- **SA-LED-063:** Saved workflows, recipes, or replays derived from the ledger MUST reference stable declaration IDs and schemas rather than copying action semantics into the saved artifact.
- **SA-LED-064:** Eval traces derived from the ledger MUST be extractable without raw sensitive values when redaction policy replaces those values with references or redacted summaries.

## 7. Undo Handle Model (Normative)

- **SA-LED-070:** A successful action execution whose declaration claims `reversibility.kind: undoable` or `reversibility.kind: snapshot` MUST produce an executable undo handle or a recorded failure explaining why no handle is available.
- **SA-LED-071:** An undo handle MUST be executable by trusted app-owned code or runtime-owned restoration code; it MUST NOT depend on the model remembering or inventing a repair.
- **SA-LED-072:** An undo handle MUST record the associated `recordId`, `stepId`, `actionId`, reversibility kind, handle status, eligibility scope, and any expiration or invalidation condition known to the runtime.
- **SA-LED-073:** An undo handle MUST carry or reference the minimum state, parameters, result, snapshot, or compensation data needed for the trusted undo mechanism to run.
- **SA-LED-074:** An undo handle MUST declare whether it is intended to restore the prior product state fully, partially, or only compensate for the earlier action; partial handles and compensating handles that do not fully restore prior product state MUST trigger disclosure under `SA-LED-037`.
- **SA-LED-075:** An undo handle status MUST distinguish at least available, unavailable, expired, attempted, succeeded, failed, and superseded.
- **SA-LED-076:** An undo attempt MUST itself be recorded in the ledger with its target handle or handles, start and settled status, result, error summary when applicable, and any partial-undo disclosure.
- **SA-LED-077:** When an action's later state changes supersede an undo handle, the ledger MUST record the handle as superseded or unavailable rather than leaving a stale successful undo promise visible.

## 8. Reversibility Semantics (Normative)

- **SA-LED-080:** For `reversibility.kind: undoable`, the ledger MUST treat the declaration's `undo` field required by `SA-DECL-049` as the source of the executable inverse.
- **SA-LED-081:** For `undoable` actions, the runtime MUST record the parameters, pre-action state references, result references, or other undo inputs required by the declared inverse before the undo handle is considered available.
- **SA-LED-082:** For `reversibility.kind: snapshot`, the runtime MUST capture the necessary pre-action state after policy authorization and before the action's mutation is applied.
- **SA-LED-083:** A snapshot undo handle MUST identify the captured snapshot or snapshot reference, the state keys covered by the snapshot, and any known restore limitations.
- **SA-LED-084:** A snapshot restore MUST use trusted runtime-owned or app-owned restoration code and MUST record the restore attempt and result in the ledger.
- **SA-LED-085:** If snapshot capture fails, the ledger MUST record the capture failure and MUST NOT represent the action as having an available snapshot undo handle.
- **SA-LED-086:** For `reversibility.kind: irreversible`, the ledger MUST record that no undo handle is claimed and MUST include an honest no-undo reason suitable for activity trail and audit use.
- **SA-LED-087:** An irreversible action MAY have later recovery, remediation, or support workflows, but the ledger MUST NOT represent those workflows as undo unless they satisfy the executable reversibility semantics in `SA-POL-040` through `SA-POL-048`.
- **SA-LED-088:** The ledger MUST preserve enough data to disclose the difference between full restoration, partial restoration, compensation, and no undo.

## 9. Server-Mutation Reversibility Vocabulary (Normative)

- **SA-LED-090:** The ledger MUST support the vocabulary `declared_inverse`, `runtime_snapshot`, `compensating_action`, `soft_delete_window`, and `honest_irreversible` as undo or recovery mechanism descriptors.
- **SA-LED-091:** `declared_inverse` MUST mean the action declaration provides a trusted inverse through `undo` and the ledger has recorded the inputs needed to call it.
- **SA-LED-092:** `runtime_snapshot` MUST mean the runtime captured sufficient pre-action state and can restore that state under the snapshot semantics in this document.
- **SA-LED-093:** `compensating_action` MUST mean trusted app-owned code will issue a new action or domain operation intended to counteract the original action's effect.
- **SA-LED-094:** A compensating action MUST NOT be described as full undo unless it restores the relevant product and domain state to the prior condition as required by `SA-POL-046`.
- **SA-LED-095:** `soft_delete_window` MUST mean the product retains a restorable server-side state for a bounded period and the ledger records the handle expiration or invalidation condition.
- **SA-LED-096:** A soft-delete-window handle MUST become expired or unavailable in the ledger when the restoration window closes.
- **SA-LED-097:** `honest_irreversible` MUST mean the runtime has no reliable undo handle and records the action as irreversible with disclosure.
- **SA-LED-098:** A server mutation MAY be declared `undoable` when its declared `undo` handler implements a compensating action or soft-delete restore that fully satisfies the action's domain-specific reversibility claim.
- **SA-LED-099:** A server mutation MUST remain `irreversible` when compensation is best-effort, partial, support-mediated, outside the runtime's authority, or unable to restore the relevant product and domain state.
- **SA-LED-100:** This vocabulary MUST NOT add new `reversibility.kind` values to the declaration value set defined by `SA-DECL-039`; it describes ledger mechanisms and recovery honesty within the existing `undoable`, `snapshot`, and `irreversible` kinds.

## 10. Chain Undo, Undo-All, and Partial Undo (Normative)

- **SA-LED-110:** A chain record MUST preserve step order and execution-success order sufficient to undo executed reversible steps in reverse execution order.
- **SA-LED-111:** An undo-all request over a chain MUST target the set of successfully executed steps in the requested scope; held, skipped, refused, or never-executed steps MUST NOT be represented as undone.
- **SA-LED-112:** Undo-all over a fully reversible executed scope MUST attempt undo handles in reverse execution order unless a recorded dependency requires a stricter reverse-dependency order.
- **SA-LED-113:** If the requested undo scope contains a succeeded step without an available undo handle, the runtime MUST NOT silently skip that step.
- **SA-LED-114:** When full undo is impossible, the ledger MUST record either a refused full-undo outcome or a partial-undo outcome with disclosure identifying which steps were undone, which were not undone, and why.
- **SA-LED-115:** A product MAY offer partial undo for the reversible subset of a chain, but the ledger MUST record it as partial undo rather than undo-all success.
- **SA-LED-116:** If an undo attempt succeeds for some handles and fails for others, the ledger MUST record the final state as partial undo or failed undo and MUST preserve per-handle results.
- **SA-LED-117:** A chain-level undo handle MAY aggregate step handles, but the ledger MUST preserve the underlying per-step handles and results.
- **SA-LED-118:** If undo is requested while a chain still has running or unsettled steps, the ledger MUST record the undo request, the steps known to be completed, held, running, or unsettled at that time, and the undo status as pending execution settlement.
- **SA-LED-119:** The ledger MUST NOT define how running execution is canceled, paused, allowed to settle, or resumed; execution-side behavior for still-executing chains belongs to `SA-EXEC`.
- **SA-LED-120:** Once execution-side behavior settles the running or held steps, the ledger MUST reconcile the undo request against the final step statuses and record whether full undo, partial undo, refusal, or failure occurred.

## 11. Redaction and Sensitive Parameters (Normative)

- **SA-LED-130:** The ledger MUST support storing sensitive values as redacted values or stable references rather than raw values.
- **SA-LED-131:** When an action has `effects.sensitive: true`, the ledger MUST allow developer policy to redact or reference user intent, params, observations, errors, state diffs, and results at rest.
- **SA-LED-132:** Redaction MUST NOT remove the stable action IDs, status values, policy modes, reason codes, undo-handle availability, or other structural facts required for audit, activity, undo, and eval-trace extraction.
- **SA-LED-133:** A redacted or reference-backed parameter value MUST remain sufficient for trusted undo execution when that parameter is required by the undo handle; otherwise the undo handle MUST be recorded as unavailable or degraded with disclosure.
- **SA-LED-134:** This specification does not define retention schedules, encryption, access control, legal hold, or compliance regimes; those are developer-controlled storage and governance choices.

## 12. Storage Interface and Depth Policy (Normative)

- **SA-LED-140:** A conforming ledger layer MUST provide conceptual operations to create a steering invocation record, append or attach policy decisions, attach action-step status changes, attach approval outcomes, attach execution results, attach undo handles, attach undo attempts, attach errors, and extract an ordered trace.
- **SA-LED-141:** Ledger writes that are required before execution by policy MUST report success or failure to the runtime before the affected execution is represented as authorized.
- **SA-LED-142:** Ledger writes that attach later execution, repair, or undo facts SHOULD be retried or marked degraded when storage is temporarily unavailable, subject to developer storage policy.
- **SA-LED-143:** A developer storage policy MUST define the ledger scope, retention depth, redaction behavior, and durability expectation for the integration's chosen posture and conformance claim.
- **SA-LED-144:** The framework MUST allow different ledger backends for different integrations or conformance levels, including in-memory session storage, browser storage, local durable storage, server durable storage, or append-only audit storage.
- **SA-LED-145:** A ledger backend MUST preserve minimal record semantics even when it stores records as event streams, mutable rows, documents, logs, or application state.
- **SA-LED-146:** A ledger backend MUST NOT expose stale undo availability after a handle has expired, failed, been superseded, or become unavailable.

## 13. Derived Uses (Informative)

The same minimum record supports several downstream uses:

1. Activity trails consume intent summaries, action IDs, declaration-derived titles, status, disclosure records, errors, and undo-handle availability.
2. Undo consumes per-step undo handles, state references, ordering, eligibility, and expiration.
3. Eval traces consume intent, surface context, action IDs, parameters or redacted references, policy rationale, execution status, errors, repairs, and undo results.
4. Debugging and replay may consume extended fields such as model traces, raw observations, state diffs, latency, and provider IDs.
5. Saved workflows or recipes consume stable declaration IDs and parameter schemas, not copied executor semantics.
6. Analytics consume aggregate status, mode, and reason-code data subject to developer redaction and retention policy.

## 14. Worked Ledger Trace (Informative)

This trace uses the three-step policy example from `SA-POL`: set a custom palette, apply a landing-page template, then generate directions. Under the `creative-tool` posture, the first two safe reversible steps execute as a prefix, and the quota-consuming generation step is held as a gated suffix. `SA-EXEC` owns how the chain is scheduled and displayed; this trace only shows the ledger-side facts.

| Order | Ledger fact | Record contents |
|---:|---|---|
| 1 | Invocation recorded | `recordId: inv_101`; intent text "Use #0F766E and #B45309, switch to the landing page template, then generate three directions"; surface `editor`; initiator `user`. |
| 2 | Policy decision recorded | Final chain mode `Gated suffix`; action IDs `palette.set_custom`, `template.apply_landing`, `lab.generate_directions`; executed-prefix boundary after step 2; held-suffix boundary before step 3; selected posture `creative-tool`; effect floor `quota -> Gated suffix`; reason codes include `safe_reversible_prefix` and `quota_gated_suffix`. |
| 3 | Step 1 succeeds | `palette.set_custom` params are recorded; status `succeeded`; writes `design.palette`; undo handle `h1` mechanism `declared_inverse`, status `available`. |
| 4 | Step 2 succeeds | `template.apply_landing` params are recorded; status `succeeded`; writes `design.template`; undo handle `h2` mechanism `runtime_snapshot`, status `available`, covering `design.template`. |
| 5 | Step 3 held | `lab.generate_directions` status `held`; approval state `pending`; no execution result and no undo handle because the step has not executed. |
| 6 | User requests undo-all before approving suffix | Undo attempt `u1` targets successfully executed prefix steps 1 and 2; held step 3 is recorded as not executed and therefore not undone. |
| 7 | Undo runs in reverse execution order | Handle `h2` restores the template snapshot and records success; handle `h1` runs the declared inverse and records success. |
| 8 | Invocation reconciled | Steps 1 and 2 status `undone`; step 3 status `held` or `canceled` depending on execution-side outcome; undo attempt `u1` status `succeeded_for_executed_scope`; disclosure states that the gated suffix never executed. |

If step 2 had been an irreversible server mutation that already succeeded, step 6 could not be recorded as successful undo-all. The ledger would have to record either refused full undo or partial undo with disclosure that step 2 was not reversed.

## 15. Resolution Notes for This Ledger Document (Informative)

The following issue-level decisions are recorded so later authors do not re-open them accidentally:

1. The minimal record is intentionally narrow: record identity, ordering, surface/initiator, intent reference, policy decision, approval state, ordered action steps, params or redacted references, statuses, errors, repair linkage, state/observation references, undo handles, and disclosures. Raw model traces, provider metadata, full snapshots, analytics, and compliance fields are extensions.
2. Undo-all uses reverse execution order over the successfully executed scope. If any succeeded step in scope lacks an available undo handle, the outcome is refused full undo or disclosed partial undo, never silent skipping.
3. Server mutation reversibility uses mechanism descriptors rather than new declaration kinds: compensating actions and soft-delete windows can support `undoable` only when they fully restore the relevant product and domain state; otherwise the honest label is `irreversible`.
4. Sensitive params are handled through redaction or stable references. Redaction cannot erase the structural facts needed for policy audit, activity, eval traces, or trusted undo.
5. Storage depth is policy-controlled. An in-memory session ledger is conformant for a creative tool that only claims session trail and session undo; sensitive-domain or durable-audit products must choose stronger storage.
6. Still-executing chain behavior is deliberately not specified here. The ledger records pending undo requests, current step statuses, and final reconciliation; `SA-EXEC` owns cancellation, pausing, scheduling, and surface behavior.
7. Issue #83: clarification linkage is an invocation-scope field, not a step-scope one. `SA-LED-034`'s `repairOfStepId` links a step to the step it repairs, but a clarification blocks before any step executes, so the linkage a clarification needs is record-to-record. `SA-LED-041` then makes the stale-policy question auditable rather than only normative: a resuming invocation that lacks its own policy decision record is visibly reusing a decision made on inputs that have changed.

No conflict with `SA-POL-108`, `SA-POL-109`, or `SA-DECL` undo fields was identified while writing this document.

## 16. Self-Audit (Informative)

This document was checked against the issue acceptance criteria after drafting:

1. The minimal record supports undo, activity trail rendering, and eval-trace extraction without requiring raw model traces, analytics, durable storage, or compliance fields.
2. `SA-POL-108` rationale fields are all representable in `PolicyDecisionRecord`.
3. `SA-POL-109` is honored by requiring every policy decision associated with steering to be recorded.
4. `SA-DECL-049` through `SA-DECL-053` and `SA-DECL-103` remain the source of undo derivation; this document records and executes handles without redefining declaration fields.
5. An in-memory session ledger remains conformant for a creative-tool policy that makes only session-scoped claims.
6. Execution-path behavior, chain scheduling, router semantics, and UI presentation are left to `SA-EXEC`.
7. The worked trace covers a three-step chain with a gated suffix followed by undo-all.

## 17. Framework Decides vs. Developer Decides (Normative)

- **SA-LED-160:** This action ledger specification MUST preserve the framework/developer boundary in Table 1.

| Requirement | The framework decides | The developer decides |
|---|---|---|
| **SA-LED-161** | The minimal steering invocation record needed for undo, activity, and eval traces. | Additional record fields for debugging, analytics, compliance, replay, saved workflows, or product audit. |
| **SA-LED-162** | That every policy decision associated with proposed action use is recordable and represented with the rationale fields required by `SA-POL-108`. | The concrete storage backend, durability level, and retention depth beyond the selected conformance and policy requirements. |
| **SA-LED-163** | That undo handles are executable mechanisms or honest no-undo records, derived from `SA-DECL` reversibility semantics. | The product-specific inverse, snapshot capture, compensation, or soft-delete implementation that makes a reversal honest. |
| **SA-LED-164** | The ledger vocabulary for full undo, partial undo, compensation, soft-delete windows, expiration, supersession, and honest irreversibility. | Which server mutations can truthfully satisfy those mechanisms in the product's domain. |
| **SA-LED-165** | That undo-all never silently skips irreversible or unavailable steps and records per-step outcomes. | Whether the product offers disclosed partial undo, refuses full undo, or exposes additional recovery workflows. |
| **SA-LED-166** | That sensitive values can be redacted or reference-backed without losing structural audit and undo facts. | The redaction policy, encryption, access control, legal retention, and governance regime. |
| **SA-LED-167** | That ledger storage is pluggable and depth is policy-controlled. | Whether a session-memory trail, browser storage, local durable store, server audit log, or append-only compliance system is appropriate. |
| **SA-LED-168** | That ledger records preserve enough ordering and status to reconcile undo with execution results. | The execution scheduling, cancellation, surface presentation, and chain behavior specified by `SA-EXEC` and the integrating app. |
