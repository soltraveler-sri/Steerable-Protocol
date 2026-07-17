# Steerable Apps Autonomy Policy Specification (Normative)

**Status:** Draft v0.1
**Spec code:** SA-POL
**Role:** Risk, reversibility, effects, autonomy ladder, posture presets, and policy-engine semantics
**Canonical project source:** `Steerable-Protocol-NorthStar.md`

## 1. Introduction (Informative)

Autonomy policy is the Steerable Apps contract area that turns declared action nature into execution posture. It is the home of the project's first founding decision: execution posture is policy, not workflow.

The framework does not hard-code one universal steering ceremony. A creative tool can execute safe reversible changes instantly with visible undo, while a sensitive-domain app can route the same registry model through stricter review. Both are valid outcomes of the same policy engine because the engine resolves posture from declaration metadata, app policy, user/session context, grants, and runtime signals.

This document elaborates the policy metadata declared by `SA-DECL-038` through `SA-DECL-044`; it does not fork those value sets. It cites the core vocabulary for actions, read tools, registry, posture, autonomy ladder, autonomy mode, policy engine, ledger, and undo handles from `SA-CORE-023` through `SA-CORE-033`.

## 2. Scope and Dependencies (Informative)

This document defines classification semantics, autonomy modes, policy-engine inputs and outputs, framework posture presets, and default resolution rules.

This document does not define the detailed execution mechanics of each mode, the shape of review artifacts, the user interface for gates, cross-surface wait algorithms, or the ledger record schema. Those subjects belong to `SA-EXEC` and `SA-LED`. This document does require every policy decision to be recordable so those later specifications have a trustworthy input.

## 3. Policy Metadata Value Sets (Normative)

- **SA-POL-001:** Policy metadata for action declarations MUST be interpreted as declaration semantics for actions as defined by `SA-CORE-023`, not as user-interface workflow instructions.
- **SA-POL-002:** The policy entry for an action MUST be derivable from the declaration fields named by `SA-DECL-101`.
- **SA-POL-003:** The `risk` value set for actions MUST be exactly the set declared by `SA-DECL-038`: `safe`, `side_effect`, `mutating`, and `destructive`.
- **SA-POL-004:** The `reversibility.kind` value set for actions MUST be exactly the set declared by `SA-DECL-039`: `undoable`, `snapshot`, and `irreversible`.
- **SA-POL-005:** The `effects` dimensions for actions MUST be exactly the fields declared by `SA-DECL-040`: `external`, `cost`, and `sensitive`.
- **SA-POL-006:** The `effects.external` value MUST use the boolean semantics declared by `SA-DECL-041`.
- **SA-POL-007:** The `effects.cost` value set MUST be exactly the set declared by `SA-DECL-042`: `none`, `quota`, and `money`.
- **SA-POL-008:** The `effects.sensitive` value MUST use the boolean semantics declared by `SA-DECL-043`.
- **SA-POL-009:** The `confirmation` value set MUST be exactly the set declared by `SA-DECL-044`: `never`, `policy`, and `always`.
- **SA-POL-010:** A posture preset, role rule, surface rule, grant, or runtime signal MUST NOT add new action declaration metadata values beyond the value sets in `SA-DECL-038` through `SA-DECL-044`.
- **SA-POL-011:** Posture configuration MUST live outside action declarations; declarations describe action nature, while posture maps that nature to autonomy modes.

## 4. Risk Classification Semantics (Normative)

