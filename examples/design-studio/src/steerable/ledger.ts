import type { AutonomyMode, PolicyDecision, PolicyRationale } from "./policy";
import type { ReversibilityKind, StateKey } from "./registry";

export type StepStatus =
  | "proposed"
  | "held"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "undone"
  | "canceled";

export type ApprovalStatus =
  | "not-required"
  | "pending"
  | "approved"
  | "declined"
  | "expired"
  | "canceled";

export type UndoHandleStatus =
  | "available"
  | "unavailable"
  | "expired"
  | "attempted"
  | "succeeded"
  | "failed"
  | "superseded";

export type UndoMechanism =
  | "declared_inverse"
  | "runtime_snapshot"
  | "compensating_action"
  | "soft_delete_window"
  | "honest_irreversible";

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

export interface ActionStepRecord {
  stepId: string;
  order: number;
  actionId: string;
  params: unknown;
  status: StepStatus;
  writes: StateKey[];
  undo: UndoHandleRecord | { status: "pending_snapshot_capture" } | { noUndoReason: string };
  executionResult?: {
    ok: boolean;
    result?: unknown;
    errorCode?: string;
    errorSummary?: string;
  };
  repairOfStepId?: string;
  observations?: unknown;
}

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
  requiredGate?: {
    mode: AutonomyMode;
    startIndex: number;
    actionIds: string[];
  };
  rationale: PolicyRationale;
}

export interface ApprovalRecord {
  status: ApprovalStatus;
  updatedAt: string;
  gateId?: string;
  actionIds?: string[];
  reason?: string;
}

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

export interface UndoAttemptRecord {
  undoAttemptId: string;
  targetHandleIds: string[];
  status: "pending" | "succeeded" | "partial" | "failed" | "refused";
  startedAt: string;
  settledAt?: string;
  perHandleResults: {
    handleId: string;
    status: UndoHandleStatus;
    errorSummary?: string;
  }[];
  disclosure?: string;
}

export interface SteeringInvocationRecord {
  recordId: string;
  schemaVersion: "steerable-ledger.v0";
  order: {
    sequence: number;
    recordedAt: string;
  };
  surfaceRef?: string;
  initiator: {
    kind: "user" | "system" | "external_agent";
    ref?: string;
  };
  intent: {
    text?: string;
    redactedText?: string;
    ref?: string;
  };
  policyDecisions: PolicyDecisionRecord[];
  approval: ApprovalRecord;
  steps: ActionStepRecord[];
  disclosures: DisclosureRecord[];
  undoAttempts: UndoAttemptRecord[];
}

export interface CreateInvocationInput {
  surfaceRef?: string;
  intent: SteeringInvocationRecord["intent"];
  initiator?: SteeringInvocationRecord["initiator"];
  steps: {
    stepId: string;
    actionId: string;
    params: unknown;
    writes: StateKey[];
  }[];
}

export interface EvalTraceStep {
  stepId: string;
  actionId: string;
  params: unknown;
  status: StepStatus;
  writes: StateKey[];
  undoStatus: string;
  errorCode?: string;
}

export interface EvalTrace {
  recordId: string;
  surfaceRef?: string;
  intent: SteeringInvocationRecord["intent"];
  policy: {
    finalMode: AutonomyMode;
    actionIds: string[];
    reasonCodes: string[];
  }[];
  approvalStatus: ApprovalStatus;
  steps: EvalTraceStep[];
  disclosures: DisclosureRecord[];
}

type LedgerListener = () => void;

