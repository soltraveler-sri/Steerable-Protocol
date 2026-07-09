# `@steerable/react`

`@steerable/react` is the thin React binding over `@steerable/core`. It creates or hosts a core runtime, ties declared surfaces to React route lifecycle, publishes bounded facts, and exposes event-driven execution state for trail and undo UI. It renders no product UI and does not depend on a router.

## Install and create a runtime

`react` is the only peer dependency. `@steerable/core` is a normal dependency because the binding executes its typed core API.

```tsx
import { SteerableProvider, useSteerableRuntime } from "@steerable/react";

function AppRuntime({ children }: { children: React.ReactNode }) {
  const approvalHook = useApprovalHook(showProductApprovalDialog);
  const runtime = useSteerableRuntime({
    declarations: { actions, readTools, facts, surfaces },
    snapshotAdapter: appSnapshotAdapter,
    approvalHook,
  });
  return <SteerableProvider runtime={runtime}>{children}</SteerableProvider>;
}
```

Declarations, trusted executors, optional durable ledger, state snapshot adapter, approval UI/service, and all product UI are supplied by the consumer. `useSteerableRuntime` compiles declarations once; construct a new runtime intentionally when declarations change.

## Route and facts hooks

```tsx
function SettingsRoute() {
  useSurfaceRegistration("settings");
  const { values, publish } = usePublishedFacts("settings.current_facts", [theme]);
  // render app-owned UI with values; call publish after non-React changes if needed
}
```

`useSurfaceRegistration` registers on mount and deregisters on unmount. It is router-agnostic: React Router, Next, and a custom router all drive it by mounting the actual route. That registration emits the core registry event used by default `SurfaceReadiness`, so a cross-surface execution can await the destination without importing `react-router`.

## Execution, approvals, and trail state

```tsx
const { executeChain, undoAll } = useSteerable();
const { records, pendingApproval } = useSteeringState();

const run = executeChain({ intent, surfaceId: "editor", posture, steps });
await run.done;
await undoAll(run);
```

`useSteeringState` uses `useSyncExternalStore`, not polling. It tracks chains started through this runtime and pending calls to the supplied `ApprovalHook`; pass `pendingApproval` to your own approval UI. `useApprovalHook(handler)` creates a stable callback when a React component owns the approval handler.

For an application-managed or durable ledger, the core `ActionLedger` currently has no record-read or subscription contract. The binding can refresh records exposed by an optional `getRecords()` method and always tracks its own dispatches, but externally-written ledger changes need an application state source until core adds a notification/read-model seam.
