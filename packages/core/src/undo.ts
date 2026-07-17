import type {
  ActionExecutionContext,
  AnyCompiledActionDeclaration,
  MaybePromise,
  StateKey,
  StateSnapshot,
  StateSnapshotAdapter,
} from "./registry.js";
import type { ActionLedger, UndoHandleRecord, UndoHandleStatus } from "./ledger.js";

/**
 * Executable view of a serializable ledger handle.
 *
 * The `execute` behavior is *derived at undo time from the handle's serializable `payload`*
 * (params/result/snapshot) plus the runtime's registry binding and snapshot store — never from a
 * captured closure. A closure cannot survive a durable ledger's JSON round-trip (SA-LED-144), so a
 * handle read back from server durable storage arrives as plain `UndoHandleRecord` data with no
 * functions; `makeExecutableHandle` reconstructs the executable behavior from that data, which is
 * what keeps SA-LED-070 (executable undo handles) and SA-LED-144 (durable backends) from being
 * mutually exclusive. SA-LED-073 requires the handle to carry exactly this data.
 *
 * Implements SA-LED-070–075 and SA-LED-144.
 */
export interface RuntimeUndoHandle extends UndoHandleRecord {
  execute(context: ActionExecutionContext): MaybePromise<unknown>;
}
/** Aggregate undo outcome with honest reversed and unreversed scope. Implements SA-LED-110–120. */
export interface UndoAllResult {
  status: "succeeded" | "partial" | "failed" | "refused";
  undoneStepIds: string[];
  notUndoneStepIds: string[];
  disclosure?: string;
}
/** Settled result for one trusted undo handle. Implements SA-LED-075–076. */
export interface UndoOneResult {
  handleId: string;
  status: UndoHandleStatus;
  errorSummary?: string;
}
/** In-memory state and its snapshot adapter for tests or session integrations. Implements SA-LED-082–084. */
export interface MemorySnapshotStore {
  adapter: StateSnapshotAdapter;
  read(key: StateKey): unknown;
  write(key: StateKey, value: unknown): void;
  getState(): Record<StateKey, unknown>;
}
/**
 * Collision-free default undo-handle ID.
 *
 * A module-level `let handleSequence = 0` counter (the previous scheme) restarts at 0 on every cold
 * process — so a serverless/multi-instance durable adopter re-mints `undo_handle_1` after a restart,
 * a primary-key collision on a shared store that silently reroutes an undo to the wrong step. A
 * random UUID is unique across processes and instances. `crypto.randomUUID` is a standard global in
 * Node 19+ (this repo is Node 22) and all modern browsers. The readable prefix is retained for logs.
 *
 * Implements SA-LED-070 and SA-LED-146.
 */
const defaultUndoHandleId = (): string => `undo_handle_${crypto.randomUUID()}`;

/**
 * Builds a trusted inverse, snapshot restore, or honest no-undo result.
 *
 * The returned handle's `payload` carries the serializable data a durable ledger persists and later
 * rehydrates through `makeExecutableHandle` (SA-LED-073). `options.idFactory` overrides handle-ID
 * minting so a durable/multi-instance adopter can guarantee cross-process uniqueness; it defaults to
 * a UUID rather than a process-local counter (SA-LED-070).
 *
 * Implements SA-LED-070–077 and SA-LED-080–086.
 */
export function createUndoHandleForAction(
  action: AnyCompiledActionDeclaration,
  input: {
    recordId: string;
    stepId: string;
    params: unknown;
    result?: unknown;
    snapshot?: StateSnapshot;
  },
  options: { idFactory?: () => string } = {},
): RuntimeUndoHandle | { noUndoReason: string } {
  const base = {
    handleId: (options.idFactory ?? defaultUndoHandleId)(),
    recordId: input.recordId,
    stepId: input.stepId,
    actionId: action.id,
    reversibilityKind: action.reversibility.kind,
    eligibilityScope: "step" as const,
    stateKeys: [...action.writes],
  };
  if (action.reversibility.kind === "undoable") {
    if (!action.undo) return { noUndoReason: "undoable_action_missing_declared_inverse" };
    return {
      ...base,
      mechanism: "declared_inverse",
      status: "available",
      restoration: "full",
      payload: clone(input),
      execute: (context) =>
        action.undo?.(
          { params: input.params, result: input.result, snapshot: input.snapshot },
          context,
        ),
    };
  }
  if (action.reversibility.kind === "snapshot") {
    if (!input.snapshot) return { noUndoReason: "snapshot_capture_unavailable" };
    return {
      ...base,
      mechanism: "runtime_snapshot",
      status: "available",
      restoration: "full",
      payload: { snapshot: clone(input.snapshot) },
      execute: (context) => {
        if (!context.snapshotStore)
          throw new Error("Snapshot undo requires a StateSnapshotAdapter.");
        return context.snapshotStore.restore(input.snapshot!);
      },
    };
  }
  return { noUndoReason: "honest_irreversible" };
}