- **SA-POL-020:** `risk` MUST classify the highest-risk effect that can occur during normal valid execution of the declared action.
- **SA-POL-021:** If one action executor can perform materially different risk classes for different valid parameters, the integrating developer SHOULD split it into separate actions; if it is not split, the declaration MUST use the highest applicable risk class.
- **SA-POL-022:** A coding agent classifying an unfamiliar action MUST inspect the declared executor, called setters or commands, network or storage writes, metered-resource use, deletion paths, user-visible side effects, and recovery mechanism before assigning risk.
- **SA-POL-023:** When the available evidence cannot distinguish two plausible risk classes, the action MUST be classified at the higher risk class until the declaration is narrowed or the executor is split.
- **SA-POL-024:** `safe` MUST mean execution is limited to process-local, tab-local, session-local, or product-local UI state where no external system is called or affected, no quota or money is spent, and no sensitive data is exposed outside the local application session.
- **SA-POL-025:** In-app navigation between declared surfaces MAY be classified as `safe` when it only changes local route or view state and can be restored by ordinary app navigation or an undo handle.
- **SA-POL-026:** Browser-level navigation that opens an external URL, launches another application, changes the OS clipboard, downloads a file, or emits a notification MUST be classified at least `side_effect`.
- **SA-POL-027:** `side_effect` MUST mean execution can affect a user-visible environment outside the app's internal state, but does not create, update, delete, or commit durable product data, does not spend quota or money, and does not cause hard-to-recover data loss.
- **SA-POL-028:** Clipboard writes, browser share sheets, local downloads, outbound URL openings, desktop or browser notifications, and local device affordances MUST be classified at least `side_effect` unless they also meet `mutating` or `destructive` criteria.
- **SA-POL-029:** `mutating` MUST mean execution can create, update, submit, publish, synchronize, or otherwise commit durable product state, remote state, account state, workflow state, or a metered resource.
- **SA-POL-030:** A remote draft save, cloud preference write, publish action, export that consumes quota, message send, billing-setting update, or app-backend mutation MUST be classified at least `mutating`.
- **SA-POL-031:** An action with `effects.cost` of `quota` or `money` MUST be classified as `mutating` or `destructive`, not `safe` or `side_effect`.
- **SA-POL-032:** `destructive` MUST mean execution can delete, overwrite, revoke, expose, spend, or commit something in a way that is hard to recover, materially lossy, or domain-significant even if a partial technical recovery path exists.
- **SA-POL-033:** Permanent deletion, irreversible reset, revocation of access, irreversible external send, irreversible purchase, data disclosure, and operations that bypass normal recovery windows MUST be classified as `destructive` unless the product can prove a lower-risk classification through an executable restoration mechanism and domain policy.
- **SA-POL-034:** `risk` MUST describe action nature before posture overrides, user settings, grants, or runtime-signal demotions are applied.

## 5. Reversibility Classification Semantics (Normative)

- **SA-POL-040:** `reversibility.kind` MUST classify the recovery mechanism that the runtime can honestly execute after successful action execution.
- **SA-POL-041:** `undoable` MUST mean the action declaration provides an executable inverse through the `undo` field required by `SA-DECL-049`.
- **SA-POL-042:** An `undoable` action's inverse MUST be specific enough to restore the action's own relevant effect without relying on an unbounded manual repair by the user.
- **SA-POL-043:** `snapshot` MUST mean the runtime can capture sufficient pre-action state and restore it as described by `SA-DECL-050`.
- **SA-POL-044:** A `snapshot` claim MUST NOT be used when the state needed for restoration is unavailable, stale before execution, too broad to restore safely, or outside the runtime's authority.
- **SA-POL-045:** `irreversible` MUST mean the runtime does not claim a reliable undo handle for the action, as allowed by `SA-DECL-051`.
- **SA-POL-046:** A compensating action MAY support a lower-risk product experience, but the original action MUST remain `irreversible` unless the compensation restores the relevant product and domain state to the prior condition.
- **SA-POL-047:** Reversibility MUST be evaluated after considering external effects, cost, sensitive data movement, and remote state, not merely local UI state.
- **SA-POL-048:** A reversible claim MUST be executable by trusted app-owned code and MUST NOT depend on the model remembering how to repair the outcome.

## 6. Effects and Confirmation Semantics (Normative)

