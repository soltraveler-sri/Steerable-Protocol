import type {
  ActionExecutionContext,
  AnyCompiledActionDeclaration,
  CapabilityRegistry,
  StateSnapshot,
  StateSnapshotAdapter,
  SurfaceId,
} from "./registry.js";
import {
  type AutonomyMode,
  type PolicyDecision,
  type PolicyInputs,
  resolveActionPolicy,
  resolveChainPolicy,
} from "./policy.js";
import type { ActionLedger, SteeringInvocationRecord } from "./ledger.js";
import { createUndoHandleForAction, undoAll as undoAllRecord, type UndoAllResult } from "./undo.js";

/** Default finite destination-readiness wait in milliseconds. Implements SA-EXEC-166–167. */
export const DEFAULT_SURFACE_READINESS_TIMEOUT_MS = 5000;
/** Target surface, required actions, and cancellation bounds for a readiness wait. Implements SA-EXEC-163–168. */
export interface SurfaceReadinessRequest {
  targetSurfaceId: SurfaceId;
  actionIds: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
}
/** Settled destination readiness or a legible boundary failure. Implements SA-EXEC-169–172 and SA-EXEC-177. */
export type SurfaceReadinessResult =
  | { ok: true; targetSurfaceId: SurfaceId }
  | {
      ok: false;
      targetSurfaceId: SurfaceId;
      reason: "timeout" | "capability_unavailable" | "canceled";
      missingActionIds: string[];
    };
/**
 * Host-owned, platform-neutral destination-readiness seam.
 *
 * A host app implements this when its router or platform needs custom readiness signaling. The
 * engine calls `awaitReady` only after a cross-surface transition has begun and before invoking
 * the destination action. The promise must settle once the declared surface is live and every
 * requested action is available, or settle with a timeout, unavailable-capability, or cancellation
 * result. Waiting must remain finite; abort must prevent later continuation from this request.
 *
 * Implements SA-EXEC-165–172 and SA-EXEC-178.
 */
export interface SurfaceReadiness {
  awaitReady(request: SurfaceReadinessRequest): Promise<SurfaceReadinessResult>;
}

/**
 * Declaration- and policy-derived scope presented at an execution gate.
 * Implements SA-EXEC-092–096 and SA-EXEC-130–136.
 */
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
/** Host decision for exactly the supplied approval scope. Implements SA-EXEC-094–096 and SA-EXEC-132–136. */
export type ApprovalDecision =
  | { status: "approved"; approvedBy?: string; reason?: string }
  | { status: "declined"; declinedBy?: string; reason?: string };
/**
 * Host-owned approval UI or service seam.
 *
 * The host app implements this callback and presents the supplied held steps, material effects,
 * rationale, and undo implications without widening their scope. The engine invokes it after
 * recording the gate and marking affected steps held, and it does not execute that scope until the
 * returned promise approves it. Decline prevents the held scope from running; cancellation is
 * delivered through `request.signal`. An absent hook fails closed.
 *
 * Implements SA-EXEC-092–096 and SA-EXEC-130–136.
 */
export type ApprovalHook = (request: ApprovalRequest) => Promise<ApprovalDecision>;
/** One ordered proposed action in a chain. Implements SA-EXEC-080 and SA-EXEC-163. */
export interface ProposedActionStep {
  stepId?: string;
  actionId: string;
  params: unknown;
  targetSurfaceId?: SurfaceId;
  surfaceTimeoutMs?: number;
}
/** Intent, source surface, policy inputs, and ordered steps for chain execution. Implements SA-EXEC-080–082. */
export interface ExecuteChainRequest extends Omit<PolicyInputs, "currentSurface" | "availability"> {
  intent: string;
  surfaceId: SurfaceId;
  steps: ProposedActionStep[];
  initiator?: SteeringInvocationRecord["initiator"];
}
/** Single-action direct-dispatch request. Implements SA-EXEC-060–068. */
export interface ExecuteActionRequest extends Omit<ExecuteChainRequest, "steps"> {
  actionId: string;
  params: unknown;
  targetSurfaceId?: SurfaceId;
  surfaceTimeoutMs?: number;
}
/** Settled execution status with its authoritative ledger record. Implements SA-EXEC-009 and SA-EXEC-012. */
export interface ChainExecutionResult {
  recordId: string;
  status: "succeeded" | "failed" | "declined" | "canceled" | "refused";
  record: SteeringInvocationRecord;
  failure?: { stepId?: string; code: string; message: string };
}
/** Running chain handle exposing settlement, aggregate undo, and current record. Implements SA-EXEC-085–089. */
export interface ChainExecutionRun {
  recordId: string;
  done: Promise<ChainExecutionResult>;
  undoAll(): Promise<UndoAllResult>;
  getRecord(): SteeringInvocationRecord;
}
interface CompiledStep {
  stepId: string;
  action: AnyCompiledActionDeclaration;
  params: unknown;
  targetSurfaceId?: SurfaceId;
  surfaceTimeoutMs?: number;
}

