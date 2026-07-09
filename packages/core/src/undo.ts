import type { ActionExecutionContext, AnyCompiledActionDeclaration, MaybePromise, StateKey, StateSnapshot, StateSnapshotAdapter } from "./registry.js";
import type { ActionLedger, UndoHandleRecord, UndoHandleStatus } from "./ledger.js";

/** Executable runtime extension of the serializable ledger handle. */
export interface RuntimeUndoHandle extends UndoHandleRecord { execute(context: ActionExecutionContext): MaybePromise<unknown> }
export interface UndoAllResult { status: "succeeded" | "partial" | "failed" | "refused"; undoneStepIds: string[]; notUndoneStepIds: string[]; disclosure?: string }
export interface UndoOneResult { handleId: string; status: UndoHandleStatus; errorSummary?: string }
export interface MemorySnapshotStore { adapter: StateSnapshotAdapter; read(key: StateKey): unknown; write(key: StateKey, value: unknown): void; getState(): Record<StateKey, unknown> }
let handleSequence = 0;

export function createUndoHandleForAction(action: AnyCompiledActionDeclaration, input: { recordId: string; stepId: string; params: unknown; result?: unknown; snapshot?: StateSnapshot }): RuntimeUndoHandle | { noUndoReason: string } {
  const base = { handleId: `undo_handle_${++handleSequence}`, recordId: input.recordId, stepId: input.stepId, actionId: action.id, reversibilityKind: action.reversibility.kind, eligibilityScope: "step" as const, stateKeys: [...action.writes] };
  if (action.reversibility.kind === "undoable") {
    if (!action.undo) return { noUndoReason: "undoable_action_missing_declared_inverse" };
    return { ...base, mechanism: "declared_inverse", status: "available", restoration: "full", payload: clone(input), execute: (context) => action.undo?.({ params: input.params, result: input.result, snapshot: input.snapshot }, context) };
  }
  if (action.reversibility.kind === "snapshot") {
    if (!input.snapshot) return { noUndoReason: "snapshot_capture_unavailable" };
    return { ...base, mechanism: "runtime_snapshot", status: "available", restoration: "full", payload: { snapshot: clone(input.snapshot) }, execute: (context) => { if (!context.snapshotStore) throw new Error("Snapshot undo requires a StateSnapshotAdapter."); return context.snapshotStore.restore(input.snapshot!); } };
  }
  return { noUndoReason: "honest_irreversible" };
}

export async function runUndoHandle(ledger: ActionLedger, handle: UndoHandleRecord, context: ActionExecutionContext): Promise<UndoOneResult> {
  if (!("execute" in handle) || typeof handle.execute !== "function") return { handleId: handle.handleId, status: "unavailable", errorSummary: "Undo handle is not executable in this runtime." };
  if (handle.status !== "available") return { handleId: handle.handleId, status: handle.status, errorSummary: `Undo handle is ${handle.status}.` };
  const runtimeHandle = handle as RuntimeUndoHandle;
  ledger.updateUndoHandle(handle.recordId, handle.stepId, handle.handleId, { status: "attempted" });
  try {
    await runtimeHandle.execute(context);
    ledger.updateUndoHandle(handle.recordId, handle.stepId, handle.handleId, { status: "succeeded" });
    ledger.updateStep(handle.recordId, handle.stepId, { status: "undone", executionResult: { ok: true, result: "undone" } });
    return { handleId: handle.handleId, status: "succeeded" };
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message : String(error);
    ledger.updateUndoHandle(handle.recordId, handle.stepId, handle.handleId, { status: "failed" });
    return { handleId: handle.handleId, status: "failed", errorSummary };
  }
}

/** Reverse every successful step; never silently skips unavailable handles. */
export async function undoAll(ledger: ActionLedger, recordId: string, context: ActionExecutionContext, options: { allowPartial?: boolean } = {}): Promise<UndoAllResult> {
  const succeeded = ledger.requireRecord(recordId).steps.filter((step) => step.status === "succeeded").sort((a, b) => b.order - a.order);
  const available = succeeded.filter((step) => "handleId" in step.undo && step.undo.status === "available");
  const unavailable = succeeded.filter((step) => !("handleId" in step.undo) || step.undo.status !== "available");
  const attempt = ledger.appendUndoAttempt(recordId, { targetHandleIds: available.map((step) => "handleId" in step.undo ? step.undo.handleId : ""), status: "pending", perHandleResults: [] });
  const results: UndoOneResult[] = []; const undone: string[] = [];
  if (unavailable.length > 0 && options.allowPartial === false) return settle("refused", [], unavailable.map((step) => step.stepId));
  for (const step of available) { if ("handleId" in step.undo) { const result = await runUndoHandle(ledger, step.undo, context); results.push(result); if (result.status === "succeeded") undone.push(step.stepId); } }
  const failed = available.filter((step) => {
    const handle = step.undo;
    if (!("handleId" in handle)) return false;
    return !results.some((result) => result.handleId === handle.handleId && result.status === "succeeded");
  }).map((step) => step.stepId);
  return settle([...unavailable.map((step) => step.stepId), ...failed].length === 0 ? "succeeded" : undone.length ? "partial" : "failed", undone, [...unavailable.map((step) => step.stepId), ...failed]);

  function settle(status: UndoAllResult["status"], undoneStepIds: string[], notUndoneStepIds: string[]): UndoAllResult {
    const disclosure = status === "succeeded" ? undefined : `Partial undo: reversed ${undoneStepIds.join(", ") || "none"}; not reversed ${notUndoneStepIds.join(", ") || "none"}.`;
    ledger.updateUndoAttempt(recordId, attempt.undoAttemptId, { status, settledAt: new Date().toISOString(), perHandleResults: results.map((result) => ({ handleId: result.handleId, status: result.status, errorSummary: result.errorSummary })), disclosure });
    if (disclosure) ledger.appendDisclosure(recordId, { kind: "partial_undo", message: disclosure, stepIds: notUndoneStepIds });
    return { status, undoneStepIds, notUndoneStepIds, disclosure };
  }
}

/** Minimal app-independent adapter for tests and non-durable session integrations. */
export function createMemorySnapshotStore(initialState: Record<StateKey, unknown>, now: () => Date = () => new Date()): MemorySnapshotStore {
  const state = clone(initialState) as Record<StateKey, unknown>;
  return { adapter: { capture: (keys) => ({ capturedAt: now().toISOString(), keys: [...keys], values: Object.fromEntries(keys.map((key) => [key, clone(state[key])])) }), restore: (snapshot) => { snapshot.keys.forEach((key) => { state[key] = clone(snapshot.values[key]); }); } }, read: (key) => clone(state[key]), write: (key, value) => { state[key] = clone(value); }, getState: () => clone(state) as Record<StateKey, unknown> };
}
function clone<T>(value: T): T { return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value)) as T; }