- **SA-POL-060:** `effects.external` MUST be `true` when execution can call, update, notify, transmit to, or otherwise affect a system outside the current local application session.
- **SA-POL-061:** A backend owned by the same product still counts as external for `effects.external` when execution can persist, synchronize, bill, notify, or affect account state outside the current local session.
- **SA-POL-062:** `effects.external` MAY be `false` for local UI state, in-memory state, current-tab state, and local-only sandbox state that does not affect another system or user.
- **SA-POL-063:** `effects.cost` MUST be `none` when execution consumes no user-visible quota, credit, paid resource, funds, billable unit, or metered allocation.
- **SA-POL-064:** `effects.cost` MUST be `quota` when execution consumes a limited product allocation, daily limit, credit balance, rate-limited unit, export slot, build allowance, or comparable non-currency scarce resource.
- **SA-POL-065:** `effects.cost` MUST be `money` when execution can charge funds, initiate a purchase, change a paid subscription, consume a directly billable paid resource, transfer value, or otherwise affect financial liability.
- **SA-POL-066:** If any normal valid execution path can spend quota or money, the action MUST declare that cost value unless the action is split so the spending path is isolated.
- **SA-POL-067:** `effects.sensitive` MUST be `true` when execution can expose, transmit, transform, copy, summarize, redact, delete, or otherwise operate on data the integrating app's policy treats as sensitive.
- **SA-POL-068:** `effects.sensitive` MUST be `false` only when the action cannot receive, read, write, transmit, or transform sensitive data under valid inputs and declared reads.
- **SA-POL-069:** `confirmation: never` MUST mean the declaration itself asserts no inherent per-invocation gate, while still allowing developer policy to resolve a gated or refused mode from posture, role, surface, user setting, grant state, or runtime signals.
- **SA-POL-070:** `confirmation: policy` MUST mean the policy engine decides whether the invocation needs a gated mode from declared metadata and policy inputs.
- **SA-POL-071:** `confirmation: always` MUST set a minimum resolved mode of `Gated suffix` for any invocation that would otherwise execute the action.
- **SA-POL-072:** A sticky grant MUST NOT suppress `confirmation: always`.
- **SA-POL-073:** Framework-supplied presets MUST NOT resolve an action with `risk: safe`, `reversibility.kind` of `undoable` or `snapshot`, `effects.external: false`, `effects.cost: none`, `effects.sensitive: false`, and `confirmation: never` to a gated or refused mode by default.

## 7. Autonomy Ladder (Normative)

- **SA-POL-080:** The autonomy ladder MUST contain exactly these seven framework-defined modes: `Read-only`, `Instant execution`, `Optimistic chain`, `Gated suffix`, `Plan preview`, `Step-gated`, and `Refuse / hand off`.
- **SA-POL-081:** A resolved autonomy mode MUST be treated as the policy outcome for a proposed invocation, chain, or workflow, as described by `SA-CORE-029` and `SA-CORE-030`.
- **SA-POL-082:** `Read-only` MUST allow facts and read tools as defined by `SA-CORE-024` and `SA-CORE-025`, and MUST NOT execute actions.
- **SA-POL-083:** `Read-only` MUST be available when policy allows inspection or answer generation but does not allow mutation, side effects, external effects, or action execution for the request.
- **SA-POL-084:** `Instant execution` MUST allow a validated action or short compatible action chain to execute without a pre-execution gate, subject to registry availability, policy resolution, trusted execution, visible activity, and ledger-recordable rationale.
- **SA-POL-085:** `Instant execution` MUST preserve any available undo handle for actions declared `undoable` or `snapshot`.
- **SA-POL-086:** `Optimistic chain` MUST allow a compatible chain of actions to execute live with a visible activity trail and an aggregate undo affordance for the reversible executed portion.
- **SA-POL-087:** `Optimistic chain` MUST NOT include an action that lacks a claimed reversal mechanism in the aggregate undo affordance.
- **SA-POL-088:** `Gated suffix` MUST allow an eligible reversible prefix to execute under its own resolved mode while holding the first gated action and the remaining suffix until the policy gate for that suffix is satisfied or declined.
- **SA-POL-089:** `Gated suffix` MUST identify the boundary between the executed prefix and held suffix in a form recordable by the ledger.
- **SA-POL-090:** `Plan preview` MUST present the proposed action set as a single policy review outcome before execution begins, and execution MUST proceed only for the reviewed scope. (Informative: because the reviewed unit is the whole set, a chain resolving to `Plan preview` holds every step, including a step that would resolve `Instant execution` alone; see Resolution Note 9. `Gated suffix` is the mode that executes a safe prefix immediately.)
- **SA-POL-091:** `Plan preview` MUST NOT be required by the framework solely because a model proposed an action.
- **SA-POL-092:** `Step-gated` MUST require a separate policy gate for each action or step that policy marks as individually sensitive, regulated, high-risk, or otherwise not safely coverable by one grouped gate.
- **SA-POL-093:** `Step-gated` MUST preserve step identity and rationale for ledger recording.
- **SA-POL-094:** `Refuse / hand off` MUST prevent action execution and route the request to a human path, product-native manual path, or explanatory refusal.
- **SA-POL-095:** `Refuse / hand off` MUST be the resolved mode when an action is unavailable, forbidden by policy, outside the registry, unsupported by trusted execution, or not safely automatable under the supplied inputs.
- **SA-POL-096:** The ladder order for applying policy floors from more autonomous to less autonomous execution modes MUST be `Instant execution`, `Optimistic chain`, `Gated suffix`, `Plan preview`, `Step-gated`, and `Refuse / hand off`.
- **SA-POL-097:** `Read-only` MUST be selected independently when the request is answered through facts or read tools without action execution, rather than used as a floor in the execution-mode ordering.

