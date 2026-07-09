import type { AutonomyMode, PolicyDecision, PolicyRationale } from "./policy.js";
import type { ReversibilityKind, StateKey } from "./registry.js";

export type StepStatus = "proposed" | "held" | "running" | "succeeded" | "failed" | "skipped" | "undone" | "canceled";
export type ApprovalStatus = "not-required" | "pending" | "approved" | "declined" | "expired" | "canceled";
export type UndoHandleStatus = "available" | "unavailable" | "expired" | "attempted" | "succeeded" | "failed" | "superseded";
export type UndoMechanism = "declared_inverse" | "runtime_snapshot" | "compensating_action" | "soft_delete_window" | "honest_irreversible";

export interface UndoHandleRecord {
  handleId: string; recordId: string; stepId: string; actionId: string;
  reversibilityKind: ReversibilityKind; mechanism: UndoMechanism; status: UndoHandleStatus;
  eligibilityScope: "step" | "chain"; restoration: "full" | "partial" | "compensation" | "none";
  stateKeys: StateKey[]; expiresAt?: string; invalidationReason?: string; payload?: unknown;
}

export interface ActionStepRecord {
  stepId: string; order: number; actionId: string; params: unknown; status: StepStatus; writes: StateKey[];
  undo: UndoHandleRecord | { status: "pending_snapshot_capture" } | { noUndoReason: string };
  executionResult?: { ok: boolean; result?: unknown; errorCode?: string; errorSummary?: string };
  repairOfStepId?: string; observations?: unknown;
}

export interface PolicyDecisionRecord {
  decisionId: string; recordedAt: string; actionIds: string[]; finalMode: AutonomyMode;
  perActionModes: { actionId: string; mode: AutonomyMode }[]; chainLevelMode?: AutonomyMode;
  executedPrefixEndIndex?: number; heldSuffixStartIndex?: number; refusalReason?: string;
  requiredGate?: { mode: AutonomyMode; startIndex: number; actionIds: string[] };
  rationale: PolicyRationale;
}

export interface ApprovalRecord { status: ApprovalStatus; updatedAt: string; gateId?: string; actionIds?: string[]; reason?: string }
export interface DisclosureRecord {
  disclosureId: string;
  kind: "partial_undo" | "no_undo" | "cross_surface_wait" | "cross_surface_continue" | "cross_surface_failure" | "held_suffix" | "redaction" | "degraded_ledger";
  message: string; stepIds?: string[];
}
export interface UndoAttemptRecord {
  undoAttemptId: string; targetHandleIds: string[]; status: "pending" | "succeeded" | "partial" | "failed" | "refused";
  startedAt: string; settledAt?: string; perHandleResults: { handleId: string; status: UndoHandleStatus; errorSummary?: string }[]; disclosure?: string;
}
export interface SteeringInvocationRecord {
  recordId: string; schemaVersion: "steerable-ledger.v0"; order: { sequence: number; recordedAt: string };
  surfaceRef?: string; initiator: { kind: "user" | "system" | "external_agent"; ref?: string };
  intent: { text?: string; redactedText?: string; ref?: string }; policyDecisions: PolicyDecisionRecord[];
  approval: ApprovalRecord; steps: ActionStepRecord[]; disclosures: DisclosureRecord[]; undoAttempts: UndoAttemptRecord[];
}

/** Optional application policy for replacing sensitive values before storage. */
export interface LedgerRedactor {
  redact(value: unknown, context: { kind: "intent" | "params" | "result" | "error" | "observation"; actionId?: string }): unknown;
}
export interface CreateInvocationInput {
  surfaceRef?: string; intent: SteeringInvocationRecord["intent"]; initiator?: SteeringInvocationRecord["initiator"];
  steps: { stepId: string; actionId: string; params: unknown; writes: StateKey[]; sensitive?: boolean }[];
}

