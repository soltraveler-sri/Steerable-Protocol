# Steerable Apps Core Specification (Normative)

**Status:** Draft v0.1
**Spec code:** SA-CORE
**Role:** Umbrella specification for the Steerable Apps specification suite
**Canonical project source:** `Steerable-Protocol-NorthStar.md`

## 1. Introduction (Informative)

In the Steerable pattern, an application makes its real product capabilities legible and operable to agents on the application's own terms. Instead of asking an agent to click through the interface like a person, the app declares typed capabilities, exposes curated context, resolves policy before execution, runs trusted app-owned executors, and records what happened.

The point is not to add a chatbot beside a product. The point is to let users state intent and have the product act through its own declared surface, with fast feedback for safe and reversible work and explicit gates only where policy says the action's nature requires them. Chat can be one way to express intent, but the steering contract is independent of any particular user interface.

The Steerable pattern is not a model SDK, a UI kit, a generic workflow platform, an external browser agent, or an instruction to hand the DOM to a model. It is the contract layer where an application declares what can be done, what context may be seen, how policy is resolved, how trusted execution happens, and how outcomes remain visible and reversible where claimed.

This document defines the suite vocabulary, conformance conventions, requirement-ID scheme, document map, and the master boundary between what the standard decides and what integrating developers decide. Detailed contracts for declarations, policy, execution, context, ledger behavior, external access, and conformance levels live in the sibling specifications listed below.

This document intentionally carries only enough thesis to make the standard readable on its own. Competitive analysis, market timing, and broader category argument belong in research and essay documents, not in this normative core.

## 2. Scope (Informative)

This document is the first normative document in the suite. It establishes shared language and conventions so later specification documents can cite one vocabulary and one requirement-ID scheme.

This document does not define the detailed declaration contract, policy algorithm, execution state machine, context ladder, ledger storage model, external bridge protocol, or conformance levels. Those subjects are assigned to the document map in Section 6.

## 3. Conformance Conventions (Normative)

- **SA-CORE-001:** The capitalized keywords **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in Steerable Apps specification documents MUST be interpreted as described in RFC 2119 and RFC 8174.
- **SA-CORE-002:** Lowercase uses of words such as "must", "should", and "may" are ordinary prose and MUST NOT create requirements unless they appear inside a requirement carrying a stable requirement ID.
- **SA-CORE-003:** Every section in every Steerable Apps specification document MUST be explicitly marked either **Normative** or **Informative** in its heading.
- **SA-CORE-004:** Every normative requirement in a Steerable Apps specification document MUST carry a stable requirement ID in the form `SA-<DOC>-<NNN>`.
- **SA-CORE-005:** The `<DOC>` component of a requirement ID MUST be one of the document codes assigned in Section 6 unless a later version of this core specification assigns an additional code.
- **SA-CORE-006:** The `<NNN>` component of a requirement ID MUST be a three-digit decimal number unique within that document code.
- **SA-CORE-007:** Once published, requirement IDs MUST NOT be renumbered or reused; if a requirement is removed, its ID remains reserved.
- **SA-CORE-008:** Normative requirements MAY be clarified by informative prose, examples, tables, and diagrams, but conformance claims MUST be judged against the normative requirements.
- **SA-CORE-009:** TypeScript-like syntax is the suite's illustration language, but the specification defines conceptual shapes and semantics rather than a commitment to any TypeScript runtime API.
- **SA-CORE-010:** Every Steerable Apps specification document MUST end with a "framework decides vs. developer decides" table that localizes the boundary defined by this document.

## 4. Normative Vocabulary (Normative)