/**
 * Reconstructs the executable undo behavior for a handle from its serializable data — never from a
 * captured closure — so a handle read back from a durable ledger as plain data undoes correctly.
 *
 * Dispatches by recorded `mechanism` using the handle's own `payload` plus the live runtime binding:
 * `declared_inverse` looks up `action.undo` from `context.registry`; `runtime_snapshot` restores
 * `payload.snapshot` through `context.snapshotStore`. When the data is insufficient to run — an
 * unknown mechanism, a missing snapshot payload, or a registry that no longer exposes the action's
 * declared inverse — it returns a legible `{ nonExecutableReason }` so the caller degrades to an
 * honest `unavailable` status rather than a false success. A missing snapshot store is surfaced at
 * execution time (a thrown, recorded failure) rather than here, so the undo attempt is logged.
 *
 * This is the seam that keeps SA-LED-070 (executable undo handles) and SA-LED-144 (durable backends)
 * from being mutually exclusive. Implements SA-LED-070–077 and SA-LED-144.
 */
export function makeExecutableHandle(
  handle: UndoHandleRecord,
  context: Pick<ActionExecutionContext, "registry" | "snapshotStore">,
): RuntimeUndoHandle | { nonExecutableReason: string } {
  const payload = (handle.payload ?? {}) as {
    params?: unknown;
    result?: unknown;
    snapshot?: StateSnapshot;
  };
  switch (handle.mechanism) {
    case "declared_inverse": {
      const action = context.registry.getAction(handle.actionId);
      if (!action?.undo)
        return {
          nonExecutableReason: `Declared inverse for "${handle.actionId}" is unavailable: the action is not bound in this runtime's registry.`,
        };
      const undo = action.undo;
      return {
        ...handle,
        execute: (ctx) =>
          undo({ params: payload.params, result: payload.result, snapshot: payload.snapshot }, ctx),
      };
    }
    case "runtime_snapshot": {
      const snapshot = payload.snapshot;
      if (!snapshot)
        return {
          nonExecutableReason: `Snapshot undo for "${handle.actionId}" is unavailable: the handle payload carries no snapshot.`,
        };
      return {
        ...handle,
        execute: (ctx) => {
          if (!ctx.snapshotStore) throw new Error("Snapshot undo requires a StateSnapshotAdapter.");
          return ctx.snapshotStore.restore(snapshot);
        },
      };
    }
    default:
      return {
        nonExecutableReason: `Undo mechanism "${handle.mechanism}" has no trusted runtime behavior.`,
      };
  }
}

/** Executes and records one available trusted undo handle. Implements SA-LED-071 and SA-LED-075–076. */
export async function runUndoHandle(
  ledger: ActionLedger,
  handle: UndoHandleRecord,
  context: ActionExecutionContext,
): Promise<UndoOneResult> {
  if (handle.status !== "available")
    return {
      handleId: handle.handleId,
      status: handle.status,
      errorSummary: `Undo handle is ${handle.status}.`,
    };
  const executable = makeExecutableHandle(handle, context);
  if ("nonExecutableReason" in executable)
    return {
      handleId: handle.handleId,
      status: "unavailable",
      errorSummary: executable.nonExecutableReason,
    };
  await ledger.updateUndoHandle(handle.recordId, handle.stepId, handle.handleId, {
    status: "attempted",
  });
  try {
    await executable.execute(context);
    await ledger.updateUndoHandle(handle.recordId, handle.stepId, handle.handleId, {
      status: "succeeded",
    });
    await ledger.updateStep(handle.recordId, handle.stepId, {
      status: "undone",
      executionResult: { ok: true, result: "undone" },
    });
    return { handleId: handle.handleId, status: "succeeded" };
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message : String(error);
    await ledger.updateUndoHandle(handle.recordId, handle.stepId, handle.handleId, {
      status: "failed",
    });
    return { handleId: handle.handleId, status: "failed", errorSummary };
  }
}

