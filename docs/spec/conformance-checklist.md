# Steerable Apps Conformance Checklist (Normative)

**Status:** Draft v0.1
**Spec code:** SA-CONF
**Role:** Conformance levels, checkable criteria, audit checklist, and traceability from checklist items to requirement IDs
**Canonical project source:** `Steerable-Protocol-NorthStar.md`

## 1. Introduction (Informative)

This document distills the Steerable Apps specification suite into observable checks that a coding agent can run against an unfamiliar codebase. It answers the north-star question of how sharp conformance tests need to be before "a coding agent did the retrofit" becomes a trust statement: the app must expose one registry of declared capabilities, resolve policy before every steering execution, execute only through trusted app-owned code, keep context bounded and declared, record decisions and undo truthfully, and avoid both unsafe mutation and approval theater.

The checklist is intentionally execution-oriented. Each checklist item cites the requirement IDs it verifies, states a single independently checkable assertion, gives a "how to look" procedure, and assigns a severity. Spec gaps discovered while writing the checks are listed instead of patched inline.

## 2. Result Vocabulary (Normative)

An auditor reports each checklist item with one of these result values:

| Result | Meaning |
|---|---|
| Pass | The check was executed and the assertion holds for the claimed conformance scope. |
| Fail | A MUST-severity item was executed and the assertion does not hold for the claimed conformance scope. |
| Flag | A SHOULD-severity item was executed and the assertion does not hold. |
| Not applicable | The item is conditional and the implementation does not expose or claim that condition. |
| Pending spec clarification | The item is checkable in shape, but a known spec ambiguity blocks a decisive pass/fail rule. |
| Inconclusive | Required evidence is unavailable; this does not count as pass for a conformance claim. |

## 3. Conformance Levels (Normative)

The `<level>` token from `SA-CORE-080` has exactly these values in this draft: `minimal` and `full`.

`minimal` is the trust floor for user-facing steering. A minimal claim requires the registry, policy-before-execution path, trusted executors, facts/read tools, visible activity, ledger trace, and honest undo/no-undo behavior to pass every Minimal+ MUST item that applies to the exposed steering scope.

`full` is the complete Stage-1 specification profile. A full claim requires every Minimal+ and Full MUST item to pass, every applicable door-two MUST item to pass when door two is exposed or claimed, every SHOULD item to be reported, and all pending-clarification items to be resolved or explicitly excluded by the cited spec clarification.

## 4. Checklist Items (Normative)