/** Storage seam for minimal SA-LED records; backends can be session-memory or durable. */
export interface ActionLedger {
  createInvocation(input: CreateInvocationInput): SteeringInvocationRecord;
  appendPolicyDecision(recordId: string, decision: PolicyDecision): PolicyDecisionRecord;
  setApproval(recordId: string, approval: Omit<ApprovalRecord, "updatedAt">): void;
  updateStep(recordId: string, stepId: string, patch: Partial<Omit<ActionStepRecord, "stepId" | "order" | "actionId">>): ActionStepRecord;
  attachUndoHandle(recordId: string, stepId: string, handle: UndoHandleRecord): void;
  updateUndoHandle(recordId: string, stepId: string, handleId: string, patch: Partial<UndoHandleRecord>): UndoHandleRecord;
  appendDisclosure(recordId: string, disclosure: Omit<DisclosureRecord, "disclosureId">): DisclosureRecord;
  appendUndoAttempt(recordId: string, attempt: Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">): UndoAttemptRecord;
  updateUndoAttempt(recordId: string, undoAttemptId: string, patch: Partial<Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">>): UndoAttemptRecord;
  requireRecord(recordId: string): SteeringInvocationRecord;
  /** Returns the ordered ledger read model for application-owned trail UI. */
  getRecords(): SteeringInvocationRecord[];
  /** Notifies consumers whenever the readable ledger state changes. */
  subscribe(listener: () => void): () => void;
}

/** In-memory, session-scoped implementation of the storage-independent ledger seam. */
export class InMemoryLedger implements ActionLedger {
  private readonly records = new Map<string, SteeringInvocationRecord>();
  private readonly listeners = new Set<() => void>();
  private sequence = 0; private decisionSequence = 0; private disclosureSequence = 0; private undoAttemptSequence = 0;
  constructor(private readonly now: () => Date = () => new Date(), private readonly redactor?: LedgerRedactor) {}

  createInvocation(input: CreateInvocationInput): SteeringInvocationRecord {
    const recordId = `inv_${++this.sequence}`; const recordedAt = this.now().toISOString();
    const record: SteeringInvocationRecord = { recordId, schemaVersion: "steerable-ledger.v0", order: { sequence: this.sequence, recordedAt }, surfaceRef: input.surfaceRef,
      initiator: input.initiator ?? { kind: "user" }, intent: clone(input.intent), policyDecisions: [], approval: { status: "not-required", updatedAt: recordedAt },
      steps: input.steps.map((step, order) => ({ stepId: step.stepId, order, actionId: step.actionId, params: this.store(step.params, "params", step.actionId, step.sensitive), status: "proposed", writes: [...step.writes], undo: { status: "pending_snapshot_capture" } })), disclosures: [], undoAttempts: [] };
    this.records.set(recordId, record); this.emit(); return record;
  }
  appendPolicyDecision(recordId: string, decision: PolicyDecision): PolicyDecisionRecord {
    const policy: PolicyDecisionRecord = { decisionId: `pol_${++this.decisionSequence}`, recordedAt: this.now().toISOString(), actionIds: [...decision.actionIds], finalMode: decision.finalMode,
      perActionModes: decision.perActionModes.map(({ actionId, mode }) => ({ actionId, mode })), chainLevelMode: decision.chainLevelMode, executedPrefixEndIndex: decision.executedPrefixEndIndex, heldSuffixStartIndex: decision.heldSuffixStartIndex, refusalReason: decision.refusalReason,
      requiredGate: decision.requiredGate && { ...decision.requiredGate, actionIds: [...decision.requiredGate.actionIds] }, rationale: clone(decision.rationale) };
    this.requireRecord(recordId).policyDecisions.push(policy); this.emit(); return policy;
  }
  setApproval(recordId: string, approval: Omit<ApprovalRecord, "updatedAt">): void { this.requireRecord(recordId).approval = { ...approval, updatedAt: this.now().toISOString() }; this.emit(); }
  updateStep(recordId: string, stepId: string, patch: Partial<Omit<ActionStepRecord, "stepId" | "order" | "actionId">>): ActionStepRecord { const step = this.step(recordId, stepId); Object.assign(step, clone(patch)); this.emit(); return step; }
  attachUndoHandle(recordId: string, stepId: string, handle: UndoHandleRecord): void { this.step(recordId, stepId).undo = handle; this.emit(); }
  updateUndoHandle(recordId: string, stepId: string, handleId: string, patch: Partial<UndoHandleRecord>): UndoHandleRecord { const step = this.step(recordId, stepId); if (!("handleId" in step.undo) || step.undo.handleId !== handleId) throw new Error(`Unknown undo handle "${handleId}".`); step.undo = { ...step.undo, ...clone(patch) }; this.emit(); return step.undo; }
  expireUndoHandle(handleId: string, reason: string): void { this.updateHandle(handleId, { status: "expired", invalidationReason: reason }); }
  supersedeUndoHandle(handleId: string, reason: string): void { this.updateHandle(handleId, { status: "superseded", invalidationReason: reason }); }
  appendDisclosure(recordId: string, disclosure: Omit<DisclosureRecord, "disclosureId">): DisclosureRecord { const entry = { disclosureId: `disc_${++this.disclosureSequence}`, ...clone(disclosure) }; this.requireRecord(recordId).disclosures.push(entry); this.emit(); return entry; }
  appendUndoAttempt(recordId: string, attempt: Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">): UndoAttemptRecord { const entry = { undoAttemptId: `undo_${++this.undoAttemptSequence}`, startedAt: this.now().toISOString(), ...clone(attempt) }; this.requireRecord(recordId).undoAttempts.push(entry); this.emit(); return entry; }
  updateUndoAttempt(recordId: string, undoAttemptId: string, patch: Partial<Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">>): UndoAttemptRecord { const item = this.requireRecord(recordId).undoAttempts.find((attempt) => attempt.undoAttemptId === undoAttemptId); if (!item) throw new Error(`Unknown undo attempt "${undoAttemptId}".`); Object.assign(item, clone(patch)); this.emit(); return item; }
  getRecord(recordId: string): SteeringInvocationRecord | undefined { return this.records.get(recordId); }
  requireRecord(recordId: string): SteeringInvocationRecord { const record = this.getRecord(recordId); if (!record) throw new Error(`Unknown ledger record "${recordId}".`); return record; }
  getRecords(): SteeringInvocationRecord[] { return [...this.records.values()]; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private step(recordId: string, stepId: string): ActionStepRecord { const step = this.requireRecord(recordId).steps.find((entry) => entry.stepId === stepId); if (!step) throw new Error(`Unknown step "${stepId}".`); return step; }
  private updateHandle(handleId: string, patch: Partial<UndoHandleRecord>): void { const step = this.getRecords().flatMap((record) => record.steps).find((entry) => "handleId" in entry.undo && entry.undo.handleId === handleId); if (!step || !("handleId" in step.undo)) throw new Error(`Unknown undo handle "${handleId}".`); step.undo = { ...step.undo, ...patch }; this.emit(); }
  private emit(): void { this.listeners.forEach((listener) => listener()); }
  private store(value: unknown, kind: "intent" | "params" | "result" | "error" | "observation", actionId?: string, redact = false): unknown { return clone(redact && this.redactor ? this.redactor.redact(value, { kind, actionId }) : value); }
}

export interface LedgerTrace {
  recordId: string; surfaceRef?: string; intent: SteeringInvocationRecord["intent"];
  policy: { finalMode: AutonomyMode; actionIds: string[]; reasonCodes: string[] }[];
  approvalStatus: ApprovalStatus;
  steps: { stepId: string; actionId: string; params: unknown; status: StepStatus; writes: StateKey[]; undoStatus: string; errorCode?: string }[];
  disclosures: DisclosureRecord[];
}

/** Projects serializable ledger records into the canonical evaluator trace shape. */
export function extractLedgerTrace(records: readonly SteeringInvocationRecord[], options: { redactSensitive?: boolean } = {}): LedgerTrace[] {
  return records.map((record) => {
    const sensitiveActionIds = new Set(record.policyDecisions.flatMap((decision) =>
      decision.rationale.declarationMetadata.filter((metadata) => metadata.effects.sensitive).map((metadata) => metadata.actionId),
    ));
    return {
      recordId: record.recordId,
      surfaceRef: record.surfaceRef,
      intent: options.redactSensitive ? redactIntent(record.intent) : clone(record.intent),
      policy: record.policyDecisions.map((decision) => ({ finalMode: decision.finalMode, actionIds: [...decision.actionIds], reasonCodes: [...decision.rationale.reasonCodes] })),
      approvalStatus: record.approval.status,
      steps: record.steps.map((step) => ({
        stepId: step.stepId, actionId: step.actionId,
        params: options.redactSensitive && sensitiveActionIds.has(step.actionId) ? "[redacted]" : clone(step.params),
        status: step.status, writes: [...step.writes],
        undoStatus: "handleId" in step.undo ? step.undo.status : "noUndoReason" in step.undo ? "unavailable" : "pending_snapshot_capture",
        errorCode: step.executionResult?.errorCode,
      })),
      disclosures: clone(record.disclosures),
    };
  });
}

function clone<T>(value: T): T { return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value)) as T; }

function redactIntent(intent: SteeringInvocationRecord["intent"]): SteeringInvocationRecord["intent"] {
  return intent.ref ? { ref: intent.ref } : { redactedText: intent.redactedText ?? (intent.text ? "[redacted]" : undefined) };
}
