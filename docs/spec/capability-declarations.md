# Steerable Apps Capability Declarations Specification (Normative)

**Status:** Draft v0.1
**Spec code:** SA-DECL
**Role:** Declaration contracts for actions, read tools, facts, surfaces, and the registry model
**Canonical project source:** `Steerable-Protocol-NorthStar.md`

## 1. Introduction (Informative)

Capability declarations are the core contract of the Steerable Apps specification suite. A Steerable App declares each operable product capability and each curated context source once, then derives model schemas, policy inputs, executor registration, undo semantics, user-facing copy, guidance, documentation, evaluation fixtures, and optional external-agent surfaces from that declaration.

This document specifies the four declaration kinds named by `SA-CORE-022`: actions, read tools, facts, and surfaces. It also specifies the registry model that compiles those declarations into the application-owned source of truth defined by `SA-CORE-027`.

This document uses TypeScript-like examples because `SA-CORE-009` names that as the suite's illustration language. The requirements define conceptual shapes and semantics; they do not require a TypeScript runtime API, zod, React, or any future SDK name.

## 2. Scope and Dependencies (Informative)

This document defines what declarations must carry. It does not define policy resolution algorithms, autonomy-mode mappings, execution state machines, cross-surface wait behavior, ledger record schemas, or external bridge protocols. Those subjects belong to `SA-POL`, `SA-EXEC`, `SA-LED`, and `SA-BRIDGE`.

This document references the core vocabulary in `SA-CORE` rather than redefining it. In particular, action, read tool, facts, surface, registry, policy engine, ledger, undo handle, door one, and door two have the meanings assigned by `SA-CORE-023` through `SA-CORE-035`.

## 3. Declaration Kinds (Normative)

- **SA-DECL-001:** A conforming implementation MUST support declarations for exactly these capability kinds at the declaration layer: action, read tool, facts, and surface.
- **SA-DECL-002:** A declaration MUST be the authoritative source for the declared capability's identity, typed contract, availability metadata, human-facing labels, agent-facing guidance, and downstream derivation inputs.
- **SA-DECL-003:** A declaration shape MAY be implemented in any programming language or configuration format, provided that it preserves the semantics in this document and can be compiled into the registry.
- **SA-DECL-004:** TypeScript-like syntax, including `defineAction`, `defineReadTool`, `defineFacts`, and `defineSurface`, is illustrative and MUST NOT be treated as a commitment to a specific runtime API.
- **SA-DECL-005:** Declaration authors MUST NOT add declaration fields that encode a fixed workflow such as `requiresPlan`, `approvalFlow`, `approvalMode`, or equivalent plan-first or approval-first semantics.
- **SA-DECL-006:** `confirmation` is the only action declaration field that hooks directly into gating, and its values MUST be limited to `never`, `policy`, and `always`.

## 4. Shared Declaration Rules (Normative)

- **SA-DECL-010:** Every declared capability MUST have a stable `id` unique within the registry.
- **SA-DECL-011:** Once an `id` is referenced by ledgers, fixtures, saved workflows, policy overrides, or external surfaces, an implementation MUST treat that `id` as stable and MUST NOT reuse it for a different capability meaning.
- **SA-DECL-012:** Capability IDs MUST be lowercase ASCII identifiers composed of dot-separated segments using letters, digits, and underscores, with at least one namespace segment before the final segment.
- **SA-DECL-013:** Action IDs MUST use a final `verb_noun` segment, as in `palette.set_color`, unless the action represents an established product command whose stable product name would be made less clear by that form.
- **SA-DECL-014:** Every declared capability MUST include `title` and `description` fields suitable for user-facing activity, documentation, and generated review surfaces.
- **SA-DECL-015:** `title` and `description` MUST describe what the capability is and does; they MUST NOT encode policy outcomes, approval workflows, or facts already carried by typed fields such as `risk`, `effects`, `reads`, or `writes`.
- **SA-DECL-016:** Any declaration field that accepts parameters or returns values MUST use a strict, typed schema that can be expressed as JSON Schema or an equivalently precise language-neutral schema.
- **SA-DECL-017:** A parameter schema MUST reject undeclared parameters by default.
- **SA-DECL-018:** A declaration MUST NOT replace structured parameters with a single flattened natural-language string when the capability has distinct typed inputs.
- **SA-DECL-019:** State keys in `reads`, `writes`, and facts MUST be stable dot-separated identifiers whose taxonomy is owned by the integrating developer.
- **SA-DECL-020:** State keys SHOULD be granular enough to name the smallest meaningful product state region needed for policy, context, fixtures, and dependency analysis, but MUST NOT expose private implementation paths as the normative namespace.
- **SA-DECL-021:** A declaration MUST NOT duplicate the same fact in multiple fields where the copies can disagree.
- **SA-DECL-022:** Preconditions MUST be stable registry-checkable predicate tokens; the token form `surface:<surface-key>` is reserved for surface availability predicates and MUST accept the north-star form `surface:design-studio`.

