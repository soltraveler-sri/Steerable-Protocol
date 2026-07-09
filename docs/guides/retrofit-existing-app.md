# Retrofit An Existing App

**Status:** Informative guide. Normative requirements live in `docs/spec/` and the executable self-check lives in [conformance-checklist.md](../spec/conformance-checklist.md). This guide tells a coding agent how to discover a retrofit plan in an unfamiliar codebase and when to stop for human review.

Use this when the product already exists. For greenfield feature shape, use [designing-agent-responsive-features.md](./designing-agent-responsive-features.md). For posture archetypes, overrides, grants, and tuning, use [policy-templates.md](./policy-templates.md). This guide only covers discovery, inventory, fit, risk classification, and the minimal first retrofit.

## Authority Map

- Minimal conformance self-check: `SA-CONF-001` through `SA-CONF-005`, Minimal+ checks in `SA-CONF-006` through `SA-CONF-089`, and framework/developer boundary `SA-CONF-090` through `SA-CONF-098`.
- Declarations and registry targets: `SA-DECL-001` through `SA-DECL-109`, especially action shape `SA-DECL-030` through `SA-DECL-053`, read tools `SA-DECL-060` through `SA-DECL-069`, facts `SA-DECL-070` through `SA-DECL-078`, surfaces `SA-DECL-080` through `SA-DECL-087`, and one-registry derivation `SA-DECL-090` through `SA-DECL-109`.
- Risk, reversibility, effects, confirmation, and posture inputs: `SA-POL-020` through `SA-POL-048`, `SA-POL-060` through `SA-POL-073`, `SA-POL-080` through `SA-POL-114`, and `SA-POL-140` through `SA-POL-172`.
- Context, execution, ledger, undo, and bridge checks: `SA-CONF-016` through `SA-CONF-026`, `SA-CONF-031` through `SA-CONF-043`, `SA-CONF-044` through `SA-CONF-081`, and door-two checks `SA-CONF-082` through `SA-CONF-086`.
- Failure-mode probes: [chatbot veneer](../anti-patterns/chatbot-veneer.md), [DOM-automation first](../anti-patterns/dom-automation-first.md), [duplicate tool layers](../anti-patterns/duplicate-tool-layers.md), [framework maximalism](../anti-patterns/framework-maximalism.md), [plan-everything](../anti-patterns/plan-everything.md), and [unsafe magic](../anti-patterns/unsafe-magic.md).

## Output Before Code

Produce this review packet before editing the target app:

1. Fit verdict: `fits`, `partial fit`, or `does not fit`, with file-backed evidence and anti-pattern risks. Use `SA-CONF-005` as the evidence shape.
2. Inventory: candidate actions, facts, read tools, risky operations, undo/history mechanisms, surfaces, existing assistant/tool layers, and validation seams. Map each row to the relevant `SA-CONF-*` checks.
3. Minimal first integration plan: facts plus read tools, then safe reversible actions, then one gated action, then posture selection. Map every proposed step to `SA-CONF-*` items.
4. Open questions: the decisions a human needs before code, such as scope boundary, ambiguous risk, missing undo authority, or whether a poor-fit verdict stops the work. Use `SA-CONF-098` for reproducible evidence expectations.
5. Stop line: state that no code has been changed and wait for approval before implementation. This preserves the review gate expected by north-star [§8](../../Steerable-Protocol-NorthStar.md#8-developer-experience-humans-and-coding-agents).

If the target already contains a Steerable or Steerable-like layer, treat it as evidence rather than rewrite scope. Report existing coverage, gaps, and the smallest missing or representative first slice under `SA-CONF-004`, `SA-CONF-005`, and `SA-CONF-098`.

## Inventory Procedure

Start with a read-only pass. Record commands, files, and evidence snippets so another agent can reproduce the inventory under `SA-CONF-005` and `SA-CONF-098`.

### 1. Map The Product Skeleton

Read these first, in order, adjusting names to the stack:

1. README, product docs, screenshots, demo scripts, and e2e tests.
2. Package or build manifests: `package.json`, lockfiles, workspace manifests, framework configs, routes/build configs.
3. Route, screen, page, view, controller, command, and API entry points.
4. State owners: reducers, stores, models, services, database accessors, route loaders, selectors, cache adapters.
5. Existing assistant, tool, automation, prompt, MCP, OpenAPI, fixture, and eval directories.

Useful commands:

```bash
rg --files
rg -n "route|screen|page|controller|handler|action|command|mutation|reducer|store|service|selector|loader|api"
rg -n "chat|assistant|copilot|toolCall|function_call|mcp|openapi|prompt|fixture|eval"
```

Evidence target: surfaces and liveness under `SA-CONF-020`, one registry source under `SA-CONF-006` through `SA-CONF-008`, generated/downstream layers under `SA-CONF-025` and `SA-CONF-026`, and language/API agnosticism under `SA-CONF-088`.

### 2. Discover Candidate Actions

Candidate actions come from existing app-owned ways to change product state or user-visible environment. Search broadly, then narrow to user-meaningful outcomes.

Search tactics:

```bash
rg -n "set[A-Z]|update[A-Z]|create[A-Z]|delete[A-Z]|remove[A-Z]|archive|restore|publish|send|submit|save|apply|reset|export|import|copy|share|navigate"
rg -n "dispatch\\(|useReducer|createSlice|zustand|pinia|mutation|mutate\\(|POST|PUT|PATCH|DELETE|server action|form action"
rg -n "onClick|onSubmit|handle[A-Z].*=|command|Command|controller|service|repository"
```

Read likely files:

- UI handlers and form submitters to learn the user outcome.
- Store reducers, command handlers, service methods, route actions, and mutation endpoints to find the trusted executor.
- Tests around those paths to find valid inputs, failure modes, and observable state.
- Existing docs or analytics event names to find product vocabulary.

For each candidate, write an inventory row:

| Field | What to capture | Evidence target |
|---|---|---|
| Outcome | One user-recognizable result, not a generic edit bucket. | `SA-DECL-030`, `SA-CONF-014` |
| Executor | Existing trusted app-owned setter, command, endpoint, or handler. | `SA-DECL-046`, `SA-CONF-015` |
| Params | Structured values visible in handler signatures, schemas, forms, or tests. | `SA-DECL-016` through `SA-DECL-018`, `SA-CONF-012`, `SA-CONF-013` |
| Reads and writes | Stable product state regions, external systems, quota, money, sensitive data, and route state. | `SA-DECL-019`, `SA-DECL-036`, `SA-DECL-037`, `SA-CONF-028`, `SA-CONF-030` |
| Surface | Where the action is available and which preconditions are registry-checkable. | `SA-DECL-045`, `SA-CONF-020` through `SA-CONF-022` |
| Recovery | Existing inverse, history entry, snapshot root, soft-delete restore, compensation, or honest no-undo. | `SA-DECL-049` through `SA-DECL-053`, `SA-CONF-029`, `SA-CONF-073` through `SA-CONF-077` |
| First-pass classification | Risk, reversibility, effects, confirmation, and ambiguity notes. | `SA-POL-020` through `SA-POL-073`, `SA-CONF-027` through `SA-CONF-030`, `SA-CONF-042` |

Split candidates when one executor performs materially different outcomes or risk classes under valid inputs; if the first pass cannot split it, classify upward and mark the split as an open question. Authority: `SA-POL-021`, `SA-POL-023`, `SA-CONF-028`.

### 3. Discover Hidden Domain State For Facts

Facts are the live surface's small, bounded context contract under `SA-DECL-070` through `SA-DECL-078`, so look for state the UI already depends on but the agent cannot infer safely from a prompt.

Search tactics:

```bash
rg -n "selector|select[A-Z]|use[A-Z].*Store|current[A-Z]|active[A-Z]|selected[A-Z]|quota|role|permission|status|mode|filter|sort|view|workspace|project|case|cart|draft"
rg -n "loader|route data|getServerSideProps|query|cache|state\\.|store\\.|context"
```

Read likely files:

- Route loaders and page components for current object, selected item, role, permissions, filters, and quota.
- Store selectors and derived state helpers for stable product vocabulary.
- Activity, status, and notification components for user-visible state.
- Tests that assert current context or empty states.

For each surface, record fact candidates as stable keys, why an agent needs them, update trigger, schema hint, and privacy note. Keep parameterized, large, private, or sparse data for read tools instead. Evidence target: `SA-DECL-070` through `SA-DECL-078`, `SA-CONF-017` through `SA-CONF-019`, `SA-CONF-044` through `SA-CONF-046`, and `SA-CONF-051`.

### 4. Discover Read Tools

Read tools are app-owned queries that answer parameterized or detailed information needs without executing actions.

Search tactics:

```bash
rg -n "GET|find|list|search|lookup|query|select|filter|summarize|count|status|remaining|available"
rg -n "fetch\\(|axios|get[A-Z]|loader|resolver|repository|service|cache"
```

Read likely files:

- Existing GET endpoints, route loaders, query services, selectors, and repository reads.
- Search/list pages and tests for params, pagination, filters, and authorization.
- Any code that looks read-only but writes analytics, quota, cache mutation, or marks notifications read; classify it against `SA-DECL-061`, `SA-CONF-016`, and `SA-CONF-047`.

Inventory each read tool with params, reads, preconditions, query owner, result bounds, and examples. Evidence target: `SA-DECL-060` through `SA-DECL-069`, `SA-CONF-016`, `SA-CONF-019`, `SA-CONF-047`, and `SA-CONF-081`.

### 5. Discover Risky Operations

Run a targeted pass for operations whose policy metadata can surprise users.

Search tactics:

```bash
rg -n "delete|destroy|reset|clear|revoke|archive|publish|send|email|sms|webhook|charge|billing|subscription|invoice|purchase|quota|credit|token|export|download|clipboard|share|open\\(|window\\.open|notify|sensitive|pii|secret"
rg -n "POST|PUT|PATCH|DELETE|mutation|write|save|sync|external|integration|provider|stripe|resend|slack|mailchimp"
```

Read likely files:

- Endpoint handlers, service methods, database writes, payment/email/integration clients, clipboard/download/share code.
- Permission checks and role gates around those paths.
- Tests for failure, rollback, idempotency, deleted state, quota exhaustion, and sensitive redaction.

Classify from executor evidence, called setters/endpoints, writes, external effects, quota/money, sensitive data, deletion/overwrite paths, and recovery mechanism. Evidence target: `SA-POL-020` through `SA-POL-073`, `SA-CONF-028` through `SA-CONF-030`, `SA-CONF-037`, `SA-CONF-040` through `SA-CONF-042`, and `SA-CONF-078`.

### 6. Discover Undo, History, And Recovery

Recovery earns speed. Search before designing new gates or broad snapshots.

Search tactics:

```bash
rg -n "undo|redo|history|snapshot|restore|rollback|revert|version|previous|before|after|softDelete|deletedAt|trash|recover|compensat"
```

Read likely files:

- Reducer history, command stacks, event-sourcing logs, audit logs, version tables, trash/soft-delete windows, form draft history, and server restore endpoints.
- Existing undo UI or keyboard-shortcut handlers.
- Tests proving restore order, partial restore, expired recovery, and failed restore behavior.

For each action, write the executable recovery path or mark no undo claim. Evidence target: `SA-POL-040` through `SA-POL-048`, `SA-CONF-029`, `SA-CONF-073` through `SA-CONF-077`, and `SA-CONF-074`.

### 7. Discover Surfaces And Routes

Surfaces are product boundaries for live capabilities, not component names.

Search tactics:

```bash
rg -n "routes|router|Route|NavLink|screen|view|tab|mode|workspace|panel|drawer|modal|surface|register|mount|unmount"
rg -n "permission|role|featureFlag|available|enabled|disabled|currentRoute|location|pathname"
```

Read likely files:

- Router config, page files, layouts, tabs/modes, navigation guards, feature flags, route loaders, and access-control wrappers.
- Cross-route flows and tests for navigation, readiness, timeout, and state preservation.

Record each candidate surface with route/view/mode, current-state facts, live actions, live read tools, capability availability conditions, and cross-surface continuation needs. Evidence target: `SA-DECL-080` through `SA-DECL-087`, `SA-CONF-020` through `SA-CONF-022`, `SA-CONF-066`, and `SA-CONF-068`.

### 8. Discover Existing Agent Or Tool Layers

A retrofit converges tool surfaces into one registry instead of preserving drift; check this against `SA-CONF-007`, `SA-CONF-025`, and `SA-CONF-026`.

Search tactics:

```bash
rg -n "assistant|copilot|chat|system prompt|toolCall|function_call|tools\\s*=|defineTool|server\\.tool|mcp|openapi|swagger|functionDeclarations|eval|fixture|prompt"
```

Read likely files:

- Prompt assembly, tool schemas, external MCP/OpenAPI tools, tests, fixtures, docs, and authorization adapters.
- Any code path where model output can reach mutation.

Inventory duplicate or unsafe layers separately from product actions. Evidence target: `SA-CONF-007`, `SA-CONF-008`, `SA-CONF-015`, `SA-CONF-025`, `SA-CONF-026`, `SA-CONF-031`, and door-two checks `SA-CONF-082` through `SA-CONF-086`.

## Fit Assessment

Use fit as a real gate before planning code.

| Verdict | Evidence pattern | What to return |
|---|---|---|
| Fits | The app has meaningful user-facing state, app-owned executors, surface boundaries, context worth publishing, and at least one safe reversible path plus one policy boundary candidate. | A minimal plan mapped to `SA-CONF-006` through `SA-CONF-081`. |
| Partial fit | One area of the product has those seams, but the whole app is static, externally controlled, selector-only, or missing recovery for high-impact actions. | A scoped plan for the fit area plus exclusions under `SA-CONF-004`, `SA-CONF-005`, and `SA-CONF-092`. |
| Does not fit | No useful product steering scope can satisfy the registry, trusted executor, facts/read tools, policy, visible activity, ledger, and undo/no-undo evidence needed for Minimal+ checks. | A no-go report with evidence and the smallest prerequisite product work. |

Poor-fit catalog:

- Read-only content site: no meaningful product mutation; answer/retrieval may be useful, but a steering retrofit has no action surface under `SA-DECL-030` through `SA-DECL-053`.
- Static marketing page: surface facts may exist, but no trusted app-owned executors or ledger-worthy operations appear under `SA-CONF-015`, `SA-CONF-031`, and `SA-CONF-069`.
- Docs chatbot or support bot only: likely [chatbot veneer](../anti-patterns/chatbot-veneer.md) until product-changing declared actions and trusted executors exist under `SA-CONF-006` through `SA-CONF-016`.
- Pixel/selector automation wrapper: likely [DOM-automation first](../anti-patterns/dom-automation-first.md) until normal product actions route through declarations, registry availability, and policy under `SA-CONF-015`, `SA-CONF-020`, `SA-CONF-031`, and `SA-CONF-050`.
- External SaaS wrapper with no product-owned executor authority: partial or no fit until the app can own trusted execution and policy records under `SA-CONF-015`, `SA-CONF-031`, and `SA-CONF-069`.
- High-stakes destructive workflow with no recovery or reviewable policy path: no first integration for that action until `SA-CONF-029`, `SA-CONF-037`, `SA-CONF-042`, and `SA-CONF-073` through `SA-CONF-077` have an honest path.
- Multiple independent tool registries for the same capability: partial fit only after one declaration source can drive downstream schemas, prompts, fixtures, and optional bridge surfaces under `SA-CONF-007`, `SA-CONF-025`, and `SA-CONF-026`.
- Broad "do anything" command endpoint: no safe action declaration until parameters, writes, risk, and executor outcomes can be narrowed under `SA-DECL-016` through `SA-DECL-018`, `SA-POL-021`, and `SA-CONF-012` through `SA-CONF-014`.
- Framework/platform rewrite temptation: out of retrofit scope when the plan is to replace the app runtime instead of declaring existing product capabilities under `SA-CONF-088`, `SA-CONF-089`, and [framework maximalism](../anti-patterns/framework-maximalism.md).

If the verdict is `does not fit`, stop. Return the evidence, name the blocked `SA-CONF-*` items, and propose prerequisite product changes outside this retrofit.

## Minimal-First Sequencing

The first integration path for this guide is a narrow slice that can pass the applicable Minimal+ checks before the scope expands. Do not start by productizing door two, model-provider adapters, framework-specific packages, lower-rung DOM/vision context, durable audit storage, or full workflow loops; those are outside the minimal floor or conditional under `SA-CONF-048`, `SA-CONF-056`, `SA-CONF-063`, `SA-CONF-080`, and `SA-CONF-082` through `SA-CONF-086`.

### Phase 1: Facts And Read Tools

Pick one product surface and publish enough facts/read tools for ordinary routing, answer, and policy context before action execution. Self-check `SA-CONF-016` through `SA-CONF-020`, `SA-CONF-044` through `SA-CONF-047`, and `SA-CONF-051`.

Human review stop:

- Confirm the surface boundary and any exclusions.
- Confirm fact keys are product vocabulary rather than private implementation paths under `SA-DECL-019` and `SA-DECL-020`.
- Confirm no fact/read tool leaks raw stores, DOM dumps, screenshots, secrets, or unbounded graphs under `SA-CONF-019`.

### Phase 2: Safe Actions With Real Undo

Add one to three safe reversible actions that wrap existing trusted executors and can run at product speed under policy. Self-check `SA-CONF-006` through `SA-CONF-015`, `SA-CONF-023`, `SA-CONF-028`, `SA-CONF-029`, `SA-CONF-031`, `SA-CONF-034`, `SA-CONF-038`, `SA-CONF-057` through `SA-CONF-059`, `SA-CONF-067`, `SA-CONF-069` through `SA-CONF-075`, and `SA-CONF-081`.

Human review stop:

- Confirm each action is a user-meaningful outcome, not a generic instruction bucket.
- Confirm params are structured and validated before executor code.
- Confirm undo uses a declared inverse or runtime-owned snapshot path, not model repair.
- Confirm safe reversible actions are not routed through universal review ceremony under `SA-CONF-038` and `SA-CONF-087`.

### Phase 3: One Gated Action

Add exactly one higher-friction action that proves policy boundaries, visible held state, ledger records, and honest no-undo or snapshot behavior. Good candidates are export quota, external share, account write, reset, publish, send, or delete. Self-check `SA-CONF-027` through `SA-CONF-043`, `SA-CONF-057`, `SA-CONF-062` or `SA-CONF-064` or `SA-CONF-065` as applicable, `SA-CONF-067` through `SA-CONF-078`, and `SA-CONF-081`.

Human review stop:

- Confirm risk/effects/confirmation evidence from executor code, not UI copy.
- Confirm the action has a gate path, executable recovery, or honest irreversible record under `SA-CONF-029`, `SA-CONF-042`, `SA-CONF-073`, and `SA-CONF-076`.
- Confirm approval UI and activity/ledger records identify the held boundary and outcome under `SA-CONF-062`, `SA-CONF-067`, `SA-CONF-069`, and `SA-CONF-072`.

### Phase 4: Posture Selection

Choose the starting posture after the action metadata is known. Use [policy-templates.md](./policy-templates.md) for archetype guidance and do not duplicate its tuning tables here. Self-check `SA-POL-140` through `SA-POL-172`, `SA-CONF-034` through `SA-CONF-041`, and `SA-CONF-087`.

Human review stop:

- Confirm the app archetype and selected preset.
- Confirm any override is a product policy input, not an action declaration mutation under `SA-POL-112` through `SA-POL-114`.
- Confirm the plan preserves product speed for clean safe reversible work under `SA-POL-073`, `SA-POL-146`, `SA-CONF-038`, and `SA-CONF-087`.

### Phase 5: Minimal Conformance Claim Check

Before any public conformance claim, run the checklist item-by-item for the exposed scope. Use `SA-CONF-001` through `SA-CONF-005` for claim and report shape, `SA-CONF-002` for the minimal pass gate, and `SA-CONF-090` through `SA-CONF-098` for framework/developer boundary evidence.

## Risk Classification Walkthrough

Apply this to every candidate action during inventory.

1. Inspect the executor and all called setters, services, endpoints, jobs, integrations, storage writes, clipboard/download/open-url paths, quota/money use, deletion/overwrite paths, and recovery mechanism. Cite `SA-POL-022` and `SA-CONF-028`.
2. Classify `risk` from the highest normal valid execution effect. If two classes remain plausible, classify upward or split the action. Cite `SA-POL-020`, `SA-POL-021`, `SA-POL-023`, and `SA-CONF-028`.
3. Classify reversibility by the recovery the runtime can execute after success. Cite `SA-POL-040` through `SA-POL-048`, `SA-CONF-029`, and `SA-CONF-073` through `SA-CONF-076`.
4. Classify effects from executor evidence for external systems, quota/money, and sensitive data. Cite `SA-POL-060` through `SA-POL-068` and `SA-CONF-030`.
5. Classify confirmation from inherent per-invocation need, then let policy resolve posture from metadata and inputs. Cite `SA-POL-069` through `SA-POL-073`, `SA-CONF-030`, and `SA-CONF-037`.
6. For mutating or destructive actions, verify a policy gate path or executable undo/snapshot path before including the action in the first slice. Cite `SA-CONF-042`.

Worked classifications:

| Candidate | Evidence to inspect | First-pass classification |
|---|---|---|
| Local tab or route change | Router setter only, no external call, ordinary back/undo path. | Often `safe` plus `undoable` or `snapshot`, citing `SA-POL-024`, `SA-POL-025`, `SA-POL-040` through `SA-POL-044`. |
| Local canvas color edit | Store setter for one token, previous value available. | Often `safe`, `undoable`, no external/cost/sensitive effect, citing `SA-POL-024`, `SA-POL-041`, `SA-POL-063`, `SA-POL-068`. |
| Copy share link | Clipboard write and status message, no product data commit. | At least `side_effect`, usually `irreversible`, external true, citing `SA-POL-026` through `SA-POL-028`, `SA-POL-045`, `SA-POL-060`. |
| Export with daily quota | Quota decrement or metered unit spend. | At least `mutating`, cost quota, often irreversible, citing `SA-POL-029` through `SA-POL-031`, `SA-POL-064`, `SA-POL-066`. |
| Send email or publish live | External send and durable external outcome. | `mutating` or `destructive` depending recoverability/domain impact, citing `SA-POL-029`, `SA-POL-030`, `SA-POL-032`, `SA-POL-033`, `SA-POL-060`. |
| Reset workspace | Overwrites broad local or durable state. | `destructive` when domain-significant or materially lossy even with snapshot recovery, citing `SA-POL-032`, `SA-POL-033`, `SA-POL-043`, `SA-POL-044`. |
| Delete record with restore window | Delete path plus soft-delete restore. | Usually `destructive` with a recovery mechanism to document, citing `SA-POL-032`, `SA-POL-033`, `SA-POL-046`, `SA-CONF-076`. |
| Billing change | Subscription/payment path or financial liability. | `mutating` or `destructive`, cost money, citing `SA-POL-029` through `SA-POL-033`, `SA-POL-065`, `SA-POL-066`. |

## Worked Example: Design Studio Inventory

This applies the procedure to [examples/design-studio](../../examples/design-studio) as if the app were unknown.

### Discovery Pass

Files read first:

- [README.md](../../examples/design-studio/README.md): app purpose, three routes, steering demo, setter inventory, coverage matrix.
- [package.json](../../examples/design-studio/package.json): Vite, React, React Router, Vitest scripts.
- [src/App.tsx](../../examples/design-studio/src/App.tsx): route map for `/`, `/templates`, `/settings`.
- [src/routes/Editor.tsx](../../examples/design-studio/src/routes/Editor.tsx), [src/routes/Templates.tsx](../../examples/design-studio/src/routes/Templates.tsx), [src/routes/Settings.tsx](../../examples/design-studio/src/routes/Settings.tsx): UI handlers and route-specific operations.
- [src/state/designStore.tsx](../../examples/design-studio/src/state/designStore.tsx): reducer events and trusted setters.
- [src/steerable/designStudioCapabilities.ts](../../examples/design-studio/src/steerable/designStudioCapabilities.ts): declarations, state keys, facts, read tools, surfaces, snapshot adapter.
- [src/steerable/policy.ts](../../examples/design-studio/src/steerable/policy.ts), [src/steerable/execution.ts](../../examples/design-studio/src/steerable/execution.ts), [src/steerable/ledger.ts](../../examples/design-studio/src/steerable/ledger.ts), [src/steerable/undo.ts](../../examples/design-studio/src/steerable/undo.ts): policy, trusted execution, visible record model, and recovery.
- [src/steerable/designStudioCapabilities.test.ts](../../examples/design-studio/src/steerable/designStudioCapabilities.test.ts), [src/steerable/router.test.ts](../../examples/design-studio/src/steerable/router.test.ts), [src/steerable/runtime.test.ts](../../examples/design-studio/src/steerable/runtime.test.ts): registry, routing, policy, cross-surface, ledger, and undo evidence.

Searches that reproduce the seams:

```bash
rg -n "setPaletteToken|applyPalettePreset|setFontPairing|setTypeScale|setHeroLayout|toggleSectionVisibility|moveSection|updateSectionText|applyTemplate|updateProjectMeta|copyShareLink|exportProject|resetProject|restoreState" examples/design-studio/src
rg -n "defineAction|defineReadTool|defineFacts|defineSurface|risk:|reversibility|confirmation|externalExposure" examples/design-studio/src/steerable
rg -n "registerSurface|deregisterSurface|surface.navigate_surface|RegistrySurfaceReadiness" examples/design-studio/src/steerable
rg -n "undo|snapshot|ledger|policyDecision|approval|held|Plan preview|Gated suffix" examples/design-studio/src/steerable
```

### Fit Verdict

Verdict: fits. Evidence: the app has three product surfaces, reducer-backed trusted setters, finite facts per surface, three read tools, 15 declared actions, strict params, policy-before-execution, visible steering records, and executable undo/snapshot/no-undo handling. The first integration scope can be mapped to Minimal+ checks in `SA-CONF-006` through `SA-CONF-081`, while door two remains not applicable under `SA-CONF-082` through `SA-CONF-086`.

### Surface Inventory

| Surface | Route | Live action groups | Live read/facts | Evidence target |
|---|---|---|---|---|
| `editor` | `/` | palette, typography, layout, sections, export, navigation | `design.get_current_design`, `quota.get_status`, `editor.current_facts` | `SA-CONF-020`, `SA-CONF-044` through `SA-CONF-047` |
| `templates` | `/templates` | apply template, navigation | `design.get_current_design`, `template.list_available`, `templates.current_facts` | `SA-CONF-020`, `SA-CONF-066` |
| `settings` | `/settings` | metadata, posture, copy share link, export, reset, navigation | `design.get_current_design`, `quota.get_status`, `settings.current_facts` | `SA-CONF-020`, `SA-CONF-067` |

### Candidate Action Inventory

| Action ID | Existing executor evidence | Surface | Classification evidence |
|---|---|---|---|
| `surface.navigate_surface` | `navigateToSurface` host callback in `SteeringContext.tsx` | All | Local route state, inverse route restore: `SA-POL-024`, `SA-POL-025`, `SA-CONF-066`. |
| `palette.set_color` | `setPaletteToken` reducer event | Editor | One palette token, previous value inverse: `SA-CONF-028`, `SA-CONF-029`, `SA-CONF-038`. |
| `palette.apply_preset` | `applyPalettePreset` reducer event | Editor | Full local palette snapshot: `SA-POL-043`, `SA-CONF-029`, `SA-CONF-075`. |
| `typography.set_pairing` | `setFontPairing` reducer event | Editor | Local typography field plus inverse: `SA-POL-024`, `SA-POL-041`. |
| `typography.set_scale` | `setTypeScale` reducer event | Editor | Local typography field plus inverse: `SA-POL-024`, `SA-POL-041`. |
| `layout.set_hero` | `setHeroLayout` reducer event | Editor | Local layout field plus inverse: `SA-POL-024`, `SA-POL-041`. |
| `section.set_visibility` | `toggleSectionVisibility` reducer event | Editor | Local section flag, previous value restore: `SA-POL-024`, `SA-POL-041`. |
| `section.move_section` | `moveSection` reducer event | Editor | Local section order, inverse move: `SA-POL-024`, `SA-POL-041`. |
| `section.update_copy` | `updateSectionText` reducer event | Editor | Local section copy, previous field restore: `SA-POL-024`, `SA-POL-041`; future sensitivity would use `SA-POL-067`. |
| `template.apply_template` | `applyTemplate` reducer event | Templates | Multi-field local snapshot: `SA-POL-043`, `SA-CONF-075`. |
| `project.update_meta` | `updateProjectMeta` reducer event | Settings | Local metadata, previous value inverse: `SA-POL-024`, `SA-POL-041`. |
| `policy.set_posture` | `setPosture` host callback | Settings | Runtime posture state, previous value inverse: `SA-POL-011`, `SA-POL-113`. |
| `share.copy_link` | `copyShareLink` uses `navigator.clipboard.writeText` | Settings | Clipboard side effect, honest no undo: `SA-POL-026`, `SA-POL-028`, `SA-POL-045`, `SA-CONF-076`. |
| `project.export_project` | `exportProject` decrements fake quota | Editor, Settings | Quota spend, policy confirmation, no undo: `SA-POL-029` through `SA-POL-031`, `SA-POL-064`, `SA-CONF-042`. |
| `project.reset_project` | `resetProject` overwrites design/meta to starter state | Settings | Destructive local overwrite, snapshot, confirmation always: `SA-POL-032`, `SA-POL-043`, `SA-POL-071`, `SA-CONF-037`. |

### Facts And Read Tools

Facts inventory:

- `editor.current_facts`: route, project name/goal, selection, palette, typography, hero layout, visible section IDs, section order, active template, export quota, posture. Evidence target: `SA-CONF-017` through `SA-CONF-019`, `SA-CONF-046`.
- `templates.current_facts`: route, active template, template count/IDs, tone, audience, palette, typography, hero layout, export quota, posture. Evidence target: `SA-CONF-017` through `SA-CONF-019`.
- `settings.current_facts`: route, project metadata, share slug/URL, quota, last export, share status, posture. Evidence target: `SA-CONF-017` through `SA-CONF-019`, `SA-CONF-051`.

Read tool inventory:

| Read tool | Purpose | Scope evidence |
|---|---|---|
| `design.get_current_design` | Bounded design/project summary. | `SA-DECL-060` through `SA-DECL-069`, `SA-CONF-016`, `SA-CONF-019`. |
| `template.list_available` | Parameterized template listing by optional tone. | `SA-CONF-016`, `SA-CONF-047`. |
| `quota.get_status` | Export quota status and `canExport` summary. | `SA-CONF-016`, `SA-CONF-019`, `SA-CONF-047`. |

### Risky Operations And Recovery

Risky operation inventory:

- Clipboard: `share.copy_link` writes to browser clipboard and records honest no-undo, using `SA-POL-026`, `SA-POL-028`, `SA-POL-045`, and `SA-CONF-076`.
- Quota: `project.export_project` spends a fake export quota unit and is held by policy under creative posture, using `SA-POL-031`, `SA-POL-064`, `SA-POL-070`, `SA-CONF-030`, and `SA-CONF-042`.
- Reset: `project.reset_project` overwrites broad local state, uses snapshot recovery, and carries inherent confirmation, using `SA-POL-032`, `SA-POL-043`, `SA-POL-071`, `SA-CONF-037`, and `SA-CONF-075`.

Recovery inventory:

- Declared inverse: navigation, palette token, typography, layout, section visibility/order/copy, project metadata, posture.
- Runtime snapshot: palette preset, template apply, project reset.
- Honest irreversible: share link copy, export quota.
- Aggregate undo: chain undo discloses partial recovery when an irreversible completed step exists, using `SA-CONF-061`, `SA-CONF-073`, `SA-CONF-076`, and `SA-CONF-077`.

### Minimal First Integration If This Were Not Already Complete

First slice:

1. Surface: `editor`.
2. Facts/read tools: `editor.current_facts`, `design.get_current_design`, `quota.get_status`; self-check `SA-CONF-016` through `SA-CONF-020`, `SA-CONF-044` through `SA-CONF-047`.
3. Safe action: `palette.set_color`; self-check `SA-CONF-006` through `SA-CONF-015`, `SA-CONF-028`, `SA-CONF-029`, `SA-CONF-038`, `SA-CONF-057` through `SA-CONF-059`, `SA-CONF-069` through `SA-CONF-075`.
4. One gated action: `project.export_project`; self-check `SA-CONF-030`, `SA-CONF-031`, `SA-CONF-042`, `SA-CONF-057`, `SA-CONF-062`, `SA-CONF-067`, `SA-CONF-069` through `SA-CONF-078`.
5. Posture: start from `creative-tool` because Design Studio is a local creative production tool, then verify with [policy-templates.md](./policy-templates.md) and `SA-POL-140` through `SA-POL-172`.

Stop before adding template chains, settings posture toggles, reset, eval adapter, or door two. Those become second-pass scope after the first slice passes the checklist evidence above.
