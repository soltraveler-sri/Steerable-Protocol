# Steerable Apps Execution and Surfaces Specification (Normative)

**Status:** Draft v0.1
**Spec code:** SA-EXEC
**Role:** Execution paths, intent routing contract, cross-surface continuation, observation, repair, and user-visible steering surfaces
**Canonical project source:** `Steerable-Protocol-NorthStar.md`

## 1. Introduction (Informative)

Execution is where a resolved user intent becomes product behavior. In a Steerable App, the model proposes capability use, the registry and policy engine constrain it, and trusted app-owned executors perform the work through the application itself.

This document specifies the operational form of the founding decision that the loop is a capability, not a mandate. Direct dispatch is a first-class path for a single safe action. Chain execution, tool loops, and plan preview exist for work whose structure, uncertainty, or policy outcome calls for them.

This document also specifies the cross-surface execution semantics that make a Steerable App more than a set of mounted component tools: navigate, await the destination surface's declared capabilities, continue, and fail legibly when continuation is unavailable.

## 2. Scope and Dependencies (Informative)

This document consumes the core vocabulary in `SA-CORE`, the declaration contracts in `SA-DECL`, and the autonomy ladder in `SA-POL`.

Surface declarations are defined by `SA-DECL-080` through `SA-DECL-087`. This document builds on those requirements by defining how execution waits for, continues across, and fails across declared surfaces. It does not redefine surface declaration fields.

Autonomy modes are defined by `SA-POL-080` through `SA-POL-097`. This document operationalizes those modes after policy resolution. It does not decide which mode a given invocation receives.

Ledger and undo-handle vocabulary is defined by `SA-CORE-032` and `SA-CORE-033`. This document states when steps, decisions, results, failures, and undo handles are recorded or preserved; it does not define ledger record schemas, storage, retention, or indexing.

The UX surfaces catalog in Section 12 is informative. It lists replaceable heads over the same execution engine rather than prescribing a UI toolkit, component hierarchy, or visual design.

## 3. Shared Execution Invariants (Normative)

- **SA-EXEC-001:** A conforming execution engine MUST consume proposed action use only after the proposal has validated against the registry, strict action parameters, current capability availability, and policy output.
- **SA-EXEC-002:** A conforming execution engine MUST treat model output as an untrusted proposal and MUST execute mutation, navigation, side effects, remote writes, or destructive operations only through trusted app-owned executors declared as required by `SA-DECL-031` and `SA-DECL-046`.
- **SA-EXEC-003:** A conforming implementation MUST support the four execution paths defined in this document: direct dispatch, chain execution, tool loop, and plan preview.
- **SA-EXEC-004:** A conforming implementation MUST NOT require one execution path app-wide, surface-wide, or risk-class-wide solely because an agent is involved.
- **SA-EXEC-005:** Execution path selection MUST be the result of both router classification and policy output, with policy retaining authority over autonomy mode as specified by `SA-POL-100` through `SA-POL-108`.
- **SA-EXEC-006:** A conforming implementation MUST NOT add plan preview, confirmation, approval, a tool loop, or an additional model round trip to a single eligible action solely as framework ceremony.
- **SA-EXEC-007:** Every action execution attempt MUST expose user-visible activity promptly enough that the user can understand whether the system is acting, held at a gate, complete, failed, or undoable.
- **SA-EXEC-008:** User-visible activity required by this document MUST NOT be implemented as a blocking precondition for direct dispatch when execution can safely begin immediately.
- **SA-EXEC-009:** Every executed action step MUST be recordable by the ledger layer with its policy decision, execution result, error or repair outcome, and undo handle where one exists; this document does not define the ledger record schema.
- **SA-EXEC-010:** When an action declaration claims `undoable` or `snapshot` reversibility, execution MUST preserve the resulting undo handle or restoration mechanism in a form usable by later undo behavior as defined by `SA-CORE-033` and `SA-DECL-103`.
- **SA-EXEC-011:** An execution engine MUST stop rather than silently continue when a required registry entry, executor, surface, policy decision, or required parameter is unavailable at execution time.
- **SA-EXEC-012:** A stopped execution MUST leave the user with a legible outcome: completed steps, held steps, skipped steps, failed step, and available undo scope.
- **SA-EXEC-013:** A terminal steering error MUST be emitted at error severity into the operator-facing diagnostic stream of the process in which it originates, in addition to whatever the user is shown. A terminal steering error is one that ends a steering invocation without the user's intent being satisfied, including a failed trusted executor, a failed router or model-provider call, a validation failure that stops execution under `SA-EXEC-011`, and a cross-surface failure under `SA-EXEC-171` or `SA-EXEC-172`.
- **SA-EXEC-014:** When a terminal steering error originates in a server, worker, or other operator-owned process, returning or streaming it to the client MUST NOT be treated as satisfying `SA-EXEC-013`; the originating process MUST emit its own record. That record is subject to the redaction policy in `SA-CTX-120` and `SA-LED-131`, and redaction MUST NOT reduce it below the failing action ID or route class, the failure class, and an error summary, consistent with `SA-LED-132`.
- **SA-EXEC-015:** A conforming integration between a model and app behavior MUST separate two seams and MUST NOT let the first stand in for the second. The **policy-preview seam** is a synchronous, ecosystem-facing policy resolution — the shape a `canUseTool` callback or a `needsApproval`/`toolApproval` predicate provides — that returns an advisory `allow`, `needs-approval`, or `deny` for a proposed tool call and consults no ledger; it is advisory policy resolution, never execution authorization. The **execution seam** is the validating, gating, and ledgered pipeline defined by `SA-EXEC-001` through `SA-EXEC-012`. Every model-authorized action proposal MUST reach an execution path that satisfies `SA-EXEC-001` through `SA-EXEC-009` and records the attempt under `SA-LED-002`, however the adopter builds that path. The model call, prompt, history, and router that produce the proposal remain developer-owned under `SA-CORE-094` and `SA-EXEC-035`; this requirement governs only the last hop, from an authorized proposal to a ledgered execution path.
- **SA-EXEC-016:** A policy-preview-seam decision MUST NOT be the terminal record of a proposed action's use. An adapter-level `allow`, `needs-approval`, or `deny` is advisory: a proposal resolved to `allow` MUST still be dispatched through the execution seam so that its execution attempt and result are recorded, and a proposal resolved to `deny` or `needs-approval` that ends at the preview seam without a corresponding execution-path record leaves that disposition unledgered, contrary to `SA-LED-002` and `SA-POL-109`. Routing the proposal into the execution seam satisfies this requirement: the engine re-resolves policy, raises any gate through the single `ApprovalHook` consent point, and records allow, refusal (`unknown_action`, `invalid_params`, policy refusal), and result outcomes alike.