## 5. Action Declarations (Normative)

- **SA-DECL-030:** An action declaration MUST describe one trusted app-owned executor for work performed on behalf of a user.
- **SA-DECL-031:** Mutation, navigation, side effects, remote writes, and destructive operations performed through Steerable Apps MUST occur only through declared action executors.
- **SA-DECL-032:** Model output for an action MUST be treated as an untrusted proposal until it validates against the action declaration, registry availability, and policy.
- **SA-DECL-033:** An action declaration MUST include these required fields: `id`, `title`, `description`, `params`, `reads`, `writes`, `risk`, `reversibility`, `effects`, `confirmation`, `preconditions`, `execute`, `guidance`, and `examples`.
- **SA-DECL-034:** The optional action fields are `undo`, `observe`, and `externalExposure`; omitting any required field is non-conformant.
- **SA-DECL-035:** `params` MUST be a strict typed schema for the executor inputs. An action with no inputs MUST declare an empty object schema rather than omit `params`.
- **SA-DECL-036:** `reads` MUST list the state keys the action needs to inspect or rely on. An action with no state dependencies MUST declare an empty list rather than omit `reads`.
- **SA-DECL-037:** `writes` MUST list the state keys the action can mutate or externally affect. An action that performs no mutation or side effect MUST declare an empty list rather than omit `writes`.
- **SA-DECL-038:** `risk` MUST be one of exactly `safe`, `side_effect`, `mutating`, or `destructive`.
- **SA-DECL-039:** `reversibility` MUST declare a `kind` of exactly `undoable`, `snapshot`, or `irreversible`.
- **SA-DECL-040:** `effects` MUST declare exactly the north-star effect dimensions as the fields `external`, `cost`, and `sensitive`.
- **SA-DECL-041:** `effects.external` MUST be a boolean indicating whether execution can call or affect systems outside the local application session.
- **SA-DECL-042:** `effects.cost` MUST be one of exactly `none`, `quota`, or `money`.
- **SA-DECL-043:** `effects.sensitive` MUST be a boolean indicating whether execution can expose, transmit, or transform sensitive data.
- **SA-DECL-044:** `confirmation` MUST be one of exactly `never`, `policy`, or `always`.
- **SA-DECL-045:** `preconditions` MUST list registry-checkable availability predicates, including surface predicates such as `surface:design-studio` when an action is surface-scoped. An action with no preconditions MUST declare an empty list rather than omit `preconditions`.
- **SA-DECL-046:** `execute` MUST be a trusted app-owned function, command handler, mutation endpoint, or equivalent executor that is not controlled by the model.
- **SA-DECL-047:** `guidance` MUST provide concise agent-facing usage guidance for when to choose the action and any important distinction from neighboring actions.
- **SA-DECL-048:** `examples` MUST contain at least one example mapping a realistic user request to valid action parameters.
- **SA-DECL-049:** The optional `undo` field MUST be present when `reversibility.kind` is `undoable`.
- **SA-DECL-050:** If `reversibility.kind` is `snapshot` and `undo` is omitted, the runtime MUST derive restoration from an automatic snapshot mechanism rather than from a separately declared inverse.
- **SA-DECL-051:** If `reversibility.kind` is `irreversible`, `undo` MAY be omitted and omission means no undo handle is claimed by the declaration.
- **SA-DECL-052:** The optional `observe` field, when present, MUST provide an action-specific post-execution observation that can be used by execution, ledger, or evaluation layers.
- **SA-DECL-053:** If `observe` is omitted, downstream layers MAY use generic observation or no action-specific post-check, but omission MUST NOT change the executor contract.

