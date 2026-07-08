# Steerable Apps External Bridge Specification (Normative)

**Status:** Draft v0.1
**Spec code:** SA-BRIDGE
**Role:** Door-two generation from the registry, policy parity, session routing, and design-level external-agent semantics
**Canonical project source:** `Steerable-Protocol-NorthStar.md`

## 1. Introduction (Informative)

Door two is external-agent steering: an agent outside the application accesses policy-permitted capabilities generated from the same registry used by in-application steering. It exists because outside agents will try to operate products one way or another; a Steerable App gives them a typed, governed path instead of forcing them through browser or pixel automation.

This document makes the Stage 3 promise checkable during Stage 1: external access is generated from declarations and governed by the same policy engine, but MCP servers, tab bridges, identity systems, hosting, and protocol adapters are deferred.

The normative-now requirements are intentionally small. They bind the one-registry rule, same-policy invariant, and declaration metadata consumed by door two. Later sections sketch possible Stage 3 shapes and are loudly marked provisional.

## 2. Scope and Dependencies (Informative)

This document depends on `SA-CORE` for door-one and door-two vocabulary, `SA-DECL` for the registry and declaration fields, and `SA-POL` for policy-engine inputs and autonomy modes.

This document does not define an MCP server implementation, transport, authorization protocol, hosting topology, tab routing algorithm, UI widget model, or non-MCP protocol mapping. Those are Stage 3 work. The only protocol named here is MCP because the roadmap and research grounding identify it as the likely first door-two target.

## 3. Normative-Now Boundary (Normative)

- **SA-BRIDGE-001:** This document's Stage-1 normative requirements MUST be limited to registry derivation, external exposure eligibility, policy parity, declaration metadata consumed by door two, and the framework/developer boundary.
- **SA-BRIDGE-002:** A Stage-1 implementation MUST NOT be required to implement an MCP server, tab bridge, external authentication flow, external hosting surface, or non-MCP protocol adapter to satisfy this document.
- **SA-BRIDGE-003:** Door two is optional for an integrating application, but if an implementation exposes door two or claims door-two conformance, it MUST satisfy every normative-now requirement in this document.
- **SA-BRIDGE-004:** A non-MCP external protocol MAY be added by a later specification or implementation, but it MUST NOT bypass the one-registry rule, external exposure eligibility, trusted executors, or same-policy invariant in this document.

## 4. Two Doors, One Registry (Normative)

- **SA-BRIDGE-010:** Every external action tool and external read tool exposed through door two MUST be generated from the same capability registry used by door one.
- **SA-BRIDGE-011:** A conforming implementation MUST NOT maintain a separately authored external tool layer that defines action meaning, read-tool meaning, schemas, policy metadata, guidance, examples, executor semantics, or exposure eligibility outside the registry.
- **SA-BRIDGE-012:** Door-two generation MUST preserve the stable declaration ID for every generated external tool, either as the protocol-visible tool name or as protocol metadata that is traceable to the tool name.
- **SA-BRIDGE-013:** A generated external tool definition MUST NOT add, remove, or change declared parameters, parameter constraints, title, description, guidance, examples, risk, reversibility, effects, confirmation posture, preconditions, reads, writes, executor semantics, query semantics, undo semantics, observation semantics, or external exposure eligibility outside the registry.
- **SA-BRIDGE-014:** Protocol-required transformations, such as converting a dot-separated declaration ID into a protocol-safe tool name, MUST be deterministic, reversible by the bridge, and traceable to the original declaration ID.
- **SA-BRIDGE-015:** External bridge configuration MAY choose which eligible registry capabilities are published in a deployment, but it MUST NOT publish a capability whose registry declaration has `externalExposure: none`.
- **SA-BRIDGE-016:** If generated door-two output conflicts with the registry, the registry MUST win and the conflicting generated output MUST be treated as a conformance error.

## 5. External Exposure Eligibility (Normative)

- **SA-BRIDGE-020:** Door-two generation MUST consider only action and read tool declarations whose registry entry has `externalExposure: eligible`.
- **SA-BRIDGE-021:** `externalExposure: none` MUST prevent generation of an external door-two tool for that capability.
- **SA-BRIDGE-022:** `externalExposure: eligible` MUST be treated only as capability-level eligibility for external generation, not as authorization to publish, invoke, or execute the capability.
- **SA-BRIDGE-023:** Actual door-two publication and invocation MUST still depend on developer bridge configuration, registry availability, surface and precondition state, user/session context, session trust, scoped grants, runtime signals, and policy resolution.
- **SA-BRIDGE-024:** External exposure eligibility MUST NOT be inferred from `risk`, `effects.external`, action namespace, title, description, guidance, or the presence of an MCP server configuration.
- **SA-BRIDGE-025:** Door-two generation MUST NOT expose facts declarations as external tools unless a later specification defines a facts-specific external context export model.

## 6. Declaration Metadata Consumed by Door Two (Normative)

