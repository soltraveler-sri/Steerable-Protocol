import {
  CapabilityRegistry,
  ExecutionEngine,
  InMemoryLedger,
  type ActionLedger,
  type ApprovalDecision,
  type ApprovalHook,
  type ApprovalRequest,
  type ChainExecutionRun,
  type ExecuteActionRequest,
  type ExecuteChainRequest,
  type RegistryDeclarations,
  type StateSnapshotAdapter,
  type SteeringInvocationRecord,
  type SurfaceReadiness,
} from "@steerable/core";
import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
  type DependencyList,
  type ReactNode,
} from "react";

declare const process: { env?: { NODE_ENV?: string } } | undefined;

/**
 * Reports whether the binding's development-only diagnostics should run.
 * Bundlers replace `process.env.NODE_ENV` at build time, so production builds
 * drop every guarded branch. Implements SA-CONF-029.
 */
function isDevelopment(): boolean {
  return typeof process === "undefined" || process?.env?.NODE_ENV !== "production";
}

/**
 * Reports a ledger refresh failure instead of discarding it.
 * A durable ledger read can reject, and a discarded rejection surfaces as an
 * unhandled rejection with no attribution. Reporting is unconditional: a
 * terminal steering error must stay observable wherever the runtime hosts.
 * Implements SA-EXEC-012 and SA-LED-142.
 */
function reportLedgerRefreshFailure(error: unknown): void {
  console.error("Steerable: reading the ledger for the trail snapshot failed.", error);
}

/**
 * Runs before paint on the client and degrades to a passive effect on the server,
 * where `useLayoutEffect` is a no-op that React warns about.
 *
 * Surface liveness and facts must be readable by the first steering turn, which can be
 * dispatched from any client layout effect or event handler — both of which run before
 * passive effects. Implements SA-DECL-084–086 and SA-EXEC-162.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" && typeof window.document?.createElement === "function"
    ? useLayoutEffect
    : useEffect;

/** Compares two flat facts records by key identity. Implements SA-DECL-071–078. */
function shallowEqualRecords(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key],
  );
}

/** Host configuration for one React-bound Steerable runtime. Implements SA-DECL-090 and SA-EXEC-001–012. */
export interface SteerableRuntimeOptions {
  /** Declarations and trusted executors compiled once into the core registry. */
  declarations: RegistryDeclarations;
  /** App-owned snapshot capture/restore for snapshot undo. */
  snapshotAdapter?: StateSnapshotAdapter;
  /** App-owned approval UI or service. Omit to fail closed. */
  approvalHook?: ApprovalHook;
  /** Optional platform readiness adapter; registry events are the default. */
  surfaceReadiness?: SurfaceReadiness;
  /** Optional durable ledger. The default is an in-memory session ledger. */
  ledger?: ActionLedger;
  now?: () => Date;
}

/** Immutable React snapshot of activity records and the current gate. Implements SA-EXEC-007–012. */
export interface SteerableState {
  records: readonly SteeringInvocationRecord[];
  pendingApproval: ApprovalRequest | null;
}

/**
 * An opaque claim on one facts snapshot, held by exactly one publisher instance.
 *
 * Ownership is what makes publisher teardown safe. React commits a replacing route's
 * render before it runs the outgoing route's cleanup, so an outgoing publisher's cleanup
 * routinely runs *after* the incoming publisher has already claimed the same facts ID.
 * An unconditional clear would erase the incoming snapshot. Implements SA-DECL-071–078.
 */
export type FactsOwner = symbol;

/**
 * Runtime-owned store of the facts each live publisher has published.
 *
 * This is the seam the steering turn reads: it is a plain, synchronous accessor, not React
 * state, so a turn dispatched before paint still sees facts the current route already knows.
 * Every mutation is ownership-scoped so that cleanup can only ever retract what it still owns.
 * Implements SA-DECL-070–078 and SA-CTX-024.
 */
