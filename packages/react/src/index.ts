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
  useRef,
  useSyncExternalStore,
  useState,
  type DependencyList,
  type ReactNode,
} from "react";

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

/** React-facing registry, execution, undo, ledger, and subscription facade. Implements SA-EXEC-001–012. */
export interface SteerableRuntime {
  readonly registry: CapabilityRegistry;
  readonly ledger: ActionLedger;
  readonly engine: ExecutionEngine;
  executeChain(request: ExecuteChainRequest): ChainExecutionRun;
  executeAction(request: ExecuteActionRequest): ChainExecutionRun;
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
  const refreshRecords = () => {
    ledger.getRecords().forEach((record) => records.set(record.recordId, record));
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
  const track = (run: ChainExecutionRun) => {
    records.set(run.recordId, run.getRecord());
    refreshRecords();
    emit();
    void run.done.finally(() => {
      records.set(run.recordId, run.getRecord());
      refreshRecords();
      emit();
    });
    return run;
  };

  refreshRecords();
  snapshot = { records: Array.from(records.values()), pendingApproval };
  ledger.subscribe(() => {
    refreshRecords();
    emit();
  });
  return {
    registry,
    ledger,
    engine,
    executeChain: (request) => track(engine.executeChain(request)),
    executeAction: (request) =>
      track(
        engine.executeChain({
          ...request,
          steps: [
            {
              actionId: request.actionId,
              params: request.params,
              targetSurfaceId: request.targetSurfaceId,
              surfaceTimeoutMs: request.surfaceTimeoutMs,
            },
          ],
        }),
      ),
    undoAll: async (run) => {
      await run.undoAll();
      records.set(run.recordId, run.getRecord());
      refreshRecords();
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
}

const SteerableContext = createContext<SteerableRuntime | null>(null);

/** Provides one Steerable runtime to descendant hooks. Implements SA-EXEC-178. */
export function SteerableProvider({
  runtime,
  children,
}: {
  runtime: SteerableRuntime;
  children: ReactNode;
}) {
  return createElement(SteerableContext.Provider, { value: runtime }, children);
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
 * Registers a declared surface while its React route is mounted and deregisters on unmount.
 * Implements SA-DECL-084–086 and SA-EXEC-162.
 */
export function useSurfaceRegistration(surfaceId: string): void {
  const { registry } = useSteerable();
  useEffect(() => {
    registry.registerSurface(surfaceId);
    return () => registry.deregisterSurface(surfaceId);
  }, [registry, surfaceId]);
}

/** Current values and an explicit publisher for one declared facts source. Implements SA-DECL-070–078. */
export interface PublishedFacts {
  values: Record<string, unknown> | undefined;
  publish(): Promise<Record<string, unknown>>;
}

/**
 * Publishes a declared, bounded facts source on mount and when dependencies change.
 * Implements SA-DECL-071–078.
 */
export function usePublishedFacts(
  factsId: string,
  dependencies: DependencyList = [],
): PublishedFacts {
  const { registry } = useSteerable();
  const facts = registry.getFacts(factsId);
  if (!facts) throw new Error(`Unknown facts declaration "${factsId}".`);
  const [values, setValues] = useState<Record<string, unknown> | undefined>();
  const publish = useCallback(async () => {
    const next = await facts.publish();
    setValues(next);
    return next;
  }, [facts]);
  useEffect(() => {
    void publish();
  }, [publish, ...dependencies]);
  return { values, publish };
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