## 8. Policy Engine Contract (Normative)

- **SA-POL-100:** A conforming implementation MUST run a trusted application-owned policy engine before action execution proceeds, as required by `SA-CORE-031` and `SA-CORE-051`.
- **SA-POL-101:** The policy engine MUST treat model output as an untrusted proposal and MUST NOT grant execution authority directly to the model.
- **SA-POL-102:** The policy engine MUST be a pure function of its declared inputs.
- **SA-POL-103:** The policy engine MUST NOT read hidden mutable state, perform network calls, consume randomness, mutate the registry, mutate user state, execute actions, or write the ledger while resolving a policy decision.
- **SA-POL-104:** Any state needed by the policy engine, including time, session trust, current surface, grant state, user settings, role, and runtime signals, MUST be supplied as explicit inputs.
- **SA-POL-105:** Policy-engine inputs MUST include the proposed action or chain, the relevant registry entries, declared policy metadata, current surface, registry-checkable precondition state, selected posture preset, developer overrides, user role, session trust, user autonomy setting, scoped grants, and runtime signals.
- **SA-POL-106:** Policy-engine output MUST include a resolved autonomy mode and a recordable rationale.
- **SA-POL-107:** For an action chain, policy-engine output MUST identify any per-action mode, chain-level mode, executed-prefix boundary, held-suffix boundary, refusal reason, or required policy gate needed to make the final mode auditable.
- **SA-POL-108:** A recordable rationale MUST include at least the action IDs, relevant declaration metadata, selected posture preset, applicable overrides, effect floors, confirmation floor, grant use or non-use, runtime-signal demotions, final mode, and reason codes.
- **SA-POL-109:** Every policy decision MUST be recorded by the ledger layer once that layer is present; this document does not define the ledger record schema.
- **SA-POL-110:** The user autonomy setting MUST be able to lower autonomy relative to the developer's default policy.
- **SA-POL-111:** Whether a user autonomy setting can raise autonomy above the developer's default policy is a developer-controlled policy choice.
- **SA-POL-112:** Developer overrides MAY change preset mappings per action, role, surface, user segment, environment, or declared metadata predicate.
- **SA-POL-113:** A developer override that changes a framework-supplied preset mapping MUST be policy configuration, not a mutation of the action declaration.
- **SA-POL-114:** A developer override MUST NOT bypass declaration validation, trusted executor requirements, registry availability, or the sticky-grant prohibitions in this document.

## 9. Runtime Signals and Scoped Grants (Normative)

- **SA-POL-120:** Runtime signals MUST be optional explicit inputs to the policy engine.
- **SA-POL-121:** Runtime signal sources, scoring methods, and thresholds are developer-controlled unless a later conformance specification defines stricter profiles.
- **SA-POL-122:** A runtime signal MAY lower autonomy for the current invocation, chain, or workflow, but MUST NOT raise autonomy above the mode otherwise allowed by declarations, posture, overrides, user setting, and grants.
- **SA-POL-123:** Framework-supplied runtime-signal demotion MUST be invocation-specific, bounded to one rung in the execution-mode ordering, and recorded in the rationale.
- **SA-POL-124:** Absence of a confidence score, model score, verifier result, or other optional signal MUST NOT be treated as a low-confidence signal by default.
- **SA-POL-125:** Runtime-signal demotion MUST NOT be implemented as a hidden global rule that gates all safe reversible actions.
- **SA-POL-126:** A scoped grant MUST be represented as an explicit policy-engine input with scope, expiration, issuer, granted subject, and granted policy effect.
- **SA-POL-127:** Supported scoped-grant subjects MUST include at least action ID and MAY include surface, session, role, parameter predicate, and action-class predicates over declared metadata.
- **SA-POL-128:** An action-class grant MUST name its predicate in terms of declared metadata such as risk, reversibility, effects, confirmation, and action namespace.
- **SA-POL-129:** A framework-supplied scoped grant MUST expire no later than the current session unless developer policy defines a shorter expiration.
- **SA-POL-130:** A persistent grant beyond the current session MAY exist only as developer policy, and MUST be revocable and recordable.
- **SA-POL-131:** A scoped grant MUST NOT apply to an action whose declared `risk` is `destructive`.
- **SA-POL-132:** A scoped grant MUST NOT lower the minimum mode imposed by `confirmation: always`.
- **SA-POL-133:** A scoped grant MUST NOT authorize actions unavailable on the current surface or actions whose preconditions are unsatisfied.

