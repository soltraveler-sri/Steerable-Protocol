import {
  CapabilityRegistry,
  type ActionExecutionContext,
  type CompiledActionDeclaration,
  type StateSnapshot,
  type StateSnapshotAdapter,
  type SurfaceId,
} from "./registry";
import { InMemoryLedger, type SteeringInvocationRecord } from "./ledger";
import {
  type AutonomyMode,
  type PolicyDecision,
  type PolicyInputs,
  resolveActionPolicy,
  resolveChainPolicy,
} from "./policy";
import {
  createUndoHandleForAction,
  undoAll as undoAllRecord,
  type UndoAllResult,
} from "./undo";

export const DEFAULT_SURFACE_READINESS_TIMEOUT_MS = 5000;

export interface SurfaceReadinessRequest {
  targetSurfaceId: SurfaceId;
  actionIds: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type SurfaceReadinessResult =
  | { ok: true; targetSurfaceId: SurfaceId }
  | {
      ok: false;
      targetSurfaceId: SurfaceId;
      reason: "timeout" | "capability_unavailable" | "canceled";
      missingActionIds: string[];
    };

export interface SurfaceReadiness {
  awaitReady: (request: SurfaceReadinessRequest) => Promise<SurfaceReadinessResult>;
}

export interface ApprovalRequest {
  gateId: string;
  recordId: string;
  mode: AutonomyMode;
  heldSteps: {
    stepId: string;
    actionId: string;
    title: string;
    description: string;
    params: unknown;
  }[];
  rationale: PolicyDecision["rationale"];
  materialEffects: PolicyDecision["rationale"]["declarationMetadata"];
  undoImplications: string;
  signal?: AbortSignal;
}

export type ApprovalDecision =
  | { status: "approved"; approvedBy?: string; reason?: string }
  | { status: "declined"; declinedBy?: string; reason?: string };

export type ApprovalHook = (request: ApprovalRequest) => Promise<ApprovalDecision>;

export interface ProposedActionStep {
  stepId?: string;
  actionId: string;
  params: unknown;
  targetSurfaceId?: SurfaceId;
  surfaceTimeoutMs?: number;
}

export interface ExecuteChainRequest extends Omit<PolicyInputs, "currentSurface"> {
  intent: string;
  surfaceId: SurfaceId;
  steps: ProposedActionStep[];
  initiator?: SteeringInvocationRecord["initiator"];
}

export interface ExecuteActionRequest extends Omit<ExecuteChainRequest, "steps"> {
  actionId: string;
  params: unknown;
  targetSurfaceId?: SurfaceId;
  surfaceTimeoutMs?: number;
}

export interface ChainExecutionResult {
  recordId: string;
  status: "succeeded" | "failed" | "declined" | "canceled" | "refused";
  record: SteeringInvocationRecord;
  failure?: {
    stepId?: string;
    code: string;
    message: string;
  };
}

export interface ChainExecutionRun {
  recordId: string;
  done: Promise<ChainExecutionResult>;
  undoAll: () => Promise<UndoAllResult>;
  getRecord: () => SteeringInvocationRecord;
}

interface CompiledStep {
  stepId: string;
  action: CompiledActionDeclaration;
  params: unknown;
  targetSurfaceId?: SurfaceId;
  surfaceTimeoutMs?: number;
}

export class RegistrySurfaceReadiness implements SurfaceReadiness {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly defaultTimeoutMs = DEFAULT_SURFACE_READINESS_TIMEOUT_MS,
  ) {}

  awaitReady(request: SurfaceReadinessRequest): Promise<SurfaceReadinessResult> {
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const immediate = this.checkReadiness(request);

    if (immediate.ok) {
      return Promise.resolve(immediate);
    }

    return new Promise((resolve) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const settle = (result: SurfaceReadinessResult) => {
        if (settled) {
          return;
        }

        settled = true;
        unsubscribe?.();

        if (timeout) {
          clearTimeout(timeout);
        }

        request.signal?.removeEventListener("abort", handleAbort);
        resolve(result);
      };

      const revalidate = () => {
        const result = this.checkReadiness(request);

        if (result.ok) {
          settle(result);
        }
      };

      const handleAbort = () => {
        settle({
          ok: false,
          targetSurfaceId: request.targetSurfaceId,
          reason: "canceled",
          missingActionIds: this.missingActions(request),
        });
      };

      unsubscribe = this.registry.subscribe(revalidate);
      request.signal?.addEventListener("abort", handleAbort, { once: true });
      timeout = setTimeout(() => {
        const finalCheck = this.checkReadiness(request);

        if (finalCheck.ok) {
          settle(finalCheck);
          return;
        }

        settle(finalCheck);
      }, timeoutMs);
    });
  }

  private checkReadiness(request: SurfaceReadinessRequest): SurfaceReadinessResult {
    const missingActionIds = this.missingActions(request);

    if (missingActionIds.length === 0) {
      return {
        ok: true,
        targetSurfaceId: request.targetSurfaceId,
      };
    }

    return {
      ok: false,
      targetSurfaceId: request.targetSurfaceId,
      reason: this.registry.isSurfaceLive(request.targetSurfaceId)
        ? "capability_unavailable"
        : "timeout",
      missingActionIds,
    };
  }

  private missingActions(request: SurfaceReadinessRequest): string[] {
    return request.actionIds.filter(
      (actionId) =>
        !this.registry.isActionAvailableOnSurface(actionId, request.targetSurfaceId),
    );
  }
}