| ID | Applies | Severity | Assertion | Requirement IDs | How to look |
|---|---|---:|---|---|---|
| **SA-CONF-001** | Any claim | MUST | A conformance claim uses the exact level/version shape and only the `minimal` or `full` level token. | `SA-CORE-080`, `SA-CORE-081`, `SA-CORE-082`, `SA-CORE-083` | Search README, docs, UI badges, package metadata, and release notes for "Steerable App"; verify any claim matches `This app is a Steerable App: <level> conformance to Steerable Apps <version>.` |
| **SA-CONF-002** | Minimal+ | MUST | A `minimal` claim passes only when all applicable Minimal+ MUST items pass. | `SA-CORE-083`, `SA-CORE-084` | Review the completed checklist result table; verify no applicable Minimal+ item is Fail, Pending, or Inconclusive. |
| **SA-CONF-003** | Full | MUST | A `full` claim passes only under the full-level pass rule. | `SA-CORE-083`, `SA-CORE-084`, `SA-BRIDGE-003` | Review the completed checklist result table; verify all non-SHOULD items that apply to the claimed scope are Pass or Not applicable by condition. |
| **SA-CONF-004** | Any claim | MUST | The implementation does not overclaim its audited conformance level. | `SA-CORE-084` | Compare the public claim to audit results for registry, policy, execution, context, ledger, and bridge sections; flag any higher-level claim with failed or unimplemented required behavior. |
| **SA-CONF-005** | Any claim | MUST | A conformance report satisfies the item-level evidence contract. | `SA-CORE-083`, `SA-CORE-084`, `SA-CORE-099` | Inspect the audit artifact; verify every checklist ID has a result and either evidence, an explicit not-applicable condition, or a pending-clarification reference. |
| **SA-CONF-006** | Minimal+ | MUST | The declaration layer supports the required capability-kind set. | `SA-CORE-022`, `SA-CORE-057`, `SA-DECL-001` | Locate the declaration APIs or registry schema; verify capability kind enums, type unions, or tables contain these four kinds and no additional declaration kind used as normative steering authority. |
| **SA-CONF-007** | Minimal+ | MUST | Each steering action has exactly one authoritative declaration source. | `SA-CORE-050`, `SA-DECL-002`, `SA-DECL-030`, `SA-DECL-093` | List product-changing steering actions from registry, prompts, tools, docs, fixtures, and bridge code; verify each maps back to one action declaration and that no second action table defines meaning. |
| **SA-CONF-008** | Minimal+ | MUST | The runtime registry uses declarations as its compile source. | `SA-CORE-027`, `SA-DECL-090` | Trace registry construction; verify runtime capability lookup consumes declared actions, read tools, facts, and surfaces rather than handwritten runtime-only tool entries. |
| **SA-CONF-009** | Minimal+ | MUST | Declared capability IDs satisfy the spec identity contract. | `SA-DECL-010`, `SA-DECL-011`, `SA-DECL-012`, `SA-LED-009` | Dump all declaration IDs and ledger/test references; check uniqueness, grammar, and absence of aliases or reused IDs across migrations, saved workflows, fixtures, and ledgers where history is available. |
| **SA-CONF-010** | Minimal+ | MUST | Action ID final segments satisfy the `verb_noun` or declared established-product-command exception contract. | `SA-DECL-013`, `SA-DECL-054` | List action IDs; verify every final segment contains a verb/noun separator, or that its declaration has exactly the `idException` object required by `SA-DECL-054`. |
| **SA-CONF-011** | Minimal+ | MUST | Capability prose satisfies the declaration prose contract. | `SA-DECL-014`, `SA-DECL-015`, `SA-DECL-104`, `SA-EXEC-206` | Inspect declarations and generated activity/approval text; verify title/description exist, describe the capability, and policy facts come from typed metadata rather than prose. |
| **SA-CONF-012** | Minimal+ | MUST | Parameter-bearing declaration fields satisfy the strict-schema contract. | `SA-DECL-016`, `SA-DECL-017`, `SA-DECL-035`, `SA-DECL-064`, `SA-CTX-024`, `SA-CTX-042` | Locate schema parsers or JSON Schemas; run or inspect tests with extra keys and wrong types for representative actions/read tools/facts; verify rejection before executor/query code runs. |
| **SA-CONF-013** | Minimal+ | MUST | Structured parameters are not replaced by one flattened natural-language string when distinct inputs exist. | `SA-DECL-018` | Search declarations for single `text`, `prompt`, `instruction`, or `input` params; compare executor use to see whether separable fields such as IDs, enum choices, amounts, or booleans are hidden in prose. |
| **SA-CONF-014** | Minimal+ | MUST | Every action declaration includes all required action fields. | `SA-DECL-033`, `SA-DECL-034`, `SA-DECL-035`, `SA-DECL-036`, `SA-DECL-037`, `SA-DECL-038`, `SA-DECL-039`, `SA-DECL-040`, `SA-DECL-044`, `SA-DECL-045`, `SA-DECL-047`, `SA-DECL-048` | Enumerate actions and check required field presence, including explicit empty `params`, `reads`, `writes`, and `preconditions` where applicable. |
| **SA-CONF-015** | Minimal+ | MUST | Each action executor is trusted app-owned code, not model-controlled authority. | `SA-CORE-052`, `SA-CORE-094`, `SA-DECL-030`, `SA-DECL-031`, `SA-DECL-032`, `SA-DECL-046`, `SA-EXEC-002` | Trace from model/router output to mutation; verify model output only supplies proposed IDs/params and cannot call arbitrary functions, eval code, mutate stores, or choose executors outside declarations. |
| **SA-CONF-016** | Minimal+ | MUST | Read tools satisfy the read-only declaration contract. | `SA-CORE-024`, `SA-DECL-060`, `SA-DECL-061`, `SA-DECL-062`, `SA-DECL-063`, `SA-DECL-067`, `SA-CTX-040`, `SA-CTX-044` | Inspect read tool declarations; verify required read-tool fields exist, forbidden fields are absent, and `query` paths do not write state, spend resources, call action `execute`, or use action risk/undo fields. |
| **SA-CONF-017** | Minimal+ | MUST | Facts declarations satisfy the surface-live context contract. | `SA-CORE-025`, `SA-DECL-070`, `SA-DECL-071`, `SA-DECL-072`, `SA-DECL-073`, `SA-DECL-075`, `SA-DECL-076`, `SA-CTX-020`, `SA-CTX-031` | Locate facts registration and surface lifecycle code; verify facts name a surface, publish through trusted app code, and stop appearing in live context when that surface deregisters. |
| **SA-CONF-018** | Minimal+ | MUST | Top-level facts satisfy the finite-enumerability contract. | `SA-DECL-074`, `SA-CTX-022`, `SA-CTX-023`, `SA-CTX-030`, `SA-CTX-149` | Inspect each facts declaration; verify the declared `facts` list is finite, has stable keys, and `publish()` cannot create data-dependent top-level keys outside that list. |
| **SA-CONF-019** | Minimal+ | MUST | Facts and read-tool outputs satisfy the bounded-context contract. | `SA-DECL-077`, `SA-DECL-078`, `SA-CTX-027`, `SA-CTX-028`, `SA-CTX-043` | Inspect schemas and publishers/queries; sample outputs in tests; search for DOM serialization, screenshots, raw stores, secrets, or recursive object returns in facts/read tools. |
| **SA-CONF-020** | Minimal+ | MUST | Surfaces satisfy the declaration and liveness contract. | `SA-CORE-026`, `SA-DECL-080`, `SA-DECL-081`, `SA-DECL-083`, `SA-DECL-084`, `SA-DECL-086`, `SA-EXEC-160`, `SA-EXEC-162` | Inspect surface declarations and route/mode lifecycle code; verify surfaces list capability IDs, reject unknown refs, register when live, deregister when unavailable, and use declared surface IDs as identity. |
| **SA-CONF-021** | Minimal+ | MUST | Precondition tokens satisfy the canonical surface-predicate grammar. | `SA-DECL-019`, `SA-DECL-022`, `SA-DECL-045`, `SA-DECL-066`, `SA-DECL-085` | List precondition tokens and their evaluators; verify tokens are stable and registry-checkable, each `surface:<surface-key>` names a declared simple surface ID, and the colon-bearing predicate is not validated as a capability ID. |
| **SA-CONF-022** | Minimal+ | MUST | Multi-surface availability uses declared surface capability lists and conjunctive additional preconditions. | `SA-DECL-045`, `SA-DECL-085`, `SA-EXEC-168`, `SA-POL-105`, `SA-POL-133` | Find capabilities available on multiple surfaces; verify each is listed by every eligible surface, is available only while the current listed surface is live, and has no invented OR-style surface predicate. |
| **SA-CONF-023** | Minimal+ | MUST | The registry satisfies the runtime queryability contract. | `SA-DECL-091`, `SA-DECL-092`, `SA-DECL-096`, `SA-BRIDGE-035` | Inspect registry APIs and compile-time validation; run duplicate ID, invalid schema, missing field, invalid enum, and unknown surface-capability-reference tests where available. |
| **SA-CONF-024** | Minimal+ | MUST | Registry `externalExposure` materialization satisfies the door-two eligibility contract. | `SA-DECL-130`, `SA-DECL-131`, `SA-DECL-135`, `SA-DECL-136`, `SA-BRIDGE-020`, `SA-BRIDGE-024` | Dump compiled action/read-tool entries; verify omitted values become `none`, declared values are limited to `none`/`eligible`, and no bridge eligibility is inferred from names, risk, effects, or config. |
| **SA-CONF-025** | Minimal+ | MUST | Downstream generated artifacts derive from the registry. | `SA-DECL-100`, `SA-DECL-101`, `SA-DECL-102`, `SA-DECL-103`, `SA-DECL-104`, `SA-DECL-105`, `SA-DECL-106`, `SA-DECL-107`, `SA-DECL-108`, `SA-DECL-109` | Search prompts, tool schemas, docs, fixture data, policy tables, and bridge generation; verify they import/consume registry data and do not redefine action facts. |
| **SA-CONF-026** | Minimal+ | MUST | Duplicate tool layers cannot survive declaration removal. | `SA-CORE-050`, `SA-CORE-056`, `SA-DECL-093`, `SA-DECL-094`, `SA-DECL-095`, `SA-BRIDGE-011`, `SA-BRIDGE-016` | Search for `tool`, `mcp`, `functionDeclarations`, `openapi`, `fixtures`, and prompt schema homes; perform or reason through a deletion test for one action declaration. |
| **SA-CONF-027** | Minimal+ | MUST | Action policy metadata satisfies the shared value-set contract. | `SA-POL-001`, `SA-POL-002`, `SA-POL-003`, `SA-POL-004`, `SA-POL-005`, `SA-POL-006`, `SA-POL-007`, `SA-POL-008`, `SA-POL-009`, `SA-POL-010`, `SA-POL-011` | Dump action metadata and policy config; verify no posture, override, role, or runtime signal adds new declaration metadata values. |
| **SA-CONF-028** | Minimal+ | MUST | `risk` classifies the highest normal valid execution effect. | `SA-POL-020`, `SA-POL-021`, `SA-POL-022`, `SA-POL-023`, `SA-POL-024`, `SA-POL-026`, `SA-POL-027`, `SA-POL-028`, `SA-POL-029`, `SA-POL-030`, `SA-POL-031`, `SA-POL-032`, `SA-POL-033`, `SA-POL-034` | For each action, inspect executor code, called setters/endpoints, storage/network writes, clipboard/download/open-url behavior, quota/money use, deletion paths, and recovery; compare to declared risk. |
| **SA-CONF-029** | Minimal+ | MUST | Reversibility claims match an executable recovery mechanism. | `SA-POL-040`, `SA-POL-041`, `SA-POL-042`, `SA-POL-043`, `SA-POL-044`, `SA-POL-045`, `SA-POL-046`, `SA-POL-047`, `SA-POL-048`, `SA-DECL-049`, `SA-DECL-050`, `SA-DECL-051` | For each action, verify `undoable` has a declared inverse, `snapshot` has capture/restore authority, and `irreversible` does not claim an undo handle. |
| **SA-CONF-030** | Minimal+ | MUST | Effects and confirmation fields satisfy the policy-semantic contract. | `SA-POL-060`, `SA-POL-061`, `SA-POL-063`, `SA-POL-064`, `SA-POL-065`, `SA-POL-066`, `SA-POL-067`, `SA-POL-068`, `SA-POL-069`, `SA-POL-070`, `SA-POL-071`, `SA-POL-072` | Inspect executor normal paths and declared reads/writes; verify external systems, quota/money, sensitive data, and `confirmation` semantics are represented in typed metadata. |
| **SA-CONF-031** | Minimal+ | MUST | The trusted application-owned policy engine runs before every steering action execution. | `SA-CORE-031`, `SA-CORE-051`, `SA-CORE-054`, `SA-POL-100`, `SA-POL-101`, `SA-EXEC-001`, `SA-EXEC-005` | Trace every model/router/action-chain path from proposal to executor invocation; verify policy resolution happens after registry/schema/precondition validation and before executor code. |
| **SA-CONF-032** | Minimal+ | MUST | Policy resolution is a pure function of explicit inputs. | `SA-POL-102`, `SA-POL-103`, `SA-POL-104`, `SA-POL-105`, `SA-POL-120` | Inspect policy resolver code; flag hidden mutable reads, network calls, randomness, action execution, ledger writes, or state mutation inside policy; verify time/session/role/surface/grants/signals are inputs. |
| **SA-CONF-033** | Minimal+ | MUST | Policy output satisfies the recordable-rationale contract. | `SA-POL-106`, `SA-POL-107`, `SA-POL-108`, `SA-POL-109`, `SA-LED-050`, `SA-LED-051`, `SA-LED-052` | Inspect policy result type and ledger policy records; verify action IDs, declaration metadata, posture, overrides, effect floors, confirmation floor, grant use, runtime demotions, final mode, and reason codes are present. |
| **SA-CONF-034** | Minimal+ | MUST | The autonomy ladder satisfies the framework mode contract. | `SA-POL-080`, `SA-POL-081`, `SA-POL-082`, `SA-POL-083`, `SA-POL-084`, `SA-POL-085`, `SA-POL-086`, `SA-POL-087`, `SA-POL-088`, `SA-POL-089`, `SA-POL-090`, `SA-POL-091`, `SA-POL-092`, `SA-POL-093`, `SA-POL-094`, `SA-POL-095`, `SA-POL-096`, `SA-POL-097` | Inspect autonomy-mode enum/order and tests; verify `Read-only` does not execute actions and execution floors choose the least autonomous applicable execution mode. |
| **SA-CONF-035** | Full | MUST | Framework posture presets define complete default mappings for every risk-by-reversibility cell. | `SA-POL-140`, `SA-POL-141`, `SA-POL-142`, `SA-POL-143`, `SA-POL-145`, `SA-POL-146`, `SA-POL-147` | Inspect preset mapping tables/config and tests; verify `creative-tool`, `business-app`, and `sensitive-domain` all have complete 4x3 grids outside declarations. |
| **SA-CONF-036** | Minimal+ | MUST | Effect-floor rationale records satisfy the deterministic `applied` contract. | `SA-POL-144`, `SA-POL-160`, `SA-POL-161`, `SA-POL-162`, `SA-POL-163`, `SA-POL-164`, `SA-POL-165`, `SA-POL-166`, `SA-POL-167`, `SA-POL-168`, `SA-POL-169`, `SA-POL-170`, `SA-POL-171`, `SA-POL-172`, `SA-POL-173`, `SA-POL-108` | Inspect effect-floor code and rationale output; verify `applied` is true precisely for a candidate floor at least as restrictive as the mode immediately before its evaluation, including equal floors, and false for no-floor or already-stricter cases. |
| **SA-CONF-037** | Minimal+ | MUST | `confirmation: always` imposes a gated floor and cannot be suppressed by sticky grants. | `SA-POL-071`, `SA-POL-072`, `SA-POL-132`, `SA-EXEC-100` | Test or inspect an action with `confirmation: "always"` under grants and permissive posture; verify resolved mode is at least `Gated suffix`. |
| **SA-CONF-038** | Minimal+ | MUST | Clean safe reversible actions are not gated or refused by framework defaults solely because an agent is involved. | `SA-CORE-053`, `SA-CORE-055`, `SA-POL-073`, `SA-POL-091`, `SA-POL-125`, `SA-POL-146`, `SA-EXEC-004`, `SA-EXEC-006`, `SA-EXEC-031`, `SA-EXEC-032`, `SA-EXEC-111`, `SA-EXEC-143`, `SA-EXEC-190`, `SA-EXEC-191` | Find actions with `risk: safe`, `undoable`/`snapshot`, no external/cost/sensitive effects, and `confirmation: never`; run policy/router tests and inspect defaults for hidden universal gates, plans, loops, or confidence demotions. |
| **SA-CONF-039** | Minimal+ | MUST | User autonomy settings can lower autonomy relative to developer defaults. | `SA-POL-110`, `SA-POL-111` | Inspect policy inputs and tests for user setting floors; verify lowering is supported and any raising behavior is explicit developer policy. |
| **SA-CONF-040** | Minimal+ | MUST | Scoped grants satisfy the policy-input safety contract. | `SA-POL-126`, `SA-POL-127`, `SA-POL-128`, `SA-POL-129`, `SA-POL-130`, `SA-POL-131`, `SA-POL-132`, `SA-POL-133`, `SA-POL-114` | Inspect grant model and policy tests; verify scope, expiration, issuer, subject, revocation where persistent, destructive prohibition, confirmation prohibition, and surface/precondition checks. |
| **SA-CONF-041** | Minimal+ | MUST | Runtime-signal demotion satisfies the explicit bounded-demotion contract. | `SA-POL-122`, `SA-POL-123`, `SA-POL-124`, `SA-POL-125`, `SA-POL-189` | Search for confidence/verifier/model-score handling; verify signals are policy inputs, recorded in rationale, demote at most one rung by framework default, and absence is not treated as low confidence. |
| **SA-CONF-042** | Minimal+ | MUST | Every `mutating` or `destructive` action has either a policy gate path or an executable undo/snapshot path. | `SA-CORE-052`, `SA-DECL-031`, `SA-POL-029`, `SA-POL-032`, `SA-POL-040`, `SA-POL-071`, `SA-EXEC-010`, `SA-LED-070` | Filter actions by `risk` in the registry; for each, verify policy can hold/gate/refuse it or the declaration/runtime produces a real undo/snapshot handle. |
| **SA-CONF-043** | Minimal+ | MUST | Chain policy output satisfies the auditable-boundary contract. | `SA-POL-107`, `SA-POL-108`, `SA-EXEC-047`, `SA-EXEC-089`, `SA-LED-052` | Run chain policy tests with safe prefix plus gated/refused suffix; inspect decision records for boundaries and per-action modes. |
| **SA-CONF-044** | Minimal+ | MUST | The context ladder satisfies the ordered-rung contract. | `SA-CTX-001`, `SA-CTX-002`, `SA-CTX-100`, `SA-CTX-101`, `SA-CTX-146` | Inspect context assembly code and prompts; verify facts/read tools are attempted before DOM/vision and lower rungs are not exposed preemptively. |
| **SA-CONF-045** | Minimal+ | MUST | Context from any rung never mutates state or grants action execution authority. | `SA-CTX-003`, `SA-CTX-004`, `SA-EXEC-044` | Trace context publisher/query/snapshot/vision paths; verify they feed observation only and action execution still requires registry and policy validation. |
| **SA-CONF-046** | Minimal+ | MUST | Live surface facts are considered before read tools or lower rungs. | `SA-CTX-021`, `SA-CTX-025`, `SA-CTX-026` | Inspect prompt/context assembly; verify current committed surface facts are included first and provisional facts are distinguishable when present. |
| **SA-CONF-047** | Minimal+ | MUST | Read tool invocation satisfies the pre-query validation contract. | `SA-CTX-042`, `SA-CTX-046`, `SA-DECL-066`, `SA-DECL-067` | Trace read-tool call path; run invalid ID/param/surface tests; verify failures do not simulate the query through action executors. |
| **SA-CONF-048** | Full | MUST | Rung 3 and Rung 4 satisfy the fallback-only contract. | `SA-CTX-005`, `SA-CTX-006`, `SA-CTX-060`, `SA-CTX-061`, `SA-CTX-067`, `SA-CTX-068`, `SA-CTX-080`, `SA-CTX-081`, `SA-CTX-083` | Disable DOM and vision context in policy/config; run declared action/read/fact fixtures; verify capability use still succeeds or fails only for legitimate missing declared context. |
| **SA-CONF-049** | Full | MUST | Lower-rung context exposure satisfies the bounded-exposure contract. | `SA-CTX-007`, `SA-CTX-008`, `SA-CTX-062`, `SA-CTX-063`, `SA-CTX-084`, `SA-CTX-085`, `SA-CTX-120`, `SA-CTX-122` | Inspect DOM/screenshot capture code if present; verify surface scoping, exclusion of scripts/styles/hidden state/secrets, viewport bounds, and redaction/withholding before prompts or bridge output. |
| **SA-CONF-050** | Minimal+ | MUST | Lower-rung context cannot bypass higher-authority steering sources. | `SA-CTX-009`, `SA-CTX-103`, `SA-CTX-104`, `SA-CTX-105`, `SA-CTX-106`, `SA-CTX-121`, `SA-CTX-125`, `SA-CTX-126` | Search for fallback code that synthesizes tools or overrides metadata from DOM/vision; run refusal/precondition failure scenarios and verify lower rungs do not route around them. |
| **SA-CONF-051** | Minimal+ | MUST | Sensitive context exposure remains consistent with action `effects.sensitive` classification. | `SA-CTX-123`, `SA-CTX-124`, `SA-POL-067`, `SA-POL-068`, `SA-LED-130`, `SA-LED-131`, `SA-LED-132` | Inspect context permissions and actions that read/write sensitive data; verify context policy does not add metadata values and sensitive action ledgers can redact values without losing structural facts. |
| **SA-CONF-052** | Minimal+ | SHOULD | Rung 3 annotations satisfy the semantic-identifier guidance. | `SA-CTX-064`, `SA-CTX-065`, `SA-CTX-066` | If annotated DOM is implemented, inspect annotation generation and sample DOM; flag implementation paths, database IDs, personal data, array indexes as sole identity, or unstable generated values. |
| **SA-CONF-053** | Minimal+ | MUST | The intent router classifies each user intent into exactly one framework route class. | `SA-EXEC-020`, `SA-EXEC-024`, `SA-EXEC-025`, `SA-EXEC-026`, `SA-EXEC-028`, `SA-EXEC-029`, `SA-EXEC-030` | Inspect router output type and tests; verify only `answer`, `single action`, `action chain`, `workflow needing the loop`, `clarification`, or `refusal/handoff` is emitted for each intent. |
| **SA-CONF-054** | Minimal+ | MUST | Router outputs satisfy the route-record contract. | `SA-EXEC-021`, `SA-EXEC-022`, `SA-EXEC-023` | Run documented utterance fixtures and negative cases; inspect outputs for source surface, action/read IDs, structured params, missing fields, and specific escalation reasons. |
| **SA-CONF-055** | Minimal+ | MUST | The router does not escalate eligible single actions or known short chains solely because the request arrived in natural language. | `SA-EXEC-027`, `SA-EXEC-031`, `SA-EXEC-032`, `SA-EXEC-033`, `SA-EXEC-034`, `SA-EXEC-035` | Test natural-language single-action and short-chain examples whose params are known; verify route class remains direct/chain unless policy, missing state, or observation uncertainty requires escalation. |
| **SA-CONF-056** | Full | MUST | The execution engine satisfies the execution-path support contract. | `SA-EXEC-003`, `SA-EXEC-040`, `SA-EXEC-041`, `SA-EXEC-042`, `SA-EXEC-043`, `SA-EXEC-241` | Inspect execution engine APIs and tests; verify each path can be selected by router/policy output without requiring one path app-wide. |
| **SA-CONF-057** | Minimal+ | MUST | Execution path selection satisfies the policy-authority contract. | `SA-EXEC-005`, `SA-EXEC-040`, `SA-EXEC-041`, `SA-EXEC-042`, `SA-EXEC-043`, `SA-EXEC-044`, `SA-EXEC-045`, `SA-EXEC-046`, `SA-EXEC-047` | Run policy/path tests for read-only, instant, gated suffix, plan preview, step-gated, and refusal outcomes; verify actions do not execute under read-only/refusal. |
| **SA-CONF-058** | Minimal+ | MUST | Direct dispatch satisfies the no-extra-ceremony execution contract. | `SA-EXEC-060`, `SA-EXEC-061`, `SA-EXEC-062`, `SA-EXEC-063`, `SA-DECL-032` | Trace single-action execution; run success and invalid-param tests; verify no plan artifact or second model call appears between policy resolution and executor invocation. |
| **SA-CONF-059** | Minimal+ | MUST | Direct dispatch satisfies the visible-outcome contract. | `SA-EXEC-064`, `SA-EXEC-065`, `SA-EXEC-066`, `SA-EXEC-067`, `SA-EXEC-068` | Run direct-dispatch success/failure tests or inspect UI states; verify failures are visible and do not leave successful activity state. |
| **SA-CONF-060** | Minimal+ | MUST | Chain execution satisfies the ordered-step contract. | `SA-EXEC-080`, `SA-EXEC-081`, `SA-EXEC-082`, `SA-LED-030` | Inspect chain record/UI status vocabulary; run a multi-step chain and verify pending/running/succeeded/held/skipped/failed/undone distinctions. |
| **SA-CONF-061** | Minimal+ | MUST | Optimistic prefix undo satisfies the reversible-scope contract. | `SA-POL-086`, `SA-POL-087`, `SA-EXEC-083`, `SA-EXEC-084`, `SA-EXEC-085`, `SA-EXEC-086`, `SA-EXEC-087`, `SA-EXEC-088`, `SA-EXEC-089` | Run a chain containing reversible and irreversible steps; invoke undo-all during and after execution; verify irreversible steps are excluded or disclosed, and rollback order is correct. |
| **SA-CONF-062** | Minimal+ | MUST | Gated suffix execution satisfies the held-boundary contract. | `SA-POL-088`, `SA-POL-089`, `SA-EXEC-090`, `SA-EXEC-091`, `SA-EXEC-092`, `SA-EXEC-093`, `SA-EXEC-094`, `SA-EXEC-095`, `SA-EXEC-096`, `SA-EXEC-097`, `SA-EXEC-098`, `SA-EXEC-099`, `SA-EXEC-100` | Run a safe-prefix plus quota/destructive suffix chain; approve and decline; verify prefix state, undo availability, held boundary, gate content, and retry revalidation. |
| **SA-CONF-063** | Full | MUST | Tool-loop execution satisfies the bounded repair-loop contract. | `SA-EXEC-110`, `SA-EXEC-111`, `SA-EXEC-113`, `SA-EXEC-114`, `SA-EXEC-115`, `SA-EXEC-116`, `SA-EXEC-117`, `SA-EXEC-118`, `SA-EXEC-119`, `SA-EXEC-120` | Inspect loop implementation and tests; force observation failure, repair proposal, out-of-scope repair, and step-limit/time-budget exhaustion. |
| **SA-CONF-064** | Full | MUST | Plan preview satisfies the one-Apply review contract. | `SA-EXEC-130`, `SA-EXEC-131`, `SA-EXEC-132`, `SA-EXEC-133`, `SA-EXEC-134`, `SA-EXEC-135`, `SA-EXEC-136`, `SA-EXEC-139`, `SA-EXEC-140`, `SA-EXEC-141`, `SA-EXEC-142`, `SA-EXEC-144` | Trigger a `Plan preview` policy outcome; inspect plan fields, one Apply behavior, no duplicate confirmation for listed gated steps, step-gated preservation, and amendment behavior for changed scope. |
| **SA-CONF-065** | Minimal+ | MUST | Step-gated execution satisfies the per-step gate contract. | `SA-POL-092`, `SA-POL-093`, `SA-EXEC-045`, `SA-EXEC-190`, `SA-EXEC-191`, `SA-EXEC-192`, `SA-EXEC-193`, `SA-EXEC-194` | Run a chain with one step resolved `Step-gated`; verify neighboring autonomous steps are not gated and one approval authorizes only that step. |
| **SA-CONF-066** | Minimal+ | MUST | Cross-surface execution satisfies the declared-surface continuation contract. | `SA-EXEC-160`, `SA-EXEC-161`, `SA-EXEC-162`, `SA-EXEC-163`, `SA-EXEC-164`, `SA-EXEC-165`, `SA-EXEC-166`, `SA-EXEC-167`, `SA-EXEC-168`, `SA-EXEC-169`, `SA-EXEC-170`, `SA-EXEC-171`, `SA-EXEC-172`, `SA-EXEC-173`, `SA-EXEC-174`, `SA-EXEC-175`, `SA-EXEC-176`, `SA-EXEC-177`, `SA-EXEC-178`, `SA-EXEC-179` | Run cross-surface success and timeout fixtures; verify default timeout is 5000 ms unless overridden, required capabilities are live before execution, failures preserve prefix undo, and retry does not silently continue. |
| **SA-CONF-067** | Minimal+ | MUST | Steering activity satisfies the visible-surface contract. | `SA-EXEC-007`, `SA-EXEC-008`, `SA-EXEC-012`, `SA-EXEC-200`, `SA-EXEC-201`, `SA-EXEC-202`, `SA-EXEC-203`, `SA-EXEC-204`, `SA-EXEC-205`, `SA-LED-037` | Inspect UI components or CLI/log surface; run direct, chain, held, declined, failed, undone, and cross-surface cases; verify visible statuses and undo controls appear without blocking safe direct dispatch. |
| **SA-CONF-068** | Minimal+ | MUST | Execution stops rather than silently continuing when registry entries, executors, surfaces, policy decisions, or required params are unavailable. | `SA-EXEC-011`, `SA-EXEC-012`, `SA-BRIDGE-047` | Force missing action, missing executor, unsatisfied precondition, unavailable surface, and invalid params; verify execution stops and reports completed/held/skipped/failed/undo scope. |
| **SA-CONF-069** | Minimal+ | MUST | The ledger records meaningful steering activity with append-only historical ordering in the current conformance scope. | `SA-CORE-032`, `SA-LED-001`, `SA-LED-002`, `SA-LED-003`, `SA-LED-004`, `SA-LED-005`, `SA-LED-006`, `SA-EXEC-009` | Inspect ledger layer and run steering actions; verify intents, policy decisions, approvals/refusals, execution attempts/results, repairs, and undo attempts are ordered and historical facts are not rewritten. |
| **SA-CONF-070** | Minimal+ | MUST | Minimal invocation records satisfy the minimum record contract. | `SA-LED-020`, `SA-LED-021`, `SA-LED-022`, `SA-LED-023`, `SA-LED-024`, `SA-LED-025`, `SA-LED-026`, `SA-LED-027`, `SA-LED-035`, `SA-LED-036`, `SA-LED-037`, `SA-LED-038`, `SA-LED-039` | Dump ledger records after action, read-only/refusal, gated, and undo cases; verify required fields exist and raw prompts/model traces/full snapshots are not required for minimal conformance. |
| **SA-CONF-071** | Minimal+ | MUST | Action-step records satisfy the minimum step contract. | `SA-LED-028`, `SA-LED-029`, `SA-LED-030`, `SA-LED-031`, `SA-LED-032`, `SA-LED-033`, `SA-LED-034` | Inspect per-step ledger shape; run success, failure, skipped, and repair cases; verify stable action IDs and state keys are used. |
| **SA-CONF-072** | Minimal+ | MUST | Ledger policy records preserve policy/result separation. | `SA-LED-050`, `SA-LED-051`, `SA-LED-052`, `SA-LED-053`, `SA-LED-054`, `SA-LED-055` | Trigger approval decline, executor failure, and undo failure after policy resolution; verify policy records remain unchanged and recordability failure blocks execution when policy requires recording. |
| **SA-CONF-073** | Minimal+ | MUST | Successful `undoable` or `snapshot` executions produce an executable undo handle or a recorded failure explaining absence. | `SA-CORE-033`, `SA-EXEC-010`, `SA-LED-070`, `SA-LED-072`, `SA-LED-073`, `SA-LED-075` | Run each reversible action; inspect ledger step undo state for handle ID, action ID, reversibility kind, status, scope, state/param/snapshot payload, and expiration/invalidation conditions. |
| **SA-CONF-074** | Minimal+ | MUST | Undo handle execution satisfies the trusted-code contract. | `SA-LED-071`, `SA-POL-048`, `SA-EXEC-116` | Inspect undo handler and snapshot restore code; verify undo invocation does not call model generation or natural-language repair instructions. |
| **SA-CONF-075** | Minimal+ | MUST | Snapshot undo satisfies the pre-mutation capture contract. | `SA-DECL-050`, `SA-LED-080`, `SA-LED-081`, `SA-LED-082`, `SA-LED-083`, `SA-LED-084`, `SA-LED-085` | Trace snapshot action execution; verify snapshot capture happens before writes, restore uses trusted code, and capture failure records unavailable undo rather than available snapshot. |
| **SA-CONF-076** | Minimal+ | MUST | Irreversible and server-recovery records satisfy the recovery-honesty contract. | `SA-LED-074`, `SA-LED-086`, `SA-LED-087`, `SA-LED-088`, `SA-LED-090`, `SA-LED-091`, `SA-LED-092`, `SA-LED-093`, `SA-LED-094`, `SA-LED-095`, `SA-LED-096`, `SA-LED-097`, `SA-LED-099`, `SA-LED-100` | Inspect undo mechanism descriptors for irreversible/server actions; verify compensation is not called full undo unless it restores relevant product/domain state. |
| **SA-CONF-077** | Minimal+ | MUST | Undo-all satisfies the full-or-disclosed-partial contract. | `SA-LED-110`, `SA-LED-111`, `SA-LED-112`, `SA-LED-113`, `SA-LED-114`, `SA-LED-115`, `SA-LED-116`, `SA-LED-117`, `SA-LED-118`, `SA-LED-119`, `SA-LED-120`, `SA-EXEC-085`, `SA-EXEC-086` | Run a chain with reversible, irreversible, held, skipped, and running steps; invoke undo-all and verify reverse order, refused/partial disclosure, per-handle results, and reconciliation after running steps settle. |
| **SA-CONF-078** | Minimal+ | MUST | Redaction satisfies the structural-facts preservation contract. | `SA-LED-130`, `SA-LED-131`, `SA-LED-132`, `SA-LED-133`, `SA-LED-064` | Mark or find a sensitive action; extract a redacted eval/audit trace and verify action IDs, statuses, modes, reason codes, undo availability, and undo inputs needed by trusted code remain usable. |
| **SA-CONF-079** | Minimal+ | MUST | Ledger storage satisfies the scoped-backend contract. | `SA-LED-008`, `SA-LED-140`, `SA-LED-141`, `SA-LED-143`, `SA-LED-144`, `SA-LED-145`, `SA-LED-146` | Inspect storage policy/config; verify scope, retention, redaction, durability expectation, backend independence, pre-execution write failure reporting, and expiration/supersession handling. |
| **SA-CONF-080** | Full | SHOULD | Later ledger writes satisfy the degraded-write handling recommendation. | `SA-LED-142` | Inspect storage error handling tests; flag dropped post-execution ledger updates without retry, degraded marker, or user-visible limitation. |
| **SA-CONF-081** | Minimal+ | MUST | Eval fixtures satisfy the registry-derived trace contract. | `SA-DECL-107`, `SA-LED-038`, `SA-LED-064`, `SA-EXEC-023`, north-star §8 | Locate eval fixtures/tests; run them; verify they assert action IDs, params or redacted params, policy result, execution status, errors, repairs, and undo outcome rather than only assistant text. |
| **SA-CONF-082** | Door two | MUST | Stage-1 conformance satisfies the no-required-bridge-infrastructure boundary. | `SA-BRIDGE-001`, `SA-BRIDGE-002`, `SA-BRIDGE-003`, `SA-BRIDGE-004` | Inspect product docs/config for door-two exposure or claims; if absent, mark door-two generation/invocation items not applicable rather than failing missing MCP infrastructure. |
| **SA-CONF-083** | Door two | MUST | Door-two tool generation satisfies the one-registry contract. | `SA-CORE-035`, `SA-CORE-056`, `SA-BRIDGE-010`, `SA-BRIDGE-011`, `SA-BRIDGE-012`, `SA-BRIDGE-013`, `SA-BRIDGE-014`, `SA-BRIDGE-016` | Inspect bridge generator and emitted tools; verify stable declaration IDs are preserved or reversibly mapped and generated definitions do not change registry facts. |
| **SA-CONF-084** | Door two | MUST | Door-two generation satisfies the external-exposure eligibility contract. | `SA-DECL-132`, `SA-DECL-133`, `SA-DECL-134`, `SA-BRIDGE-015`, `SA-BRIDGE-020`, `SA-BRIDGE-021`, `SA-BRIDGE-022`, `SA-BRIDGE-023`, `SA-BRIDGE-024`, `SA-BRIDGE-025` | Compare registry `externalExposure` values to emitted external tools; verify `none` blocks generation, `eligible` is not treated as authorization, and facts are absent from external tools. |
| **SA-CONF-085** | Door two | MUST | Door two satisfies the registry-metadata consumption contract. | `SA-BRIDGE-030`, `SA-BRIDGE-031`, `SA-BRIDGE-032`, `SA-BRIDGE-033`, `SA-BRIDGE-034`, `SA-BRIDGE-035`, `SA-BRIDGE-036` | Inspect generator inputs and bridge runtime; verify it consumes listed action/read/surface fields and precondition state from the registry, with `location` only as a hint. |
| **SA-CONF-086** | Door two | MUST | External invocation satisfies the same-policy fail-closed contract. | `SA-BRIDGE-040`, `SA-BRIDGE-041`, `SA-BRIDGE-042`, `SA-BRIDGE-043`, `SA-BRIDGE-044`, `SA-BRIDGE-045`, `SA-BRIDGE-046`, `SA-BRIDGE-047`, `SA-BRIDGE-048` | Trace external invocation handling; compare door-one/door-two policy decisions for equivalent inputs; force missing registry, ineligible, not-live, refused, and execution-error cases. |
| **SA-CONF-087** | Minimal+ | MUST | The implementation avoids universal steering ceremony. | `SA-CORE-053`, `SA-CORE-100`, `SA-DECL-005`, `SA-DECL-006`, `SA-EXEC-004`, `SA-EXEC-207` | Search declarations/prompts/config for fixed workflow flags; run safe direct-dispatch and gated high-risk cases; verify workflow varies by registry/policy rather than app-wide ceremony. |
| **SA-CONF-088** | Minimal+ | MUST | The conformance boundary remains language/API agnostic. | `SA-CORE-009`, `SA-DECL-003`, `SA-DECL-004` | Inspect docs and public claims; verify conceptual fields/semantics are required, while concrete helpers such as `defineAction` are presented as implementation choices. |
| **SA-CONF-089** | Minimal+ | MUST | The conformance boundary preserves framework/developer separation. | `SA-CORE-058`, `SA-CORE-090`, `SA-DECL-120`, `SA-POL-180`, `SA-CTX-140`, `SA-EXEC-240`, `SA-LED-160`, `SA-BRIDGE-070` | Inspect framework APIs, docs, policy config, and example code; verify the framework owns declaration categories, validation, policy semantics, execution/ledger contracts, and bridge invariants while developers own product capabilities, classifications, posture choices, UX, storage depth, and exposure decisions. |