export class InMemoryLedger {
  private readonly records = new Map<string, SteeringInvocationRecord>();
  private readonly listeners = new Set<LedgerListener>();
  private sequence = 0;
  private decisionSequence = 0;
  private disclosureSequence = 0;
  private undoAttemptSequence = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  createInvocation(input: CreateInvocationInput): SteeringInvocationRecord {
    const recordId = `inv_${++this.sequence}`;
    const recordedAt = this.now().toISOString();
    const record: SteeringInvocationRecord = {
      recordId,
      schemaVersion: "steerable-ledger.v0",
      order: {
        sequence: this.sequence,
        recordedAt,
      },
      surfaceRef: input.surfaceRef,
      initiator: input.initiator ?? { kind: "user" },
      intent: input.intent,
      policyDecisions: [],
      approval: {
        status: "not-required",
        updatedAt: recordedAt,
      },
      steps: input.steps.map((step, index) => ({
        stepId: step.stepId,
        order: index,
        actionId: step.actionId,
        params: cloneLedgerValue(step.params),
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

  appendPolicyDecision(recordId: string, decision: PolicyDecision): PolicyDecisionRecord {
    const record = this.requireRecord(recordId);
    const policyRecord: PolicyDecisionRecord = {
      decisionId: `pol_${++this.decisionSequence}`,
      recordedAt: this.now().toISOString(),
      actionIds: [...decision.actionIds],
      finalMode: decision.finalMode,
      perActionModes: decision.perActionModes.map((item) => ({
        actionId: item.actionId,
        mode: item.mode,
      })),
      chainLevelMode: decision.chainLevelMode,
      executedPrefixEndIndex: decision.executedPrefixEndIndex,
      heldSuffixStartIndex: decision.heldSuffixStartIndex,
      refusalReason: decision.refusalReason,
      requiredGate: decision.requiredGate
        ? {
            mode: decision.requiredGate.mode,
            startIndex: decision.requiredGate.startIndex,
            actionIds: [...decision.requiredGate.actionIds],
          }
        : undefined,
      rationale: decision.rationale,
    };

    record.policyDecisions.push(policyRecord);
    this.emit();
    return policyRecord;
  }

  setApproval(recordId: string, approval: Omit<ApprovalRecord, "updatedAt">): void {
    const record = this.requireRecord(recordId);

    record.approval = {
      ...approval,
      updatedAt: this.now().toISOString(),
    };
    this.emit();
  }

  updateStep(
    recordId: string,
    stepId: string,
    patch: Partial<Omit<ActionStepRecord, "stepId" | "order" | "actionId">>,
  ): ActionStepRecord {
    const step = this.requireStep(recordId, stepId);

    Object.assign(step, patch);
    this.emit();
    return step;
  }

  attachUndoHandle(recordId: string, stepId: string, handle: UndoHandleRecord): void {
    const step = this.requireStep(recordId, stepId);

    step.undo = handle;
    this.emit();
  }

  updateUndoHandle(
    recordId: string,
    stepId: string,
    handleId: string,
    patch: Partial<UndoHandleRecord>,
  ): UndoHandleRecord {
    const step = this.requireStep(recordId, stepId);

    if (!("handleId" in step.undo) || step.undo.handleId !== handleId) {
      throw new Error(`Unknown undo handle "${handleId}" on step "${stepId}".`);
    }

    step.undo = {
      ...step.undo,
      ...patch,
    };

    this.emit();
    return step.undo;
  }

  expireUndoHandle(handleId: string, reason: string): void {
    this.updateHandleWherever(handleId, {
      status: "expired",
      invalidationReason: reason,
    });
  }

  supersedeUndoHandle(handleId: string, reason: string): void {
    this.updateHandleWherever(handleId, {
      status: "superseded",
      invalidationReason: reason,
    });
  }

  appendDisclosure(
    recordId: string,
    disclosure: Omit<DisclosureRecord, "disclosureId">,
  ): DisclosureRecord {
    const record = this.requireRecord(recordId);
    const nextDisclosure: DisclosureRecord = {
      disclosureId: `disc_${++this.disclosureSequence}`,
      ...disclosure,
    };

    record.disclosures.push(nextDisclosure);
    this.emit();
    return nextDisclosure;
  }

  appendUndoAttempt(
    recordId: string,
    attempt: Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">,
  ): UndoAttemptRecord {
    const record = this.requireRecord(recordId);
    const undoAttempt: UndoAttemptRecord = {
      undoAttemptId: `undo_${++this.undoAttemptSequence}`,
      startedAt: this.now().toISOString(),
      ...attempt,
    };

    record.undoAttempts.push(undoAttempt);
    this.emit();
    return undoAttempt;
  }

  updateUndoAttempt(
    recordId: string,
    undoAttemptId: string,
    patch: Partial<Omit<UndoAttemptRecord, "undoAttemptId" | "startedAt">>,
  ): UndoAttemptRecord {
    const record = this.requireRecord(recordId);
    const attempt = record.undoAttempts.find((item) => item.undoAttemptId === undoAttemptId);

    if (!attempt) {
      throw new Error(`Unknown undo attempt "${undoAttemptId}".`);
    }

    Object.assign(attempt, patch);
    this.emit();
    return attempt;
  }

  getRecord(recordId: string): SteeringInvocationRecord | undefined {
    return this.records.get(recordId);
  }

  requireRecord(recordId: string): SteeringInvocationRecord {
    const record = this.getRecord(recordId);

    if (!record) {
      throw new Error(`Unknown ledger record "${recordId}".`);
    }

    return record;
  }

  getRecords(): SteeringInvocationRecord[] {
    return Array.from(this.records.values());
  }

  subscribe(listener: LedgerListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  extractEvalTrace(options: { redactSensitive?: boolean } = {}): EvalTrace[] {
    return this.getRecords().map((record) => {
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
        intent: options.redactSensitive ? redactIntent(record.intent) : record.intent,
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
              : cloneLedgerValue(step.params),
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
        disclosures: [...record.disclosures],
      };
    });
  }

  private requireStep(recordId: string, stepId: string): ActionStepRecord {
    const record = this.requireRecord(recordId);
    const step = record.steps.find((item) => item.stepId === stepId);

    if (!step) {
      throw new Error(`Unknown step "${stepId}" in record "${recordId}".`);
    }

    return step;
  }

  private updateHandleWherever(handleId: string, patch: Partial<UndoHandleRecord>): void {
    const step = this.getRecords()
      .flatMap((record) => record.steps)
      .find((item) => "handleId" in item.undo && item.undo.handleId === handleId);

    if (!step || !("handleId" in step.undo)) {
      throw new Error(`Unknown undo handle "${handleId}".`);
    }

    step.undo = {
      ...step.undo,
      ...patch,
    };
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function redactIntent(
  intent: SteeringInvocationRecord["intent"],
): SteeringInvocationRecord["intent"] {
  if (intent.ref) {
    return { ref: intent.ref };
  }

  return {
    redactedText: intent.redactedText ?? (intent.text ? "[redacted]" : undefined),
  };
}

function cloneLedgerValue<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
