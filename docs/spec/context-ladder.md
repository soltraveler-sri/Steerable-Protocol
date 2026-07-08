# Steerable Apps Context Ladder Specification (Normative)

**Status:** Draft v0.1
**Spec code:** SA-CTX
**Role:** Curated facts, read tools, annotated DOM snapshots, vision fallback, privacy boundaries, and context escalation
**Canonical project source:** `Steerable-Protocol-NorthStar.md`

## 1. Introduction (Informative)

Context is the part of the Steerable Apps contract that lets an agent understand the current product state without taking over the browser. The north-star principle is "curated context beats raw context": a runtime should use declared, typed, app-owned context before it considers raw UI structure or pixels.

This document makes that principle checkable. It defines four ordered context rungs: curated facts, typed read tools, annotated DOM snapshots, and screenshot or vision fallback. The higher rungs are cheaper, more private, and more deterministic; the lower rungs exist for bounded fallback, not as a foundation for declared capabilities.

## 2. Scope and Dependencies (Informative)

This document elaborates the facts and read-tool semantics declared by `SA-DECL-060` through `SA-DECL-069` and `SA-DECL-070` through `SA-DECL-078`. It cites those declaration contracts rather than redefining their shapes.

This document also depends on the policy semantics in `SA-POL`, especially `SA-POL-067` and `SA-POL-068` for sensitive-data effects. Context exposure is not action execution, but context choices can affect whether an action honestly operates on sensitive data.

This document does not define DOM annotation tooling, screenshot capture APIs, vision model selection, prompt assembly, execution state machines, or ledger record schemas.

## 3. Context Ladder Model (Normative)

- **SA-CTX-001:** A conforming implementation MUST define the context ladder as exactly these four ordered rungs: Rung 1 curated facts, Rung 2 typed read tools, Rung 3 annotated DOM snapshot, and Rung 4 screenshot or vision fallback.
- **SA-CTX-002:** A runtime MUST prefer the lowest-numbered permitted rung that can satisfy the current information need.
- **SA-CTX-003:** Context obtained from any rung MUST NOT by itself mutate application state, perform user-visible product changes, spend quota or money, perform destructive operations, or grant action execution authority.
- **SA-CTX-004:** Context from any rung MUST be treated as observation input; proposed actions still MUST validate against the registry and policy before trusted execution as required by `SA-CORE-051`, `SA-DECL-032`, and `SA-POL-100`.
- **SA-CTX-005:** A conforming integration MUST NOT require Rung 3 or Rung 4 for successful use of its declared actions, read tools, or facts.
- **SA-CTX-006:** Rung 3 and Rung 4 MUST be fallback rungs, never the foundation for declared capability meaning, schemas, policy metadata, preconditions, executor semantics, or undo semantics.
- **SA-CTX-007:** A runtime MUST allow developer policy to forbid Rung 3, Rung 4, or both, globally or for particular surfaces, roles, sessions, environments, or sensitivity classes.
- **SA-CTX-008:** If developer policy forbids a rung, the runtime MUST treat that rung as unavailable and MUST NOT expose its context to the agent.
- **SA-CTX-009:** When lower-rung context conflicts with registry-derived capability metadata, facts, or read-tool output, the runtime MUST NOT use the lower-rung context to override the higher-authority source.

## 4. Rung 1: Curated Facts (Normative)

- **SA-CTX-020:** Rung 1 facts MUST use the facts declaration semantics defined by `SA-DECL-070` through `SA-DECL-078`.
- **SA-CTX-021:** A runtime assembling context for a live surface MUST consider that surface's live facts before invoking read tools or considering lower rungs.
- **SA-CTX-022:** Each top-level fact exposed at Rung 1 MUST be statically enumerable from the facts declaration's `facts` entries.
- **SA-CTX-023:** A facts publisher MUST NOT create a data-dependent or unbounded number of top-level fact keys at runtime.
- **SA-CTX-024:** Fact values MUST conform to the strict typed schemas declared for those fact entries under `SA-DECL-074`.
- **SA-CTX-025:** Fact values MUST represent committed app-owned state known to the publisher at publication time, not speculative model proposals.
- **SA-CTX-026:** If a fact intentionally represents pending or provisional product state, its fact key, schema, or description MUST make that status distinguishable from committed state.
- **SA-CTX-027:** Facts MUST NOT contain DOM trees, markup dumps, screenshot transcripts, unbounded collections, arbitrary application memory exports, raw framework state graphs, secrets, or hidden implementation objects.
- **SA-CTX-028:** When a useful context value is too large, sparse, private, or parameter-dependent for Rung 1, the implementation SHOULD expose a bounded summary fact and a Rung 2 read tool for deliberate lookup.
- **SA-CTX-029:** This specification does not replace the `SA-DECL-078` SHOULD that a facts declaration publish roughly a dozen or fewer fact entries for a surface.
- **SA-CTX-030:** A conformance check for facts boundedness MUST be able to inspect the declaration for enumerability and finite top-level fact keys, and MUST NOT fail an implementation solely because a surface has more than a dozen facts unless the applicable conformance level defines a stricter numeric bound.
- **SA-CTX-031:** A runtime MUST stop exposing a surface's facts when the surface is no longer live, consistent with `SA-DECL-071` and `SA-DECL-084`.