- **SA-BRIDGE-030:** For each external action tool, door two MUST consume the action declaration fields `id`, `title`, `description`, `params`, `reads`, `writes`, `risk`, `reversibility`, `effects`, `confirmation`, `preconditions`, `externalExposure`, `execute`, `undo`, `observe`, `guidance`, and `examples`.
- **SA-BRIDGE-031:** For each external read tool, door two MUST consume the read tool declaration fields `id`, `title`, `description`, `params`, `reads`, `preconditions`, `externalExposure`, `query`, `guidance`, and `examples`.
- **SA-BRIDGE-032:** Door two MUST consume surface declaration `id` and `capabilities` metadata when determining whether a capability is live for a user's session.
- **SA-BRIDGE-033:** Door two MUST consume optional surface `location` metadata only as a registry-derived routing hint; absence of `location` MUST NOT be repaired by a separately authored external routing table that claims normative surface semantics.
- **SA-BRIDGE-034:** Door two MUST consume facts declaration metadata only when a later context or bridge specification allows external fact export; until then, facts are not part of Stage-1 external tool generation.
- **SA-BRIDGE-035:** Door two MUST consume registry-compiled precondition state and surface liveness before allowing an external invocation to reach trusted execution or query code.
- **SA-BRIDGE-036:** The external bridge MUST NOT require declaration metadata beyond the fields listed in `SA-BRIDGE-030` through `SA-BRIDGE-034` for Stage-1 conformance.

## 7. Same-Policy Invariant (Normative)

- **SA-BRIDGE-040:** Every externally initiated action invocation MUST pass through the same application-owned policy engine used by door one before trusted execution proceeds.
- **SA-BRIDGE-041:** Every externally initiated read tool query MUST pass through the same application-owned policy engine used by door one before application data is returned, resolving through the read-only policy path rather than action risk machinery.
- **SA-BRIDGE-042:** For the same user, session, surface, registry state, proposed capability use, posture, overrides, grants, and runtime signals except access path, door two MUST NOT resolve to a more autonomous policy outcome than door one.
- **SA-BRIDGE-043:** Door-two-specific policy configuration MAY lower autonomy, add gates, or refuse external access, but it MUST NOT bypass declaration validation, registry availability, precondition checks, scoped-grant rules, confirmation floors, or trusted executor requirements.
- **SA-BRIDGE-044:** External caller, host, transport, and session trust information MUST be supplied to the policy engine through explicit inputs such as session trust, role, environment, scoped grants, developer overrides, or runtime signals.
- **SA-BRIDGE-045:** Host-level consent, MCP client approval, OAuth consent, browser permission, or external-agent policy MUST NOT be treated as a substitute for the application's own policy decision.
- **SA-BRIDGE-046:** External callers MUST NOT receive direct authority to call `execute`, `query`, `undo`, or `observe`; the bridge MUST treat external requests as untrusted proposals routed to app-owned trusted code.
- **SA-BRIDGE-047:** A generated external tool MUST fail closed when the target registry entry is missing, no longer eligible, not live for the session, preconditions are unsatisfied, policy refuses, the required user's live execution context cannot be reached, or trusted execution returns an error.
- **SA-BRIDGE-048:** Door-two policy decisions and execution results MUST be recordable by the ledger layer under the same audit expectations as equivalent door-one decisions once `SA-LED` is present.

## 8. Consistency Audit Against SA-DECL and SA-POL (Informative)

Audit result: `SA-DECL` carried most door-two inputs before this issue: stable IDs, strict schemas, titles, descriptions, guidance, examples, reads, writes, policy metadata, preconditions, trusted executors, read queries, surfaces, and registry derivation rules. It did not carry an explicit capability-level external exposure eligibility field.

This issue adds `externalExposure` to action and read tool declarations in `SA-DECL-130` through `SA-DECL-137`. The split follows the framework/developer meta-principle: a declaration states whether a capability is eligible for external exposure; policy and deployment configuration decide whether a particular bridge, caller, session, role, or environment may use it.

`SA-POL` already supplies the policy hooks door two needs at Stage 1: session trust, role, user autonomy setting, current surface, grants, developer overrides, environment-like override scope, and runtime signals are explicit inputs to the pure policy engine. No autonomy-policy field addition is required for this issue. Door-two caller and host details are mapped into those explicit policy inputs rather than encoded in declarations.

## 9. MCP Tool Generation Sketch (Informative, Provisional)

> **PROVISIONAL — Stage 3 design sketch, not yet normative.**

A Stage 3 MCP generator could project eligible registry entries into MCP tools. A generated action tool would use the declaration ID as the stable source identity, the declaration title and description as human-readable tool text, `params` as the input schema, and `guidance` plus `examples` as model-facing selection help. A generated read tool would follow the same pattern but route to `query` and resolve through the read-only policy path.

An illustrative generated shape might look like this:

```ts
{
  name: "palette_set_color",
  metadata: { steerableId: "palette.set_color" },
  title: "Set one palette color",
  description: "Set a single palette token to a hex value.",
  inputSchema: registry.actions["palette.set_color"].params,
}
```

The generator may also emit protocol annotations derived from registry metadata, such as read-only hints for read tools or destructive hints for destructive actions. Such annotations would be advisory to external hosts; the app policy engine would remain authoritative.

