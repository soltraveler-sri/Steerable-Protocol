# `@steerable/react`

`@steerable/react` is the thin React binding over `@steerable/core`. It hosts a core runtime in context, ties declared surfaces to React mount lifecycles, publishes bounded facts, and exposes event-driven execution state. It renders no product UI and depends on no router.

## Status

The binding works and is covered by package tests plus the package-backed Design Studio example. It is not yet published to npm: vendor it from this repository for now, following the [root quickstart](../../README.md#try-it). React 18 or newer is the only peer dependency; `@steerable/core` is a direct dependency.

## Provide the runtime

Create the runtime once from core declarations, then provide it above every component that uses Steerable hooks.

```tsx
import { SteerableProvider, useSteerableRuntime } from "@steerable/react";

function App({ children }: { children: React.ReactNode }) {
  const runtime = useSteerableRuntime({
    declarations: { actions, readTools, facts, surfaces },
    snapshotAdapter: appSnapshotAdapter,
    approvalHook: showProductApproval,
  });
  return <SteerableProvider runtime={runtime}>{children}</SteerableProvider>;
}
```

Declarations, executors, snapshot storage, approval UI, and product UI remain app-owned. If a component owns the approval handler, `useApprovalHook(handler)` keeps the core callback stable while using the current handler.

## Register a surface

Mount the hook in the actual route or mode component. It registers on mount and deregisters on unmount, so any router can drive liveness.

```tsx
import { useSurfaceRegistration } from "@steerable/react";

function EditorRoute() {
  useSurfaceRegistration("editor");
  return <Editor />;
}
```

## Publish facts

Pass the ID of a declared facts source. The hook publishes on mount and when its dependency list changes; `publish` supports app events outside React's dependency flow.

```tsx
import { usePublishedFacts } from "@steerable/react";

function EditorFacts({ theme }: { theme: string }) {
  const { values, publish } = usePublishedFacts("editor.current_facts", [theme]);
  return <button onClick={() => void publish()}>Facts: {JSON.stringify(values)}</button>;
}
```

The facts declaration itself comes from core and must already be present in the provider's `declarations.facts`.

## Execution and trail state

```tsx
const runtime = useSteerable();
const { records, pendingApproval } = useSteeringState();
const run = runtime.executeChain({ intent, surfaceId: "editor", posture, steps });
const result = await run.done;
await runtime.undoAll(run);
```

`useSteeringState()` uses `useSyncExternalStore`, not polling. It tracks ledger records and the current `ApprovalRequest`; render `pendingApproval` in app-owned UI and resolve it through the approval hook.

## Spec map

| Binding concept | Specification |
|---|---|
| Provider over one compiled registry | [Capability declarations](../../docs/spec/capability-declarations.md) |
| Route-driven surface liveness | [Execution and surfaces](../../docs/spec/execution-and-surfaces.md) |
| Bounded facts publication | [Context ladder](../../docs/spec/context-ladder.md) |
| Approval and execution state | [Autonomy policy](../../docs/spec/autonomy-policy.md) · [Action ledger](../../docs/spec/action-ledger.md) |

## Design notes

`useSteerableRuntime` compiles declarations once; create a new runtime intentionally when declarations change. Surface registration is router-agnostic, and ledger subscriptions let durable app ledgers update trail state without a parallel polling model.