| Field | Required? | Omission semantics |
|---|---:|---|
| `id` | Required | Non-conformant if omitted. |
| `title` | Required | Non-conformant if omitted. |
| `description` | Required | Non-conformant if omitted. |
| `params` | Required | Use an empty object schema for no inputs. |
| `reads` | Required | Use an empty list for no state dependencies. |
| `writes` | Required | Use an empty list for no writes or side effects. |
| `risk` | Required | Non-conformant if omitted. |
| `reversibility` | Required | Non-conformant if omitted. |
| `effects` | Required | Non-conformant if omitted. |
| `confirmation` | Required | Non-conformant if omitted. |
| `preconditions` | Required | Use an empty list for globally available actions. |
| `externalExposure` | Optional | Registry compilation materializes `none` if omitted. |
| `execute` | Required | Non-conformant if omitted. |
| `undo` | Optional | Required for `undoable`; snapshot-derived for `snapshot`; absent undo claim for `irreversible`. |
| `observe` | Optional | No action-specific post-check if omitted. |
| `guidance` | Required | Non-conformant if omitted. |
| `examples` | Required | Must contain at least one valid parameter example. |

## 6. Read Tool Declarations (Normative)

- **SA-DECL-060:** A read tool declaration MUST describe one typed, side-effect-free query over application information.
- **SA-DECL-061:** A read tool MUST NOT mutate state, perform user-visible product changes, spend quota or money, perform destructive operations, or depend on action risk machinery.
- **SA-DECL-062:** A read tool declaration MUST include these required fields: `id`, `title`, `description`, `params`, `reads`, `preconditions`, `query`, `guidance`, and `examples`. The optional read tool field is `externalExposure`.
- **SA-DECL-063:** A read tool declaration MUST NOT include `writes`, `risk`, `reversibility`, `effects`, `confirmation`, `execute`, or `undo`.
- **SA-DECL-064:** `params` MUST be a strict typed schema for query inputs. A read tool with no inputs MUST declare an empty object schema rather than omit `params`.
- **SA-DECL-065:** `reads` MUST list the state keys the query can inspect. A read tool with no state dependency MUST declare an empty list rather than omit `reads`.
- **SA-DECL-066:** `preconditions` MUST list registry-checkable availability predicates. A read tool with no preconditions MUST declare an empty list rather than omit `preconditions`.
- **SA-DECL-067:** `query` MUST be a trusted app-owned function, endpoint, selector, or equivalent read-only executor.
- **SA-DECL-068:** `guidance` MUST explain when an agent should use the read tool before proposing actions.
- **SA-DECL-069:** `examples` MUST contain at least one example mapping a realistic information need to valid read tool parameters.

| Field | Required? | Omission semantics |
|---|---:|---|
| `id` | Required | Non-conformant if omitted. |
| `title` | Required | Non-conformant if omitted. |
| `description` | Required | Non-conformant if omitted. |
| `params` | Required | Use an empty object schema for no inputs. |
| `reads` | Required | Use an empty list for no state dependencies. |
| `preconditions` | Required | Use an empty list for globally available read tools. |
| `externalExposure` | Optional | Registry compilation materializes `none` if omitted. |
| `query` | Required | Non-conformant if omitted. |
| `guidance` | Required | Non-conformant if omitted. |
| `examples` | Required | Must contain at least one valid parameter example. |

## 7. Facts Declarations (Normative)

- **SA-DECL-070:** A facts declaration MUST describe curated, bounded key-value context published by a surface for agent use without a tool call.
- **SA-DECL-071:** Facts MUST be scoped to a surface and MUST be registered only while that surface is live unless a later context specification defines a broader scope.
- **SA-DECL-072:** A facts declaration MUST include these required fields: `id`, `title`, `description`, `surface`, `facts`, and `publish`.
- **SA-DECL-073:** A facts declaration MAY include an optional `update` policy; if omitted, the implementation MUST publish on registration and whenever the integrating developer knows the declared facts have materially changed.
- **SA-DECL-074:** Each entry in `facts` MUST have a stable fact key, a concise description, and a strict typed schema for its value.
- **SA-DECL-075:** `publish` MUST be a trusted app-owned producer for the current fact values.
- **SA-DECL-076:** Published fact values MUST be JSON-serializable or equivalently transportable in the implementation's registry representation.
- **SA-DECL-077:** Facts MUST be bounded, curated product context and MUST NOT be used as a DOM dump, screenshot transcript, unbounded object graph, or arbitrary application memory export.
- **SA-DECL-078:** A facts declaration SHOULD publish roughly a dozen or fewer fact entries for a surface unless the context specification defines a stricter or looser bound for a conformance level.