## 4. Intent Router Classification Contract (Normative)

- **SA-EXEC-020:** A conforming intent router MUST classify each user intent into exactly one initial route class from this set: `answer`, `single action`, `action chain`, `workflow needing the loop`, `clarification`, or `refusal/handoff`.
- **SA-EXEC-021:** A router classification MUST identify the source surface, the route class, the user intent being routed, and the registry capability IDs or read-tool needs that justify the class when capability use is proposed.
- **SA-EXEC-022:** A router classification that proposes actions MUST include strict structured parameters for any action that is ready to execute, or MUST identify the missing information that prevents execution.
- **SA-EXEC-023:** A router classification that does not choose direct execution MUST include an escalation reason that is specific enough for an eval fixture to assert the expected route class.
- **SA-EXEC-024:** The `answer` route class MUST be used when the request can be satisfied by available facts, read tools, or ordinary generated explanation without action execution.
- **SA-EXEC-025:** The `single action` route class MUST be used when the request maps to one available declared action, the needed parameters are known or deterministically derivable from current declared context, and no conditional observation is needed before attempting that action.
- **SA-EXEC-026:** The `action chain` route class MUST be used when the request maps to a finite ordered set of declared actions with known dependencies and parameters, and continuation can be determined from declared capability availability and ordinary step results rather than from open-ended agent reasoning.
- **SA-EXEC-027:** Cross-surface execution MUST NOT by itself force the `workflow needing the loop` route class when the target surface and required capabilities are declared and the ordered continuation is known.
- **SA-EXEC-028:** The `workflow needing the loop` route class MUST be used when satisfying the request requires iterative read-act-observe-repair behavior, conditional branching on observations, state discovery before action choice, or repair planning that cannot be reduced to a known ordered action list.
- **SA-EXEC-029:** The `clarification` route class MUST be used when required user intent, target object, parameter value, or consent scope is missing and cannot be safely inferred from registry declarations, current facts, read tools, or product defaults.
- **SA-EXEC-030:** The `refusal/handoff` route class MUST be used when the request is outside declared capabilities, forbidden by policy, unsupported by trusted executors, unsafe to automate under supplied inputs, or better served by a product-native human path.
- **SA-EXEC-031:** A router MUST NOT escalate an eligible `single action` route to `workflow needing the loop` solely because the action was proposed through natural language.
- **SA-EXEC-032:** A router MUST NOT escalate a short compatible `action chain` to `workflow needing the loop` solely to obtain a plan artifact or approval artifact.
- **SA-EXEC-033:** Plan preview MUST be selected as an execution outcome only through policy output or a developer-controlled policy override, not by the router as a universal route class.
- **SA-EXEC-034:** A router MAY be implemented with rules, a model, a hybrid classifier, generated registry prompts, or another mechanism, provided that the externally checkable classification contract in this section is preserved.
- **SA-EXEC-035:** Router implementation details such as model provider, prompt shape, caching, streaming, and latency strategy are developer-controlled and MUST NOT change the route-class semantics in this section.
- **SA-EXEC-036:** A `clarification` route MUST record the pending proposal it is blocked on: the user intent being routed, the source surface, the candidate action or read-tool IDs where the router has chosen them, the parameters already determined, and the specific missing information identified under `SA-EXEC-022`. No action from that pending proposal may execute while the clarification is outstanding.
- **SA-EXEC-037:** When the user answers an outstanding clarification, the runtime MUST route the answer together with the pending proposal recorded under `SA-EXEC-036`, not the answer utterance alone. An answer that carries no capability, target, or scope of its own MUST resolve against the recorded proposal's intent, capability IDs, and parameters rather than being routed as a new intent or discarded.
- **SA-EXEC-038:** A clarification answer MUST be treated as untrusted input that completes a proposal, not as consent. It MUST NOT satisfy a policy gate under `SA-EXEC-090` through `SA-EXEC-100` or `SA-EXEC-190` through `SA-EXEC-194`, MUST NOT satisfy a `confirmation` floor, and MUST NOT carry the policy decision recorded for the clarifying invocation forward. The resumed proposal MUST re-resolve policy under `SA-EXEC-001` and `SA-POL-100` against current inputs before any executor is invoked.
- **SA-EXEC-039:** A pending clarification proposal MUST have a bounded lifetime. It MUST become invalid when its source surface deregisters, when a capability it names stops being available, or when a developer-configured finite expiry elapses; this specification does not fix that expiry's value. Once a pending proposal is invalid, a later answer MUST be routed as a new intent under `SA-EXEC-020` rather than silently reusing the recorded scope.