export interface FactsSnapshotStore {
  /** Returns the current snapshot for one facts ID, or undefined when no publisher owns it. */
  get(factsId: string): Record<string, unknown> | undefined;
  /** Returns every currently published facts snapshot, keyed by facts ID. */
  getAll(): Readonly<Record<string, Record<string, unknown>>>;
  /** Publishes values, claims ownership for `owner`, and notifies subscribers. */
  set(factsId: string, values: Record<string, unknown>, owner: FactsOwner): void;
  /**
   * Publishes values without notifying subscribers, for synchronous render-time seeding.
   * Value identity is preserved when the incoming values are shallow-equal to the current
   * snapshot, so a `useSyncExternalStore` reader never sees a fresh snapshot per render.
   */
  seed(factsId: string, values: Record<string, unknown>, owner: FactsOwner): void;
  /**
   * Retracts a snapshot only when `owner` still owns it, and reports whether it did.
   * A stale owner is a no-op: this is the ownership-aware cleanup that keeps an outgoing
   * publisher from destroying an incoming publisher's snapshot.
   */
  clear(factsId: string, owner: FactsOwner): boolean;
  /** Reports whether `owner` currently owns one facts ID. */
  isOwnedBy(factsId: string, owner: FactsOwner): boolean;
  subscribe(listener: () => void): () => void;
}