/**
 * Registry-backed readiness adapter with subscription revalidation and a finite 5000 ms default.
 * Implements SA-EXEC-165–172 and SA-EXEC-178–179.
 */
export class RegistrySurfaceReadiness implements SurfaceReadiness {
  /** Creates a registry-backed finite readiness waiter. Implements SA-EXEC-165–168. */
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly defaultTimeoutMs = DEFAULT_SURFACE_READINESS_TIMEOUT_MS,
  ) {}
  /**
   * Waits until all requested actions are live on the target or the bounded wait settles.
   * Implements SA-EXEC-165–172.
   */
  awaitReady(request: SurfaceReadinessRequest): Promise<SurfaceReadinessResult> {
    const check = () => this.check(request);
    const immediate = check();
    if (immediate.ok) return Promise.resolve(immediate);
    return new Promise((resolve) => {
      let done = false;
      let unsubscribe: (() => void) | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const settle = (result: SurfaceReadinessResult) => {
        if (done) return;
        done = true;
        unsubscribe?.();
        if (timeout) clearTimeout(timeout);
        request.signal?.removeEventListener("abort", abort);
        resolve(result);
      };
      const abort = () =>
        settle({
          ok: false,
          targetSurfaceId: request.targetSurfaceId,
          reason: "canceled",
          missingActionIds: this.missing(request),
        });
      unsubscribe = this.registry.subscribe(() => {
        const next = check();
        if (next.ok) settle(next);
      });
      request.signal?.addEventListener("abort", abort, { once: true });
      timeout = setTimeout(() => settle(check()), request.timeoutMs ?? this.defaultTimeoutMs);
    });
  }
  private check(request: SurfaceReadinessRequest): SurfaceReadinessResult {
    const missingActionIds = this.missing(request);
    return missingActionIds.length === 0
      ? { ok: true, targetSurfaceId: request.targetSurfaceId }
      : {
          ok: false,
          targetSurfaceId: request.targetSurfaceId,
          reason: this.registry.isSurfaceLive(request.targetSurfaceId)
            ? "capability_unavailable"
            : "timeout",
          missingActionIds,
        };
  }
  private missing(request: SurfaceReadinessRequest): string[] {
    return request.actionIds.filter(
      (actionId) => !this.registry.isActionAvailableOnSurface(actionId, request.targetSurfaceId),
    );
  }
}

/**
 * Validates, authorizes, records, executes, gates, and undoes declared actions.
 * Implements SA-EXEC-001–012, SA-EXEC-060–068, SA-EXEC-080–100, SA-EXEC-130–139,
 * and SA-EXEC-160–174 and SA-EXEC-178–179.
 */