## 5. Execution Path Selection (Normative)

- **SA-EXEC-040:** A `single action` route with a policy outcome that permits ungated execution MUST be eligible for direct dispatch.
- **SA-EXEC-041:** An `action chain` route with a policy outcome of `Instant execution`, `Optimistic chain`, or `Gated suffix` MUST be eligible for chain execution.
- **SA-EXEC-042:** A `workflow needing the loop` route MUST be eligible for tool-loop execution after policy permits the reads and actions used by the loop.
- **SA-EXEC-043:** A policy outcome of `Plan preview` MUST be eligible for plan-preview execution.
- **SA-EXEC-044:** A policy outcome of `Read-only` MUST prevent action execution and limit behavior to facts, read tools, and answer generation as specified by `SA-POL-082` and `SA-POL-083`.
- **SA-EXEC-045:** A policy outcome of `Step-gated` MUST require a separate gate for each step that policy marks individually gated, without adding gates to other steps in the same request that policy allows to execute more autonomously.
- **SA-EXEC-046:** A policy outcome of `Refuse / hand off` MUST prevent action execution and surface the refusal or hand-off path to the user.
- **SA-EXEC-047:** Execution path selection MUST preserve the least-autonomous applicable policy outcome when chain-level and per-action policy outputs differ, consistent with `SA-POL-096`.

## 6. Direct Dispatch Path (Normative)

- **SA-EXEC-060:** Direct dispatch MUST execute one validated action without requiring a plan artifact, approval artifact, tool loop, or additional model interaction after routing and policy resolution.
- **SA-EXEC-061:** Direct dispatch MUST perform registry availability, parameter validation, precondition evaluation, and policy validation before invoking the action executor.
- **SA-EXEC-062:** Direct dispatch validation MAY happen in-process and MUST NOT be treated as a user-facing round trip or confirmation step.
- **SA-EXEC-063:** When direct dispatch validation succeeds, execution MUST invoke the trusted app-owned executor promptly.
- **SA-EXEC-064:** When direct dispatch validation fails before executor invocation, execution MUST report the failed validation or route repair need without pretending the action ran.
- **SA-EXEC-065:** When the direct-dispatched executor succeeds, execution MUST expose the result and any available undo affordance through a user-visible activity surface.
- **SA-EXEC-066:** When the direct-dispatched executor fails, execution MUST expose the failure legibly and MUST NOT show stale success state.
- **SA-EXEC-067:** Direct dispatch MUST preserve an undo handle for `undoable` or `snapshot` actions as required by `SA-EXEC-010`.
- **SA-EXEC-068:** Direct dispatch MUST remain conformant when the only user-visible artifact is a prompt result, activity-trail row, or undo toast shown during or immediately after execution.

## 7. Chain Execution Path (Normative)

- **SA-EXEC-080:** Chain execution MUST represent the work as an ordered sequence of declared action steps.
- **SA-EXEC-081:** Each chain step MUST have a user-visible execution status drawn from a stable implementation vocabulary that distinguishes at least pending, executing, succeeded, held, skipped, failed, and undone states.
- **SA-EXEC-082:** Chain execution MUST evaluate registry availability, preconditions, and policy for every step before that step executes.
- **SA-EXEC-083:** Chain execution MAY execute a reversible prefix as soon as its steps are validated and policy permits execution, without waiting for later gated or uncertain suffix steps.
- **SA-EXEC-084:** An optimistic reversible prefix MUST include only steps for which the runtime can preserve an undo handle or restoration mechanism.
- **SA-EXEC-085:** Chain execution MUST expose aggregate undo for the reversible executed portion of the chain.
- **SA-EXEC-086:** Aggregate undo MUST roll back completed reversible steps in reverse execution order unless the integrating developer proves a different order is required to restore the same product state.
- **SA-EXEC-087:** Aggregate undo MUST NOT claim to reverse a step that lacks an executable undo handle or restoration mechanism.
- **SA-EXEC-088:** If a user invokes aggregate undo while the chain is still executing, the runtime MUST cancel not-yet-started steps, request cancellation of the in-flight step when the executor supports cancellation, and then roll back completed reversible steps within the aggregate undo scope.
- **SA-EXEC-089:** If an in-flight step cannot be cancelled, the runtime MUST wait for that step to settle before deciding whether it is included in the rollback scope.
- **SA-EXEC-090:** When chain execution reaches a step whose policy output requires a gate, execution MUST stop before that step and mark that step plus the remaining ordered suffix as held.
- **SA-EXEC-091:** A held suffix MUST identify the boundary between the executed prefix and held suffix in user-visible activity and in a form recordable by the ledger layer.
- **SA-EXEC-092:** A held suffix gate MUST describe the held action set, policy rationale, material effects, and undo implications using declaration-derived titles and descriptions where available.
- **SA-EXEC-093:** Approval of a held suffix MUST authorize only the held steps and consent scope presented at the gate.
- **SA-EXEC-094:** Decline of a held suffix MUST prevent every held step from executing.
- **SA-EXEC-095:** After a held suffix is declined, the already-executed prefix MUST remain visible and undoable when it has undo handles.
- **SA-EXEC-096:** After a held suffix is declined, the runtime MUST NOT silently roll back the executed prefix unless developer policy declared the prefix dependent on the suffix and the gate presentation made that rollback behavior visible before the decision.
- **SA-EXEC-097:** If developer policy rolls back a declined prefix, rollback MUST use the same aggregate undo semantics defined by `SA-EXEC-085` through `SA-EXEC-089`.
- **SA-EXEC-098:** If a chain step fails, execution MUST stop dependent later steps, mark independent skipped or held steps legibly, and preserve aggregate undo for completed reversible steps.
- **SA-EXEC-099:** Chain execution MAY permit retry of a failed or held suffix only after revalidating registry availability, current surface, preconditions, and policy.
- **SA-EXEC-100:** Chain execution MUST NOT use optimistic execution to bypass a policy gate, confirmation floor, unavailable surface, or unsatisfied precondition.