- **SA-CORE-020:** The terms defined in this section are the core normative vocabulary for the Steerable Apps specification suite. Other phrases from the north-star, including "assistant", "copilot", "recipe", "shortcut", "plan card", and "chat panel", are colloquial in this core specification unless a later specification assigns them formal definitions and requirement IDs.
- **SA-CORE-021:** A **Steerable App** is an application that exposes declared capabilities through a registry, resolves policy over proposed use of those capabilities, executes mutations only through trusted app-owned executors, and presents results through one or more user or agent surfaces. Tightening note: this turns the north-star's product description into the conformance subject.
- **SA-CORE-022:** A **capability** is a declared, typed unit of application functionality or context that the registry can expose to an agent subject to policy. Actions, read tools, facts, and surfaces are capability kinds in this suite. Tightening note: the north-star sometimes uses "capability" broadly; this specification reserves it for declared registry items.
- **SA-CORE-023:** An **action** is a capability with declared inputs and a trusted app-owned executor that can perform work on behalf of a user, including local state changes, navigation, side effects, remote mutations, or destructive operations as classified by the policy specification.
- **SA-CORE-024:** A **read tool** is a side-effect-free capability that returns typed application information without causing mutation, external effects, or user-visible product changes.
- **SA-CORE-025:** **Facts** are curated, bounded pieces of application context published by a surface for agent use without requiring a tool call.
- **SA-CORE-026:** A **surface** is a named application region, route, view, mode, or access point that scopes which capabilities are live and how steering activity is presented. Tightening note: a surface is not limited to a web route.
- **SA-CORE-027:** The **registry** is the application-owned source of truth containing declared capabilities and their metadata, including availability, policy-relevant attributes, and surface scoping.
- **SA-CORE-028:** A **posture** is a developer-selected policy stance, preset, or override set that influences how proposed capability use resolves to an autonomy mode. Tightening note: posture is policy configuration, not a required user workflow.
- **SA-CORE-029:** The **autonomy ladder** is the ordered vocabulary of execution modes defined by the policy specification, ranging from read-only behavior through more autonomous execution and on to gated, refused, or human-hand-off behavior.
- **SA-CORE-030:** An **autonomy mode** is the resolved rung of the autonomy ladder for a proposed invocation, action chain, or workflow.
- **SA-CORE-031:** The **policy engine** is the trusted application-owned decision component that evaluates proposed capability use against declarations, posture, context, user/session attributes, and runtime signals before execution proceeds.
- **SA-CORE-032:** A **ledger** is the record of meaningful steering activity, including user intent, proposed and resolved capability use, policy decisions, approvals where applicable, execution results, errors, observations, and undo handles where applicable.
- **SA-CORE-033:** An **undo handle** is an executable reversal or restoration mechanism associated with an executed action or chain. It can be an inverse operation, a restorable snapshot, a compensating action, or another mechanism defined by the relevant specification.
- **SA-CORE-034:** **Door one** is in-application steering: a user or app-owned agent accesses the registry through product-owned user experience surfaces.
- **SA-CORE-035:** **Door two** is external-agent steering: an agent outside the application accesses policy-permitted capabilities generated from the same registry. Tightening note: door two is an access path over the same declarations, not a separate tool layer.
- **SA-CORE-036:** **Agent-responsive design** is the practice of making an application legible and operable to agents through declared capabilities, curated context, policy, trusted execution, and observable feedback rather than through DOM or pixel automation as the foundation.

## 5. Core Standard Boundaries (Normative)

- **SA-CORE-050:** The Steerable Apps specification suite MUST treat capability declarations as the primary source of truth for action meaning, policy metadata, execution entry points, undo semantics, user-facing labels, agent guidance, evaluation fixtures, and generated external surfaces where applicable.
- **SA-CORE-051:** The specification suite MUST require proposed capability use to be validated against the registry and policy before trusted execution.
- **SA-CORE-052:** The specification suite MUST require mutation to occur only through trusted app-owned executors, not through direct model authority.
- **SA-CORE-053:** The specification suite MUST NOT require a universal plan-first, approval-first, confirmation-first, or chat-first workflow.
- **SA-CORE-054:** Execution posture MUST be resolved by policy for the relevant invocation, chain, workflow, surface, user, and application context.
- **SA-CORE-055:** Specifications MAY define preview, approval, confirmation, refusal, and hand-off modes, but those modes MUST NOT be imposed on safe, reversible actions solely because an agent is involved.
- **SA-CORE-056:** The same registry MUST be the basis for door one and door two when an implementation exposes both access paths.
- **SA-CORE-057:** The specification suite MUST distinguish actions, read tools, facts, and surfaces as different capability kinds.
- **SA-CORE-058:** The specification suite MUST distinguish normative framework requirements from developer-controlled policy, product, and experience choices.

## 6. Specification Document Map (Normative)

- **SA-CORE-070:** The Steerable Apps specification suite consists of the documents in Table 1. Each listed document code is stable and MUST be used for requirement IDs assigned by that document.

| Document | Code | Normative role | Scope |
|---|---:|---|---|
| `steerable-apps.md` | `SA-CORE` | Normative core | Vocabulary, conventions, document map, conformance-claim shape, and the master framework/developer boundary. |
| `capability-declarations.md` | `SA-DECL` | Normative sibling spec | Declaration contracts for actions, read tools, facts, surfaces, and the registry model. |
| `autonomy-policy.md` | `SA-POL` | Normative sibling spec | Risk, reversibility, effects, autonomy ladder, posture presets, and policy-engine semantics. |
| `context-ladder.md` | `SA-CTX` | Normative sibling spec | Curated facts, read tools, annotated DOM snapshots, vision fallback, privacy boundaries, and context escalation. |
| `execution-and-surfaces.md` | `SA-EXEC` | Normative sibling spec | Execution paths, surface registration, cross-surface continuation, observation, repair, and user-visible steering surfaces. |
| `action-ledger.md` | `SA-LED` | Normative sibling spec | Ledger entries, audit depth, undo-handle recording, replay/debug data, and storage expectations. |
| `external-bridge.md` | `SA-BRIDGE` | Normative sibling spec | Door-two generation from the registry, policy parity, session routing, and design-level external-agent semantics. |
| `conformance-checklist.md` | `SA-CONF` | Normative checklist spec | Conformance levels, checkable criteria, audit checklist, and traceability from checklist items to requirement IDs. |