## 5. MUST Coverage Audit (Informative)

The audit below covers every MUST-bearing requirement ID in the current spec suite. Counted source requirements: 515. Unverifiable-by-inspection entries: 0. Issue #41's four prior checklist ambiguities are resolved by the cited requirements.

| Spec | MUST-bearing IDs | Checklist coverage | Unverifiable-by-inspection |
|---|---|---|---|
| `SA-CORE` | `SA-CORE-001-008`, `SA-CORE-010`, `SA-CORE-050-058`, `SA-CORE-070-071`, `SA-CORE-080-084`, `SA-CORE-090` | `SA-CONF-001-008`, `SA-CONF-025-026`, `SA-CONF-031`, `SA-CONF-038`, `SA-CONF-087-089`, closing table | None. Spec-authoring conventions are covered by this document's headings, ID scheme, and closing table. |
| `SA-DECL` | `SA-DECL-001-002`, `SA-DECL-004-006`, `SA-DECL-010-022`, `SA-DECL-030-033`, `SA-DECL-035-050`, `SA-DECL-052-054`, `SA-DECL-060-077`, `SA-DECL-080-081`, `SA-DECL-083-087`, `SA-DECL-090-092`, `SA-DECL-094-096`, `SA-DECL-100-109`, `SA-DECL-120`, `SA-DECL-130-136` | `SA-CONF-006-026`, `SA-CONF-029`, `SA-CONF-047`, `SA-CONF-075`, `SA-CONF-081`, `SA-CONF-084-085`, `SA-CONF-087-089` | None. Issue #41 resolves `SA-DECL-013`, `SA-DECL-022`, and multi-surface availability in `SA-DECL-045` and `SA-DECL-085`. |
| `SA-POL` | `SA-POL-001-011`, `SA-POL-020-024`, `SA-POL-026-034`, `SA-POL-040-048`, `SA-POL-060`, `SA-POL-063-073`, `SA-POL-080-097`, `SA-POL-100-110`, `SA-POL-113-114`, `SA-POL-120`, `SA-POL-122-133`, `SA-POL-140-147`, `SA-POL-160-170`, `SA-POL-173`, `SA-POL-180` | `SA-CONF-027-043`, `SA-CONF-051`, `SA-CONF-057`, `SA-CONF-061-065`, `SA-CONF-072`, `SA-CONF-074`, `SA-CONF-087-089` | None. Issue #41 resolves effect-floor `applied` rationale semantics in `SA-POL-173`. |
| `SA-CTX` | `SA-CTX-001-009`, `SA-CTX-020-027`, `SA-CTX-030-031`, `SA-CTX-040`, `SA-CTX-042-044`, `SA-CTX-046`, `SA-CTX-060-063`, `SA-CTX-067-068`, `SA-CTX-080-081`, `SA-CTX-083-086`, `SA-CTX-101`, `SA-CTX-103-106`, `SA-CTX-120-126`, `SA-CTX-140` | `SA-CONF-017-019`, `SA-CONF-044-052`, `SA-CONF-087-089` | None. |
| `SA-EXEC` | `SA-EXEC-001-012`, `SA-EXEC-020-033`, `SA-EXEC-035`, `SA-EXEC-040-047`, `SA-EXEC-060-068`, `SA-EXEC-080-082`, `SA-EXEC-084-098`, `SA-EXEC-100`, `SA-EXEC-110-111`, `SA-EXEC-113-120`, `SA-EXEC-130-136`, `SA-EXEC-139-144`, `SA-EXEC-160-179`, `SA-EXEC-190-194`, `SA-EXEC-200-205`, `SA-EXEC-240` | `SA-CONF-015`, `SA-CONF-031`, `SA-CONF-038`, `SA-CONF-053-068`, `SA-CONF-087-089` | None. Full-path requirements for tool loop and full plan preview are Full-level checks, not minimal-level requirements. |
| `SA-LED` | `SA-LED-001-004`, `SA-LED-006`, `SA-LED-008-010`, `SA-LED-020-039`, `SA-LED-050-055`, `SA-LED-061-064`, `SA-LED-070-077`, `SA-LED-080-088`, `SA-LED-090-097`, `SA-LED-099-100`, `SA-LED-110-120`, `SA-LED-130-133`, `SA-LED-140-141`, `SA-LED-143-146`, `SA-LED-160` | `SA-CONF-009`, `SA-CONF-033`, `SA-CONF-051`, `SA-CONF-067`, `SA-CONF-069-081`, `SA-CONF-087-089` | None. |
| `SA-BRIDGE` | `SA-BRIDGE-001-004`, `SA-BRIDGE-010-016`, `SA-BRIDGE-020-025`, `SA-BRIDGE-030-036`, `SA-BRIDGE-040-048`, `SA-BRIDGE-070` | `SA-CONF-024`, `SA-CONF-026`, `SA-CONF-068`, `SA-CONF-082-089` | None. Door two remains conditional unless exposed or claimed. |