## 8. Tool Loop Execution Path (Normative)

- **SA-EXEC-110:** Tool-loop execution MUST be used for workflows whose route or policy outcome requires iterative read, action, observation, and repair.
- **SA-EXEC-111:** Tool-loop execution MUST NOT be required for a request that already qualifies for direct dispatch or chain execution unless policy, missing state, or observation uncertainty requires escalation.
- **SA-EXEC-112:** A tool loop MAY call declared read tools before choosing or parameterizing actions.
- **SA-EXEC-113:** A tool loop MUST validate every proposed action against the registry, action schema, current availability, and policy before executor invocation.
- **SA-EXEC-114:** A tool loop MUST observe action outcomes through action-specific `observe` hooks when available, declared read tools, surface facts, or another app-owned observation mechanism.
- **SA-EXEC-115:** A tool loop MUST distinguish an observation failure from an action execution failure in user-visible activity.
- **SA-EXEC-116:** A repair action proposed by a tool loop MUST be treated as a new untrusted action proposal and MUST pass registry and policy validation before execution.
- **SA-EXEC-117:** A tool loop operating inside an approved plan or gate MUST NOT execute a repair action outside the approved scope without first surfacing an amendment or additional policy gate.
- **SA-EXEC-118:** Tool-loop execution MUST have a developer-configurable finite step limit or time budget.
- **SA-EXEC-119:** When a tool loop reaches its step limit or time budget, it MUST stop legibly, preserve completed-step undo handles, and identify whether user input, retry, or manual hand-off is needed.
- **SA-EXEC-120:** Tool-loop execution MUST NOT hide repeated repair attempts behind stale success state.

## 9. Plan Preview Path (Normative)

- **SA-EXEC-130:** Plan preview MUST present a reviewable plan artifact before action execution begins.
- **SA-EXEC-131:** The plan artifact MUST identify the user intent, proposed action steps, known target surfaces, policy gates covered by the plan, material effects, and available undo scope.
- **SA-EXEC-132:** Plan preview MUST have one Apply decision for the reviewed scope.
- **SA-EXEC-133:** For a `Plan preview` policy outcome, Apply MUST cover every listed step and gated item inside the reviewed plan scope, and execution MUST NOT ask for a second confirmation for those same listed steps solely because a step is gated within the plan.
- **SA-EXEC-134:** Plan preview MUST NOT suppress a separate `Step-gated` policy outcome; steps resolved as `Step-gated` require the per-step gates specified by `SA-EXEC-045`.
- **SA-EXEC-135:** Declining a plan preview MUST prevent the plan's action steps from executing.
- **SA-EXEC-136:** Applying a plan MUST authorize execution only for the reviewed intent, listed action set, listed target surfaces, and material effect envelope.
- **SA-EXEC-137:** After Apply, execution MAY use chain execution or tool-loop execution inside the approved scope.
- **SA-EXEC-138:** An execution variation after Apply MAY consume the existing approval only when it preserves the approved user intent, does not introduce a new action ID outside the plan, does not increase risk or effects, does not expand writes or target surfaces, does not spend more quota or money than approved, and does not materially change the user-visible outcome.
- **SA-EXEC-139:** A material deviation after Apply MUST be surfaced as a plan amendment before the deviating action executes.
- **SA-EXEC-140:** A plan amendment MUST identify what changed, why the current execution cannot continue as approved, and the new action, surface, effect, cost, risk, or outcome scope being requested.
- **SA-EXEC-141:** Approval of a plan amendment MUST authorize only the amendment scope and the still-valid remainder of the original approved plan.
- **SA-EXEC-142:** Decline of a plan amendment MUST stop the amended portion, preserve completed-step undo handles, and leave the user with a legible partial outcome.
- **SA-EXEC-143:** Plan preview MUST NOT be required by this specification for any risk class, reversibility class, effect class, surface kind, or action count; those mappings belong to policy.
- **SA-EXEC-144:** A plan artifact MUST be derived from registry declarations, policy rationale, and current route context rather than from a second hand-written action table.

## 10. Cross-Surface Execution Semantics (Normative)

