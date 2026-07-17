# `@steerable/react`

`@steerable/react` is the thin React binding over `@steerable/core`. It hosts a core runtime in context, ties declared surfaces to React mount lifecycles, publishes bounded facts, and exposes event-driven execution state. It renders no product UI and depends on no router.

## Status

The binding works and is covered by package tests plus the package-backed Design Studio example. It is not yet published to npm: vendor it from this repository for now, following the [root quickstart](../../README.md#try-it). React 18 or newer is the only peer dependency; `@steerable/core` is a direct dependency.

## Provide the runtime

Create the runtime once from core declarations, then provide it above every component that uses Steerable hooks.

`SteerableProvider` must be hoisted **above your router**. The steering session host has to outlive intra-app navigation: if the provider is mounted inside the navigable region, every navigation discards the runtime, its ledger records, and any in-flight chain, which makes cross-surface continuation ([SA-EXEC-247](../../docs/spec/execution-and-surfaces.md)) impossible by construction. Only route components below it should call `useSurfaceRegistration`. In development the binding reports a provider that is remounted by a surface change; the check is compiled out of production builds.

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

Registration commits before paint, so the first turn of a session cannot race it. Registration is mount-counted per registry: if two mounted components register the same surface, the surface stays live until the last of them unmounts.

Nothing registers during server rendering. Surface liveness is per-client mutable state on a shared registry, so a server render must not publish it; a server-rendered host registers on hydration, still before the client's first paint.

## Publish facts

Pass the ID of a declared facts source. There are two publication models, because one does not cover both shapes of app.

**Pull** asks the declared producer for values on mount and whenever the dependency list changes. It suits a live client-side store the producer can read.

```tsx
import { usePublishedFacts } from "@steerable/react";

function EditorFacts({ theme }: { theme: string }) {
  const { values, publish } = usePublishedFacts("editor.current_facts", [theme]);
  return <button onClick={() => void publish()}>Facts: {JSON.stringify(values)}</button>;
}
```

**Push** publishes values the render already holds, synchronously and before paint. Use it when state arrives as props — from a server component, a loader, or a router — where the producer has nothing to read yet and an async pull would only race:

```tsx
function EditorFacts({ theme }: { theme: string }) {
  const { values } = usePublishedFacts("editor.current_facts", {
    seed: { "design.theme": theme },
  });
  return <output>{JSON.stringify(values)}</output>;
}
```

Supplying `seed` turns automatic pulling off; pass `autoPublish: true` to do both. Automatic publishes never escape as unhandled rejections: a failing producer surfaces through the returned `error`, through `onError`, and through a development console report. An explicit `publish()` still rejects so you can await it.

Facts published this way are readable synchronously through `runtime.facts` — that is the seam a steering turn reads, so a turn dispatched before paint still sees them. Teardown retracts a publisher's snapshot only while it still owns it, so when a route replaces another and both publish the same facts ID, the outgoing route's cleanup cannot erase the incoming route's snapshot.

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