/**
 * Reverses successful steps in reverse order without silently skipping unavailable handles.
 * Implements SA-LED-110–120.
 */
export async function undoAll(
  ledger: ActionLedger,
  recordId: string,
  context: ActionExecutionContext,
  options: { allowPartial?: boolean } = {},
): Promise<UndoAllResult> {
  const succeeded = (await ledger.requireRecord(recordId)).steps
    .filter((step) => step.status === "succeeded")
    .sort((a, b) => b.order - a.order);
  const available = succeeded.filter(
    (step) => "handleId" in step.undo && step.undo.status === "available",
  );
  const unavailable = succeeded.filter(
    (step) => !("handleId" in step.undo) || step.undo.status !== "available",
  );
  const attempt = await ledger.appendUndoAttempt(recordId, {
    targetHandleIds: available.map((step) => ("handleId" in step.undo ? step.undo.handleId : "")),
    status: "pending",
    perHandleResults: [],
  });
  const results: UndoOneResult[] = [];
  const undone: string[] = [];
  if (unavailable.length > 0 && options.allowPartial === false)
    return settle(
      "refused",
      [],
      unavailable.map((step) => step.stepId),
    );
  for (const step of available) {
    if ("handleId" in step.undo) {
      const result = await runUndoHandle(ledger, step.undo, context);
      results.push(result);
      if (result.status === "succeeded") undone.push(step.stepId);
    }
  }
  const failed = available
    .filter((step) => {
      const handle = step.undo;
      if (!("handleId" in handle)) return false;
      return !results.some(
        (result) => result.handleId === handle.handleId && result.status === "succeeded",
      );
    })
    .map((step) => step.stepId);
  return settle(
    [...unavailable.map((step) => step.stepId), ...failed].length === 0
      ? "succeeded"
      : undone.length
        ? "partial"
        : "failed",
    undone,
    [...unavailable.map((step) => step.stepId), ...failed],
  );

  async function settle(
    status: UndoAllResult["status"],
    undoneStepIds: string[],
    notUndoneStepIds: string[],
  ): Promise<UndoAllResult> {
    const disclosure =
      status === "succeeded"
        ? undefined
        : `Partial undo: reversed ${undoneStepIds.join(", ") || "none"}; ` +
          `not reversed ${notUndoneStepIds.join(", ") || "none"}.`;
    await ledger.updateUndoAttempt(recordId, attempt.undoAttemptId, {
      status,
      settledAt: new Date().toISOString(),
      perHandleResults: results.map((result) => ({
        handleId: result.handleId,
        status: result.status,
        errorSummary: result.errorSummary,
      })),
      disclosure,
    });
    if (disclosure)
      await ledger.appendDisclosure(recordId, {
        kind: "partial_undo",
        message: disclosure,
        stepIds: notUndoneStepIds,
      });
    return { status, undoneStepIds, notUndoneStepIds, disclosure };
  }
}

/**
 * Creates an app-independent snapshot adapter for tests and non-durable sessions.
 * Implements SA-LED-082–084.
 */
export function createMemorySnapshotStore(
  initialState: Record<StateKey, unknown>,
  now: () => Date = () => new Date(),
): MemorySnapshotStore {
  const state = clone(initialState) as Record<StateKey, unknown>;
  return {
    adapter: {
      capture: (keys) => ({
        capturedAt: now().toISOString(),
        keys: [...keys],
        values: Object.fromEntries(keys.map((key) => [key, clone(state[key])])),
      }),
      restore: (snapshot) => {
        snapshot.keys.forEach((key) => {
          state[key] = clone(snapshot.values[key]);
        });
      },
    },
    read: (key) => clone(state[key]),
    write: (key, value) => {
      state[key] = clone(value);
    },
    getState: () => clone(state) as Record<StateKey, unknown>,
  };
}
function clone<T>(value: T): T {
  return value === undefined || value === null ? value : (JSON.parse(JSON.stringify(value)) as T);
}
