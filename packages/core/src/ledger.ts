import type { AutonomyMode, PolicyDecision, PolicyRationale } from "./policy.js";
import type { MaybePromise, ReversibilityKind, StateKey } from "./registry.js";

/** Stable action-step lifecycle vocabulary. Implements SA-LED-030. */
export type StepStatus =
  "proposed" | "held" | "running" | "succeeded" | "failed" | "skipped" | "undone" | "canceled";
/** Stable approval lifecycle vocabulary. Implements SA-LED-036. */
export type ApprovalStatus =
  "not-required" | "pending" | "approved" | "declined" | "expired" | "canceled";
/** Stable undo-handle lifecycle vocabulary. Implements SA-LED-075. */
export type UndoHandleStatus =
  "available" | "unavailable" | "expired" | "attempted" | "succeeded" | "failed" | "superseded";
/** Trusted undo and recovery mechanism vocabulary. Implements SA-LED-090–100. */
export type UndoMechanism =
  | "declared_inverse"
  | "runtime_snapshot"
  | "compensating_action"
  | "soft_delete_window"
  | "honest_irreversible";

/** Serializable trusted undo capability and its lifecycle state. Implements SA-LED-070–075. */
export interface UndoHandleRecord {
  handleId: string;
  recordId: string;
  stepId: string;
  actionId: string;
  reversibilityKind: ReversibilityKind;
  mechanism: UndoMechanism;
  status: UndoHandleStatus;
  eligibilityScope: "step" | "chain";
  restoration: "full" | "partial" | "compensation" | "none";
  stateKeys: StateKey[];
  expiresAt?: string;
  invalidationReason?: string;
  payload?: unknown;
}

/** Ordered action attempt within a steering invocation. Implements SA-LED-027–034. */
export interface ActionStepRecord {
  stepId: string;
  order: number;
  actionId: string;
  params: unknown;
  status: StepStatus;
  writes: StateKey[];
  undo: UndoHandleRecord | { status: "pending_snapshot_capture" } | { noUndoReason: string };
  executionResult?: { ok: boolean; result?: unknown; errorCode?: string; errorSummary?: string };
  repairOfStepId?: string;
  observations?: unknown;
}

/** Recorded, immutable policy outcome and rationale. Implements SA-LED-050–055. */
export interface PolicyDecisionRecord {
  decisionId: string;
  recordedAt: string;
  actionIds: string[];
  finalMode: AutonomyMode;
  perActionModes: { actionId: string; mode: AutonomyMode }[];
  chainLevelMode?: AutonomyMode;
  executedPrefixEndIndex?: number;
  heldSuffixStartIndex?: number;
  refusalReason?: string;
  requiredGate?: { mode: AutonomyMode; startIndex: number; actionIds: string[] };
  rationale: PolicyRationale;
}

/** Recorded approval lifecycle for an invocation. Implements SA-LED-036. */
export interface ApprovalRecord {
  status: ApprovalStatus;
  updatedAt: string;
  gateId?: string;
  actionIds?: string[];
  reason?: string;
}
/** User-relevant limitation attached to an invocation. Implements SA-LED-037. */
export interface DisclosureRecord {
  disclosureId: string;
  kind:
    | "partial_undo"
    | "no_undo"
    | "cross_surface_wait"
    | "cross_surface_continue"
    | "cross_surface_failure"
    | "held_suffix"
    | "redaction"
    | "degraded_ledger";
  message: string;
  stepIds?: string[];
}
/** Recorded aggregate or per-handle undo attempt. Implements SA-LED-076 and SA-LED-110–120. */
export interface UndoAttemptRecord {
  undoAttemptId: string;
  targetHandleIds: string[];
  status: "pending" | "succeeded" | "partial" | "failed" | "refused";
  startedAt: string;
  settledAt?: string;
  perHandleResults: { handleId: string; status: UndoHandleStatus; errorSummary?: string }[];
  disclosure?: string;
}
/** Minimal ordered steering invocation record. Implements SA-LED-020–039. */
export interface SteeringInvocationRecord {
  recordId: string;
  schemaVersion: "steerable-ledger.v0";
  order: { sequence: number; recordedAt: string };
  surfaceRef?: string;
  initiator: { kind: "user" | "system" | "external_agent"; ref?: string };
  intent: { text?: string; redactedText?: string; ref?: string };
  policyDecisions: PolicyDecisionRecord[];
  approval: ApprovalRecord;
  steps: ActionStepRecord[];
  disclosures: DisclosureRecord[];
  undoAttempts: UndoAttemptRecord[];
}