## 10. Framework Posture Presets (Normative)

- **SA-POL-140:** The framework MUST define exactly these initial posture presets: `creative-tool`, `business-app`, and `sensitive-domain`.
- **SA-POL-141:** A posture preset MUST be a default policy mapping over declared metadata and MUST NOT be encoded in action declarations.
- **SA-POL-142:** Each posture preset MUST provide a complete default mapping for every `risk` by `reversibility.kind` cell in Tables 1, 2, and 3.
- **SA-POL-143:** The default mapping MUST be read before applying effect floors, confirmation floors, user autonomy lowering, grants, developer overrides, and runtime-signal demotion.
- **SA-POL-144:** When more than one floor applies, the policy engine MUST choose the least autonomous applicable mode according to `SA-POL-096`.
- **SA-POL-145:** Every preset mapping MUST be developer-overridable per action, role, and surface, subject to the hard requirements in this document.
- **SA-POL-146:** Preset defaults MUST NOT resolve the clean safe reversible cell described by `SA-POL-073` to a gated or refused mode.
- **SA-POL-147:** The `sensitive-domain` preset MUST require every policy decision to be recordable before execution; if recording is unavailable, the resolved mode MUST be `Refuse / hand off`.

Table 1: `creative-tool` default mapping.

| risk \ reversibility | `undoable` | `snapshot` | `irreversible` |
|---|---|---|---|
| `safe` | `Instant execution` | `Instant execution` | `Instant execution` |
| `side_effect` | `Instant execution` | `Instant execution` | `Instant execution` |
| `mutating` | `Optimistic chain` | `Gated suffix` | `Gated suffix` |
| `destructive` | `Gated suffix` | `Gated suffix` | `Step-gated` |

Table 2: `business-app` default mapping.

| risk \ reversibility | `undoable` | `snapshot` | `irreversible` |
|---|---|---|---|
| `safe` | `Optimistic chain` | `Optimistic chain` | `Gated suffix` |
| `side_effect` | `Optimistic chain` | `Gated suffix` | `Plan preview` |
| `mutating` | `Gated suffix` | `Plan preview` | `Plan preview` |
| `destructive` | `Plan preview` | `Plan preview` | `Step-gated` |

Table 3: `sensitive-domain` default mapping.

| risk \ reversibility | `undoable` | `snapshot` | `irreversible` |
|---|---|---|---|
| `safe` | `Optimistic chain` | `Optimistic chain` | `Plan preview` |
| `side_effect` | `Plan preview` | `Plan preview` | `Step-gated` |
| `mutating` | `Plan preview` | `Step-gated` | `Step-gated` |
| `destructive` | `Step-gated` | `Step-gated` | `Refuse / hand off` |

## 11. Effect Floors for Presets (Normative)