## 6. Issue #41 Resolution Map (Informative)

The four findings previously marked pending are resolved, so `SA-CONF-010`, `SA-CONF-021`, `SA-CONF-022`, and `SA-CONF-036` now have decisive pass/fail procedures.

| Finding | Normative edit | Checklist resolution |
|---|---|---|
| Established-product-command exception was not machine-checkable | `SA-DECL-013`, `SA-DECL-054` define a closed `idException` object. | `SA-CONF-010` checks `verb_noun` or exactly that object. |
| Capability-ID grammar conflicted with `surface:<key>` predicates | `SA-DECL-012`, `SA-DECL-022` separate dotted capability IDs, simple surface IDs, and predicate tokens. | `SA-CONF-021` validates the surface key against declared surfaces. |
| Multi-surface availability lacked an OR grammar | `SA-DECL-045`, `SA-DECL-085` define surface capability lists as the disjunctive scope and preconditions as conjunctive. | `SA-CONF-022` checks that declared pattern. |
| Effect-floor `applied` had no truth table | `SA-POL-173` defines participation against the incoming mode. | `SA-CONF-036` checks candidate, equal, no-floor, and already-stricter cases. |

PR description mapping: this issue resolves all four findings above and **Closes #41** alongside issue #59.

## 7. Anti-Pattern Coverage (Informative)

