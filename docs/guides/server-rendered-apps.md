# Retrofitting Steerable Into A Server-Rendered App

**Status:** Informative guide. Normative requirements live in `docs/spec/`; this guide points to requirement IDs rather than redefining them. It tells a coding agent how to carry a Steerable retrofit into a server-rendered application — a Next.js App Router app, a Remix/React Router-with-loaders app, an Astro-with-islands app, or any stack where product state arrives as **props through a router that unmounts things** and where **one process serves many principals**.

Use this **after** the discovery and fit work in [retrofit-existing-app.md](./retrofit-existing-app.md). That guide finds *what* to declare (actions, facts, read tools, surfaces, recovery); this guide covers the five things that are shaped differently on a server than in the Vite SPA the reference example ([examples/design-studio](../../examples/design-studio)) is built from. The example is a client-only single-principal app, and its shape silently encodes assumptions — a live client store to pull facts from, a single mutable liveness state, a synchronous session-scoped ledger, a provider that happens to sit above the router — that do not survive the move to a server. Each section below maps to a concrete defect the first non-SPA adopter hit, and to the current, tested SDK API that resolves it.

## This Is A Menu — Check Fit Before Applying Each Section

A server-rendered app is one shape, not the shape; not every section applies to your target. Each section opens with a **precondition to verify**, not a fact to assume. Treat skipping a section whose precondition your target does not meet as a correct outcome:

- **No cross-surface navigation** (a single-page dashboard, or steering scoped to one route)? The panel-lifetime depth in [§2](#2-panel-placement-the-session-host-must-outlive-navigation) still names an invariant worth knowing, but the four-PR failure it prevents cannot occur in your layout — read it, confirm it does not bind, move on.
- **In-memory / session ledger is genuinely enough** (steering trail need not survive a process restart, and no external audit consumer reads it)? The durable-ledger wiring in [§3](#3-durable-ledger-it-can-now-actually-be-durable) is optional — the shipped `InMemoryLedger` is conforming. Verify the precondition (below) rather than reaching for durability reflexively.
- **A single trusted principal** (an internal tool behind one operator's session, no cross-user isolation risk)? The per-request liveness scoping in [§1](#1-registry-compile-once-scope-liveness-per-request) is still the safe pattern on a shared process, but the isolation bug it prevents needs more than one principal to bite.
- **Facts come from a live server-side store you can query at turn time**, not from render props? The seeding pattern in [§4](#4-facts-seeding-for-prop-driven-state) is for the prop-driven case; a queryable store can keep the pull model.

Everywhere below, the phrase "verify against your target" means: read the cited source or spec ID and confirm it says what this guide claims before you rely on it.

## What You Build vs. What Ships

Before any code, internalize the scope boundary — the [README's "Scope of what ships vs. what you build"](../../README.md#project-status--honest-version) is authoritative and this guide does not restate it. In one line: **the specification covers the full steering loop; the packages implement everything *downstream of a validated `{actionId, params}` proposal*; you build everything *upstream* of that proposal.** Concretely, on a server that means:

| You own (upstream of the proposal) | Ships in `@steerable/core` / `@steerable/react` (downstream) |
|---|---|
| The model call (a live Anthropic/OpenAI/etc. request) | Registry compilation and the per-principal availability view |
| Prompt assembly, conversation history, tool-schema wiring | Policy resolution, gated and cross-surface execution |
| The intent router the spec mandates (`SA-EXEC-020`–`039`) | The ledger seam, undo, and the ecosystem adapter |
| **Where** that all runs (server action, API route, edge function) | The `ExecutionEngine` that validates, gates, records, and undoes |

The model call being adopter-owned is not a gap; it is the boundary (`SA-CORE-094`, `SA-EXEC-035`). What the SDK guarantees is the last hop — from an *authorized* proposal to a *ledgered execution* — and the enforcement seams around it. The single portability lesson of this whole guide is that on a server, the two ends of that boundary land in **different execution contexts** (the model call in a request handler; the registry compiled once at module scope), and the seams between them have to be wired explicitly. The rest of this guide is those seams.

---

## 1. Registry: Compile Once, Scope Liveness Per Request

**Precondition to verify:** your process serves more than one principal (user/session/tenant) from a single compiled registry. If a single trusted principal owns the whole process, the isolation defect below cannot occur — but the pattern is still the safe default on any shared host.

**The defect.** Compiling the registry is expensive and it is `SA-DECL-090`'s single source of truth, so a server adopter naturally hoists it to a module singleton — exactly right. But surface liveness (`registerSurface`/`deregisterSurface`) and satisfied preconditions (`setPrecondition`) were **instance-mutable state** on that shared registry. One request marking a surface live, or a precondition satisfied, changed availability for *every* concurrent request. One user's live surfaces leaked into another user's turn. `SA-DECL-097` (and its framework/developer split `SA-DECL-138`) now make principal-scoped liveness normative: *surface liveness and precondition state MUST be principal-scoped, so one principal's registration never makes a capability available for another.*

**The fix that now exists.** The compiled, immutable declaration data (schemas, metadata, surface membership) is shared safely; only liveness is per-principal. `CapabilityRegistry.withLiveness(state)` returns a `RegistryAvailabilityView` — a read-only availability projection over a **caller-owned** `LivenessState`. Verify these in [`packages/core/src/registry.ts`](../../packages/core/src/registry.ts): `createLivenessState()` (returns `{ liveSurfaces: Set, satisfiedPredicates: Set }`), `withLiveness(state)`, and the `RegistryAvailabilityView` interface (`isActionAvailableOnSurface`, `getLiveActions`, `getLiveFacts`, …).

Compile once at module scope; build one `LivenessState` per request and populate it for that request's principal:

```ts
// steerable/registry.ts — module singleton, compiled once per process.
import { CapabilityRegistry } from "@steerable/core";
import { declarations } from "./declarations"; // your actions/readTools/facts/surfaces

// Immutable declaration data. Shared across every request; never mutated per-principal.
export const registry = new CapabilityRegistry(declarations);
```

```ts
// Per request (server action, route handler, RSC) — derive availability for THIS principal.
import { createLivenessState } from "@steerable/core";
import { registry } from "@/steerable/registry";

function availabilityForRequest(session: Session) {
  const liveness = createLivenessState();
  // Populate from this principal's state — which routes/surfaces are live for THIS user,
  // which host predicates hold. `liveSurfaces` and `satisfiedPredicates` are plain Sets
  // you fill directly (SA-DECL-097 / SA-DECL-138). There is no shared mutation here.
  for (const surfaceId of session.liveSurfaces) liveness.liveSurfaces.add(surfaceId);
  if (session.canExport) liveness.satisfiedPredicates.add("quota:export_available");

  // A read-only availability view over just this principal's liveness.
  return registry.withLiveness(liveness);
}
```

Pass that view as `availability` wherever policy or execution asks "is this live for whom?":

- On `ExecutionEngine.executeChain` / `executeAction`: the request carries an optional `availability?: RegistryAvailabilityView` (verify `ExecuteChainRequest` in [`execution.ts`](../../packages/core/src/execution.ts)). When omitted, the engine falls back to `registry.defaultView` — the instance-liveness path, correct only for the single-principal SPA.
- On the ecosystem adapter: `EcosystemToolContext.availability` (verify in [`ecosystem-adapter.ts`](../../packages/core/src/ecosystem-adapter.ts)) — `canUseTool` resolves policy against the per-request view.

```ts
const availability = availabilityForRequest(session);
const result = await engine.executeAction({
  intent,
  surfaceId,
  posture: "business-app", // your PosturePreset: "creative-tool" | "business-app" | "sensitive-domain"
  actionId: proposal.actionId,
  params: proposal.params,
  availability, // ← per-request view; without this, availability is a shared-process bug
});
```

**Backward compatibility to note in your plan:** `availability` is optional on both the engine request and the adapter context; omitting it preserves the single-principal SPA path unchanged. A server MUST NOT rely on that fallback — read availability through `withLiveness` explicitly. Self-check: `SA-DECL-084`–`086` (liveness), `SA-DECL-085` and `SA-DECL-097` (scoped availability), `SA-POL-104`–`105` (host context into policy).

> **Binding-level honesty.** The `@steerable/react` runtime is a *client, single-principal* host: it holds surface liveness as per-client mutable instance state and registers surfaces on hydration (verify `useSurfaceRegistration` in [`packages/react/src/index.ts`](../../packages/react/src/index.ts) — "Nothing registers during server rendering, by design"). The per-request `withLiveness` pattern is therefore a **core-level** pattern you apply in your own server execution context (the server action / route handler that runs the engine), *not* something the React binding derives for you. The React runtime's `executeChain`/`executeAction` do pass a request's `availability` straight through to the engine, so a server-driven turn can supply it — but the binding will not build the per-request view on your behalf. There is no `@steerable/next` binding that automates this yet (its deferral is under reconsideration in issue #83); until one lands, the honest boundary is: **compile the registry and run the engine server-side yourself, supplying `withLiveness(perRequestState)`; use the React binding only for the client panel host** ([§2](#2-panel-placement-the-session-host-must-outlive-navigation)).

---

## 2. Panel Placement: The Session Host MUST Outlive Navigation

**Precondition to verify:** your steering flow spans more than one navigable surface — i.e. a steering turn can start on one route and continue after a client-side navigation to another (the cross-surface continuation of `SA-EXEC-247`). If steering is confined to a single route with no cross-surface continuation, this invariant cannot be violated in your layout; read it once and move on.

**The defect.** The adopter mounted the steering session host (the provider that owns pending continuations, the bounded wait, in-flight undo scope, and the activity surface) **inside a per-page shell**. Every client route change unmounted it and destroyed the pending cross-surface continuation. Cross-surface steering was *impossible by construction* — while every static reading of the continuation requirements still passed. It cost four PRs because nothing said the host had to live above the router; the SPA example gets it right only by accident of its shape (`SteeringProvider` above `<Routes>`), and never states the invariant.

**The invariant, now normative.** Verify the exact text in [`docs/spec/execution-and-surfaces.md`](../spec/execution-and-surfaces.md):

- **`SA-EXEC-180`:** the steering session host — the scope owning pending cross-surface continuations, the bounded wait (`SA-EXEC-165`–`167`), the in-flight invocation's undo scope, and the activity surface (`SA-EXEC-200`) — **MUST outlive intra-app navigation between declared surfaces, and its lifetime MUST NOT be scoped to any navigable surface.** A host destroyed and recreated by the navigation `SA-EXEC-164` requires cannot satisfy `SA-EXEC-165`–`173`. This is a *structural precondition* of cross-surface execution, not a presentation choice.
- **`SA-EXEC-181`:** where a platform genuinely cannot preserve the host across a transition (a full document load, a process restart, a platform-imposed teardown), the runtime MUST treat any pending continuation as a cross-surface failure (`SA-EXEC-171`) and preserve completed reversible-prefix undo (`SA-EXEC-173`) — never discard the continuation silently — and such a transition MUST NOT be the ordinary intra-app navigation mechanism for a declared cross-surface path.

`SA-EXEC-247` still hands the framework/router binding and *where* the host mounts to you; `SA-EXEC-180` states the one thing that binding must not do.

**Right — provider (and panel) above the router:**

```tsx
// app/layout.tsx (Next.js App Router) — the root layout is NOT unmounted by
// navigations between route segments below it. The session host lives here.
import { SteerableProvider, useSteerableRuntime } from "@steerable/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const runtime = useSteerableRuntime({ declarations, approvalHook /* … */ });
  return (
    <html>
      <body>
        <SteerableProvider runtime={runtime}>
          {children}          {/* route segments navigate below the provider */}
          <SteeringPanel />    {/* the panel is a sibling of the router outlet, not inside a page */}
        </SteerableProvider>
      </body>
    </html>
  );
}
```

**Wrong — host inside a per-page shell (the four-PR defect):**

```tsx
// app/dashboard/page.tsx — DO NOT DO THIS.
// This provider is unmounted and recreated on every navigation away from /dashboard,
// destroying any pending cross-surface continuation. SA-EXEC-180 forbids scoping the
// host's lifetime to a navigable surface.
export default function DashboardPage() {
  const runtime = useSteerableRuntime({ declarations });
  return (
    <SteerableProvider runtime={runtime}>
      <DashboardShell />
    </SteerableProvider>
  );
}
```

Only route components *below* the host should call `useSurfaceRegistration` to mark their surface live (that hook registers on hydration, before the client's first paint — verify in [`packages/react/src/index.ts`](../../packages/react/src/index.ts)).

**The self-diagnosing assertion.** The React binding fires a development-only `console.error` if the provider is unmounted and remounted with a new runtime *while the live surface set changes* — the exact signature of a host scoped inside the navigable region. Verify `usePanelLifetimeAssertion` and the `PANEL_LIFETIME_MESSAGE` in [`packages/react/src/index.ts`](../../packages/react/src/index.ts): it distinguishes this defect from benign remounts (StrictMode double-invoke, full reload, non-surface-change remounts) and is compiled out of production builds. It cites `SA-EXEC-247` (the umbrella that carries the `SA-EXEC-180`/`181` lifetime invariant). If you see that error in your dev console, your host is mounted below the router — hoist it. Framework note: in Next.js App Router, "above the router" means the root `app/layout.tsx`; segment layouts *do* remount across sibling navigations, so a `layout.tsx` deeper than the shared ancestor of your steerable surfaces is still the wrong place.

---

## 3. Durable Ledger: It Can Now Actually Be Durable

**Precondition to verify:** your steering trail must survive a process restart, or an external consumer (audit, compliance, an ops dashboard) reads it out of band. If neither holds — the trail is genuinely session-scoped and no one reads it after the process ends — the shipped `InMemoryLedger` (verify in [`packages/core/src/ledger.ts`](../../packages/core/src/ledger.ts)) is fully conforming, and you can skip this section. Serverless/multi-instance hosts usually *do* meet the precondition, because a per-process in-memory ledger is empty on the next cold start.

**The defect.** The `ActionLedger` interface used to be **synchronous**. A synchronous contract cannot report the outcome of a write to a remote datastore, so it could not honor `SA-LED-141` for a server-backed ledger: *ledger writes that policy requires before execution MUST report success or failure to the runtime before the affected execution is represented as authorized.* Adopters worked around it by Proxying the registry to slip a barrier in front of execution — fragile, and unable to report its own refusal as a legible outcome.

**The fixes that now exist.** Verify in [`ledger.ts`](../../packages/core/src/ledger.ts), [`execution.ts`](../../packages/core/src/execution.ts), and [`undo.ts`](../../packages/core/src/undo.ts):

1. **The interface is `MaybePromise`.** Every `ActionLedger` method returns `MaybePromise<T>` (verify the `interface ActionLedger` in `ledger.ts`), so one contract serves both an in-memory backend (synchronous returns) and a durable backend (promises whose **settlement is the write's success/failure report**).
2. **The engine awaits every ledger write, and awaiting *is* the durability barrier.** `ExecutionEngine` awaits the invocation record, the policy-decision record, and the approval record *before* the execution they authorize. If a required write rejects, the engine raises a legible `LedgerDurabilityError` (`code: "ledger_write_failed"`) and does **not** authorize the execution (`SA-LED-141`). You do not build the barrier; you make your writes await-able and it holds.
3. **A real pre-execution hook** — `preExecutionHook?: PreExecutionHook` on the engine constructor (verify `PreExecutionHook`/`PreExecutionRequest` in `execution.ts`). It runs immediately before each executor call, receiving `{ recordId, stepId, actionId, params, surfaceId, writes, signal }`. Returning/resolving permits the step; throwing/rejecting means the step MUST NOT run — the engine records it failed with a `pre_execution_barrier_failed` outcome and never swallows the refusal. This is the supported alternative to Proxying the registry: flush a batched durable ledger, confirm an external audit write landed, or re-check host authorization at the last moment.
4. **Undo handles rehydrate from persisted data.** A closure cannot survive a durable ledger's JSON round-trip (`SA-LED-144`), so a handle read back from Postgres arrives as plain `UndoHandleRecord` data. `makeExecutableHandle(handle, { registry, snapshotStore })` reconstructs the executable behavior from the handle's serializable `payload` plus the live runtime binding (verify in `undo.ts`) — `declared_inverse` re-looks-up `action.undo` from the registry; `runtime_snapshot` restores `payload.snapshot`. This is what keeps `SA-LED-070` (executable undo handles) and `SA-LED-144` (durable backends) from being mutually exclusive: a durable-round-tripped handle still undoes.

**Wiring a durable ledger.** Implement `ActionLedger` over your datastore — the shipped `InMemoryLedger` is the reference for the full method set (`createInvocation`, `appendPolicyDecision`, `setApproval`, `appendActionStep`, `attachUndoHandle`, `findAvailableUndoHandles`, undo-attempt and disclosure appenders, `requireRecord`, `getRecords`, `subscribe`). Return promises whose settlement reflects the durable write:

```ts
// steerable/ledger/postgres.ts
import type { ActionLedger, CreateInvocationInput, SteeringInvocationRecord } from "@steerable/core";

export class PostgresLedger implements ActionLedger {
  async createInvocation(input: CreateInvocationInput): Promise<SteeringInvocationRecord> {
    // The returned promise settles only when the row is durably committed. That settlement
    // IS the SA-LED-141 barrier: the engine awaits this before authorizing execution, so a
    // failed INSERT rejects here and the execution is never represented as authorized.
    const record = buildRecord(input);
    await db.invocations.insert(record);
    return record;
  }
  // …the remaining ActionLedger methods, each awaiting its durable write. Handle payloads
  // (params/result/snapshot) are stored as-is so makeExecutableHandle can rehydrate undo later.
}
```

```ts
// Construct the engine with the durable ledger and, if you need a last-moment barrier,
// a pre-execution hook. Both are host-owned; the engine awaits/records around them.
import { ExecutionEngine } from "@steerable/core";

const engine = new ExecutionEngine({
  registry,
  ledger: new PostgresLedger(),
  approvalHook,
  preExecutionHook: async ({ recordId, actionId, writes }) => {
    // e.g. flush a batched writer, or confirm an external audit sink acknowledged.
    // Throw to refuse: the engine records `pre_execution_barrier_failed` and stops the chain.
    await auditSink.confirm(recordId);
  },
});
```

Self-check: `SA-LED-141` (pre-execution write barrier), `SA-LED-144` (durable backend contract), `SA-LED-070`/`073` (executable, serializable undo handles), `SA-LED-146` and `SA-CONF-068`. Note also that undo handle IDs default to a UUID (`crypto.randomUUID`) rather than a process-local counter, so a multi-instance durable store does not collide re-minted IDs after a cold start (verify `defaultUndoHandleId` in `undo.ts`, `SA-LED-146`).

---

## 4. Facts Seeding For Prop-Driven State

**Precondition to verify:** your facts are known at render time and arrive as **props** (from a route loader, a server component, `getServerSideProps`-style data), rather than living in a client store the declared producer can query at turn time. If a live queryable store holds them, keep the pull model; this section is for the prop-driven case.

**The defect.** The SPA example's facts publishers are pull-model: `() => publish()` in an effect, asking a live client-side store for values on mount. On a server-rendered route, the data arrives as props — the route *renders* with the values already in hand and the producer has nothing to read yet. Worse, the binding did `void publish()`, which swallowed the producer's rejection, so a not-yet-seeded producer became an **unhandled rejection on every page load** and the agent, with no store to pull from, hardcoded fact literals that then lied about live state.

**The fixes that now exist.** Verify in [`packages/react/src/index.ts`](../../packages/react/src/index.ts) and [`packages/core/src/registry.ts`](../../packages/core/src/registry.ts):

1. **Synchronous seeding** in `usePublishedFacts`. Pass `{ seed }` to publish values the render already holds — synchronously, during render, before paint, with no async round trip that can race or throw. Supplying `seed` turns automatic pulling off (unless `autoPublish` overrides). The store keeps value identity for shallow-equal writes, so re-rendering does not churn the snapshot. A steering turn dispatched during hydration reads the values the route already knew.
2. **`void publish()` is gone.** The automatic publish now handles its rejection — surfacing through `error`, through an `onError` callback, and (in development) through a console report that tells you to switch to `{ seed }` if the values arrive as props. It never escapes as an unhandled rejection.
3. **`registry.publishFacts(id)` validates published values.** `SA-CTX-024`: every published fact value MUST parse against its declared schema; `SA-CTX-023`: every published top-level key MUST be one the declaration enumerates. A publisher can no longer emit a fact that lies about its type or mints an undeclared key — validation throws a legible `RegistryCompileError`. Verify `publishFacts` and `validatePublishedFacts` in `registry.ts`.

**Seed facts known at render time instead of racing an async pull:**

```tsx
// A route/page that already has its data as props — publish synchronously.
import { usePublishedFacts, useSurfaceRegistration } from "@steerable/react";

export function CaseView({ caseData }: { caseData: CaseProps }) {
  useSurfaceRegistration("case_detail"); // mark this surface live (below the session host)

  // Push model: publish what the render already holds. No effect, no pull, no race.
  // Values are validated against the facts declaration's schema (SA-CTX-023/024).
  usePublishedFacts("case_detail.current_facts", {
    seed: {
      case_id: caseData.id,
      status: caseData.status,
      assignee: caseData.assignee,
    },
  });

  return /* … */;
}
```

Keep facts curated and bounded (`SA-DECL-070`–`078`) — seeding does not change what belongs in facts vs. a read tool; large, parameterized, or sparse data still belongs in a read tool. Self-check: `SA-CTX-023`/`024` (published-value integrity), `SA-DECL-071`–`078`.

---

## 5. Where The Chat Turn Runs — The Two Seams

**Precondition to verify:** this applies to every server retrofit — it is the portability core, not an optional module.

The protocol ships everything downstream of a validated `{actionId, params}` and nothing upstream: the model call is yours. `SA-EXEC-015`/`016` (verify in [`docs/spec/execution-and-surfaces.md`](../spec/execution-and-surfaces.md); the framework/developer split is `SA-EXEC-251`) name the two seams and make the ledger-bypass **non-conforming**:

- **The policy-preview seam** (`SA-EXEC-015`): a synchronous, ecosystem-facing policy resolution — `adapter.canUseTool`, or a `needsApproval`/`toolApproval` predicate — that returns an advisory `allow` / `needs-approval` / `deny` and **consults no ledger**. It is advice, never authorization.
- **The execution seam** (`SA-EXEC-015`/`016`): the validating, gating, and **ledgered** pipeline — `ExecutionEngine`, satisfying `SA-EXEC-001`–`012` and recording under `SA-LED-002`. `SA-EXEC-016` forbids a preview-seam decision being the *terminal record* of a proposal's use: an `allow` MUST still be dispatched through the engine so the attempt and result are recorded, and a `deny`/`needs-approval` that stops at the preview seam leaves that disposition unledgered (contrary to `SA-LED-002`, `SA-POL-109`).

**The adapter → engine wiring is authoritative in [ecosystem-adapters.md](./ecosystem-adapters.md)** — read it; this guide does not duplicate it. The one thing that guide's worked composition assumes and a server must supply explicitly is *where each piece runs*:

```ts
//  ── server: your model loop (adopter-owned, upstream of the proposal) ──
//  A Next.js server action or route handler. The live model call, prompt assembly,
//  history, and router all live here (SA-CORE-094, SA-EXEC-035). This is PSEUDOCODE
//  for the adopter-owned half — the provider call is yours to build:
async function chatTurn(userUtterance: string, session: Session) {
  const availability = availabilityForRequest(session);         // §1: per-request view
  const context = { surfaceId: session.currentSurface, availability };

  // 1) Call the model with adapter.toolSchemas wired into your provider.  ← YOUR CODE
  const proposedToolCall = await callAnthropic(userUtterance, adapter.toolSchemas /* … */);

  // 2) Policy-preview seam (SA-EXEC-015) — advisory, no ledger. Optional; consult it only
  //    if your provider loop needs a synchronous pre-answer before the tool call resolves.
  const decision = adapter.canUseTool({
    toolName: proposedToolCall.name,
    params: proposedToolCall.input,
    context,
  });
  if (decision.status === "deny") {
    // Still record the refusal on the execution path rather than letting the preview
    // decision be the proposal's only trace (SA-EXEC-016). See ecosystem-adapters.md.
  }

  // 3) Execution seam (SA-EXEC-016) — the SAME registry, ledgered. decision.toolName is the
  //    canonical dotted declaration ID; decision.params is already parsed.
  const result = await engine.executeAction({
    intent: userUtterance,          // kept in the trail (SA-LED-002)
    surfaceId: context.surfaceId,
    posture: session.posture,
    actionId: decision.toolName,
    params: decision.params,
    availability,                   // §1 again — same per-request view
  });
  return result.record;             // the SteeringInvocationRecord, in the ledger
}
```

**The single consent point.** Two callbacks can each say "needs approval": the adapter's `toolApproval` predicate and the engine's `ApprovalHook`. They are **not two prompts.** The engine's `ApprovalHook` is the one consent point — it re-resolves policy on dispatch and raises its own gate for `Gated suffix`, `Plan preview`, and `Step-gated`. The adapter's synchronous predicate exists only for hosts whose provider loop demands a pre-answer; such a host wires its `ApprovalHook` to present or consume that same ecosystem approval, so one scope is never gated twice. On a server this matters concretely: your `ApprovalHook` is where a gated action pauses the turn to collect the user's confirmation (a round-trip to the client), and it must be the *only* place that does so. See [ecosystem-adapters.md](./ecosystem-adapters.md) ("Double gating: one consent point") for the full pattern and the tested `composition.test.ts` that runs a mock tool call through `canUseTool` and then `engine.executeAction` and asserts the ledger holds the record.

The lesson for portability: the model call is a request-scoped server concern; the registry and engine are compiled-once module concerns; the ledger and approval are durable, cross-request concerns. A server retrofit is mostly the work of putting each of those in the right execution context and wiring the seams between them — which is exactly what the SPA example never had to think about, because in a single client process they all share one lifetime.

---

## 6. Provider Wire Contract (Short — The Adapter Guide Is Authority)

**Precondition to verify:** your model call goes to a provider (Anthropic, OpenAI, Gemini, …) whose tool-name grammar or parameter model differs from the canonical declaration contract. This applies to essentially every live-model retrofit.

Two provider realities bite here, and both are handled at the adapter layer — [ecosystem-adapters.md](./ecosystem-adapters.md) is the authority; this section only tells you they exist so you do not rediscover them the hard way:

- **Dotted capability IDs are not legal Anthropic/OpenAI tool names.** `SA-DECL-012` mandates dot-separated declaration IDs (e.g. `tracker.create_application`), and Anthropic/OpenAI reject the dot while Gemini permits it. The adapter owns a **reversible wire-name mapping** you select by naming your provider's grammar (`anthropicToolNameProfile`, `openaiToolNameProfile`, `geminiToolNameProfile`, `canonicalToolNameProfile`). The mapping is checked for injectivity against your actual registry at construction (`SA-DECL-096`), so a name collision is a build-time error, not a live 400. Wire names never escape the adapter: `canUseTool` returns the canonical ID and `adapter.toCapabilityId(wireName)` recovers it (`SA-LED-009`).
- **Heterogeneous router params can't be a single strict grammar on Anthropic/OpenAI.** The registry's strict per-action parser stays authoritative **at dispatch** — model output is an untrusted proposal until it validates against the declaration, availability, and policy (`SA-DECL-032`) — so provider schemas never replace strict validation. The portable JSON-Schema subset the adapter compiles (`compileSchema`) is documented in the adapter guide's "Steerable JSON Schema Profile" section.

Do not re-implement either mapping in your server code; construct one `createEcosystemAdapter(registry, "<host>", { toolNames: <profile> })` and let it reconcile the grammars. Everything else — the profile table, the injectivity rule, and how heterogeneous router params stay validated at dispatch — lives in [ecosystem-adapters.md](./ecosystem-adapters.md).

---

## Where To Go Next

- Discovery, fit, inventory, and the minimal-first sequence: [retrofit-existing-app.md](./retrofit-existing-app.md).
- The adapter → engine composition, tool-name profiles, and the JSON-Schema profile: [ecosystem-adapters.md](./ecosystem-adapters.md).
- Posture selection for your archetype: [policy-templates.md](./policy-templates.md).
- Greenfield feature shape when a server surface needs a small missing seam: [designing-agent-responsive-features.md](./designing-agent-responsive-features.md).
- The conformance self-check for your exposed scope: [../spec/conformance-checklist.md](../spec/conformance-checklist.md).

When you claim conformance for a server retrofit, run the checklist item-by-item for the exposed scope exactly as [retrofit-existing-app.md](./retrofit-existing-app.md#phase-5-minimal-conformance-claim-check) directs; this guide changes *where* the pieces run, not *which* checks apply.