- **SA-CORE-071:** The document-code taxonomy in Table 1 MUST remain organized around stable contract areas rather than filenames alone, so later editorial renames do not force requirement-ID renumbering.
- **SA-CORE-072:** Detailed conformance levels are deferred to `conformance-checklist.md`; this core specification reserves the existence of levels but does not define their full criteria.

## 7. Conformance Claims (Normative)

- **SA-CORE-080:** A Steerable App conformance claim MUST use this shape: `This app is a Steerable App: <level> conformance to Steerable Apps <version>.`
- **SA-CORE-081:** The `<level>` token in a conformance claim MUST be defined by `conformance-checklist.md`.
- **SA-CORE-082:** The `<version>` token in a conformance claim MUST identify the version of the Steerable Apps specification suite against which the claim is made.
- **SA-CORE-083:** The conformance checklist MAY define more than one level, including minimal and full conformance, but it MUST map every level to checkable requirements or checklist items.
- **SA-CORE-084:** An implementation MUST NOT claim a higher conformance level than the level supported by its registry, policy, execution, context, ledger, and applicable access-path behavior.

## 8. Resolution Notes for This Core Document (Informative)

The following issue-level decisions are recorded here so later authors do not re-open them accidentally:

1. Normative vocabulary is limited to terms that conformance checks or sibling specs need to reference precisely. Other north-star phrases remain ordinary prose unless promoted by a later specification.
2. The informative thesis is intentionally compact. It explains typed, policy-governed application steering without embedding time-sensitive market claims in the core standard.
3. The document-code taxonomy follows the roadmap's suggested codes because they map to stable contract areas: core, declarations, policy, context, execution, ledger, external bridge, and conformance.
4. The conformance-claim shape is normative now, while the meaning of each level is deferred to `SA-CONF` so Sprint 4 can define checkable levels against the completed suite.

## 9. Naming and Versioning Notes (Informative)

"Steerable Apps" names the specification family and the app pattern. Runtime or SDK product naming is outside this document and remains deferred.

The draft version of this document is not itself a conformance level. Versioned conformance claims are defined by Section 7 and completed by `conformance-checklist.md`.

## 10. Framework Decides vs. Developer Decides (Normative)

- **SA-CORE-090:** The Steerable Apps specification suite MUST preserve the framework/developer boundary in Table 2, and each sibling specification MUST localize this boundary for its own subject matter.

| Requirement | The framework decides | The developer decides |
|---|---|---|
| **SA-CORE-091** | The declaration categories and registry model. | Which product capabilities are declared and exposed. |
| **SA-CORE-092** | The existence of a shared risk, reversibility, and effects vocabulary. | How product-specific actions are classified within that vocabulary, subject to conformance checks. |
| **SA-CORE-093** | That a policy engine evaluates proposed capability use before execution. | The app's posture, presets, overrides, and role/surface-specific autonomy mapping. |
| **SA-CORE-094** | That model output is an untrusted proposal and mutation runs through trusted app-owned executors. | Which model provider, router, prompt, or user interface submits proposals. |
| **SA-CORE-095** | That reversibility is represented by executable undo or restoration mechanisms where claimed. | What reversal honestly means in the product's domain. |
| **SA-CORE-096** | The ledger concepts required for trust, undo, evaluation, and audit. | Storage depth, retention, redaction, and audit strictness beyond conformance minimums. |
| **SA-CORE-097** | The distinction among actions, read tools, facts, surfaces, navigation, and external effects. | Which steering surfaces are primary for the product, such as chat, command palette, inline intent, voice, or background automation. |
| **SA-CORE-098** | That door one and door two derive from one registry when both are exposed. | Whether door two is exposed at all, and to which external agents or environments. |
| **SA-CORE-099** | The requirement-ID scheme, conformance traceability, and checklist structure. | The product's release bar above the standard's required conformance level. |
| **SA-CORE-100** | That the standard does not mandate a universal plan-first or approval-first workflow. | Where plan preview, approval, confirmation, refusal, or hand-off is appropriate for the product's users and risks. |