- **SA-EXEC-160:** Cross-surface execution MUST identify surfaces by declared surface `id` as defined by `SA-DECL-080` through `SA-DECL-083`.
- **SA-EXEC-161:** A route path, URL, component name, DOM selector, or visual region MUST NOT be treated as the normative surface identity unless it resolves to a declared surface `id`.
- **SA-EXEC-162:** A surface encountered after navigation MUST be treated as the same target surface only when it registers the same declared surface `id`.
- **SA-EXEC-163:** A cross-surface chain MUST identify the target surface for any step whose preconditions require a surface that is not currently live.
- **SA-EXEC-164:** When execution needs to move between surfaces, navigation MUST occur through a trusted app-owned navigation action or another app-owned surface transition mechanism represented as a declared action, consistent with the declaration and executor requirements in `SA-DECL-031`.
- **SA-EXEC-165:** After navigation begins, execution MUST wait for the destination surface to register with the registry as required by `SA-DECL-084`.
- **SA-EXEC-166:** The wait for destination readiness MUST be bounded by a finite timeout.
- **SA-EXEC-167:** The framework default destination-readiness timeout MUST be 5000 milliseconds unless the integrating developer configures a different finite timeout.
- **SA-EXEC-168:** Destination readiness MUST require both the target surface registration and availability of the capabilities needed by the next step, evaluated through surface liveness and capability preconditions as required by `SA-DECL-085`.
- **SA-EXEC-169:** Execution MUST continue the chain only after destination readiness is satisfied.
- **SA-EXEC-170:** Execution MUST NOT invoke a destination-surface action before that action is available on the registered destination surface.
- **SA-EXEC-171:** If the destination surface does not register before timeout, execution MUST fail legibly at the cross-surface boundary.
- **SA-EXEC-172:** If the destination surface registers but required capabilities are absent or preconditions remain unsatisfied before timeout, execution MUST fail legibly with the unavailable capability or precondition boundary.
- **SA-EXEC-173:** A cross-surface failure MUST preserve completed reversible prefix undo handles and MUST NOT strand half-executed state without an undo path for the reversible prefix.
- **SA-EXEC-174:** A cross-surface failure MUST mark the remaining suffix as not executed unless and until a later retry is explicitly initiated.
- **SA-EXEC-175:** Retry after cross-surface failure MAY be offered, but retry MUST revalidate current surface, destination surface, required capabilities, preconditions, parameters, and policy.
- **SA-EXEC-176:** A retry MUST NOT silently continue in the background after the user has been shown a terminal cross-surface failure.
- **SA-EXEC-177:** If the user manually navigates away during a bounded wait, the runtime MUST either cancel the wait legibly or restart the wait only after confirming that the original target surface and policy scope still apply.
- **SA-EXEC-178:** Cross-surface execution MUST remain framework-agnostic; this specification defines surface identity, wait, continuation, timeout, failure, and retry semantics rather than a React, router, browser, or server implementation.
- **SA-EXEC-179:** If a surface deregisters before a required step executes, execution MUST treat that surface's capabilities as unavailable until the same declared surface `id` registers again and destination readiness is revalidated.
- **SA-EXEC-180:** The steering session host — the runtime scope that owns pending cross-surface continuations, the bounded wait required by `SA-EXEC-165` through `SA-EXEC-167`, the undo scope of the in-flight invocation, and the user-visible activity surface required by `SA-EXEC-200` — MUST outlive intra-app navigation between declared surfaces. Its lifetime MUST NOT be scoped to any navigable surface. A session host destroyed and recreated by the navigation that `SA-EXEC-164` requires cannot satisfy `SA-EXEC-165` through `SA-EXEC-173`, so this is a precondition of cross-surface execution rather than a presentation choice.
- **SA-EXEC-181:** Where a platform cannot preserve the session host across a transition — a full document load, a host process restart, or a platform-imposed teardown — the runtime MUST treat any pending continuation as a cross-surface failure under `SA-EXEC-171` and preserve completed reversible prefix undo under `SA-EXEC-173`, rather than discard the continuation silently. Such a transition MUST NOT be used as the ordinary intra-app navigation mechanism for a declared cross-surface path.
- **SA-EXEC-182:** A pending cross-surface continuation MUST have an identity that is stable for the duration of the bounded wait and a settled/unsettled state. Continuation MUST be keyed to that identity rather than to the delivery of any particular destination-readiness signal.
- **SA-EXEC-183:** Delivering destination readiness for one unsettled pending continuation more than once MUST cause at most one continuation attempt; every delivery after the first MUST be discarded without effect. Surface-registration callbacks, wait timers, subscriptions, and host re-entry are all such deliveries, and a runtime MUST NOT assume any of them fires exactly once.
- **SA-EXEC-184:** A destination-readiness or resume signal delivered for a pending continuation that has already settled — succeeded, failed under `SA-EXEC-171` or `SA-EXEC-172`, or cancelled under `SA-EXEC-177` — MUST be discarded as a no-op. It MUST NOT begin a new attempt, which `SA-EXEC-176` forbids once a terminal failure has been shown, and it MUST NOT record or display a new execution attempt, failure, or stopped-execution outcome for a continuation that already reached one.
- **SA-EXEC-185:** Discarding a duplicate under `SA-EXEC-183` or `SA-EXEC-184` MUST NOT suppress a distinct pending continuation: idempotency is scoped to one continuation identity, and a later request that produces a new pending continuation is a new identity that MUST be attempted under `SA-EXEC-165` through `SA-EXEC-169`. An explicit user-initiated retry after a shown terminal failure is not a readiness signal and MUST revalidate under `SA-EXEC-175`.

## 11. Step-Gated Execution Semantics (Normative)