| Field | Required? | Omission semantics |
|---|---:|---|
| `id` | Required | Non-conformant if omitted. |
| `title` | Required | Non-conformant if omitted. |
| `description` | Required | Non-conformant if omitted. |
| `surface` | Required | Non-conformant if omitted. |
| `facts` | Required | Non-conformant if omitted or empty for a facts declaration. |
| `publish` | Required | Non-conformant if omitted. |
| `update` | Optional | Publish on registration and material fact changes if omitted. |

## 8. Surface Declarations (Normative)

- **SA-DECL-080:** A surface declaration MUST describe a named application region, route, view, mode, or access point that scopes which capabilities are live.
- **SA-DECL-081:** A surface declaration MUST include these required fields: `id`, `title`, `description`, and `capabilities`.
- **SA-DECL-082:** A surface declaration MAY include optional `location` metadata; if omitted, the surface is registry-addressable but does not claim runtime-navigable location metadata.
- **SA-DECL-083:** `capabilities` MUST list the action, read tool, and facts declaration IDs that can be live on the surface.
- **SA-DECL-084:** A runtime MUST register a surface with the registry when the surface is live and deregister it when the surface is no longer available for steering.
- **SA-DECL-085:** Capability availability queries MUST evaluate both surface liveness and capability preconditions.
- **SA-DECL-086:** Surface registration MUST be sufficient for downstream execution specifications to identify a destination surface and determine whether its declared capabilities have registered.
- **SA-DECL-087:** Surface declarations MUST NOT define the cross-surface execution algorithm, wait timeout, repair behavior, or user-interface presentation; those semantics belong to `SA-EXEC`.

| Field | Required? | Omission semantics |
|---|---:|---|
| `id` | Required | Non-conformant if omitted. |
| `title` | Required | Non-conformant if omitted. |
| `description` | Required | Non-conformant if omitted. |
| `capabilities` | Required | Use an empty list only for a surface that intentionally exposes no capabilities yet. |
| `location` | Optional | Surface is not declared as runtime-navigable if omitted. |

## 9. Registry Model and Single Source of Truth (Normative)

- **SA-DECL-090:** The registry MUST be the compiled output of action, read tool, facts, and surface declarations.
- **SA-DECL-091:** The registry MUST be queryable at runtime for at least: all declared capabilities, capabilities live on a surface, capability schemas, capability preconditions, policy-relevant action metadata, external exposure metadata, and trusted executor entry points.
- **SA-DECL-092:** The registry MUST preserve declaration IDs, state keys, schemas, titles, descriptions, guidance, examples, external exposure metadata, and surface scoping in a form usable by downstream policy, execution, context, ledger, documentation, evaluation, and external-bridge layers.
- **SA-DECL-093:** If a fact about an action's meaning, schema, policy metadata, executor, undo semantics, UX label, guidance, examples, documentation source, eval source, or optional external exposure lives anywhere other than the action declaration or registry compiled from it, the integration is non-conformant.
- **SA-DECL-094:** Door one and door two, when both are exposed, MUST derive their action and read tool surfaces from the same registry rather than separate declaration layers.
- **SA-DECL-095:** A model-facing tool, prompt fragment, generated document, fixture, or external tool MUST NOT add, remove, or change declared action parameters, policy metadata, or executor semantics outside the declaration source.
- **SA-DECL-096:** Registry compilation MUST fail or report a conformance error when duplicate IDs, invalid schemas, missing required fields, invalid value-set members, or unsatisfied surface capability references are detected.

## 10. Required Derivations (Normative)

- **SA-DECL-100:** The model tool schema for an action MUST be derivable from the action declaration's `id`, `description`, and `params` without a separate hand-written tool contract.
- **SA-DECL-101:** The policy entry for an action MUST be derivable from the action declaration's `risk`, `reversibility`, `effects`, `confirmation`, `preconditions`, `reads`, and `writes`.
- **SA-DECL-102:** Executor registration and current-surface availability MUST be derivable from the action declaration's `execute`, the action preconditions, and surface declarations.
- **SA-DECL-103:** Undo handling MUST be derivable from the action declaration's `reversibility` and `undo` fields, or from automatic snapshot restoration when `reversibility.kind` is `snapshot` and `undo` is omitted.
- **SA-DECL-104:** User-facing copy for activity trails, plan cards, approval sheets, documentation, and other generated review surfaces MUST be derivable from declaration `title` and `description`.
- **SA-DECL-105:** Prompt guidance and few-shot examples MUST be derivable from declaration `guidance` and `examples`.
- **SA-DECL-106:** Documentation pages for declared capabilities MUST be derivable from the registry without maintaining a second capability table.
- **SA-DECL-107:** Evaluation fixtures for declared capability use MUST be derivable from the registry's schemas, examples, state keys, and policy metadata without maintaining a separate source of action truth.
- **SA-DECL-108:** Optional external tools for door two MUST be generated from the same registry declarations used for door one and MUST honor declaration `externalExposure`.
- **SA-DECL-109:** A runtime MAY choose different prompt assembly, documentation rendering, fixture generation, or bridge generation mechanics, but those mechanics MUST consume the registry rather than redefine capability facts.