export class ExecutionEngine {
  private readonly surfaceReadiness: SurfaceReadiness;
  private readonly now: () => Date;
  private readonly approvalHook: ApprovalHook;

  constructor(
    private readonly options: {
      registry: CapabilityRegistry;
      ledger: InMemoryLedger;
      snapshotStore?: StateSnapshotAdapter;
      surfaceReadiness?: SurfaceReadiness;
      approvalHook?: ApprovalHook;
      now?: () => Date;
    },
  ) {
    this.surfaceReadiness =
      options.surfaceReadiness ?? new RegistrySurfaceReadiness(options.registry);
    this.now = options.now ?? (() => new Date());
    this.approvalHook =
      options.approvalHook ??
      (async () => ({
        status: "declined" as const,
        reason: "no_approval_hook_attached",
      }));
  }

  async executeAction(request: ExecuteActionRequest): Promise<ChainExecutionResult> {
    const run = this.executeChain({
      ...request,
      steps: [
        {
          actionId: request.actionId,
          params: request.params,
          targetSurfaceId: request.targetSurfaceId,
          surfaceTimeoutMs: request.surfaceTimeoutMs,
        },
      ],
    });

    return run.done;
  }

  executeChain(request: ExecuteChainRequest): ChainExecutionRun {
    const compiledSteps = request.steps.map((step, index) => this.compileStep(step, index));
    const record = this.options.ledger.createInvocation({
      surfaceRef: request.surfaceId,
      intent: { text: request.intent },
      initiator: request.initiator,
      steps: compiledSteps.map((step) => ({
        stepId: step.stepId,
        actionId: step.action.id,
        params: step.params,
        writes: step.action.writes,
      })),
    });
    const policyInputs: PolicyInputs = {
      ...request,
      currentSurface: request.surfaceId,
    };
    const policyDecision = resolveChainPolicy(
      compiledSteps.map((step) => step.action),
      policyInputs,
    );
    let currentSurfaceId = request.surfaceId;
    let undoRequested = false;
    let approvalAbortController: AbortController | undefined;
    let currentExecution:
      | {
          controller: AbortController;
          settled: Promise<void>;
        }
      | undefined;

    this.options.ledger.appendPolicyDecision(record.recordId, policyDecision);

    const undoAll = async () => {
      undoRequested = true;
      approvalAbortController?.abort();
      markAllUnstarted(this.options.ledger, record.recordId, compiledSteps, "skipped");
      currentExecution?.controller.abort();

      if (currentExecution) {
        await currentExecution.settled.catch(() => undefined);
      }

      return undoAllRecord(
        this.options.ledger,
        record.recordId,
        this.actionContext(currentSurfaceId),
        { allowPartial: true },
      );
    };

    const executeRange = async (
      start: number,
      end: number,
    ): Promise<ChainExecutionResult | undefined> => {
      for (let index = start; index < end; index += 1) {
        const step = compiledSteps[index];

        if (undoRequested) {
          this.options.ledger.updateStep(record.recordId, step.stepId, {
            status: "skipped",
            undo: { noUndoReason: "step_never_started" },
            executionResult: {
              ok: false,
              errorCode: "undo_requested_before_start",
              errorSummary: "Undo-all canceled this not-started step.",
            },
          });
          continue;
        }

        const stepPolicy = resolveActionPolicy(step.action, {
          ...policyInputs,
          currentSurface: currentSurfaceId,
        });
        this.options.ledger.appendPolicyDecision(record.recordId, stepPolicy);

        const surfaceReady = await this.ensureSurfaceReady(step, currentSurfaceId);

        if (!surfaceReady.ok) {
          this.options.ledger.updateStep(record.recordId, step.stepId, {
            status: "failed",
            undo: { noUndoReason: "step_never_completed" },
            executionResult: {
              ok: false,
              errorCode:
                surfaceReady.reason === "timeout"
                  ? "surface_readiness_timeout"
                  : surfaceReady.reason,
              errorSummary: `Surface "${surfaceReady.targetSurfaceId}" was not ready for ${surfaceReady.missingActionIds.join(
                ", ",
              )}.`,
            },
          });
          this.options.ledger.appendDisclosure(record.recordId, {
            kind: "cross_surface_failure",
            message: `Cross-surface continuation failed at "${surfaceReady.targetSurfaceId}".`,
            stepIds: [step.stepId],
          });
          markRemaining(this.options.ledger, record.recordId, compiledSteps, index + 1);

          return this.result(record.recordId, "failed", {
            stepId: step.stepId,
            code:
              surfaceReady.reason === "timeout"
                ? "surface_readiness_timeout"
                : surfaceReady.reason,
            message: `Destination surface "${surfaceReady.targetSurfaceId}" did not become ready.`,
          });
        }

        if (step.targetSurfaceId) {
          currentSurfaceId = step.targetSurfaceId;
        }

        if (
          !this.options.registry.isActionAvailableOnSurface(step.action.id, currentSurfaceId)
        ) {
          this.options.ledger.updateStep(record.recordId, step.stepId, {
            status: "failed",
            undo: { noUndoReason: "step_never_completed" },
            executionResult: {
              ok: false,
              errorCode: "action_unavailable",
              errorSummary: `Action "${step.action.id}" is unavailable on "${currentSurfaceId}".`,
            },
          });
          markRemaining(this.options.ledger, record.recordId, compiledSteps, index + 1);

          return this.result(record.recordId, "failed", {
            stepId: step.stepId,
            code: "action_unavailable",
            message: `Action "${step.action.id}" is unavailable on "${currentSurfaceId}".`,
          });
        }

        const controller = new AbortController();
        const settled = this.executeStep(record.recordId, step, currentSurfaceId, controller);
        currentExecution = {
          controller,
          settled,
        };
        await settled;
        currentExecution = undefined;

        const settledStep = this.options.ledger
          .requireRecord(record.recordId)
          .steps.find((item) => item.stepId === step.stepId);

        if (settledStep?.status === "failed") {
          markRemaining(this.options.ledger, record.recordId, compiledSteps, index + 1);

          return this.result(record.recordId, "failed", {
            stepId: step.stepId,
            code: settledStep.executionResult?.errorCode ?? "step_failed",
            message: settledStep.executionResult?.errorSummary ?? "Action execution failed.",
          });
        }
      }

      return undefined;
    };

    const requestApproval = async (
      startIndex: number,
    ): Promise<ChainExecutionResult | undefined> => {
      const heldSteps = compiledSteps.slice(startIndex);
      const gateId = `gate_${record.recordId}_${startIndex}`;

      heldSteps.forEach((step) => {
        this.options.ledger.updateStep(record.recordId, step.stepId, {
          status: "held",
        });
      });
      this.options.ledger.setApproval(record.recordId, {
        status: "pending",
        gateId,
        actionIds: heldSteps.map((step) => step.action.id),
      });
      this.options.ledger.appendDisclosure(record.recordId, {
        kind: "held_suffix",
        message: `Held suffix starts at step ${startIndex + 1}.`,
        stepIds: heldSteps.map((step) => step.stepId),
      });

      approvalAbortController = new AbortController();

      const approval = await this.approvalHook({
        gateId,
        recordId: record.recordId,
        mode: policyDecision.requiredGate?.mode ?? policyDecision.finalMode,
        heldSteps: heldSteps.map((step) => ({
          stepId: step.stepId,
          actionId: step.action.id,
          title: step.action.title,
          description: step.action.description,
          params: step.params,
        })),
        rationale: policyDecision.rationale,
        materialEffects: policyDecision.rationale.declarationMetadata,
        undoImplications: undoImplicationsFor(heldSteps),
        signal: approvalAbortController.signal,
      });

      approvalAbortController = undefined;

      if (undoRequested) {
        this.options.ledger.setApproval(record.recordId, {
          status: "canceled",
          gateId,
          actionIds: heldSteps.map((step) => step.action.id),
          reason: "undo_all_requested",
        });
        markAllUnstarted(this.options.ledger, record.recordId, heldSteps, "skipped");
        return this.result(record.recordId, "canceled");
      }

      if (approval.status === "declined") {
        this.options.ledger.setApproval(record.recordId, {
          status: "declined",
          gateId,
          actionIds: heldSteps.map((step) => step.action.id),
          reason: approval.reason,
        });
        markAllUnstarted(this.options.ledger, record.recordId, heldSteps, "skipped");

        return this.result(record.recordId, "declined");
      }

      this.options.ledger.setApproval(record.recordId, {
        status: "approved",
        gateId,
        actionIds: heldSteps.map((step) => step.action.id),
        reason: approval.reason,
      });

      return undefined;
    };

    const done = (async (): Promise<ChainExecutionResult> => {
      try {
        if (policyDecision.finalMode === "Read-only") {
          markAllUnstarted(this.options.ledger, record.recordId, compiledSteps, "skipped");
          return this.result(record.recordId, "refused", {
            code: "read_only_policy",
            message: "Policy resolved to read-only; no actions executed.",
          });
        }

        if (policyDecision.finalMode === "Refuse / hand off") {
          markAllUnstarted(this.options.ledger, record.recordId, compiledSteps, "skipped");
          return this.result(record.recordId, "refused", {
            code: "policy_refused",
            message: policyDecision.refusalReason ?? "Policy refused the proposed actions.",
          });
        }

        const heldStart = heldStartIndex(policyDecision);

        if (heldStart >= compiledSteps.length) {
          const result = await executeRange(0, compiledSteps.length);

          if (result) {
            return result;
          }

          return this.result(record.recordId, undoRequested ? "canceled" : "succeeded");
        }

        if (heldStart > 0) {
          const prefixResult = await executeRange(0, heldStart);

          if (prefixResult) {
            return prefixResult;
          }
        }

        if (heldStart < compiledSteps.length) {
          const approvalResult = await requestApproval(heldStart);

          if (approvalResult) {
            return approvalResult;
          }
        }

        const finalResult = await executeRange(heldStart, compiledSteps.length);

        if (finalResult) {
          return finalResult;
        }

        return this.result(record.recordId, undoRequested ? "canceled" : "succeeded");
      } catch (error) {
        return this.result(record.recordId, "failed", {
          code: "execution_error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return {
      recordId: record.recordId,
      done,
      undoAll,
      getRecord: () => this.options.ledger.requireRecord(record.recordId),
    };
  }

  private compileStep(step: ProposedActionStep, index: number): CompiledStep {
    const action = this.options.registry.requireAction(step.actionId);
    const params = this.options.registry.validateActionParams(action, step.params);

    return {
      stepId: step.stepId ?? `step_${index + 1}`,
      action,
      params,
      targetSurfaceId: step.targetSurfaceId,
      surfaceTimeoutMs: step.surfaceTimeoutMs,
    };
  }

  private async ensureSurfaceReady(
    step: CompiledStep,
    currentSurfaceId: SurfaceId,
  ): Promise<SurfaceReadinessResult> {
    if (!step.targetSurfaceId || step.targetSurfaceId === currentSurfaceId) {
      return {
        ok: true,
        targetSurfaceId: currentSurfaceId,
      };
    }

    return this.surfaceReadiness.awaitReady({
      targetSurfaceId: step.targetSurfaceId,
      actionIds: [step.action.id],
      timeoutMs: step.surfaceTimeoutMs,
    });
  }

  private async executeStep(
    recordId: string,
    step: CompiledStep,
    surfaceId: SurfaceId,
    controller: AbortController,
  ): Promise<void> {
    let snapshot: StateSnapshot | undefined;

    if (
      this.options.snapshotStore &&
      step.action.reversibility.kind !== "irreversible" &&
      step.action.writes.length > 0
    ) {
      snapshot = await this.options.snapshotStore.capture(step.action.writes);
    }

    this.options.ledger.updateStep(recordId, step.stepId, {
      status: "running",
      undo:
        step.action.reversibility.kind === "irreversible"
          ? { noUndoReason: "honest_irreversible" }
          : { status: "pending_snapshot_capture" },
    });

    try {
      if (controller.signal.aborted) {
        throw new Error("Action canceled before execution.");
      }

      const context = this.actionContext(surfaceId, controller.signal);
      const result = await step.action.execute(step.params, context);
      const observations = step.action.observe ? await step.action.observe(context) : undefined;
      const undoHandle = createUndoHandleForAction(step.action, {
        recordId,
        stepId: step.stepId,
        params: step.params,
        result,
        snapshot,
      });

      this.options.ledger.updateStep(recordId, step.stepId, {
        status: "succeeded",
        executionResult: {
          ok: true,
          result,
        },
        observations,
      });

      if ("noUndoReason" in undoHandle) {
        this.options.ledger.updateStep(recordId, step.stepId, {
          undo: undoHandle,
        });
        this.options.ledger.appendDisclosure(recordId, {
          kind: "no_undo",
          message: `Step ${step.stepId} has no undo handle: ${undoHandle.noUndoReason}.`,
          stepIds: [step.stepId],
        });
      } else {
        this.options.ledger.attachUndoHandle(recordId, step.stepId, undoHandle);
      }
    } catch (error) {
      this.options.ledger.updateStep(recordId, step.stepId, {
        status: controller.signal.aborted ? "canceled" : "failed",
        undo: { noUndoReason: "step_never_completed" },
        executionResult: {
          ok: false,
          errorCode: controller.signal.aborted ? "execution_canceled" : "executor_failed",
          errorSummary: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private actionContext(surfaceId: SurfaceId, signal?: AbortSignal): ActionExecutionContext {
    return {
      registry: this.options.registry,
      surfaceId,
      snapshotStore: this.options.snapshotStore,
      signal,
      now: this.now,
    };
  }

  private result(
    recordId: string,
    status: ChainExecutionResult["status"],
    failure?: ChainExecutionResult["failure"],
  ): ChainExecutionResult {
    return {
      recordId,
      status,
      record: this.options.ledger.requireRecord(recordId),
      failure,
    };
  }
}

export function createManualApprovalController() {
  let pending:
    | {
        request: ApprovalRequest;
        resolve: (decision: ApprovalDecision) => void;
      }
    | undefined;
  const waiters = new Set<(request: ApprovalRequest) => void>();

  const hook: ApprovalHook = (request) =>
    new Promise((resolve) => {
      pending = { request, resolve };
      waiters.forEach((waiter) => waiter(request));

      request.signal?.addEventListener(
        "abort",
        () => {
          if (pending?.request.gateId === request.gateId) {
            pending = undefined;
          }

          resolve({
            status: "declined",
            reason: "approval_canceled",
          });
        },
        { once: true },
      );
    });

  return {
    hook,
    waitForPendingRequest(): Promise<ApprovalRequest> {
      if (pending) {
        return Promise.resolve(pending.request);
      }

      return new Promise((resolve) => {
        const waiter = (request: ApprovalRequest) => {
          waiters.delete(waiter);
          resolve(request);
        };

        waiters.add(waiter);
      });
    },
    approve(reason?: string) {
      const next = pending;
      pending = undefined;
      next?.resolve({ status: "approved", reason });
    },
    decline(reason?: string) {
      const next = pending;
      pending = undefined;
      next?.resolve({ status: "declined", reason });
    },
  };
}

function heldStartIndex(policyDecision: PolicyDecision): number {
  if (policyDecision.finalMode === "Plan preview" || policyDecision.finalMode === "Step-gated") {
    return 0;
  }

  return policyDecision.heldSuffixStartIndex ?? policyDecision.actionIds.length;
}

function markRemaining(
  ledger: InMemoryLedger,
  recordId: string,
  steps: CompiledStep[],
  startIndex: number,
): void {
  steps.slice(startIndex).forEach((step) => {
    ledger.updateStep(recordId, step.stepId, {
      status: "skipped",
      undo: { noUndoReason: "step_never_started" },
      executionResult: {
        ok: false,
        errorCode: "dependency_failed",
        errorSummary: "Skipped because an earlier step did not complete.",
      },
    });
  });
}

function markAllUnstarted(
  ledger: InMemoryLedger,
  recordId: string,
  steps: CompiledStep[],
  status: "skipped" | "canceled",
): void {
  const record = ledger.requireRecord(recordId);
  const unstartedStatuses = new Set(["proposed", "held"]);

  steps.forEach((step) => {
    const current = record.steps.find((item) => item.stepId === step.stepId);

    if (current && unstartedStatuses.has(current.status)) {
      ledger.updateStep(recordId, step.stepId, {
        status,
        undo: { noUndoReason: "step_never_started" },
        executionResult: {
          ok: false,
          errorCode: status === "canceled" ? "execution_canceled" : "step_skipped",
          errorSummary: "Step did not start.",
        },
      });
    }
  });
}

function undoImplicationsFor(heldSteps: CompiledStep[]): string {
  const irreversible = heldSteps
    .filter((step) => step.action.reversibility.kind === "irreversible")
    .map((step) => step.action.id);

  if (irreversible.length === 0) {
    return "Held suffix will preserve undo handles for reversible completed steps.";
  }

  return `Held suffix includes irreversible steps: ${irreversible.join(", ")}.`;
}