## 5. Rung 2: Typed Read Tools (Normative)

- **SA-CTX-040:** Rung 2 read tools MUST use the read-tool declaration semantics defined by `SA-DECL-060` through `SA-DECL-069`.
- **SA-CTX-041:** A runtime MAY invoke a read tool when permitted Rung 1 facts are absent, insufficient, stale, too summarized, or explicitly direct the agent to look up parameterized detail.
- **SA-CTX-042:** A read tool invocation MUST validate the read tool ID, parameters, preconditions, and surface availability against the registry before the trusted `query` runs.
- **SA-CTX-043:** A read tool result exposed as context MUST be bounded by the tool's typed contract and MUST NOT return an unbounded object graph, arbitrary memory export, DOM dump, screenshot transcript, secret store, or undeclared implementation structure.
- **SA-CTX-044:** Read tool use MUST NOT be routed through action risk, reversibility, effects, confirmation, execute, or undo machinery, consistent with `SA-DECL-061` and `SA-DECL-063`.
- **SA-CTX-045:** Read tool guidance assembled for agents SHOULD preserve the declaration guidance required by `SA-DECL-068`, especially when the read tool is intended to be used before proposing an action.
- **SA-CTX-046:** If a read tool is unavailable, forbidden, or fails validation, the runtime MUST NOT simulate the query through an action executor.
- **SA-CTX-047:** If a read tool result contradicts Rung 1 facts, the runtime SHOULD refresh the relevant facts or report the ambiguity rather than silently choose the lower-confidence value.

## 6. Rung 3: Annotated DOM Snapshot (Normative)

- **SA-CTX-060:** Rung 3 is a bounded structural snapshot of the current user interface annotated with app-owned semantic identifiers such as `data-ai-id`; it is not a declaration kind and MUST NOT be added to the registry as a capability.
- **SA-CTX-061:** A runtime MUST consider Rung 3 only when Rung 1 and permitted Rung 2 read tools cannot satisfy the current information need, and developer policy permits Rung 3.
- **SA-CTX-062:** An annotated DOM snapshot MUST be bounded to the relevant live surface, region, or element set needed for the information need.
- **SA-CTX-063:** An annotated DOM snapshot MUST exclude script contents, style contents, event handler code, raw framework props, hidden implementation state, secrets, and content the user or app policy has not authorized for agent exposure.
- **SA-CTX-064:** `data-ai-id` values SHOULD be stable, app-owned, human-meaningful identifiers for product-semantic elements or regions.
- **SA-CTX-065:** `data-ai-id` values SHOULD include enough namespace context to avoid collisions within the surface, and SHOULD NOT encode private implementation paths, database identifiers, secrets, personal data, or array indexes as the only source of identity.
- **SA-CTX-066:** An implementation MAY use an annotation attribute other than `data-ai-id` only when the target UI platform lacks HTML DOM attributes or a later profile defines an equivalent annotation mechanism.
- **SA-CTX-067:** Rung 3 MUST NOT be used to discover action schemas, infer policy metadata, bypass preconditions, synthesize undeclared read tools, or identify trusted executors.
- **SA-CTX-068:** A conforming implementation MUST remain usable for declared capabilities when Rung 3 is disabled by developer policy.

## 7. Rung 4: Screenshot and Vision Fallback (Normative)

- **SA-CTX-080:** Rung 4 is screenshot or vision-based observation of the current product surface and MUST be treated as the final context fallback.
- **SA-CTX-081:** A runtime MUST consider Rung 4 only when Rung 1, permitted Rung 2, and permitted Rung 3 cannot satisfy the current information need, and developer policy permits Rung 4.
- **SA-CTX-082:** Rung 4 MAY be used for incidental visible information that the app has not declared, visual QA, layout inspection, or accessibility-adjacent observation when the product permits that exposure.
- **SA-CTX-083:** Rung 4 MUST NOT be required for conformance and MUST NOT be required for successful use of declared actions, read tools, or facts.
- **SA-CTX-084:** A screenshot or vision capture MUST be bounded to the relevant app surface or viewport and MUST NOT include other applications, unrelated browser tabs, operating-system UI, or background windows unless explicitly permitted by the user and developer policy.
- **SA-CTX-085:** A runtime MUST apply configured redaction or withholding policy before exposing screenshot or vision content to an agent.
- **SA-CTX-086:** Vision-derived text, labels, coordinates, or descriptions MUST be treated as untrusted observations and MUST NOT override registry-derived declarations, facts, or read-tool outputs.
- **SA-CTX-087:** Absence of sufficient declared context MAY result in clarification, refusal, or hand-off instead of descent to Rung 4.