## 11. Door-Two Declaration Addendum (Normative)

- **SA-DECL-130:** Door-two addition (issue #9): Action and read tool declarations MAY include `externalExposure`; registry compilation MUST materialize an explicit external-exposure value for every action and read tool, defaulting omitted declarations to `none`, so door-two eligibility is always explicit in the registry source of truth.
- **SA-DECL-131:** Door-two addition (issue #9): `externalExposure`, when declared, MUST be exactly one of `none` or `eligible`, and the registry-materialized value MUST be one of those two values.
- **SA-DECL-132:** Door-two addition (issue #9): `externalExposure: none` MUST mean no conforming door-two generator emits an external tool for that capability.
- **SA-DECL-133:** Door-two addition (issue #9): `externalExposure: eligible` MUST mean the declaration asserts the capability may be considered for door-two generation, but it MUST NOT by itself authorize generation, publication, invocation, or execution.
- **SA-DECL-134:** Door-two addition (issue #9): `externalExposure` MUST describe only capability-level external eligibility and MUST NOT encode deployment enablement, caller identity, host allow-lists, session trust, autonomy mode, approval workflow, or other policy configuration.
- **SA-DECL-135:** Door-two addition (issue #9): Registry compilation MUST preserve the materialized `externalExposure` value for every action and read tool (including the `none` default for omitted declarations) in a form usable by external-bridge generation and conformance checks.
- **SA-DECL-136:** Door-two addition (issue #9): Door-two derivation MUST consume `externalExposure` from the registry and MUST NOT infer external eligibility from title, description, guidance, risk class, effects, or external-tool configuration.

## 12. North-Star Action Example (Informative)

The following example is reproduced from the north-star's core abstraction. It is conformant with this document because it declares a stable action ID, strict typed parameters, required state keys, policy metadata, confirmation posture, preconditions, trusted execution, optional undo and observe hooks, and model-facing guidance and examples.

```ts
defineAction({
  id: "palette.set_color",
  title: "Set one palette color",
  description: "Set a single palette token to a hex value. Switches palette to 'custom'.",

  // Contract
  params: z.object({
    token: z.enum(["background", "surface", "text", "accent", /* … */]),
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  reads:  ["design.palette"],          // state this action needs
  writes: ["design.palette"],          // state this action mutates

  // Policy metadata (drives the policy engine, §7)
  risk: "safe",                        // safe | side_effect | mutating | destructive
  reversibility: { kind: "undoable" }, // undoable | snapshot | irreversible
  effects: { external: false, cost: "none", sensitive: false },
  confirmation: "never",               // never | policy | always
  preconditions: ["surface:design-studio"],

  // Execution (trusted, app-owned)
  execute: async ({ token, hex }, ctx) => { /* call the app's real setter */ },
  undo:    async (snapshot, ctx)     => { /* restore */ },   // or omit + snapshot: auto
  observe: async (ctx)               => ctx.read("design.palette"),  // optional post-check

  // Model & human-facing knowledge
  guidance: "Use when the user names ONE color. For full brand palettes prefer palette.set_custom.",
  examples: [{ user: "make the accent #FF6600", params: { token: "accent", hex: "#FF6600" } }],
})
```

Field-by-field conformance notes:

1. `id` follows the required namespace plus `verb_noun` action form.
2. `params` is strict and typed; it names `token` and `hex` instead of flattening the request into a string.
3. `reads` and `writes` use one developer-owned state key, `design.palette`, at the granularity the action needs.
4. `risk`, `reversibility`, `effects`, and `confirmation` use only the allowed declaration values.
5. `execute` is app-owned; model output can only propose its parameters.
6. `undo` is present because `reversibility.kind` is `undoable`; `observe` is optional but present.
7. `guidance` and `examples` provide the model-facing knowledge required to derive prompts and fixtures.
8. `externalExposure` is omitted, so registry compilation materializes `none`: the action is not eligible for door-two generation unless the developer marks it `eligible`.

## 13. Minimal Viable Declaration Example (Informative)

This is the smallest honest action declaration shape: no inputs, no state dependencies, no side effects, no workflow assumptions, one trusted executor, and enough guidance/example material for generated prompts, docs, and fixtures.

```ts
defineAction({
  id: "panel.open_help",
  title: "Open help panel",
  description: "Open the current surface's help panel.",
  params: z.object({}),
  reads: [],
  writes: ["ui.help_panel"],
  risk: "safe",
  reversibility: { kind: "undoable" },
  effects: { external: false, cost: "none", sensitive: false },
  confirmation: "never",
  preconditions: [],
  execute: async (_params, ctx) => ctx.ui.openHelpPanel(),
  undo: async (_snapshot, ctx) => ctx.ui.closeHelpPanel(),
  guidance: "Use when the user asks for help, instructions, or available actions on the current surface.",
  examples: [{ user: "show me help", params: {} }],
})
```

## 14. Resolution Notes for This Declaration Document (Informative)

The following issue-level decisions are recorded so later authors do not re-open them accidentally:

1. Typed params are conceptual, strict, and JSON-Schema-expressible; zod and TypeScript syntax are examples only.
2. Action policy metadata is required. Empty `params`, `reads`, `writes`, and `preconditions` are explicit values rather than omitted fields, so minimum declarations remain honest and machine-checkable.
3. State key format is normative, but the taxonomy is developer-owned. This gives facts, read tools, fixtures, and capability queries stable handles without standardizing every product's domain model.
4. Action IDs use stable lowercase namespaced IDs with a final `verb_noun` segment as the default requirement, because fixtures, ledgers, policy overrides, and generated external tools need durable references.
5. `guidance` and `examples` are required declaration inputs; prompt assembly mechanics are runtime-specific, but model-facing knowledge must come from the declaration and registry.
6. Door-two addition (issue #9): the declaration shape now includes optional `externalExposure` for actions and read tools because external eligibility is capability nature, while deployment enablement, caller identity, session trust, and autonomy outcomes remain policy inputs outside declarations. The field is optional with a registry-materialized `none` default (orchestrator adjustment): omission is the safe direction, the north-star §5 example remains conformant as written, and the meta-principle prefers a sane default over a mandatory field in every declaration.

No conflict with the north-star was identified while writing this document.

## 15. Framework Decides vs. Developer Decides (Normative)

- **SA-DECL-120:** This declaration specification MUST preserve the framework/developer boundary in Table 1.

| Requirement | The framework decides | The developer decides |
|---|---|---|
| **SA-DECL-121** | The four declaration kinds: actions, read tools, facts, and surfaces. | Which product capabilities and context sources are worth declaring. |
| **SA-DECL-122** | The required fields, optional fields, omission semantics, ID stability rules, and schema strictness requirements. | The concrete IDs, titles, descriptions, parameters, state keys, and examples for the product. |
| **SA-DECL-123** | That action policy metadata is required and uses the shared risk, reversibility, effects, and confirmation vocabulary. | How each product action is honestly classified within that vocabulary, subject to policy and conformance checks. |
| **SA-DECL-124** | That mutation and side effects run only through trusted app-owned action executors. | Which existing setters, commands, endpoints, or mutation handlers implement those executors. |
| **SA-DECL-125** | That read tools are typed and side-effect-free, outside action risk machinery. | Which product queries are useful enough to expose as read tools. |
| **SA-DECL-126** | That facts are curated, bounded, typed, and surface-scoped. | Which small set of facts best represents the current product context. |
| **SA-DECL-127** | That surfaces scope live capabilities and register/deregister with the registry. | Which routes, views, modes, or access points count as surfaces in the product. |
| **SA-DECL-128** | That the registry is the single source of truth for generated schemas, prompts, docs, fixtures, policy entries, execution availability, and optional external tools. | Whether door two is exposed, which docs or fixtures are published, and what product release bar applies above conformance. |
| **SA-DECL-129** | That declarations carry inputs needed by policy, execution, context, ledger, and bridge specs without defining those downstream algorithms here. | The app's policy posture, execution UX, ledger retention, context escalation choices, and external-agent exposure policy. |
| **SA-DECL-137** | Door-two addition (issue #9): That action and read tool declarations carry external exposure eligibility as registry metadata, defaulting to `none` when omitted. | Which capabilities are marked `eligible` (or left at the `none` default), and which policy configuration decides actual external availability. |