Stage 3 still needs to decide exact MCP naming, output shape, tool annotations, elicitation use, Apps UI resources, host compatibility, and whether to expose any generated review UI. This document intentionally does not settle those mechanics.

## 10. Tab Bridge Sketch (Informative, Provisional)

> **PROVISIONAL — Stage 3 design sketch, not yet normative.**

The hard door-two problem is not generating a schema; it is executing a server-side external request inside the right user's live product session. A plausible tab bridge has these moving parts:

| Part | Provisional role |
|---|---|
| External host or agent | Sends a tool call proposal to the bridge. |
| Bridge server | Authenticates the external channel, maps tool name to registry ID, finds the user/session, and prepares policy inputs. |
| Registry projection | Supplies the generated external tool definitions and reverse mapping to registry entries. |
| Session binding | Connects the external call to one user's active app session and surface state. |
| Live tab adapter | Receives authorized invocation envelopes and runs trusted app-owned `execute` or `query` code in the live session. |
| Policy engine | Resolves the same policy decision door one would resolve, with external caller context supplied as explicit inputs. |
| Ledger/result path | Records the decision and result where required, then returns a bounded result to the external caller. |

A likely flow is: external tool call proposal, registry lookup, session lookup, policy resolution, delivery to the live tab, trusted execution or query, observation, ledger recording, and result return. If the session is gone, the surface is not live, preconditions fail, or policy refuses, the bridge returns a legible failure rather than trying to operate the UI through pixels.

The trust boundary stays simple: the external host and model propose; the app registry and policy decide; trusted app code executes. The bridge server may authenticate and route, but it does not become a second executor layer.

## 11. Identity and Auth Questions (Informative, Provisional)

> **PROVISIONAL — Stage 3 design sketch, not yet normative.**

Stage 3 needs concrete answers to at least these questions:

1. How is an external host or MCP client bound to an app user account?
2. How does the bridge choose among multiple active tabs, surfaces, devices, or sessions for the same user?
3. What proves that a live tab is still controlled by the intended user and has not expired?
4. How are replay, stale approvals, and confused-deputy risks prevented?
5. Which external hosts are trusted enough to receive generated tools, and where is that configured?
6. What result data can leave the live session, especially for sensitive reads or observations?
7. What happens when no live tab is available: refusal, hand-off, queued intent, or product-specific fallback?
8. How do MCP host consent and app-owned policy gates appear to the user without creating double-confirmation theater?

These are policy and product questions as much as protocol questions. They remain deferred until Stage 3.

## 12. Resolution Notes (Informative)

1. Exposure control shape: resolved as both declaration and policy. `externalExposure` records capability-level eligibility in the declaration; deployment publication, caller authorization, session trust, and autonomy outcome remain policy/configuration.
2. External-caller identity: `SA-POL` is sufficient for Stage 1 because caller and host trust can be supplied as explicit session trust, role, environment, grant, override, or runtime-signal inputs. No policy-spec edit was made.
3. Generated means bindingly: generated external tools may transform protocol names, but no external tool definition may introduce capability facts absent from the registry.
4. Deferral marking: every Stage 3 design section uses the banner "PROVISIONAL — Stage 3 design sketch, not yet normative" immediately under the heading.
5. Consistency audit: `SA-DECL` needed one additive field family; `SA-POL` needed no change for this issue.
6. Same-policy invariant: external access may be stricter than door one, but never more permissive for equivalent inputs except where non-access-path policy inputs genuinely differ.

## 13. Framework Decides vs. Developer Decides (Normative)

- **SA-BRIDGE-070:** This external bridge specification MUST preserve the framework/developer boundary in Table 1.

| Requirement | The framework decides | The developer decides |
|---|---|---|
| **SA-BRIDGE-071** | Door one and door two use one registry when both are exposed. | Whether door two is exposed at all. |
| **SA-BRIDGE-072** | External action tools and read tools are generated from eligible registry entries. | Which action and read tool declarations are marked `externalExposure: eligible`. |
| **SA-BRIDGE-073** | External eligibility is declaration metadata, while publication and invocation authorization are policy/configuration. | Which bridge deployments, hosts, roles, users, and environments may publish or invoke eligible capabilities. |
| **SA-BRIDGE-074** | External invocations pass through the same application-owned policy engine as door one. | Whether external access is treated equally, more cautiously, or refused for a product context. |
| **SA-BRIDGE-075** | External callers never receive direct executor or query authority. | Which trusted app-owned executors and queries implement the declared capabilities. |
| **SA-BRIDGE-076** | Protocol transformations remain traceable to declaration IDs and cannot redefine capability facts. | Which protocol names, descriptions, or metadata conventions a concrete MCP generator uses within that constraint. |
| **SA-BRIDGE-077** | Stage 1 does not standardize MCP server implementation, tab bridge transport, identity binding, hosting, or non-MCP adapters. | The concrete Stage 3 bridge architecture, authentication provider, host allow-list, session routing behavior, and deployment topology. |
| **SA-BRIDGE-078** | The same-policy invariant and fail-closed behavior are mandatory when door two is exposed. | Product-specific user experience for gates, refusals, unavailable sessions, and bridge result presentation. |