/** Creates an ownership-aware facts snapshot store. Implements SA-DECL-070–078. */
function createFactsSnapshotStore(): FactsSnapshotStore {
  const values = new Map<string, Record<string, unknown>>();
  const owners = new Map<string, FactsOwner>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  const write = (factsId: string, next: Record<string, unknown>, owner: FactsOwner): boolean => {
    owners.set(factsId, owner);
    if (shallowEqualRecords(values.get(factsId), next)) return false;
    values.set(factsId, next);
    return true;
  };

  return {
    get: (factsId) => values.get(factsId),
    getAll: () => Object.fromEntries(values),
    set: (factsId, next, owner) => {
      if (write(factsId, next, owner)) emit();
    },
    seed: (factsId, next, owner) => {
      write(factsId, next, owner);
    },
    clear: (factsId, owner) => {
      if (owners.get(factsId) !== owner) return false;
      owners.delete(factsId);
      values.delete(factsId);
      emit();
      return true;
    },
    isOwnedBy: (factsId, owner) => owners.get(factsId) === owner,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** React-facing registry, execution, undo, ledger, and subscription facade. Implements SA-EXEC-001–012. */
export interface SteerableRuntime {
  readonly registry: CapabilityRegistry;
  readonly ledger: ActionLedger;
  readonly engine: ExecutionEngine;
  /** Synchronously readable snapshot of every fact the live surfaces have published. */
  readonly facts: FactsSnapshotStore;
  executeChain(request: ExecuteChainRequest): Promise<ChainExecutionRun>;
  executeAction(request: ExecuteActionRequest): Promise<ChainExecutionRun>;
  undoAll(run: ChainExecutionRun): Promise<void>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): SteerableState;
}

/**
 * Creates the framework-neutral core runtime and a small event source for React.
 * State events cover work started through this runtime; external durable-ledger
 * writes require the ledger to be reflected through an application state source.
 * Implements SA-DECL-090–092, SA-EXEC-001–012, and SA-LED-140–145.
 */
export function createSteerableRuntime(options: SteerableRuntimeOptions): SteerableRuntime {
  const registry = new CapabilityRegistry(options.declarations);
  const ledger = options.ledger ?? new InMemoryLedger(options.now);
  const facts = createFactsSnapshotStore();
  const listeners = new Set<() => void>();
  const records = new Map<string, SteeringInvocationRecord>();
  let pendingApproval: ApprovalRequest | null = null;
  let snapshot: SteerableState = { records: [], pendingApproval };

  const emit = () => {
    snapshot = {
      records: Array.from(records.values()).sort(
        (left, right) => right.order.sequence - left.order.sequence,
      ),
      pendingApproval,
    };
    listeners.forEach((listener) => listener());
  };
  const refreshRecords = async () => {
    (await ledger.getRecords()).forEach((record) => records.set(record.recordId, record));
  };
  const approvalHook: ApprovalHook = async (request) => {
    pendingApproval = request;
    emit();
    try {
      return await (options.approvalHook?.(request) ??
        Promise.resolve({ status: "declined", reason: "no_approval_hook_attached" }));
    } finally {
      if (pendingApproval === request) {
        pendingApproval = null;
        emit();
      }
    }
  };
  const engine = new ExecutionEngine({
    registry,
    ledger,
    snapshotStore: options.snapshotAdapter,
    approvalHook,
    surfaceReadiness: options.surfaceReadiness,
    now: options.now,
  });
  const track = async (run: ChainExecutionRun) => {
    records.set(run.recordId, await run.getRecord());
    await refreshRecords();
    emit();
    run.done
      .finally(async () => {
        records.set(run.recordId, await run.getRecord());
        await refreshRecords();
        emit();
      })
      .catch(reportLedgerRefreshFailure);
    return run;
  };

  refreshRecords().then(emit).catch(reportLedgerRefreshFailure);
  snapshot = { records: Array.from(records.values()), pendingApproval };
  ledger.subscribe(() => {
    refreshRecords().then(emit).catch(reportLedgerRefreshFailure);
  });
  const runtime: SteerableRuntime = {
    registry,
    ledger,
    engine,
    facts,
    executeChain: (request) => engine.executeChain(request).then(track),
    executeAction: (request) =>
      engine
        .executeChain({
          ...request,
          steps: [
            {
              actionId: request.actionId,
              params: request.params,
              targetSurfaceId: request.targetSurfaceId,
              surfaceTimeoutMs: request.surfaceTimeoutMs,
            },
          ],
        })
        .then(track),
    undoAll: async (run) => {
      await run.undoAll();
      records.set(run.recordId, await run.getRecord());
      await refreshRecords();
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
  return runtime;
}

const SteerableContext = createContext<SteerableRuntime | null>(null);

/** Renders the sorted live-surface set of one registry as a comparable key. */
function liveSurfaceKey(registry: CapabilityRegistry): string {
  return registry
    .getAllSurfaces()
    .map((surface) => surface.id)
    .filter((id) => registry.isSurfaceLive(id))
    .sort()
    .join(",");
}

/**
 * The provider teardown from the commit currently in progress, if any.
 *
 * Retained for exactly one microtask, which is what makes this check quiet enough to trust.
 * A router replacing a route tears down the outgoing provider and mounts the incoming one in
 * a single synchronous commit, so only a genuine navigation-scoped remount can still see this
 * record. Anything separated by a task — a deliberate teardown and a later re-mount, two
 * unrelated runtimes taking turns in one document — has already dropped it. Module scope is
 * deliberate: a full page reload resets it, so a reload can never look like a remount.
 *
 * The cost is a false negative when a router splits teardown and mount across commits (a
 * Suspense or transition boundary). That is the right way to be wrong: an assertion that
 * cries wolf gets disabled, and then it detects nothing at all.
 * Development-only. Implements SA-EXEC-247.
 */
let providerTeardownThisCommit: {
  token: object;
  runtime: SteerableRuntime;
  surfaceKey: string;
} | null = null;

const PANEL_LIFETIME_MESSAGE =
  "[@steerable/react] The steering session was destroyed by a surface change.\n" +
  "SteerableProvider unmounted and remounted with a new runtime while the live surface set " +
  "changed from [%s] to [%s]. That means the provider is mounted *inside* the navigable " +
  "region, so every navigation discards the runtime, its ledger records, and any in-flight " +
  "chain. Cross-surface continuation (SA-EXEC-247) is impossible by construction in this " +
  "layout, including the bounded wait for a destination surface and preserved-prefix undo.\n" +
  "Fix: hoist SteerableProvider (and the steering panel) above your router, so the session " +
  "host outlives intra-app navigation. Only route components below it should call " +
  "useSurfaceRegistration.\n" +
  "This check is development-only and is compiled out of production builds.";

/**
 * Provides one Steerable runtime to descendant hooks.
 *
 * In development it also asserts the one structural precondition of cross-surface
 * continuation that no other check covers: the steering session host MUST outlive
 * intra-app navigation. Implements SA-EXEC-178 and SA-EXEC-247.
 */
export function SteerableProvider({
  runtime,
  children,
}: {
  runtime: SteerableRuntime;
  children: ReactNode;
}) {
  usePanelLifetimeAssertion(runtime);
  return createElement(SteerableContext.Provider, { value: runtime }, children);
}

/**
 * Reports a provider that is remounted by navigation instead of hosting it.
 *
 * Distinguishing a real defect from the benign remounts React performs is the whole
 * problem, so every arm is deliberate:
 * - **StrictMode double-invoke** re-runs this effect against a *preserved* ref, so the
 *   mount token matches the teardown token and the check is skipped.
 * - **Full page reload** starts with fresh module scope and no teardown record.
 * - **Intentional teardown** never remounts, and a deliberate later remount falls outside
 *   the navigation window.
 * - **A remount that is not a surface change** (same live surfaces) is not this defect.
 * Implements SA-EXEC-247.
 */
function usePanelLifetimeAssertion(runtime: SteerableRuntime): void {
  const tokenRef = useRef<object | null>(null);
  if (tokenRef.current === null) tokenRef.current = {};
  const token = tokenRef.current;
  const surfaceKeyRef = useRef("");

  useIsomorphicLayoutEffect(() => {
    if (!isDevelopment()) return;
    const { registry } = runtime;
    // Child layout effects commit before this one, so route surfaces are already live here.
    const observe = () => {
      const key = liveSurfaceKey(registry);
      if (key !== "") surfaceKeyRef.current = key;
      return key;
    };
    const mountedKey = observe();
    const priorTeardown = providerTeardownThisCommit;
    providerTeardownThisCommit = null;
    if (
      priorTeardown &&
      // A StrictMode remount re-runs this effect against a preserved ref, so a matching
      // token means React simulated the unmount and no session was actually lost.
      priorTeardown.token !== token &&
      // A provider handed the same runtime keeps its session; only a new runtime loses one.
      priorTeardown.runtime !== runtime &&
      // A remount that is not a surface change is some other lifecycle, not this defect.
      priorTeardown.surfaceKey !== "" &&
      mountedKey !== "" &&
      priorTeardown.surfaceKey !== mountedKey
    ) {
      console.error(PANEL_LIFETIME_MESSAGE, priorTeardown.surfaceKey, mountedKey);
    }
    const unsubscribe = registry.subscribe(observe);
    return () => {
      unsubscribe();
      const record = { token, runtime, surfaceKey: surfaceKeyRef.current };
      providerTeardownThisCommit = record;
      queueMicrotask(() => {
        if (providerTeardownThisCommit === record) providerTeardownThisCommit = null;
      });
    };
  }, [runtime, token]);
}

/**
 * Compiles declarations once for a provider owned by this React tree.
 * Implements SA-DECL-090–096.
 */
export function useSteerableRuntime(options: SteerableRuntimeOptions): SteerableRuntime {
  const runtimeRef = useRef<SteerableRuntime | null>(null);
  if (!runtimeRef.current) runtimeRef.current = createSteerableRuntime(options);
  return runtimeRef.current;
}

/** Returns the nearest provided runtime or fails outside a provider. Implements SA-EXEC-178. */
export function useSteerable(): SteerableRuntime {
  const runtime = useContext(SteerableContext);
  if (!runtime) throw new Error("Steerable hooks must be used inside SteerableProvider.");
  return runtime;
}

/**
 * Mount counts per registry, so concurrent mounts of one surface do not deregister each other.
 *
 * `CapabilityRegistry` models liveness as a set, which is the right contract for a host that
 * knows its own surfaces. React does not: a surface is routinely rendered by more than one
 * component at once (a shell and its route, a transition mounting the next route before the
 * previous unmounts), and the *last* of them to unmount is the one that ends liveness.
 * Keyed by registry rather than module-global so concurrent runtimes stay isolated.
 * Implements SA-DECL-084–086.
 */
const surfaceMountCounts = new WeakMap<CapabilityRegistry, Map<string, number>>();

/** Claims one mount of a surface, registering it on the first claim. Implements SA-DECL-084–086. */
function acquireSurface(registry: CapabilityRegistry, surfaceId: string): void {
  let counts = surfaceMountCounts.get(registry);
  if (!counts) surfaceMountCounts.set(registry, (counts = new Map()));
  const next = (counts.get(surfaceId) ?? 0) + 1;
  counts.set(surfaceId, next);
  if (next === 1) registry.registerSurface(surfaceId);
}

/** Releases one mount of a surface, deregistering it only on the last release. Implements SA-DECL-084–086. */
function releaseSurface(registry: CapabilityRegistry, surfaceId: string): void {
  const counts = surfaceMountCounts.get(registry);
  const next = (counts?.get(surfaceId) ?? 0) - 1;
  if (!counts || next < 0) return;
  if (next === 0) {
    counts.delete(surfaceId);
    registry.deregisterSurface(surfaceId);
    return;
  }
  counts.set(surfaceId, next);
}

/**
 * Registers a declared surface while its React route is mounted and deregisters on unmount.
 *
 * Registration commits before paint, not after it. A passive effect would leave every surface
 * dark until after the first paint, so the first steering turn of a session — dispatched from
 * a layout effect or from the user's first interaction, both of which precede passive effects —
 * would resolve against an empty registry and refuse with `action_unavailable`. Registration is
 * also mount-counted, so overlapping mounts of one surface do not deregister each other.
 *
 * Nothing registers during server rendering, by design: surface liveness is per-client mutable
 * state on a shared registry, so a server render must not publish it. Server-rendered hosts
 * register on hydration, still before the client's first paint.
 * Implements SA-DECL-084–086 and SA-EXEC-162.
 */
export function useSurfaceRegistration(surfaceId: string): void {
  const { registry } = useSteerable();
  useIsomorphicLayoutEffect(() => {
    acquireSurface(registry, surfaceId);
    return () => releaseSurface(registry, surfaceId);
  }, [registry, surfaceId]);
}

/** Current values, the last publish failure, and an explicit publisher. Implements SA-DECL-070–078. */
export interface PublishedFacts {
  values: Record<string, unknown> | undefined;
  /** The last automatic-publish failure, or undefined once a publish succeeds. */
  error: unknown;
  publish(): Promise<Record<string, unknown>>;
}

/** Options for one facts publisher. Implements SA-DECL-071–078. */
export interface UsePublishedFactsOptions {
  /**
   * Values already known at render time, published synchronously.
   *
   * The pull model — call the declared producer from an effect and wait — assumes the
   * producer already holds the data. That holds for a client-side store and fails for
   * prop-driven state, where the route renders with the values in hand and the producer
   * has nothing to read yet. Seeding publishes what the render already knows, before paint
   * and without an async round trip that can race or throw. Supplying `seed` turns
   * automatic pulling off unless `autoPublish` says otherwise.
   */
  seed?: Record<string, unknown>;
  /** Republish triggers for pull mode, matching the effect dependency contract. */
  deps?: DependencyList;
  /** Receives automatic-publish failures. Without it, failures are reported to the console in development. */
  onError?: (error: unknown) => void;
  /** Overrides whether the declared producer is pulled on mount. Defaults to true unless `seed` is supplied. */
  autoPublish?: boolean;
}

/** Distinguishes the legacy dependency-list argument from the options object. */
function isDependencyList(
  value: DependencyList | UsePublishedFactsOptions,
): value is DependencyList {
  return Array.isArray(value);
}

export function usePublishedFacts(factsId: string, dependencies?: DependencyList): PublishedFacts;
export function usePublishedFacts(
  factsId: string,
  options: UsePublishedFactsOptions,
): PublishedFacts;
/**
 * Publishes a declared, bounded facts source into the runtime's facts store.
 *
 * Two publication models are supported, because one does not cover both shapes of app.
 * *Pull* asks the declared producer for values on mount and on dependency change; it suits
 * a live client-side store. *Push* (`seed`) publishes values the render already holds; it
 * suits prop-driven and server-rendered state.
 *
 * Automatic publishes never escape as unhandled rejections: a failing producer surfaces
 * through `error`, through `onError`, and through a development console report. An explicit
 * `publish()` still rejects so callers can await it. Teardown retracts this publisher's
 * snapshot only while it still owns it. Implements SA-DECL-071–078.
 */
export function usePublishedFacts(
  factsId: string,
  optionsOrDependencies: DependencyList | UsePublishedFactsOptions = [],
): PublishedFacts {
  const runtime = useSteerable();
  const { registry, facts: store } = runtime;
  const declaration = registry.getFacts(factsId);
  if (!declaration) throw new Error(`Unknown facts declaration "${factsId}".`);

  const options: UsePublishedFactsOptions = isDependencyList(optionsOrDependencies)
    ? { deps: optionsOrDependencies }
    : optionsOrDependencies;
  const { seed, onError } = options;
  const dependencies = options.deps ?? [];
  const autoPublish = options.autoPublish ?? seed === undefined;

  const ownerRef = useRef<FactsOwner | null>(null);
  if (ownerRef.current === null) ownerRef.current = Symbol(`facts:${factsId}`);
  const owner = ownerRef.current;

  // Synchronous seeding: claim the snapshot during render so a steering turn dispatched
  // before this component's effects — including one dispatched during hydration — reads
  // the values this route already knows. The store keeps value identity for shallow-equal
  // writes, so re-rendering does not churn the snapshot read below.
  if (seed !== undefined) store.seed(factsId, seed, owner);

  const values = useSyncExternalStore(
    store.subscribe,
    () => store.get(factsId),
    () => store.get(factsId),
  );

  const errorRef = useRef<unknown>(undefined);
  const [, forceRender] = useReducer((count: number) => count + 1, 0);
  const setError = useCallback(
    (error: unknown) => {
      if (errorRef.current === error) return;
      errorRef.current = error;
      forceRender();
    },
    [forceRender],
  );

  const publish = useCallback(async () => {
    const next = await declaration.publish();
    store.set(factsId, next, owner);
    setError(undefined);
    return next;
  }, [declaration, store, factsId, owner, setError]);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const stableSeed = useShallowStable(seed);

  useIsomorphicLayoutEffect(() => {
    if (!autoPublish) return;
    let canceled = false;
    // The rejection is handled here rather than discarded: `void publish()` turned every
    // producer that is not yet seeded into an unhandled rejection on page load.
    publish().catch((error: unknown) => {
      if (canceled) return;
      setError(error);
      if (onErrorRef.current) {
        onErrorRef.current(error);
        return;
      }
      if (isDevelopment()) {
        console.error(
          `[@steerable/react] Publishing facts "${factsId}" failed. The declared producer ` +
            `rejected, so no snapshot is published and any steering turn will read this ` +
            `surface as contextless. If these values arrive as props rather than from a ` +
            `store the producer can read, publish them synchronously with ` +
            `usePublishedFacts("${factsId}", { seed }) instead of pulling. Pass onError to ` +
            `handle this yourself.`,
          error,
        );
      }
    });
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- host-declared republish triggers
  }, [publish, autoPublish, factsId, setError, ...dependencies]);

  // Republish the seed on commit so subscribers observe it, and retract it on teardown —
  // but only while this publisher still owns it. React commits a replacing route's render
  // before the outgoing route's cleanup, so by the time this cleanup runs the incoming
  // publisher may already own this facts ID; clearing unconditionally would erase it.
  useIsomorphicLayoutEffect(() => {
    if (stableSeed !== undefined) store.set(factsId, stableSeed, owner);
    return () => {
      store.clear(factsId, owner);
    };
  }, [store, factsId, owner, stableSeed]);

  return { values, error: errorRef.current, publish };
}

/** Returns a reference that changes only when a facts record's contents change. */
function useShallowStable(
  record: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const ref = useRef<Record<string, unknown> | undefined>(undefined);
  if (!shallowEqualRecords(ref.current, record)) ref.current = record;
  return ref.current;
}

/**
 * Subscribes to tracked execution records and pending approvals without polling.
 * Implements SA-EXEC-007–012 and SA-LED-140.
 */
export function useSteeringState(): SteerableState {
  const runtime = useSteerable();
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
}

/**
 * Keeps a host approval callback current while preserving stable hook identity.
 * Implements SA-EXEC-092–096 and SA-EXEC-130–136.
 */
export function useApprovalHook(handler: ApprovalHook): ApprovalHook {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  return useCallback(
    (request: ApprovalRequest): Promise<ApprovalDecision> => handlerRef.current(request),
    [],
  );
}
