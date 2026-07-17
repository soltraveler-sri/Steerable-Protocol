# `@steerable/core`

`@steerable/core` is the zero-dependency, framework-agnostic runtime for the Steerable protocol. It compiles app-owned capability declarations, resolves autonomy policy as a pure function, and executes approved actions through trusted app code with ledger and undo support. It imports no DOM, React, router, or model-provider APIs.

## Status

The package works and is covered by the repository's build, unit tests, Design Studio example, and deterministic evals. It is not yet published to npm: vendor it from this repository for now, following the [root quickstart](../../README.md#try-it).

## Define an action

Declarations are the single source of truth for parameters, effects, policy metadata, execution, and recovery.

```ts
import { compileSchema, defineAction } from "@steerable/core";

let accent = "#3366FF";
const setAccent = defineAction<{ hex: string }, { previousHex: string }>({
  id: "palette.set_color", title: "Set accent", description: "Set the accent color.",
  params: compileSchema({
    type: "object",
    properties: { hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" } },
    required: ["hex"], additionalProperties: false,
  }),
  reads: ["design.palette"], writes: ["design.palette"], risk: "safe",
  reversibility: { kind: "undoable" },
  effects: { external: false, cost: "none", sensitive: false },
  confirmation: "never", preconditions: [], externalExposure: "none",
  execute: ({ hex }) => { const previousHex = accent; accent = hex; return { previousHex }; },
  undo: ({ result }) => { if (result) accent = result.previousHex; },
  guidance: "Use when the user names an exact accent color.",
  examples: [{ user: "make the accent green", params: { hex: "#228B22" } }],
});
```

`compileSchema` derives the strict parser from the JSON Schema, so the contract enforced at dispatch and the contract shown to the model are one source and cannot drift. The schema is required: it is what every generated tool surface is derived from, so a declaration without one would compile and then be invisible to the model. Schemas must lie inside the [Steerable JSON Schema Profile](../../docs/guides/ecosystem-adapters.md#the-steerable-json-schema-profile) — the portable cross-provider intersection — and a keyword outside it fails at compile time. When a parameter genuinely needs a hand-written parser, `createStrictObjectSchema(keys, parseValues, jsonSchema)` takes one alongside its explicit schema.

## Compile the registry

The registry validates declarations and makes live surface availability queryable.

```ts
import { CapabilityRegistry } from "@steerable/core";

const registry = new CapabilityRegistry({
  actions: [setAccent],
  surfaces: [{ id: "editor", title: "Editor", description: "Design editor.", capabilities: [setAccent.id] }],
});
registry.registerSurface("editor");
```

## Resolve policy

Policy resolution is pure: it returns an auditable decision without executing the action.

```ts
import { resolveActionPolicy } from "@steerable/core";

const decision = resolveActionPolicy(registry.requireAction(setAccent.id), {
  posture: "creative-tool", currentSurface: "editor", availability: registry,
});
```

## Execute

The engine revalidates parameters and policy, invokes only the declared executor, and records the result.

```ts
import { ExecutionEngine, InMemoryLedger } from "@steerable/core";

const engine = new ExecutionEngine({ registry, ledger: new InMemoryLedger() });
const result = await engine.executeAction({
  intent: "make the accent forest green", surfaceId: "editor", posture: "creative-tool",
  actionId: setAccent.id, params: { hex: "#228B22" },
});
```

## Wire a model

`createEcosystemAdapter` compiles the registry into AI-SDK-style tool schemas and a `canUseTool`
policy callback — the **policy-preview seam**. It resolves policy and validates params but never
executes or records; on `allow` you dispatch the same proposal into the engine — the **execution
seam** — so the ledger record exists. The two halves compose with the APIs above:

```ts
import { createEcosystemAdapter, canonicalToolNameProfile } from "@steerable/core";

const adapter = createEcosystemAdapter(registry, "creative-tool", {
  toolNames: canonicalToolNameProfile,
});

// In your provider's tool-call dispatch:
const decision = adapter.canUseTool({ toolName, params, context: { surfaceId: "editor" } });
if (decision.status === "deny") return denyToolCall(decision.reason);
// `allow` and `needs-approval` route into the ledgered execution seam; the engine's ApprovalHook
// is the single consent point, so you do not gate again here (SA-EXEC-015, SA-EXEC-016).
const result = await engine.executeAction({
  intent, surfaceId: "editor", posture: "creative-tool",
  actionId: decision.toolName, params: decision.params,
});
// result.record is the SteeringInvocationRecord written to the ledger.
```

This composition — the last hop the adapter alone never completes — is spelled out in the
[ecosystem adapters guide](../../docs/guides/ecosystem-adapters.md#from-a-decision-to-a-ledgered-execution)
and proven end-to-end in [`src/composition.test.ts`](./src/composition.test.ts).

## Host seams

- `SurfaceReadiness` lets a platform navigate, await a declared surface, and revalidate its next capability. Registry events provide the default implementation; the default timeout is 5000 ms.
- `StateSnapshotAdapter` lets app-owned code capture and restore declared state keys for snapshot undo without exposing storage choices to core.
- `ApprovalHook` lets product UI or services approve or decline the declaration- and policy-derived held scope. Core never renders a gate.

## Spec map

| Concept | Specification |
|---|---|
| Declarations and registry | [Capability declarations](../../docs/spec/capability-declarations.md) |
| Policy decisions and postures | [Autonomy policy](../../docs/spec/autonomy-policy.md) |
| Execution, approval, and surface readiness | [Execution and surfaces](../../docs/spec/execution-and-surfaces.md) |
| Ledger and undo | [Action ledger](../../docs/spec/action-ledger.md) |
| Facts and read context | [Context ladder](../../docs/spec/context-ladder.md) |
| External exposure and adapters | [External bridge](../../docs/spec/external-bridge.md) |

## Design notes

Schemas pair a portable JSON Schema with a strict `parse` contract, so apps can keep their validator of choice while every declaration stays derivable into a model-facing tool (`SA-DECL-100`). Both halves are required, and `compileSchema` derives the second from the first. Omitted `externalExposure` compiles to `none`; bridge eligibility is never inferred. Mutable context is always an explicit policy input, and `ActionLedger` exposes `getRecords()` plus `subscribe()` for app-owned trail UI.
