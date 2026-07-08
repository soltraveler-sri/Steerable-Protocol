import type {
  ActionExecutionContext,
  CompiledActionDeclaration,
  MaybePromise,
  StateKey,
  StateSnapshot,
  StateSnapshotAdapter,
} from "./registry";
import type {
  InMemoryLedger,
  UndoHandleRecord,
  UndoHandleStatus,
} from "./ledger";

export interface RuntimeUndoHandle extends UndoHandleRecord {
  execute: (context: ActionExecutionContext) => MaybePromise<unknown>;
}

export interface UndoOneResult {
  handleId: string;
  status: UndoHandleStatus;
  errorSummary?: string;
}

export interface UndoAllResult {
  status: "succeeded" | "partial" | "failed" | "refused";
  undoneStepIds: string[];
  notUndoneStepIds: string[];
  disclosure?: string;
}

export interface MemorySnapshotStore {
  adapter: StateSnapshotAdapter;
  read: (key: StateKey) => unknown;
  write: (key: StateKey, value: unknown) => void;
  getState: () => Record<StateKey, unknown>;
}

let handleSequence = 0;

export function createUndoHandleForAction<Params, Result>(
  action: CompiledActionDeclaration<Params, Result>,
  input: {
    recordId: string;
    stepId: string;
    params: Params;
    result?: Result;
    snapshot?: StateSnapshot;
  },
): RuntimeUndoHandle | { noUndoReason: string } {
  const base = {
    handleId: `undo_handle_${++handleSequence}`,
    recordId: input.recordId,
    stepId: input.stepId,
    actionId: action.id,
    reversibilityKind: action.reversibility.kind,
    eligibilityScope: "step" as const,
    stateKeys: [...action.writes],
  };

  if (action.reversibility.kind === "undoable") {
    if (!action.undo) {
      return { noUndoReason: "undoable_action_missing_declared_inverse" };
    }

    return {
      ...base,
      mechanism: "declared_inverse",
      status: "available",
      restoration: "full",
      payload: {
        params: cloneValue(input.params),
        result: cloneValue(input.result),
        snapshot: cloneValue(input.snapshot),
      },
      execute: (context) =>
        action.undo?.(
          {
            params: input.params,
            result: input.result,
            snapshot: input.snapshot,
          },
          context,
        ),
    };
  }

  if (action.reversibility.kind === "snapshot") {
    const snapshot = input.snapshot;

    if (!snapshot) {
      return { noUndoReason: "snapshot_capture_unavailable" };
    }

    return {
      ...base,
      mechanism: "runtime_snapshot",
      status: "available",
      restoration: "full",
      payload: {
        snapshot: cloneValue(snapshot),
      },
      execute: (context) => {
        if (!context.snapshotStore) {
          throw new Error("Snapshot undo requires a snapshot store.");
        }

        return context.snapshotStore.restore(snapshot);
      },
    };
  }

  return { noUndoReason: "honest_irreversible" };
}

export async function runUndoHandle(
  ledger: InMemoryLedger,
  handle: UndoHandleRecord,
  context: ActionExecutionContext,
): Promise<UndoOneResult> {
  if (!isRuntimeUndoHandle(handle)) {
    return {
      handleId: handle.handleId,
      status: "unavailable",
      errorSummary: "Undo handle is not executable in this runtime.",
    };
  }

  if (handle.status !== "available") {
    return {
      handleId: handle.handleId,
      status: handle.status,
      errorSummary: `Undo handle is ${handle.status}.`,
    };
  }

  ledger.updateUndoHandle(handle.recordId, handle.stepId, handle.handleId, {
    status: "attempted",
  });

  try {
    await handle.execute(context);
    ledger.updateUndoHandle(handle.recordId, handle.stepId, handle.handleId, {
      status: "succeeded",
    });
    ledger.updateStep(handle.recordId, handle.stepId, {
      status: "undone",
      executionResult: {
        ok: true,
        result: "undone",
      },
    });

    return {
      handleId: handle.handleId,
      status: "succeeded",
    };
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message : String(error);

    ledger.updateUndoHandle(handle.recordId, handle.stepId, handle.handleId, {
      status: "failed",
    });

    return {
      handleId: handle.handleId,
      status: "failed",
      errorSummary,
    };
  }
}