| Anti-pattern note | Detection checks caught by |
|---|---|
| `chatbot-veneer.md` | `SA-CONF-006-008`, `SA-CONF-014-016`, `SA-CONF-031`, `SA-CONF-053-055`, `SA-CONF-067`, `SA-CONF-081` |
| `dom-automation-first.md` | `SA-CONF-015`, `SA-CONF-017-020`, `SA-CONF-044-052`, `SA-CONF-066`, `SA-CONF-068` |
| `duplicate-tool-layers.md` | `SA-CONF-007-009`, `SA-CONF-023-026`, `SA-CONF-081`, `SA-CONF-083-086` |
| `framework-maximalism.md` | `SA-CONF-001-005`, `SA-CONF-025`, `SA-CONF-082`, `SA-CONF-087-089`, closing table |
| `plan-everything.md` | `SA-CONF-030`, `SA-CONF-031`, `SA-CONF-034`, `SA-CONF-036-038`, `SA-CONF-041`, `SA-CONF-055`, `SA-CONF-057-058`, `SA-CONF-063-065`, `SA-CONF-087` |
| `unsafe-magic.md` | `SA-CONF-012-016`, `SA-CONF-027-033`, `SA-CONF-040-043`, `SA-CONF-057-068`, `SA-CONF-069-081` |