export class ExecutionEngine {
  private readonly readiness: SurfaceReadiness;
  private readonly now: () => Date;
  private readonly approval: ApprovalHook;
  /**
   * Creates an engine around host-owned registry, ledger, snapshot, readiness, and approval seams.
   * Implements SA-EXEC-001–012.
   */
  constructor(
    private readonly options: {
      registry: CapabilityRegistry;
      ledger: ActionLedger;
      snapshotStore?: StateSnapshotAdapter;
      surfaceReadiness?: SurfaceReadiness;
      approvalHook?: ApprovalHook;
      now?: () => Date;
    },
  ) {
    this.readiness = options.surfaceReadiness ?? new RegistrySurfaceReadiness(options.registry);
    this.now = options.now ?? (() => new Date());
    this.approval =
      options.approvalHook ??
      (async () => ({ status: "declined" as const, reason: "no_approval_hook_attached" }));
  }
  /**
   * Direct-dispatches one action through the registry, policy, ledger, and executor pipeline.
   * Implements SA-EXEC-060–068.
   */
  async executeAction(request: ExecuteActionRequest): Promise<ChainExecutionResult> {
    return this.executeChain({
      ...request,
      steps: [
        {
          actionId: request.actionId,
          params: request.params,
          targetSurfaceId: request.targetSurfaceId,
          surfaceTimeoutMs: request.surfaceTimeoutMs,
        },
      ],
    }).done;
  }
  /**
   * Starts ordered chain execution and returns its live record, settlement, and aggregate undo.
   * Implements SA-EXEC-080–100.
   */
  executeChain(request: ExecuteChainRequest): ChainExecutionRun {
    const steps = request.steps.map((step, index) => this.compile(step, index));
    const record = this.options.ledger.createInvocation({
      surfaceRef: request.surfaceId,
      intent: { text: request.intent },
      initiator: request.initiator,
      steps: steps.map((step) => ({
        stepId: step.stepId,
        actionId: step.action.id,
        params: step.params,
        writes: step.action.writes,
        sensitive: step.action.effects.sensitive,
      })),
    });
    const policyInputs: PolicyInputs = {
      ...request,
      currentSurface: request.surfaceId,
      availability: {
        isActionAvailableOnSurface: (actionId, surfaceId) => {
          const declaredTarget = steps.find((step) => step.action.id === actionId)?.targetSurfaceId;
          // A declared destination may register after navigation; SA-EXEC validates
          // its liveness and predicates again at the actual cross-surface boundary.
          return declaredTarget
            ? this.options.registry.isCapabilityOnSurface(actionId, declaredTarget)
            : this.options.registry.isActionAvailableOnSurface(actionId, surfaceId);
        },
      },
    };
    const chainPolicy = resolveChainPolicy(
      steps.map((step) => step.action),
      policyInputs,
    );
    this.options.ledger.appendPolicyDecision(record.recordId, chainPolicy);
    let currentSurface = request.surfaceId;
    let undoRequested = false;
    let approvedSuffixAt: number | undefined;
    let approvalController: AbortController | undefined;
    let active: { controller: AbortController; settled: Promise<void> } | undefined;
    const undoAll = async () => {
      undoRequested = true;
      approvalController?.abort();
      active?.controller.abort();
      this.markUnstarted(record.recordId, steps, "canceled");
      if (active) await active.settled.catch(() => undefined);
      return undoAllRecord(this.options.ledger, record.recordId, this.context(currentSurface), {
        allowPartial: true,
      });
    };
    const done = (async (): Promise<ChainExecutionResult> => {
      try {
        if (
          chainPolicy.finalMode === "Read-only" ||
          chainPolicy.finalMode === "Refuse / hand off"
        ) {
          this.markUnstarted(record.recordId, steps, "skipped");
          return this.result(record.recordId, "refused", {
            code: chainPolicy.finalMode === "Read-only" ? "read_only_policy" : "policy_refused",
            message: chainPolicy.refusalReason ?? "Policy prevented action execution.",
          });
        }
        if (chainPolicy.finalMode === "Plan preview") {
          const gate = await this.gate(record.recordId, steps, chainPolicy, 0, (controller) => {
            approvalController = controller;
          });
          if (gate) return gate;
        }
        for (let index = 0; index < steps.length; index += 1) {
          const step = steps[index];
          if (undoRequested) continue;
          const stepPolicy = resolveActionPolicy(step.action, { ...policyInputs, currentSurface });
          this.options.ledger.appendPolicyDecision(record.recordId, stepPolicy);
          if (stepPolicy.finalMode === "Refuse / hand off") {
            this.markUnstarted(record.recordId, steps.slice(index), "skipped");
            return this.result(record.recordId, "refused", {
              stepId: step.stepId,
              code: "policy_refused",
              message: "Policy refused this action.",
            });
          }
          if (
            chainPolicy.finalMode !== "Plan preview" &&
            stepPolicy.finalMode === "Gated suffix" &&
            approvedSuffixAt === undefined
          ) {
            const gate = await this.gate(
              record.recordId,
              steps.slice(index),
              chainPolicy,
              index,
              (controller) => {
                approvalController = controller;
              },
            );
            if (gate) return gate;
            approvedSuffixAt = index;
          }
          if (chainPolicy.finalMode !== "Plan preview" && stepPolicy.finalMode === "Step-gated") {
            const gate = await this.gate(
              record.recordId,
              [step],
              stepPolicy,
              index,
              (controller) => {
                approvalController = controller;
              },
            );
            if (gate) {
              this.markUnstarted(record.recordId, steps.slice(index + 1), "skipped");
              return gate;
            }
          }
          const controller = new AbortController();
          const running = this.executeStep(
            record.recordId,
            step,
            currentSurface,
            (surface) => {
              currentSurface = surface;
            },
            controller,
          );
          active = { controller, settled: running.then(() => undefined) };
          const failure = await running;
          active = undefined;
          if (failure) {
            this.markUnstarted(record.recordId, steps.slice(index + 1), "skipped");
            return this.result(record.recordId, "failed", failure);
          }
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
  private compile(proposal: ProposedActionStep, index: number): CompiledStep {
    const action = this.options.registry.requireAction(proposal.actionId);
    return {
      stepId: proposal.stepId ?? `step_${index + 1}`,
      action,
      params: this.options.registry.validateActionParams(action, proposal.params),
      targetSurfaceId: proposal.targetSurfaceId,
      surfaceTimeoutMs: proposal.surfaceTimeoutMs,
    };
  }
  private async gate(
    recordId: string,
    held: CompiledStep[],
    decision: PolicyDecision,
    start: number,
    setController: (controller: AbortController | undefined) => void,
  ): Promise<ChainExecutionResult | undefined> {
    const gateId = `gate_${recordId}_${start}`;
    held.forEach((step) =>
      this.options.ledger.updateStep(recordId, step.stepId, { status: "held" }),
    );
    this.options.ledger.setApproval(recordId, {
      status: "pending",
      gateId,
      actionIds: held.map((step) => step.action.id),
    });
    this.options.ledger.appendDisclosure(recordId, {
      kind: "held_suffix",
      message: `Held scope starts at step ${start + 1}.`,
      stepIds: held.map((step) => step.stepId),
    });
    const controller = new AbortController();
    setController(controller);
    const answer = await this.approval({
      gateId,
      recordId,
      mode: decision.requiredGate?.mode ?? decision.finalMode,
      heldSteps: held.map((step) => ({
        stepId: step.stepId,
        actionId: step.action.id,
        title: step.action.title,
        description: step.action.description,
        params: step.params,
      })),
      rationale: decision.rationale,
      materialEffects: decision.rationale.declarationMetadata,
      undoImplications: "Completed reversible steps remain undoable; held steps have not executed.",
      signal: controller.signal,
    });
    setController(undefined);
    if (answer.status === "declined") {
      this.options.ledger.setApproval(recordId, {
        status: "declined",
        gateId,
        actionIds: held.map((step) => step.action.id),
        reason: answer.reason,
      });
      this.markUnstarted(recordId, held, "skipped");
      return this.result(recordId, "declined");
    }
    this.options.ledger.setApproval(recordId, {
      status: "approved",
      gateId,
      actionIds: held.map((step) => step.action.id),
      reason: answer.reason,
    });
    return undefined;
  }
  private async executeStep(
    recordId: string,
    step: CompiledStep,
    source: SurfaceId,
    setSurface: (surface: SurfaceId) => void,
    controller: AbortController,
  ): Promise<ChainExecutionResult["failure"] | undefined> {
    let surface = source;
    if (step.targetSurfaceId && step.targetSurfaceId !== surface) {
      this.options.ledger.appendDisclosure(recordId, {
        kind: "cross_surface_wait",
        message: `Awaiting "${step.targetSurfaceId}" before ${step.action.id}.`,
        stepIds: [step.stepId],
      });
      const ready = await this.readiness.awaitReady({
        targetSurfaceId: step.targetSurfaceId,
        actionIds: [step.action.id],
        timeoutMs: step.surfaceTimeoutMs,
        signal: controller.signal,
      });
      if (!ready.ok) {
        const code = ready.reason === "timeout" ? "surface_readiness_timeout" : ready.reason;
        this.options.ledger.updateStep(recordId, step.stepId, {
          status: ready.reason === "canceled" ? "canceled" : "failed",
          undo: { noUndoReason: "step_never_completed" },
          executionResult: {
            ok: false,
            errorCode: code,
            errorSummary: `Destination "${ready.targetSurfaceId}" is not ready.`,
          },
        });
        this.options.ledger.appendDisclosure(recordId, {
          kind: "cross_surface_failure",
          message: `Cross-surface continuation failed at "${ready.targetSurfaceId}".`,
          stepIds: [step.stepId],
        });
        return {
          stepId: step.stepId,
          code,
          message: `Destination surface "${ready.targetSurfaceId}" did not become ready.`,
        };
      }
      surface = step.targetSurfaceId;
      setSurface(surface);
      this.options.ledger.appendDisclosure(recordId, {
        kind: "cross_surface_continue",
        message: `Destination "${surface}" is ready; continuing ${step.action.id}.`,
        stepIds: [step.stepId],
      });
    }
    if (!this.options.registry.isActionAvailableOnSurface(step.action.id, surface)) {
      this.options.ledger.updateStep(recordId, step.stepId, {
        status: "failed",
        undo: { noUndoReason: "step_never_completed" },
        executionResult: {
          ok: false,
          errorCode: "action_unavailable",
          errorSummary: `Action "${step.action.id}" is unavailable.`,
        },
      });
      return {
        stepId: step.stepId,
        code: "action_unavailable",
        message: `Action "${step.action.id}" is unavailable.`,
      };
    }
    let snapshot: StateSnapshot | undefined;
    if (
      this.options.snapshotStore &&
      step.action.reversibility.kind !== "irreversible" &&
      step.action.writes.length > 0
    ) {
      try {
        snapshot = await this.options.snapshotStore.capture(step.action.writes);
      } catch (error) {
        this.options.ledger.updateStep(recordId, step.stepId, {
          status: "failed",
          undo: { noUndoReason: "snapshot_capture_unavailable" },
          executionResult: {
            ok: false,
            errorCode: "snapshot_capture_failed",
            errorSummary: error instanceof Error ? error.message : String(error),
          },
        });
        return {
          stepId: step.stepId,
          code: "snapshot_capture_failed",
          message: "Snapshot capture failed before the action ran.",
        };
      }
    }
    this.options.ledger.updateStep(recordId, step.stepId, {
      status: "running",
      undo:
        step.action.reversibility.kind === "irreversible"
          ? { noUndoReason: "honest_irreversible" }
          : { status: "pending_snapshot_capture" },
    });
    try {
      if (controller.signal.aborted) throw new Error("Action canceled before execution.");
      const context = this.context(surface, controller.signal);
      const result = await step.action.execute(step.params, context);
      const observations = step.action.observe ? await step.action.observe(context) : undefined;
      const handle = createUndoHandleForAction(step.action, {
        recordId,
        stepId: step.stepId,
        params: step.params,
        result,
        snapshot,
      });
      this.options.ledger.updateStep(recordId, step.stepId, {
        status: "succeeded",
        executionResult: { ok: true, result },
        observations,
      });
      if ("noUndoReason" in handle) {
        this.options.ledger.updateStep(recordId, step.stepId, { undo: handle });
        this.options.ledger.appendDisclosure(recordId, {
          kind: "no_undo",
          message: `Step ${step.stepId} has no undo handle: ${handle.noUndoReason}.`,
          stepIds: [step.stepId],
        });
      } else this.options.ledger.attachUndoHandle(recordId, step.stepId, handle);
      return undefined;
    } catch (error) {
      const canceled = controller.signal.aborted;
      this.options.ledger.updateStep(recordId, step.stepId, {
        status: canceled ? "canceled" : "failed",
        undo: { noUndoReason: "step_never_completed" },
        executionResult: {
          ok: false,
          errorCode: canceled ? "execution_canceled" : "executor_failed",
          errorSummary: error instanceof Error ? error.message : String(error),
        },
      });
      return {
        stepId: step.stepId,
        code: canceled ? "execution_canceled" : "executor_failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  private context(surfaceId: SurfaceId, signal?: AbortSignal): ActionExecutionContext {
    return {
      registry: this.options.registry,
      surfaceId,
      snapshotStore: this.options.snapshotStore,
      signal,
      now: this.now,
    };
  }
  private markUnstarted(
    recordId: string,
    steps: CompiledStep[],
    status: "skipped" | "canceled",
  ): void {
    const record = this.options.ledger.requireRecord(recordId);
    steps.forEach((step) => {
      const current = record.steps.find((entry) => entry.stepId === step.stepId);
      if (current && (current.status === "proposed" || current.status === "held"))
        this.options.ledger.updateStep(recordId, step.stepId, {
          status,
          undo: { noUndoReason: "step_never_started" },
          executionResult: {
            ok: false,
            errorCode: status === "canceled" ? "execution_canceled" : "step_skipped",
            errorSummary: "Step did not start.",
          },
        });
    });
  }
  private result(
    recordId: string,
    status: ChainExecutionResult["status"],
    failure?: ChainExecutionResult["failure"],
  ): ChainExecutionResult {
    return { recordId, status, record: this.options.ledger.requireRecord(recordId), failure };
  }
}