## 8. Escalation and Prohibition Rules (Normative)

- **SA-CTX-100:** A runtime MAY descend from one rung to the next only for a specific information need that remains unsatisfied by all permitted higher rungs.
- **SA-CTX-101:** A runtime MUST NOT preemptively expose Rung 3 or Rung 4 context merely because an agent request exists.
- **SA-CTX-102:** A descent decision SHOULD be recordable with the requested information need, rungs considered, reason higher rungs were insufficient, and policy permission used.
- **SA-CTX-103:** A runtime MUST NOT descend a rung to work around missing, invalid, or unavailable action declarations.
- **SA-CTX-104:** A runtime MUST NOT descend a rung to work around a policy refusal, failed precondition, failed parameter validation, unavailable trusted executor, or forbidden action.
- **SA-CTX-105:** A runtime MUST NOT use Rung 3 or Rung 4 to reconstruct a duplicate tool layer for actions or read tools already governed by the registry.
- **SA-CTX-106:** If the permitted ladder cannot satisfy an information need safely, the runtime MUST choose clarification, refusal, hand-off, or another non-mutating product-native path instead of using a forbidden rung.
- **SA-CTX-107:** An implementation that disables Rung 3 and Rung 4 entirely MAY still conform to this document if its declared facts, read tools, and policy behavior satisfy the applicable requirements.

## 9. Sensitivity and Privacy Boundaries (Normative)

- **SA-CTX-120:** A runtime MUST allow developer policy to classify, redact, withhold, or scope context exposed by any rung when the app treats that context as sensitive.
- **SA-CTX-121:** A runtime MUST NOT expose sensitive information through a lower rung when the same information was intentionally withheld, redacted, or forbidden at a higher rung by developer policy.
- **SA-CTX-122:** Context exposure policy MUST be evaluated before context is supplied to an agent, model prompt, tool loop, external bridge, or generated observation.
- **SA-CTX-123:** Context permissions MUST NOT mutate action declarations or add new `effects` values beyond the value sets defined by `SA-DECL-040` through `SA-DECL-043`.
- **SA-CTX-124:** When a proposed action can operate on sensitive data made available through facts, read tools, annotated DOM, or vision, the action classification MUST remain consistent with `SA-POL-067` and `SA-POL-068`.
- **SA-CTX-125:** A runtime MUST NOT use lower-rung context to bypass a sensitive-domain policy floor, user autonomy lowering, scoped-grant restriction, or refusal outcome defined by `SA-POL`.
- **SA-CTX-126:** If context redaction prevents the agent from safely resolving an intent, the runtime MUST surface clarification, refusal, or hand-off rather than infer hidden sensitive values from lower-rung context.

## 10. Cost, Privacy, and Determinism Rationale (Informative)

| Rung | Cost profile | Privacy profile | Determinism profile |
|---:|---|---|---|
| 1. Curated facts | Lowest: no tool call and small payload. | Narrowest: developer-chosen facts only. | Highest: typed values from app-owned state. |
| 2. Typed read tools | Low to moderate: deliberate query only when needed. | Bounded by params, preconditions, and query contract. | High: trusted app-owned query over declared state keys. |
| 3. Annotated DOM snapshot | Moderate: larger payload and more filtering. | Broader: visible structure can reveal more than intended facts. | Medium: UI structure is more volatile than registry state. |
| 4. Screenshot or vision | Highest: image capture, model processing, and interpretation. | Broadest: pixels can include incidental sensitive information. | Lowest: vision output is probabilistic observation. |

The ladder preserves the reference experience by keeping common steering work in facts and read tools. Fast, reversible actions should not wait for DOM parsing or vision calls when the app has already declared the necessary state. The fallback rungs exist so a runtime can inspect genuinely undeclared visible context when policy permits, not so integrations can skip declaring product semantics.

## 11. Design Studio Example Sketch (Informative)

The `examples/design-studio` app described in `docs/plan/ROADMAP.md` can satisfy the ladder without relying on Rung 3 or Rung 4 for declared capability use.

Example Editor-surface facts:

| Fact key | Purpose |
|---|---|
| `ui.route` | Current surface or route. |
| `project.current_id` | Stable current project reference suitable for activity and fixtures. |
| `project.dirty` | Whether local changes have not been exported or saved. |
| `design.selection` | Current selected object or region, summarized. |
| `design.palette` | Current palette tokens and mode. |
| `design.typography` | Current heading and body type choices. |
| `design.template` | Active template family and variant. |
| `design.viewport` | Current preview size or responsive mode. |
| `history.can_undo` | Whether a local undo handle exists. |
| `quota.daily_builds_remaining` | Remaining mock quota for generation or export gates. |
| `policy.posture` | Current example posture, such as `creative-tool` or cautious demo posture. |

Example read tools:

| Read tool ID | Information need |
|---|---|
| `design.get_palette_report` | Return detailed palette values, contrast notes, and token usage when the facts summary is not enough. |
| `templates.list_available` | Query template options by category, style, or surface before proposing a template action. |
| `history.list_recent_activity` | Inspect recent reversible steps before answering "what changed?" or proposing undo. |
| `quota.get_generation_status` | Check quota and generation availability before proposing a quota-consuming build. |

This sketch keeps frequently needed context in bounded facts, moves parameterized or longer data into read tools, and leaves annotated DOM or vision for incidental visual inspection only.

## 12. Resolution Notes for This Context Document (Informative)

The following issue-level decisions are recorded so later authors do not re-open them accidentally:

1. Facts boundedness is made checkable through static enumerability and finite top-level fact keys. The roughly-dozen guidance remains the `SA-DECL-078` SHOULD; this document does not turn it into a hard numeric failure.
2. `data-ai-id` is a recommended convention, not a rigid universal grammar. The spec requires stable, app-owned semantic annotations when Rung 3 is used, while avoiding DOM maximalism.
3. Freshness is defined as committed app-owned state at publication time for facts and trusted query time for read tools. The spec does not prescribe a reactive implementation mechanism.
4. Sensitivity is handled through context permissions, redaction, and the existing `effects.sensitive` semantics for actions. This document adds no new action metadata values.
5. Screenshot and vision fallback is never mandatory. If declared context is insufficient and lower rungs are forbidden, clarification, refusal, or hand-off is conformant.

No conflict with the north-star, `SA-DECL`, or `SA-POL` was identified while writing this document.

## 13. Context Ladder Self-Check (Informative)

This document was checked against the issue acceptance criteria after drafting:

1. Four rungs are specified with `SA-CTX` requirement IDs.
2. Escalation and prohibition rules are normative.
3. Facts bounds are checkable by declaration enumerability and finite top-level keys.
4. Cost, privacy, and determinism rationale is informative.
5. `SA-DECL` facts and read-tool shapes are cited, not redefined.
6. The design-studio sketch exercises facts and read tools without making DOM or vision foundational.
7. Rungs 3 and 4 are normatively fallback-never-foundation.
8. No conformance path requires DOM or vision access.

## 14. Framework Decides vs. Developer Decides (Normative)

- **SA-CTX-140:** This context ladder specification MUST preserve the framework/developer boundary in Table 1.

| Requirement | The framework decides | The developer decides |
|---|---|---|
| **SA-CTX-141** | The four ordered context rungs and their fallback relationship. | Which declared facts, read tools, annotations, or visual affordances are useful for the product. |
| **SA-CTX-142** | That curated facts are the first rung and must remain bounded, typed, surface-scoped context under `SA-DECL`. | Which small set of surface facts best represents current product state. |
| **SA-CTX-143** | That typed read tools are the second rung and remain side-effect-free queries outside action risk machinery. | Which parameterized product queries are worth exposing and when agent guidance should use them. |
| **SA-CTX-144** | That annotated DOM snapshots are deliberate bounded fallback, not registry capabilities or action semantics. | Whether to permit annotated DOM snapshots and which semantic elements receive stable annotations. |
| **SA-CTX-145** | That screenshot and vision context is the final fallback and never required for conformance. | Whether screenshot or vision fallback is permitted for a surface, role, session, or environment. |
| **SA-CTX-146** | The escalation rule: use the least raw permitted rung that satisfies the information need. | The product policy for forbidding, redacting, scoping, or auditing lower-rung context. |
| **SA-CTX-147** | That lower rungs cannot bypass declarations, validation, policy, preconditions, or trusted execution. | How the product handles missing context: clarification, refusal, hand-off, or product-native manual paths. |
| **SA-CTX-148** | That sensitive context exposure must respect context permissions and existing `effects.sensitive` action semantics. | What the product treats as sensitive and which redaction or withholding rules apply. |
| **SA-CTX-149** | That conformance checks may inspect facts enumerability and finite bounds. | Whether a product chooses an even smaller fact budget than the roughly-dozen guidance. |