## 8. Design Studio Validation (Informative)

Validation target: `examples/design-studio`.

Commands executed for this validation:

```bash
npx vitest run
npm run build
```

Command results: `npx vitest run` passed 3 test files and 21 tests; `npm run build` passed `tsc -b` and `vite build`.

Result summary: 81 pass, 0 flagged, 8 documented exceptions, 0 pending spec clarification. No example fixes were made: the existing declaration and proto-runtime patterns conform to the clarified rules.

Documented exceptions:

1. `SA-CONF-001`: the example README describes a Stage-1 example but does not publish a formal conformance claim string.
2. `SA-CONF-003`: the example does not claim `full` conformance.
3. `SA-CONF-056` and `SA-CONF-063`: the inline proto-runtime does not implement a model/tool-loop path; the example documents that it has no model calls and is not a supported runtime.
4. `SA-CONF-083` through `SA-CONF-086`: the example does not expose door two; it only validates the `externalExposure: none` registry default.

| Item | Result | Evidence |
|---|---|---|
| `SA-CONF-001` | Not applicable | No formal conformance claim string appears in `examples/design-studio/README.md`. |
| `SA-CONF-002` | Pass | Minimal-scope items below were audited against the example. |
| `SA-CONF-003` | Not applicable | The example does not claim `full`. |
| `SA-CONF-004` | Pass | README describes an example/proto-runtime, not a higher conformance claim. |
| `SA-CONF-005` | Pass | This appendix records item-level results. |
| `SA-CONF-006` | Pass | `registry.ts` defines action, read tool, facts, and surface shapes. |
| `SA-CONF-007` | Pass | `designStudioCapabilities.ts` is the declaration source for steering actions. |
| `SA-CONF-008` | Pass | `createDesignStudioRegistry` compiles actions, read tools, facts, and surfaces. |
| `SA-CONF-009` | Pass | Capability IDs are unique dot-segment strings; tests assert registry counts and references. |
| `SA-CONF-010` | Pass | All action IDs are `verb_noun`; no `idException` metadata is needed. |
| `SA-CONF-011` | Pass | Trail titles/descriptions derive from declarations in `trail.ts` and router tests. |
| `SA-CONF-012` | Pass | Strict schemas reject extra params; `palette.set_color` test covers this. |
| `SA-CONF-013` | Pass | Distinct inputs such as token/hex, section/field/value, and posture are structured. |
| `SA-CONF-014` | Pass | Design Studio declares 15 actions with required fields and tests registry coverage. |
| `SA-CONF-015` | Pass | Steering execution calls declared host setters through `ExecutionEngine`; no model authority exists. |
| `SA-CONF-016` | Pass | Three read tools use `query`, no action risk/undo fields, and bounded summaries. |
| `SA-CONF-017` | Pass | Three facts declarations are surface-scoped and live through route registration. |
| `SA-CONF-018` | Pass | Facts tests assert published keys exactly match finite declaration keys. |
| `SA-CONF-019` | Pass | Facts/read tools return summaries, IDs, counts, palette/type objects, and quota state. |
| `SA-CONF-020` | Pass | Surfaces declare capability IDs and route code registers/deregisters current surface. |
| `SA-CONF-021` | Pass | `surface:<id>` preconditions resolve against simple declared `editor`, `templates`, and `settings` surface IDs, while capability IDs remain dotted. |
| `SA-CONF-022` | Pass | Multi-surface `project.export_project` is listed by the `editor` and `settings` surfaces with no OR-style precondition. |
| `SA-CONF-023` | Pass | `CapabilityRegistry` validates duplicate IDs, field shapes, value sets, and surface references. |
| `SA-CONF-024` | Pass | Registry materializes `externalExposure: "none"`; tests assert all actions/read tools. |
| `SA-CONF-025` | Pass | Policy, trail copy, router fixtures, and README matrices consume registry declaration IDs. |
| `SA-CONF-026` | Pass | No external/prompt/eval duplicate tool layer remains callable outside registry in the example. |
| `SA-CONF-027` | Pass | Registry and policy types restrict shared value sets. |
| `SA-CONF-028` | Pass | README setter inventory and declarations exercise safe, side_effect, mutating, destructive. |
| `SA-CONF-029` | Pass | Undoable actions have inverse handlers; snapshot actions use snapshot adapter; irreversible actions disclose no undo. |
| `SA-CONF-030` | Pass | Clipboard, export quota, reset, and local UI actions have matching effects/confirmation metadata. |
| `SA-CONF-031` | Pass | `ExecutionEngine` resolves chain/action policy before executor invocation. |
| `SA-CONF-032` | Pass | `policy.ts` resolver is pure over explicit inputs. |
| `SA-CONF-033` | Pass | Runtime tests assert `SA-POL-108` rationale fields and redacted eval traces. |
| `SA-CONF-034` | Pass | `policy.ts` defines seven modes and ordering; tests cover read/gate outcomes. |
| `SA-CONF-035` | Pass | `policy.ts` contains complete grids for all three presets. |
| `SA-CONF-036` | Pass | `policy.ts` records a candidate equal-or-stricter incoming effect floor as `applied`, and no-floor or already-stricter cases as false. |
| `SA-CONF-037` | Pass | `project.reset_project` uses `confirmation: "always"` and resolves to a gate. |
| `SA-CONF-038` | Pass | Router tests assert safe reversible routes are not gated under `creative-tool`. |
| `SA-CONF-039` | Pass | Policy supports `userMinimumMode` lowering. |
| `SA-CONF-040` | Pass | Policy grant handling rejects destructive and `confirmation: always` suppression. |
| `SA-CONF-041` | Pass | Runtime demotions are explicit inputs and one-rung demotions in `policy.ts`. |
| `SA-CONF-042` | Pass | Tests assert mutating/destructive actions have gate or undo path. |
| `SA-CONF-043` | Pass | Gated suffix and plan-preview tests assert held boundaries and per-action modes. |
| `SA-CONF-044` | Pass | Example uses facts/read tools and no DOM/vision foundation. |
| `SA-CONF-045` | Pass | Context publishers/read tools do not mutate; actions still go through policy/execution. |
| `SA-CONF-046` | Pass | Surface facts are declared and README lists them as primary context. |
| `SA-CONF-047` | Pass | Read tools are registry entries with strict params and preconditions. |
| `SA-CONF-048` | Pass | Declared capability use succeeds with no DOM or vision implementation. |
| `SA-CONF-049` | Pass | No lower-rung DOM/vision exposure exists, so no unredacted lower-rung path is present. |
| `SA-CONF-050` | Pass | Router/execution do not use DOM/vision to bypass declarations or refusals. |
| `SA-CONF-051` | Pass | Runtime test covers sensitive-action rationale and redacted trace behavior. |
| `SA-CONF-052` | Pass | No Rung 3 implementation exists; disabling it does not affect declared behavior. |
| `SA-CONF-053` | Pass | `ScriptedIntentRouter` emits exactly the framework route classes. |
| `SA-CONF-054` | Pass | Router tests cover action IDs, params, read needs, clarification, and refusal reasons. |
| `SA-CONF-055` | Pass | Router tests keep eligible natural-language single actions/chains out of workflow-loop escalation. |
| `SA-CONF-056` | Not applicable | Full-only: no tool-loop path; README documents no model calls/proto-runtime scope. |
| `SA-CONF-057` | Pass | Runtime tests cover instant, gated suffix, plan preview, read/refusal, and least-autonomous outcomes. |
| `SA-CONF-058` | Pass | `executeAction` uses one-step chain validation and execution with no plan/model round trip. |
| `SA-CONF-059` | Pass | Runtime tests cover success, executor failure status, and undo handle visibility. |
| `SA-CONF-060` | Pass | Chain tests assert ordered step statuses for success, held, skipped, failed, undone. |
| `SA-CONF-061` | Pass | Undo-all tests disclose partial undo for irreversible step and reverse reversible steps. |
| `SA-CONF-062` | Pass | Gated suffix tests approve/decline export and preserve prefix undo. |
| `SA-CONF-063` | Not applicable | Full-only: no workflow-needing-loop implementation in this example. |
| `SA-CONF-064` | Pass | Business posture tests exercise plan preview one Apply before any step executes. |
| `SA-CONF-065` | Pass | Policy/execution supports step-gated mode; no documented Design Studio route needs it. |
| `SA-CONF-066` | Pass | Cross-surface tests cover declared navigation, registration wait, timeout failure, and prefix undo. |
| `SA-CONF-067` | Pass | `SteeringPanel` renders activity trail, approval/plan cards, disclosures, undo, and undo all. |
| `SA-CONF-068` | Pass | Runtime tests force surface timeout and unavailable boundaries with legible failure. |
| `SA-CONF-069` | Pass | `InMemoryLedger` records intents, policy decisions, approvals, results, disclosures, and undo attempts. |
| `SA-CONF-070` | Pass | `expectMinimalLedgerRecord` tests record IDs, versions, order, surface, intent, initiator, approval, and policy. |
| `SA-CONF-071` | Pass | Step records include step ID, order, action ID, params, status, writes, undo, result/error. |
| `SA-CONF-072` | Pass | Policy records are appended separately from execution and approval updates. |
| `SA-CONF-073` | Pass | Runtime tests assert available undo handles for undoable/snapshot actions. |
| `SA-CONF-074` | Pass | Undo handlers call declared inverses or snapshot restore code, not model repair. |
| `SA-CONF-075` | Pass | `executeStep` captures snapshots before executor mutation when needed. |
| `SA-CONF-076` | Pass | Irreversible `share.copy_link` and `project.export_project` get honest no-undo records. |
| `SA-CONF-077` | Pass | Undo-all tests verify reverse order and partial-disclosure behavior. |
| `SA-CONF-078` | Pass | Redacted eval trace test keeps policy/action structure while redacting sensitive params. |
| `SA-CONF-079` | Pass | In-memory session ledger matches README scope and avoids stale handle status in undo code. |
| `SA-CONF-080` | Pass | No durable storage is claimed; no dropped durable post-execution writes exist. |
| `SA-CONF-081` | Pass | `npx vitest run` covers documented router/action/runtime fixtures and eval trace extraction. |
| `SA-CONF-082` | Pass | README says no backend/external bridge; Stage-1 does not require MCP. |
| `SA-CONF-083` | Not applicable | No door-two tools are exposed. |
| `SA-CONF-084` | Not applicable | No door-two generation; registry default `externalExposure: none` is tested. |
| `SA-CONF-085` | Not applicable | No door-two bridge consumes metadata. |
| `SA-CONF-086` | Not applicable | No external invocation path exists. |
| `SA-CONF-087` | Pass | Safe routes run instantly, export/reset gate by policy, and plan preview appears only under policy. |
| `SA-CONF-088` | Pass | README marks inline runtime as disposable and spec docs canonical. |
| `SA-CONF-089` | Pass | Example keeps product setters/declarations separate from framework-like registry/policy/execution/ledger contracts. |