- **SA-POL-160:** `effects.cost: none` MUST NOT impose an effect floor by itself.
- **SA-POL-161:** Under `creative-tool`, `effects.cost: quota` MUST impose a minimum mode of `Gated suffix`.
- **SA-POL-162:** Under `creative-tool`, `effects.cost: money` MUST impose a minimum mode of `Plan preview`.
- **SA-POL-163:** Under `business-app`, `effects.cost: quota` MUST impose a minimum mode of `Plan preview`.
- **SA-POL-164:** Under `business-app`, `effects.cost: money` MUST impose a minimum mode of `Step-gated`.
- **SA-POL-165:** Under `sensitive-domain`, `effects.cost: quota` and `effects.cost: money` MUST impose a minimum mode of `Step-gated`.
- **SA-POL-166:** Under `creative-tool`, `effects.sensitive: true` MUST impose no effect floor when `effects.external` is `false`, and MUST impose a minimum mode of `Gated suffix` when `effects.external` is `true`.
- **SA-POL-167:** Under `business-app`, `effects.sensitive: true` MUST impose a minimum mode of `Plan preview`.
- **SA-POL-168:** Under `sensitive-domain`, `effects.sensitive: true` MUST impose a minimum mode of `Step-gated`.
- **SA-POL-169:** `effects.external: true` MUST NOT impose an effect floor by itself under `creative-tool` or `business-app`; its policy effect is carried by risk, sensitivity, cost, confirmation, and developer overrides.
- **SA-POL-170:** Under `sensitive-domain`, `effects.external: true` MUST impose a minimum mode of `Plan preview`.
- **SA-POL-171:** A developer override MAY define stricter effect floors than the framework preset defaults.
- **SA-POL-172:** A developer override MAY define less restrictive effect floors only when the resulting policy remains consistent with declaration validation, `confirmation: always`, user autonomy lowering, sticky-grant prohibitions, and conformance requirements.
- **SA-POL-173:** Each effect-floor rationale record MUST include its dimension, observed value, candidate floor mode when one exists, `applied`, and a reason code. `applied` MUST be `true` exactly when a candidate floor mode exists and is at least as restrictive as the resolved mode immediately before that record's floor is evaluated; it MUST be `false` when no candidate floor exists or a stricter mode was already selected. A true value means the floor participated in the decision even when it equals the incoming mode and causes no mode change. This resolves issue #41's effect-floor rationale ambiguity.

## 12. Worked Example (Informative)

The same user request is resolved under two presets:

> "Use #0F766E and #B45309, switch to the landing page template, then generate three directions."

Assume the registry contains these actions:

| Step | Action | Metadata |
|---:|---|---|
| 1 | `palette.set_custom` | `risk: safe`, `reversibility.kind: undoable`, `effects: { external: false, cost: none, sensitive: false }`, `confirmation: never` |
| 2 | `template.apply_landing` | `risk: safe`, `reversibility.kind: snapshot`, `effects: { external: false, cost: none, sensitive: false }`, `confirmation: never` |
| 3 | `lab.generate_directions` | `risk: mutating`, `reversibility.kind: snapshot`, `effects: { external: true, cost: quota, sensitive: false }`, `confirmation: policy` |

Under `creative-tool`:

1. Step 1 maps to `Instant execution`.
2. Step 2 maps to `Instant execution`.
3. Step 3 maps to `Gated suffix` because the table maps `mutating` plus `snapshot` to `Gated suffix`, and `effects.cost: quota` also floors the action at `Gated suffix`.
4. The chain resolves as a reversible instant prefix followed by a held suffix. The first two changes can be visible immediately; the quota-spending generation waits at the policy boundary.

Under `business-app`:

1. Step 1 maps to `Optimistic chain`.
2. Step 2 maps to `Optimistic chain`.
3. Step 3 maps to `Plan preview` because the table maps `mutating` plus `snapshot` to `Plan preview`, and `effects.cost: quota` also floors the action at `Plan preview`.
4. The chain resolves to a grouped review outcome before execution because the business posture treats quota-consuming remote work as a higher-friction product action than the creative posture.

The declaration metadata did not change. Only posture policy changed.

## 13. Resolution Notes for This Policy Document (Informative)

The following issue-level decisions are recorded so later authors do not re-open them accidentally:

1. Preset mappings are complete risk by reversibility grids, with effect floors applied after the grid. `creative-tool` preserves the reference experience by keeping clean safe reversible cells ungated and making quota-spend the common boundary.
2. Runtime-signal demotion is a normative hook and input, but default demotion is invocation-specific, one rung, explicit in rationale, and never a hidden universal gate.
3. Risk ambiguity is resolved through executable inspection criteria: writes, external calls, persistence, cost, sensitive movement, deletion, and recovery mechanism; uncertain cases classify upward until narrowed.
4. `confirmation: always` sets a minimum gated outcome. `confirmation: never` does not block developer policy from being stricter, but framework presets do not gate clean safe reversible actions by default.
5. Sticky grants are scoped by action, surface, session, role, parameter predicate, or action class; framework-supplied grants expire no later than the session; destructive actions and `confirmation: always` cannot be made sticky.
6. SA-DECL handoff on risk, reversibility, effects, and confirmation semantics is resolved here without changing the value sets from `SA-DECL-038` through `SA-DECL-044`.
7. SA-DECL handoff on `effects.cost` is resolved by preset-specific floors: `none` has no floor, `quota` starts at a gate appropriate to posture, and `money` floors to stronger gated modes.
8. SA-DECL handoff on posture presets is resolved by keeping presets outside declarations and consuming registry-derived metadata plus app policy inputs.
9. Issue #83: chain-level `Plan preview` intentionally holds the entire chain, including steps that would resolve `safe` / `Instant execution` on their own. `SA-POL-090` makes the reviewed unit the whole proposed action set, and executing any prefix before that review would present the user a plan whose opening steps had already happened. This does not conflict with `SA-POL-073` / `SA-POL-146`, which constrain how presets resolve an individual action, not how a chain folds under `SA-POL-096`. The mode that runs a reversible prefix immediately while gating the rest is `Gated suffix`; a developer who wants prefix-now-review-later semantics maps the gated action there. The anti-ceremony guarantee for a clean safe action standing alone is unchanged.

No conflict with the north-star was identified while writing this document.

## 14. Ceremony Self-Check (Informative)

This document was checked against the founding decision after drafting:

1. Normative requirements do not impose gated modes on clean `safe` plus `undoable` or `safe` plus `snapshot` actions as a framework default.
2. The `creative-tool` preset reproduces the reference posture: clean safe reversible actions execute immediately, while quota-spending and destructive work reaches a policy boundary.
3. No preset table gates `safe` plus `undoable`.
4. All value sets match `SA-DECL-038` through `SA-DECL-044`.
5. The policy engine is specified as a pure function of declared inputs with a recordable rationale.
6. The acceptance criteria from issue #4 were rechecked against this file.

## 15. Framework Decides vs. Developer Decides (Normative)

- **SA-POL-180:** This autonomy policy specification MUST preserve the framework/developer boundary in Table 4.

| Requirement | The framework decides | The developer decides |
|---|---|---|
| **SA-POL-181** | The risk, reversibility, effects, and confirmation semantics over the value sets declared by `SA-DECL-038` through `SA-DECL-044`. | How each product action is honestly classified within those semantics. |
| **SA-POL-182** | The seven autonomy ladder modes and their policy-level contracts. | Which modes are appropriate for the product's users, roles, surfaces, and domain risks. |
| **SA-POL-183** | That a pure policy engine resolves proposed action use before execution and returns a recordable rationale. | The implementation mechanics, data structures, and policy authoring interface for that engine. |
| **SA-POL-184** | The initial posture presets and their default mappings. | Which preset to start from and which mappings to override per action, role, and surface. |
| **SA-POL-185** | That clean safe reversible actions are not gated by framework preset defaults. | Whether a product-specific override deliberately lowers autonomy for such actions in a particular domain. |
| **SA-POL-186** | The default effect floors for quota, money, sensitive data, and external effects. | Whether stricter or carefully justified less restrictive floors apply in a product context. |
| **SA-POL-187** | That users can always lower autonomy. | Whether users can raise autonomy above the developer's default policy. |
| **SA-POL-188** | That scoped grants are explicit policy inputs and never apply to destructive actions. | Which non-destructive scopes, expirations, and revocation controls the product offers. |
| **SA-POL-189** | That runtime-signal demotion is explicit, bounded by default, and auditable. | Which runtime signals exist and what thresholds or verifier outputs feed policy. |
| **SA-POL-190** | That every policy decision must be recordable for the ledger. | Ledger storage depth, retention, redaction, and audit strictness beyond later conformance minimums. |

## 16. Resolution Note (Informative)

Issue #41 resolves `effectFloor.applied` as a participation flag, not merely a mode-change flag: a candidate floor is applied when it is at least as restrictive as the mode present when the engine evaluates it. This preserves equal-floor evidence in the recorded rationale and makes no-floor and already-stricter cases deterministically false. The Design Studio example, now backed by `@steerable/core`, uses that rule, so no example code change is required.