/** Optional host policy for replacing sensitive values before storage. Implements SA-LED-130–134. */
export interface LedgerRedactor {
  redact(
    value: unknown,
    context: { kind: "intent" | "params" | "result" | "error" | "observation"; actionId?: string },
  ): unknown;
}
/** Inputs required to open a minimal invocation record. Implements SA-LED-020–039. */
export interface CreateInvocationInput {
  surfaceRef?: string;
  intent: SteeringInvocationRecord["intent"];
  initiator?: SteeringInvocationRecord["initiator"];
  steps: {
    stepId: string;
    actionId: string;
    params: unknown;
    writes: StateKey[];
    sensitive?: boolean;
  }[];
}

/**
 * Host-replaceable storage seam for minimal steering records.
 *
 * Every method returns `MaybePromise` so one contract serves both backend classes required by
 * SA-LED-144. A session-memory backend returns plain values and stays fully synchronous; a server
 * durable backend returns promises whose settlement *is* the write's success-or-failure report.
 *
 * This is what makes SA-LED-141 honorable rather than aspirational: the runtime awaits every ledger
 * write, so a write that policy requires before execution (the invocation record and its policy
 * decision) has reported its outcome before the affected execution is represented as authorized. A
 * rejected durable write therefore blocks execution instead of letting it proceed unrecorded. A
 * synchronous-only contract could not report a remote write's outcome at all, so it could not
 * satisfy SA-LED-141 for the backends SA-LED-144 blesses.
 *
 * Implements SA-LED-140–146, and SA-LED-141 and SA-LED-144 in particular.
 */
export interface ActionLedger {
  createInvocation(input: CreateInvocationInput): MaybePromise<SteeringInvocationRecord>;
  appendPolicyDecision(
    recordId: string,
    decision: PolicyDecision,
  ): MaybePromise<PolicyDecisionRecord>;
  setApproval(recordId: string, approval: Omit<ApprovalRecord, "updatedAt">): MaybePromise<void>;
  updateStep(
    recordId: string,
    stepId: string,
    patch: Partial<Omit<ActionStepRecord, "stepId" | "order" | "actionId">>,
  ): MaybePromise<ActionStepRecord>;
  attachUndoHandle(recordId: string, stepId: string, handle: UndoHandleRecord): MaybePromise<void>;
  updateUndoHandle(
    recordId: string,
    stepId: string,
    handleId: string,
    patch: Partial<UndoHandleRecord>,
  ): MaybePromise<UndoHandleRecord>;
  appendDisclosure(
    recordId: string,
    disclosure: Omit<DisclosureRecord, "disclosureId">,
  ): MaybePromise<DisclosureRecord>;
  appendUndoAttempt(
    recordId: string,
    attempt: Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">,
  ): MaybePromise<UndoAttemptRecord>;
  updateUndoAttempt(
    recordId: string,
    undoAttemptId: string,
    patch: Partial<Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">>,
  ): MaybePromise<UndoAttemptRecord>;
  requireRecord(recordId: string): MaybePromise<SteeringInvocationRecord>;
  /** Returns the ordered ledger read model for application-owned trail UI. */
  getRecords(): MaybePromise<SteeringInvocationRecord[]>;
  /** Notifies consumers whenever the readable ledger state changes. */
  subscribe(listener: () => void): () => void;
}

/**
 * In-memory, session-scoped implementation of the storage-independent ledger seam.
 * Implements SA-LED-140 and SA-LED-144–145.
 */