- **SA-EXEC-190:** Step-gated execution MUST present a separate policy gate before each action or step that policy resolved as individually gated.
- **SA-EXEC-191:** Step-gated execution MUST NOT add gates to preceding or following steps that policy resolved to a more autonomous mode.
- **SA-EXEC-192:** Approval of one step gate MUST authorize only that step and the consent scope presented for that step.
- **SA-EXEC-193:** Decline of one step gate MUST prevent that step and dependent later steps from executing.
- **SA-EXEC-194:** Decline of one step gate MUST preserve completed reversible prefix undo handles and expose aggregate undo for that prefix.
- **SA-EXEC-195:** Step-gated execution MAY continue independent later steps only when policy allows them, their preconditions remain satisfied, and the user-visible activity makes the skipped or declined dependency clear.

## 12. User-Visible Steering Surfaces (Normative)

- **SA-EXEC-200:** A conforming implementation MUST expose steering activity through at least one user-visible surface.
- **SA-EXEC-201:** The visible activity surface MUST distinguish proposed, executing, succeeded, held, failed, declined, undone, and skipped work at the level needed for the user to understand current state.
- **SA-EXEC-202:** The visible activity surface MUST expose aggregate undo when aggregate undo is available.
- **SA-EXEC-203:** The visible activity surface MUST expose per-action undo when per-action undo is available and aggregate undo is not the only appropriate control.
- **SA-EXEC-204:** The visible activity surface MUST show held-suffix and plan-amendment boundaries when those states occur.
- **SA-EXEC-205:** The visible activity surface MUST show cross-surface waiting and cross-surface failure states when those states occur.
- **SA-EXEC-206:** User-visible wording for action names and descriptions SHOULD be derived from declaration `title` and `description` fields as required by `SA-DECL-104`.
- **SA-EXEC-207:** A product MAY choose chat, command palette, inline intent bar, voice, background automation, external bridge, or another head as the primary surface, provided that the execution semantics in this document are preserved.
- **SA-EXEC-208:** The visible activity surface MUST remain usable as recorded steering activity accumulates. Its rendered representation MUST NOT grow one-for-one and without bound with the number of recorded steps, and the requirements in this section MUST NOT be read as requiring every recorded step to be rendered simultaneously.
- **SA-EXEC-209:** An implementation MAY satisfy `SA-EXEC-208` by collapsing, grouping, virtualizing, paginating, or summarizing activity. A collapsed or grouped representation MUST disclose the states it contains, at minimum whether it contains any failed, held, declined, or disclosure-bearing work under `SA-LED-037`, so that a group is never presented as uniformly successful while containing work that is not.
- **SA-EXEC-210:** Scaling MUST NOT drop outcomes. Every outcome this document requires to be visible — `SA-EXEC-012`, `SA-EXEC-066`, `SA-EXEC-201`, `SA-EXEC-204`, `SA-EXEC-205` — and every disclosure required by `SA-LED-037` MUST remain present and reachable from the visible activity surface. Collapsing and grouping are not dropping: an implementation MUST NOT satisfy `SA-EXEC-208` by discarding activity, by hiding it with no path to it, or by declining to record it.
- **SA-EXEC-211:** Undo affordances required by `SA-EXEC-202` and `SA-EXEC-203` MUST remain reachable for collapsed, grouped, or paginated work for as long as its undo handle is available under `SA-LED-075`.

## 13. Sequence Diagrams (Informative)

### 13.1 Direct Dispatch With No Added Round Trip

```text
User -> Intent surface: "make the accent #0F766E"
Intent surface -> Router: classify current utterance
Router -> Execution engine: single action palette.set_color { token: "accent", hex: "#0F766E" }
Execution engine -> Policy engine: resolve proposed action
Policy engine -> Execution engine: Instant execution
Execution engine -> Registry: validate schema, preconditions, availability
Execution engine -> palette.set_color executor: execute
palette.set_color executor -> App surface: update palette
Execution engine -> Activity surface: succeeded + undo available
Execution engine -> Ledger layer: recordable decision/result/undo handle

No plan artifact. No confirmation. No extra model/tool-loop round trip after routing and policy resolution.
```

### 13.2 Chain With Gated Suffix

```text
User -> Intent surface: "use these brand colors, switch to landing, then generate three directions"
Router -> Execution engine: action chain [palette.set_custom, template.apply_landing, lab.generate_directions]
Execution engine -> Policy engine: resolve chain
Policy engine -> Execution engine: Gated suffix after step 2
Execution engine -> palette.set_custom executor: execute reversible prefix step 1
Execution engine -> template.apply_landing executor: execute reversible prefix step 2
Execution engine -> Activity surface: steps 1-2 succeeded, undo all available
Execution engine -> Activity surface: step 3 held, quota gate shown

If user applies gate:
  Execution engine -> lab.generate_directions executor: execute held suffix
  Execution engine -> Activity surface: suffix succeeded or failed legibly

If user declines gate:
  Execution engine -> Activity surface: suffix not executed, prefix preserved, undo all available
```

### 13.3 Cross-Surface Chain With Failure Case

```text
User -> Intent surface: "open settings and change the workspace theme"
Router -> Execution engine: action chain [surface.navigate_settings, workspace.set_theme]
Execution engine -> Policy engine: resolve chain
Policy engine -> Execution engine: Optimistic chain
Execution engine -> surface.navigate_settings executor: navigate
Execution engine -> Registry: wait for declared surface id "settings"

Success path:
  Settings surface -> Registry: register surface "settings" with workspace.set_theme available
  Registry -> Execution engine: destination ready
  Execution engine -> workspace.set_theme executor: execute
  Execution engine -> Activity surface: navigation and theme change succeeded, undo all available

Failure path:
  Registry -> Execution engine: timeout or required capability unavailable
  Execution engine -> Activity surface: cross-surface continuation failed at "settings"; remaining suffix not executed
  Execution engine -> Activity surface: completed reversible prefix preserved with undo all
  Execution engine -> Ledger layer: recordable partial chain, failure boundary, undo handles
```