export async function undoAll(
  ledger: InMemoryLedger,
  recordId: string,
  context: ActionExecutionContext,
  options: { allowPartial?: boolean } = {},
): Promise<UndoAllResult> {
  const record = ledger.requireRecord(recordId);
  const succeededSteps = record.steps
    .filter((step) => step.status === "succeeded")
    .sort((left, right) => right.order - left.order);
  const availableHandles = succeededSteps.filter(
    (step) => "handleId" in step.undo && step.undo.status === "available",
  );
  const unavailableSteps = succeededSteps.filter(
    (step) => !("handleId" in step.undo) || step.undo.status !== "available",
  );
  const attempt = ledger.appendUndoAttempt(recordId, {
    targetHandleIds: availableHandles.map((step) =>
      "handleId" in step.undo ? step.undo.handleId : "",
    ),
    status: "pending",
    perHandleResults: [],
  });
  const perHandleResults: UndoOneResult[] = [];
  const undoneStepIds: string[] = [];

  if (unavailableSteps.length > 0 && options.allowPartial === false) {
    const disclosure = buildPartialDisclosure([], unavailableSteps.map((step) => step.stepId));

    ledger.updateUndoAttempt(recordId, attempt.undoAttemptId, {
      status: "refused",
      settledAt: new Date().toISOString(),
      disclosure,
    });
    ledger.appendDisclosure(recordId, {
      kind: "partial_undo",
      message: disclosure,
      stepIds: unavailableSteps.map((step) => step.stepId),
    });

    return {
      status: "refused",
      undoneStepIds: [],
      notUndoneStepIds: unavailableSteps.map((step) => step.stepId),
      disclosure,
    };
  }

  for (const step of availableHandles) {
    if (!("handleId" in step.undo)) {
      continue;
    }

    const result = await runUndoHandle(ledger, step.undo, context);
    perHandleResults.push(result);

    if (result.status === "succeeded") {
      undoneStepIds.push(step.stepId);
    }
  }

  const failedHandleStepIds = availableHandles
    .filter((step) => {
      const undo = step.undo;

      if (!("handleId" in undo)) {
        return false;
      }

      return !perHandleResults.some(
        (result) => result.handleId === undo.handleId && result.status === "succeeded",
      );
    })
    .map((step) => step.stepId);
  const notUndoneStepIds = [
    ...unavailableSteps.map((step) => step.stepId),
    ...failedHandleStepIds,
  ];
  const status =
    notUndoneStepIds.length === 0
      ? "succeeded"
      : undoneStepIds.length > 0
        ? "partial"
        : "failed";
  const disclosure =
    status === "partial" || status === "failed"
      ? buildPartialDisclosure(undoneStepIds, notUndoneStepIds)
      : undefined;

  ledger.updateUndoAttempt(recordId, attempt.undoAttemptId, {
    status,
    settledAt: new Date().toISOString(),
    perHandleResults: perHandleResults.map((result) => ({
      handleId: result.handleId,
      status: result.status,
      errorSummary: result.errorSummary,
    })),
    disclosure,
  });

  if (disclosure) {
    ledger.appendDisclosure(recordId, {
      kind: "partial_undo",
      message: disclosure,
      stepIds: notUndoneStepIds,
    });
  }

  return {
    status,
    undoneStepIds,
    notUndoneStepIds,
    disclosure,
  };
}

export function createMemorySnapshotStore(
  initialState: Record<StateKey, unknown>,
  now: () => Date = () => new Date(),
): MemorySnapshotStore {
  const state = cloneValue(initialState) as Record<StateKey, unknown>;

  return {
    adapter: {
      capture(keys) {
        const values = Object.fromEntries(keys.map((key) => [key, cloneValue(state[key])]));

        return {
          capturedAt: now().toISOString(),
          keys: [...keys],
          values,
        };
      },
      restore(snapshot) {
        snapshot.keys.forEach((key) => {
          state[key] = cloneValue(snapshot.values[key]);
        });
      },
    },
    read(key) {
      return cloneValue(state[key]);
    },
    write(key, value) {
      state[key] = cloneValue(value);
    },
    getState() {
      return cloneValue(state) as Record<StateKey, unknown>;
    },
  };
}

function isRuntimeUndoHandle(handle: UndoHandleRecord): handle is RuntimeUndoHandle {
  return typeof (handle as RuntimeUndoHandle).execute === "function";
}

function buildPartialDisclosure(undoneStepIds: string[], notUndoneStepIds: string[]): string {
  return `Partial undo: reversed ${formatStepList(undoneStepIds)}; not reversed ${formatStepList(
    notUndoneStepIds,
  )}.`;
}

function formatStepList(stepIds: string[]): string {
  return stepIds.length > 0 ? stepIds.join(", ") : "none";
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