## 9. Framework Decides vs. Developer Decides (Normative)

- **SA-CONF-090:** This conformance checklist MUST preserve the framework/developer boundary in Table 1.

| Requirement | The framework decides | The developer decides |
|---|---|---|
| **SA-CONF-091** | The conformance result vocabulary, level tokens, and item result semantics. | Which conformance level the product claims, if any. |
| **SA-CONF-092** | The checklist items that make registry, policy, execution, context, ledger, undo, and bridge behavior auditable. | The product capabilities, surfaces, actions, read tools, facts, policy posture, storage depth, and access paths being audited. |
| **SA-CONF-093** | That Minimal+ MUST failures block a minimal or full claim. | Whether to ship above the minimal floor for product, domain, or release reasons. |
| **SA-CONF-094** | That Full MUST failures block a full claim. | Whether maturity features such as tool-loop support, lower-rung context, durable audit, or door two are in scope for this release. |
| **SA-CONF-095** | That door-two checks are conditional on exposing or claiming door two. | Whether door two is exposed at all, and which eligible capabilities are published. |
| **SA-CONF-096** | That SHOULD failures are reported as flags rather than silent passes. | Which flagged recommendations to fix before release. |
| **SA-CONF-097** | That unresolved spec clarifications cannot be locally resolved by folklore. | Whether to wait for clarification, avoid the ambiguous shape, or document an exception until the spec changes. |
| **SA-CONF-098** | That conformance evidence must be item-level and reproducible by a coding agent. | Which code paths, tests, runtime probes, screenshots, or audit artifacts provide the evidence. |