## 14. UX Surfaces Catalog (Informative)

The following surfaces are replaceable heads over the same registry, router, policy, and execution contracts:

| Surface | Typical role |
|---|---|
| Chat panel | Conversational intent entry, results, and follow-up. |
| Command palette | Fast keyboard-driven intent entry and action selection. |
| Inline intent bar | Local steering from a specific product region or selected object. |
| Voice surface | Spoken intent entry over the same route and policy contracts. |
| Plan card | Review artifact for a `Plan preview` policy outcome. |
| Approval sheet | Gate for a held suffix or step-gated action. |
| Activity trail | Durable or session-visible list of proposed, running, held, failed, completed, and undone work. |
| Undo toast | Lightweight completion and reversal affordance for direct dispatch or short chains. |
| Recipes or shortcut chips | Product-specific shortcuts learned from repeated intents or authored by the developer. |
| External bridge surface | Door-two access path generated from the same registry when the product exposes external-agent steering. |

Chat is one surface, not the product. A conforming implementation can lead with any of these surfaces if the same execution contracts remain true.

## 15. Resolution Notes for This Execution Document (Informative)

The following issue-level decisions and policy handoffs are recorded so later authors do not re-open them accidentally:

1. Router normativity is limited to route classes, required classification outputs, and escalation criteria. Model choice, prompts, caching, and latency strategy remain implementation details.
2. Bounded cross-surface wait uses declared surface IDs as the target identity, waits for both surface registration and next-step capability availability, defaults to 5000 milliseconds, and fails legibly on timeout.
3. One Apply on a plan covers the reviewed scope, including listed gated items in that `Plan preview` outcome. Material deviations require a plan amendment before execution continues.
4. Aggregate undo during an executing chain cancels not-yet-started steps, requests cancellation for the in-flight step where supported, waits for non-cancellable in-flight work to settle, and rolls back completed reversible steps in reverse order.
5. Surface identity is the declared surface `id`; route paths, component names, and DOM selectors are implementation details unless they resolve to that ID.
6. Gated suffix execution runs the reversible prefix under its own policy outcome, holds the first gated step and remaining ordered suffix, and resumes only after the held gate is approved.
7. Plan preview is an execution path selected by policy, not a requirement attached by this document to any risk class or action count.
8. Step-gated execution gates only the specific steps policy marks as individually gated; it does not add ceremony to neighboring clean safe reversible steps.
9. The visible activity trail is required for execution state, held boundaries, failures, and undo affordances, but it is not a blocking precondition for direct dispatch.
10. Declining a held suffix or amended plan preserves the already-executed reversible prefix by default with undo available; developer policy may roll it back only when that dependency and rollback behavior were visible before the decision.
11. Issue #83: the session-host lifetime invariant is normative rather than advisory because it is the structural precondition of Section 10, not a UX preference. A host whose lifetime is scoped to a navigable surface is destroyed by the very navigation `SA-EXEC-164` requires, so `SA-EXEC-165` through `SA-EXEC-173` become unsatisfiable by construction while every static reading of them still passes. `SA-EXEC-250` continues to leave the binding to the developer; `SA-EXEC-180` states the one thing the binding must not do.
12. Issue #83: clarification resumption is closed against re-routing rather than against carrying. The answer completes the recorded pending proposal, so scope is not lost when the answer is a bare affirmative, but the prior policy decision does not survive. Policy is a pure function of explicit inputs under `SA-POL-102` through `SA-POL-105`; a clarification changes the action set, the parameters, or the consent scope, and time, surface liveness, and grants may all have moved. Reusing the earlier decision would authorize execution on inputs policy never saw, which is the shape `SA-CORE-051` exists to prevent. An answer is therefore input, never approval.
13. Issue #83: idempotent resume and `SA-EXEC-176` do not conflict once the continuation, rather than the signal, carries identity and settled state. `SA-EXEC-176` governs beginning a new attempt after a terminal failure was shown; `SA-EXEC-183` and `SA-EXEC-184` govern duplicate delivery of a signal for a continuation that already has, or already reached, an outcome. A duplicate is discarded: it starts nothing, which is what `SA-EXEC-176` requires, and it reports nothing, which is what removes the spurious stopped-execution disclosure under a fully successful trail. Retry stays explicit and revalidating under `SA-EXEC-175`.
14. Issue #83: the activity trail's scaling contract permits collapsing and forbids dropping. `SA-EXEC-208` bounds the rendered representation, never the record; `SA-EXEC-210` keeps every outcome `SA-EXEC-012` and `SA-EXEC-201` make legible reachable. A trail that hid failures to stay short would trade one legibility guarantee for another and is non-conformant.
15. Issue #83 (B2): aggregate undo invoked while a step is *held at a gate* is resolved under the existing `SA-EXEC-088` — a held step is a not-yet-started step, so it MUST be canceled, never executed after the gate settles. The runtime therefore re-checks the undo request immediately after every gate returns and settles the held step `canceled` *before* building any execution controller, and it awaits gate settlement rather than racing it, so the reported outcome and the recorded facts agree. Because the held step never runs, its `canceled` status is a historical fact that is never overwritten to `succeeded`, honoring `SA-LED-003`, and the chain settles `canceled` with `canceled`/`skipped` steps, honoring `SA-EXEC-012`. The host approval decision gains a `canceled` variant so a hook honoring the undo signal reports the honest cancellation rather than fabricating a `declined`; that records a `canceled` approval, the vocabulary `SA-LED-036` already declares. No new normative requirement was needed.
16. Issue #83 (N6): the model-facing policy-preview seam and the ledgered execution seam are named and their boundary made normative because the SDK shipped both halves and never composed them. The only documented path for wiring a model — `createEcosystemAdapter.canUseTool` — resolves policy and returns an `allow`/`needs-approval`/`deny` decision, but no shown call site carried that decision into `ExecutionEngine`, so an integration following the guide recorded nothing, violating `SA-LED-002` and `SA-POL-109`. `SA-EXEC-015` and `SA-EXEC-016` mark the one hop this layer owns — from an authorized proposal to a ledgered execution path — without restating the developer-owned model loop as shippable (`SA-CORE-094`, `SA-EXEC-035`). The adapter is retained rather than deleted: it is the deliberate compile-down of policy into ecosystem callbacks and has no independent execution path to remove. `SA-EXEC-251` localizes the framework/developer boundary; `docs/guides/ecosystem-adapters.md` shows the worked composition and the single-consent-point double-gating pattern.