export class InMemoryLedger implements ActionLedger {
  private readonly records = new Map<string, SteeringInvocationRecord>();
  private readonly listeners = new Set<() => void>();
  private sequence = 0;
  private decisionSequence = 0;
  private disclosureSequence = 0;
  private undoAttemptSequence = 0;
  /** Creates a session ledger with optional clock and redaction policy. Implements SA-LED-130–134 and SA-LED-144. */
  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly redactor?: LedgerRedactor,
  ) {}

  /** Creates and publishes an ordered invocation record. Implements SA-LED-020–039 and SA-LED-140. */
  createInvocation(input: CreateInvocationInput): SteeringInvocationRecord {
    const recordId = `inv_${++this.sequence}`;
    const recordedAt = this.now().toISOString();
    const record: SteeringInvocationRecord = {
      recordId,
      schemaVersion: "steerable-ledger.v0",
      order: { sequence: this.sequence, recordedAt },
      surfaceRef: input.surfaceRef,
      initiator: input.initiator ?? { kind: "user" },
      intent: clone(input.intent),
      policyDecisions: [],
      approval: { status: "not-required", updatedAt: recordedAt },
      steps: input.steps.map((step, order) => ({
        stepId: step.stepId,
        order,
        actionId: step.actionId,
        params: this.store(step.params, "params", step.actionId, step.sensitive),
        status: "proposed",
        writes: [...step.writes],
        undo: { status: "pending_snapshot_capture" },
      })),
      disclosures: [],
      undoAttempts: [],
    };
    this.records.set(recordId, record);
    this.emit();
    return record;
  }
  /** Appends the policy result without conflating later execution state. Implements SA-LED-050–054. */
  appendPolicyDecision(recordId: string, decision: PolicyDecision): PolicyDecisionRecord {
    const policy: PolicyDecisionRecord = {
      decisionId: `pol_${++this.decisionSequence}`,
      recordedAt: this.now().toISOString(),
      actionIds: [...decision.actionIds],
      finalMode: decision.finalMode,
      perActionModes: decision.perActionModes.map(({ actionId, mode }) => ({ actionId, mode })),
      chainLevelMode: decision.chainLevelMode,
      executedPrefixEndIndex: decision.executedPrefixEndIndex,
      heldSuffixStartIndex: decision.heldSuffixStartIndex,
      refusalReason: decision.refusalReason,
      requiredGate: decision.requiredGate && {
        ...decision.requiredGate,
        actionIds: [...decision.requiredGate.actionIds],
      },
      rationale: clone(decision.rationale),
    };
    this.requireRecord(recordId).policyDecisions.push(policy);
    this.emit();
    return policy;
  }
  /** Replaces the invocation approval state. Implements SA-LED-036 and SA-LED-140. */
  setApproval(recordId: string, approval: Omit<ApprovalRecord, "updatedAt">): void {
    this.requireRecord(recordId).approval = { ...approval, updatedAt: this.now().toISOString() };
    this.emit();
  }
  /** Applies an execution-state patch to one ordered step. Implements SA-LED-030–034 and SA-LED-140. */
  updateStep(
    recordId: string,
    stepId: string,
    patch: Partial<Omit<ActionStepRecord, "stepId" | "order" | "actionId">>,
  ): ActionStepRecord {
    const step = this.step(recordId, stepId);
    Object.assign(step, clone(patch));
    this.emit();
    return step;
  }
  /** Attaches an executable undo handle to a step. Implements SA-LED-070–075 and SA-LED-140. */
  attachUndoHandle(recordId: string, stepId: string, handle: UndoHandleRecord): void {
    this.step(recordId, stepId).undo = handle;
    this.emit();
  }
  /** Updates an attached undo handle lifecycle. Implements SA-LED-075 and SA-LED-146. */
  updateUndoHandle(
    recordId: string,
    stepId: string,
    handleId: string,
    patch: Partial<UndoHandleRecord>,
  ): UndoHandleRecord {
    const step = this.step(recordId, stepId);
    if (!("handleId" in step.undo) || step.undo.handleId !== handleId)
      throw new Error(`Unknown undo handle "${handleId}".`);
    step.undo = { ...step.undo, ...clone(patch) };
    this.emit();
    return step.undo;
  }
  /** Marks a handle expired with a visible reason. Implements SA-LED-075, SA-LED-096, and SA-LED-146. */
  expireUndoHandle(handleId: string, reason: string): void {
    this.updateHandle(handleId, { status: "expired", invalidationReason: reason });
  }
  /** Marks a stale handle superseded with a visible reason. Implements SA-LED-077 and SA-LED-146. */
  supersedeUndoHandle(handleId: string, reason: string): void {
    this.updateHandle(handleId, { status: "superseded", invalidationReason: reason });
  }
  /** Appends a user-relevant limitation disclosure. Implements SA-LED-037 and SA-LED-140. */
  appendDisclosure(
    recordId: string,
    disclosure: Omit<DisclosureRecord, "disclosureId">,
  ): DisclosureRecord {
    const entry = { disclosureId: `disc_${++this.disclosureSequence}`, ...clone(disclosure) };
    this.requireRecord(recordId).disclosures.push(entry);
    this.emit();
    return entry;
  }
  /** Starts and records an undo attempt. Implements SA-LED-076 and SA-LED-140. */
  appendUndoAttempt(
    recordId: string,
    attempt: Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">,
  ): UndoAttemptRecord {
    const entry = {
      undoAttemptId: `undo_${++this.undoAttemptSequence}`,
      startedAt: this.now().toISOString(),
      ...clone(attempt),
    };
    this.requireRecord(recordId).undoAttempts.push(entry);
    this.emit();
    return entry;
  }
  /** Settles a recorded undo attempt. Implements SA-LED-076 and SA-LED-114–120. */
  updateUndoAttempt(
    recordId: string,
    undoAttemptId: string,
    patch: Partial<Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">>,
  ): UndoAttemptRecord {
    const item = this.requireRecord(recordId).undoAttempts.find(
      (attempt) => attempt.undoAttemptId === undoAttemptId,
    );
    if (!item) throw new Error(`Unknown undo attempt "${undoAttemptId}".`);
    Object.assign(item, clone(patch));
    this.emit();
    return item;
  }
  /** Returns one record when present. Implements SA-LED-140. */
  getRecord(recordId: string): SteeringInvocationRecord | undefined {
    return this.records.get(recordId);
  }
  /** Returns one record or raises for an unknown ID. Implements SA-LED-140. */
  requireRecord(recordId: string): SteeringInvocationRecord {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Unknown ledger record "${recordId}".`);
    return record;
  }
  /** Returns the ordered ledger read model for application-owned trail UI. Implements SA-LED-023 and SA-LED-140. */
  getRecords(): SteeringInvocationRecord[] {
    return [...this.records.values()];
  }
  /** Notifies consumers whenever readable ledger state changes. Implements SA-LED-140. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private step(recordId: string, stepId: string): ActionStepRecord {
    const step = this.requireRecord(recordId).steps.find((entry) => entry.stepId === stepId);
    if (!step) throw new Error(`Unknown step "${stepId}".`);
    return step;
  }
  private updateHandle(handleId: string, patch: Partial<UndoHandleRecord>): void {
    const step = this.getRecords()
      .flatMap((record) => record.steps)
      .find((entry) => "handleId" in entry.undo && entry.undo.handleId === handleId);
    if (!step || !("handleId" in step.undo)) throw new Error(`Unknown undo handle "${handleId}".`);
    step.undo = { ...step.undo, ...patch };
    this.emit();
  }
  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
  private store(
    value: unknown,
    kind: "intent" | "params" | "result" | "error" | "observation",
    actionId?: string,
    redact = false,
  ): unknown {
    return clone(redact && this.redactor ? this.redactor.redact(value, { kind, actionId }) : value);
  }
}

/** Canonical evaluator projection of a steering invocation. Implements SA-LED-038 and SA-LED-064. */
export interface LedgerTrace {
  recordId: string;
  surfaceRef?: string;
  intent: SteeringInvocationRecord["intent"];
  policy: { finalMode: AutonomyMode; actionIds: string[]; reasonCodes: string[] }[];
  approvalStatus: ApprovalStatus;
  steps: {
    stepId: string;
    actionId: string;
    params: unknown;
    status: StepStatus;
    writes: StateKey[];
    undoStatus: string;
    errorCode?: string;
  }[];
  disclosures: DisclosureRecord[];
}

/**
 * Projects serializable ledger records into the canonical evaluator trace shape.
 * Implements SA-LED-038, SA-LED-064, and SA-LED-130–132.
 */
export function extractLedgerTrace(
  records: readonly SteeringInvocationRecord[],
  options: { redactSensitive?: boolean } = {},
): LedgerTrace[] {
  return records.map((record) => {
    const sensitiveActionIds = new Set(
      record.policyDecisions.flatMap((decision) =>
        decision.rationale.declarationMetadata
          .filter((metadata) => metadata.effects.sensitive)
          .map((metadata) => metadata.actionId),
      ),
    );
    return {
      recordId: record.recordId,
      surfaceRef: record.surfaceRef,
      intent: options.redactSensitive ? redactIntent(record.intent) : clone(record.intent),
      policy: record.policyDecisions.map((decision) => ({
        finalMode: decision.finalMode,
        actionIds: [...decision.actionIds],
        reasonCodes: [...decision.rationale.reasonCodes],
      })),
      approvalStatus: record.approval.status,
      steps: record.steps.map((step) => ({
        stepId: step.stepId,
        actionId: step.actionId,
        params:
          options.redactSensitive && sensitiveActionIds.has(step.actionId)
            ? "[redacted]"
            : clone(step.params),
        status: step.status,
        writes: [...step.writes],
        undoStatus:
          "handleId" in step.undo
            ? step.undo.status
            : "noUndoReason" in step.undo
              ? "unavailable"
              : "pending_snapshot_capture",
        errorCode: step.executionResult?.errorCode,
      })),
      disclosures: clone(record.disclosures),
    };
  });
}

/**
 * Raised when a value the runtime must preserve cannot be copied without corrupting it.
 *
 * A silent degradation here is worse than a failure: a snapshot whose `Date` came back as a string
 * is not a restoration mechanism "in a form usable by later undo behavior" (SA-EXEC-010), and undo
 * built on it would report success while failing to fully reverse the step (SA-EXEC-087). Surfacing
 * a legible, attributable error keeps that from happening quietly.
 *
 * Implements SA-EXEC-010 and SA-EXEC-087.
 */
export class RecordedValueCloneError extends Error {
  /** Stable machine-readable code for runtime and host error mapping. */
  readonly code = "recorded_value_not_cloneable";
  /** Creates a legible clone failure naming the offending value's type. Implements SA-EXEC-010. */
  constructor(value: unknown, cause: unknown) {
    super(
      `Could not copy a ${describeValue(value)} value for the steering record: it is not ` +
        `structured-cloneable. Recorded values and snapshots must round-trip without corruption, ` +
        `so it was rejected rather than silently degraded. Pass a cloneable representation ` +
        `instead. Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = "RecordedValueCloneError";
  }
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  return value.constructor?.name ?? "object";
}

/**
 * Deep-copies a value the runtime must preserve, without the corruption of a JSON round-trip.
 *
 * `JSON.parse(JSON.stringify(v))` turns `Date` into a string, `Map`/`Set` into `{}`, drops
 * `undefined`, and throws outright on `BigInt` — an ordinary database primary key. `structuredClone`
 * preserves all of those. Where a value is genuinely non-cloneable (a function, for instance) this
 * fails loudly as a `RecordedValueCloneError` rather than storing something that no longer matches
 * what the runtime saw.
 *
 * This is the shared copy helper for every value that must survive for later undo: use it instead
 * of a local JSON round-trip.
 *
 * Implements SA-EXEC-010, SA-EXEC-087, and SA-LED-140.
 */
export function cloneRecordedValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  try {
    return structuredClone(value);
  } catch (error) {
    throw new RecordedValueCloneError(value, error);
  }
}

const clone = cloneRecordedValue;

function redactIntent(
  intent: SteeringInvocationRecord["intent"],
): SteeringInvocationRecord["intent"] {
  return intent.ref
    ? { ref: intent.ref }
    : { redactedText: intent.redactedText ?? (intent.text ? "[redacted]" : undefined) };
}