No conflict with the north-star, `SA-DECL`, or `SA-POL` was identified while writing this document.

## 16. Ceremony Self-Check (Informative)

This document was checked against the founding decision after drafting:

1. A single eligible action can run by direct dispatch with no plan artifact, confirmation, tool loop, or additional model round trip.
2. Cross-surface execution does not force a tool loop when the target surface and continuation are declared.
3. Plan preview is never required here by risk class, reversibility class, effect class, surface kind, or action count.
4. Gated suffix and step-gated semantics preserve policy gates without spreading those gates to clean safe reversible prefix actions.
5. Visible activity and ledger-recordable outcomes are required without specifying an SA-LED record schema or storage model.
6. Cross-surface failure preserves reversible prefix undo and marks the suffix not executed.

## 17. Framework Decides vs. Developer Decides (Normative)

- **SA-EXEC-240:** This execution and surfaces specification MUST preserve the framework/developer boundary in Table 1.

| Requirement | The framework decides | The developer decides |
|---|---|---|
| **SA-EXEC-241** | The four execution paths and their contracts. | Which path is reached for a product request through router implementation and policy configuration. |
| **SA-EXEC-242** | The router route classes and escalation criteria needed for conformance and evals. | Router model, prompts, deterministic rules, latency targets, caching, and fallback implementation. |
| **SA-EXEC-243** | That direct dispatch is a first-class path with no framework-imposed planning or confirmation ceremony for eligible actions. | Whether stricter product policy lowers autonomy for a particular action, role, user, or surface. |
| **SA-EXEC-244** | Gated suffix mechanics: execute eligible reversible prefix, hold the suffix, expose the boundary, and preserve undo for the prefix. | Gate copy, visual presentation, and whether a declined dependent prefix is preserved by default or visibly rolled back by policy. |
| **SA-EXEC-245** | Plan preview mechanics: one Apply for the reviewed scope, loop-backed execution inside scope, and amendments for material deviations. | Which requests resolve to plan preview and how plan artifacts look in the product. |
| **SA-EXEC-246** | Step-gated mechanics for policy-marked sensitive steps. | Which actions or domains policy marks as individually sensitive, regulated, or high risk. |
| **SA-EXEC-247** | Cross-surface semantics: declared surface identity, bounded wait, capability readiness, continuation, legible failure, retry validation, preserved prefix undo, the session-host lifetime invariant in `SA-EXEC-180` and `SA-EXEC-181`, and the idempotent-resume contract in `SA-EXEC-182` through `SA-EXEC-185`. | Surface IDs, location metadata, navigation implementation, timeout override, retry affordance, framework/router binding, and where the session host is mounted — subject to `SA-EXEC-180`, which forbids scoping its lifetime to a navigable surface. |
| **SA-EXEC-248** | Required user-visible execution states and undo affordances, and that activity presentation scales without dropping outcomes under `SA-EXEC-208` through `SA-EXEC-211`. | Primary UX head, visual design, copy tone, density, placement, and which collapsing, grouping, virtualization, pagination, or summarization mechanism keeps the trail usable. |
| **SA-EXEC-249** | That steps, decisions, results, failures, and undo handles are recordable by the ledger layer without this document defining storage shape. | Ledger storage depth, retention, redaction, durability, and audit policy beyond conformance requirements. |
| **SA-EXEC-250** | Framework-agnostic execution semantics, including which structural preconditions a binding must satisfy for those semantics to be reachable at all. | Whether implementation uses React, Next.js, another router, server/client split, native app surfaces, or another platform binding — provided the binding satisfies `SA-EXEC-180`, and provided the process where a terminal error originates satisfies `SA-EXEC-013` and `SA-EXEC-014`. |
| **SA-EXEC-251** | That model-authorized action proposals reach a ledgered execution path satisfying `SA-EXEC-001`–`SA-EXEC-009` and `SA-LED-002`, and that a policy-preview-seam decision is never the terminal record of a proposal's use, per `SA-EXEC-015` and `SA-EXEC-016`. | The model loop, provider, prompts, history, and router that produce proposals, and whether and where the synchronous policy-preview seam is consulted inside the ecosystem loop. |
