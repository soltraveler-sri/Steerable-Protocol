import type {
  ActionExecutionContext,
  AnyCompiledActionDeclaration,
  CapabilityRegistry,
  MaybePromise,
  StateKey,
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

/**
 * Exactly the step the engine is about to run, handed to a host pre-execution barrier.
 * Implements SA-EXEC-005, SA-EXEC-012, and SA-LED-141.
 */
export interface PreExecutionRequest {
  recordId: string;
  stepId: string;
  actionId: string;
  /** Validated parameters the engine will pass to the executor. */
  params: unknown;
  /** Surface the action will run against, after any cross-surface transition. */
  surfaceId: SurfaceId;
  /** Declared state keys this step may write. */
  writes: StateKey[];
  signal?: AbortSignal;
}
/**
 * Host-owned barrier evaluated immediately before an action executes.
 *
 * The engine already awaits every ledger write, so the records policy requires before execution
 * have reported success by the time this runs (SA-LED-141). This seam exists for the barriers the
 * engine cannot know about: flushing a batched durable ledger, confirming an external audit write
 * landed, or re-checking host authorization at the last possible moment. It is the supported
 * alternative to wrapping the registry from outside, which cannot report its refusal as a legible
 * execution outcome.
 *
 * Returning (or resolving) permits the step. Throwing or rejecting means the step MUST NOT run: the
 * engine records the step as failed with a `pre_execution_barrier_failed` outcome carrying the
 * thrown message, skips the remainder of the chain, and settles the chain as failed. It never
 * swallows the refusal. An absent hook permits every step, preserving prior behavior.
 *
 * Implements SA-EXEC-011, SA-EXEC-012, SA-CONF-068, and SA-LED-141.
 */
export type PreExecutionHook = (request: PreExecutionRequest) => MaybePromise<void>;

/**
 * Raised when a ledger write that policy requires before execution does not report success.
 *
 * SA-LED-141 makes the write's outcome a precondition of authorizing the execution it covers, so an
 * unreported write is a hard stop rather than a warning. Implements SA-LED-141 and SA-EXEC-012.
 */
export class LedgerDurabilityError extends Error {
  /** Stable machine-readable code for runtime and host error mapping. */
  readonly code = "ledger_write_failed";
  /** Creates a legible pre-execution durability failure. Implements SA-LED-141. */
  constructor(operation: string, cause: unknown) {
    super(
      `Ledger write "${operation}" failed, so the affected execution was not authorized. ` +
        `Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = "LedgerDurabilityError";
  }
}

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
/**
 * Running chain handle exposing settlement, aggregate undo, and current record.
 *
 * The handle is only produced once the invocation record has been durably written, so `recordId`
 * always names a record that exists. `getRecord` returns `MaybePromise` because a durable backend
 * reads asynchronously. Implements SA-EXEC-085–089 and SA-LED-141.
 */
export interface ChainExecutionRun {
  recordId: string;
  done: Promise<ChainExecutionResult>;
  undoAll(): Promise<UndoAllResult>;
  getRecord(): MaybePromise<SteeringInvocationRecord>;
}
interface CompiledStep {
  stepId: string;
  action: AnyCompiledActionDeclaration;
  params: unknown;
  targetSurfaceId?: SurfaceId;
  surfaceTimeoutMs?: number;
}
/** A proposed step with its stable ID and the declaration it names, if any resolves. */
interface ResolvedProposal {
  stepId: string;
  proposal: ProposedActionStep;
  action: AnyCompiledActionDeclaration | undefined;
}
/** A step the engine could not compile, kept as data so it can be recorded. */
interface CompileFailure {
  stepId: string;
  code: "unknown_action" | "invalid_params";
  message: string;
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
  private readonly preExecution: PreExecutionHook;
  /**
   * Creates an engine around host-owned registry, ledger, snapshot, readiness, approval, and
   * pre-execution seams. Implements SA-EXEC-001–012 and SA-LED-141.
   */
  constructor(
    private readonly options: {
      registry: CapabilityRegistry;
      ledger: ActionLedger;
      snapshotStore?: StateSnapshotAdapter;
      surfaceReadiness?: SurfaceReadiness;
      approvalHook?: ApprovalHook;
      /** Host barrier run immediately before each executor call. Implements SA-LED-141. */
      preExecutionHook?: PreExecutionHook;
      now?: () => Date;
    },
  ) {
    this.readiness = options.surfaceReadiness ?? new RegistrySurfaceReadiness(options.registry);
    this.now = options.now ?? (() => new Date());
    this.approval =
      options.approvalHook ??
      (async () => ({ status: "declined" as const, reason: "no_approval_hook_attached" }));
    this.preExecution = options.preExecutionHook ?? (() => undefined);
  }
  /**
   * Direct-dispatches one action through the registry, policy, ledger, and executor pipeline.
   * Implements SA-EXEC-060–068.
   */
  async executeAction(request: ExecuteActionRequest): Promise<ChainExecutionResult> {
    const run = await this.executeChain({
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
  /**
   * Records the proposed intent, then starts ordered chain execution.
   *
   * The invocation record is written from the raw, uncompiled request *before* any action is
   * resolved or any parameter is validated, and the returned promise does not resolve until that
   * write has reported success. That ordering is what lets the two most common model failure modes —
   * a hallucinated action ID and a malformed parameter payload — settle as a recorded `refused`
   * outcome that names the offending step and reports skipped scope for the rest of the chain.
   * SA-CONF-068 requires exactly that: forcing a missing action or invalid params must stop
   * execution and *report completed/held/skipped/failed/undo scope*. Raising a bare
   * `RegistryCompileError` past the ledger stops execution but reports no scope at all. Recording
   * the attempt also keeps the submitted intent in the trail (SA-LED-002). The `unknown_action` /
   * `invalid_params` split mirrors the `unknown_tool` / `invalid_params` distinction
   * `createEcosystemAdapter.canUseTool` already draws.
   *
   * Returning a promise also makes the signature honest: this method previously advertised a
   * synchronous `ChainExecutionRun` and then threw, so callers could not reach `.done.catch()` and
   * saw a different failure protocol here than from the `async` `executeAction`.
   *
   * If the invocation write itself fails, no execution is authorized and this promise rejects with
   * a legible `LedgerDurabilityError` rather than proceeding unrecorded (SA-LED-141).
   *
   * Implements SA-EXEC-080–100, SA-EXEC-011, SA-EXEC-012, SA-CONF-068, SA-LED-002, and SA-LED-141.
   */
  async executeChain(request: ExecuteChainRequest): Promise<ChainExecutionRun> {
    const proposals = request.steps.map((step, index) => ({
      stepId: step.stepId ?? `step_${index + 1}`,
      proposal: step,
      action: this.options.registry.getAction(step.actionId),
    }));
    // SA-LED-002: the intent is recorded before anything can reject it. `writes` and `sensitive`
    // come from the declaration when the action resolves, so redaction (SA-LED-130–134) still
    // applies to a known sensitive action even when its parameters turn out to be invalid.
    const record = await this.write("createInvocation", () =>
      this.options.ledger.createInvocation({
        surfaceRef: request.surfaceId,
        intent: { text: request.intent },
        initiator: request.initiator,
        steps: proposals.map((entry) => ({
          stepId: entry.stepId,
          actionId: entry.proposal.actionId,
          params: entry.proposal.params,
          writes: entry.action?.writes ?? [],
          sensitive: entry.action?.effects.sensitive,
        })),
      }),
    );
    const compiled = this.compileAll(proposals);
    if (!compiled.ok) {
      const settled = await this.refuseCompile(record.recordId, proposals, compiled.failure);
      return {
        recordId: record.recordId,
        done: Promise.resolve(settled),
        undoAll: async () => ({
          status: "refused",
          undoneStepIds: [],
          notUndoneStepIds: [],
          disclosure: "Nothing executed: the chain was refused before compilation.",
        }),
        getRecord: () => this.options.ledger.requireRecord(record.recordId),
      };
    }
    const steps = compiled.steps;
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
    // SA-LED-141: the policy decision is a pre-execution required write, so its outcome is reported
    // before any step below is represented as authorized. A rejected durable write stops the chain.
    await this.write("appendPolicyDecision", () =>
      this.options.ledger.appendPolicyDecision(record.recordId, chainPolicy),
    );
    let currentSurface = request.surfaceId;
    let undoRequested = false;
    let approvedSuffixAt: number | undefined;
    let approvalController: AbortController | undefined;
    let active: { controller: AbortController; settled: Promise<void> } | undefined;
    const undoAll = async () => {
      undoRequested = true;
      approvalController?.abort();
      active?.controller.abort();
      await this.markUnstarted(record.recordId, steps, "canceled");
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
          await this.markUnstarted(record.recordId, steps, "skipped");
          return await this.result(record.recordId, "refused", {
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
          // SA-LED-141: pre-execution required write for this step's authorization.
          await this.write("appendPolicyDecision", () =>
            this.options.ledger.appendPolicyDecision(record.recordId, stepPolicy),
          );
          if (stepPolicy.finalMode === "Refuse / hand off") {
            await this.markUnstarted(record.recordId, steps.slice(index), "skipped");
            return await this.result(record.recordId, "refused", {
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
              await this.markUnstarted(record.recordId, steps.slice(index + 1), "skipped");
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
          // `settled` exists only so undo-all can wait for the in-flight step to stop. The
          // authoritative outcome is taken from `await running` below, so this branch must not
          // surface the same rejection a second time as an unhandled one.
          active = {
            controller,
            settled: running.then(
              () => undefined,
              () => undefined,
            ),
          };
          const failure = await running;
          active = undefined;
          if (failure) {
            await this.markUnstarted(record.recordId, steps.slice(index + 1), "skipped");
            return await this.result(record.recordId, "failed", failure);
          }
        }
        return await this.result(record.recordId, undoRequested ? "canceled" : "succeeded");
      } catch (error) {
        const failure = {
          code: error instanceof LedgerDurabilityError ? error.code : "execution_error",
          message: error instanceof Error ? error.message : String(error),
        };
        try {
          return await this.result(record.recordId, "failed", failure);
        } catch {
          // The ledger itself is unreachable, so it cannot carry the outcome. Surface the original
          // failure to the caller rather than reporting a settled result we cannot substantiate.
          // Implements SA-EXEC-012 and SA-LED-141.
          throw error;
        }
      }
    })();
    return {
      recordId: record.recordId,
      done,
      undoAll,
      getRecord: () => this.options.ledger.requireRecord(record.recordId),
    };
  }
  /**
   * Awaits one ledger write and reports its failure as a durability barrier rather than a silent gap.
   *
   * Awaiting *is* the barrier: a synchronous in-memory backend resolves immediately and behaves
   * exactly as before, while a durable backend's promise settlement is the success-or-failure report
   * SA-LED-141 requires before the covered execution may be authorized.
   *
   * Implements SA-LED-141 and SA-LED-144.
   */
  private async write<T>(operation: string, run: () => MaybePromise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof LedgerDurabilityError) throw error;
      throw new LedgerDurabilityError(operation, error);
    }
  }
  /**
   * Resolves and validates every proposed step without throwing.
   *
   * Unknown action IDs and invalid parameter payloads are the two most common model failure modes,
   * so they are returned as data for the caller to record rather than raised past the ledger. This
   * mirrors the `unknown_tool` / `invalid_params` distinction `createEcosystemAdapter.canUseTool`
   * already draws. Implements SA-EXEC-011, SA-EXEC-012, and SA-CONF-068.
   */
  private compileAll(
    proposals: ResolvedProposal[],
  ): { ok: true; steps: CompiledStep[] } | { ok: false; failure: CompileFailure } {
    const steps: CompiledStep[] = [];
    for (const entry of proposals) {
      if (!entry.action)
        return {
          ok: false,
          failure: {
            stepId: entry.stepId,
            code: "unknown_action",
            message: `Unknown action "${entry.proposal.actionId}".`,
          },
        };
      let params: unknown;
      try {
        params = this.options.registry.validateActionParams(entry.action, entry.proposal.params);
      } catch (error) {
        return {
          ok: false,
          failure: {
            stepId: entry.stepId,
            code: "invalid_params",
            message:
              `Invalid parameters for "${entry.proposal.actionId}": ` +
              (error instanceof Error ? error.message : String(error)),
          },
        };
      }
      steps.push({
        stepId: entry.stepId,
        action: entry.action,
        params,
        targetSurfaceId: entry.proposal.targetSurfaceId,
        surfaceTimeoutMs: entry.proposal.surfaceTimeoutMs,
      });
    }
    return { ok: true, steps };
  }
  /**
   * Records an uncompilable chain as a legible refusal against the already-durable record.
   *
   * The offending step carries the failure code and message; every other proposed step is marked
   * skipped so the trail reports the skipped scope SA-CONF-068's procedure asks for rather than
   * leaving it to be inferred from an exception. Implements SA-EXEC-011, SA-EXEC-012, SA-CONF-068,
   * and SA-LED-002.
   */
  private async refuseCompile(
    recordId: string,
    proposals: ResolvedProposal[],
    failure: CompileFailure,
  ): Promise<ChainExecutionResult> {
    await this.write("appendDisclosure", () =>
      this.options.ledger.appendDisclosure(recordId, {
        kind: "held_suffix",
        message: `Nothing executed: ${failure.message}`,
        stepIds: proposals.map((entry) => entry.stepId),
      }),
    );
    for (const entry of proposals) {
      const offending = entry.stepId === failure.stepId;
      await this.write("updateStep", () =>
        this.options.ledger.updateStep(recordId, entry.stepId, {
          status: offending ? "failed" : "skipped",
          undo: { noUndoReason: "step_never_started" },
          executionResult: {
            ok: false,
            errorCode: offending ? failure.code : "step_skipped",
            errorSummary: offending ? failure.message : `Step did not start: ${failure.message}`,
          },
        }),
      );
    }
    return this.result(recordId, "refused", failure);
  }
  private async gate(
    recordId: string,
    held: CompiledStep[],
    decision: PolicyDecision,
    start: number,
    setController: (controller: AbortController | undefined) => void,
  ): Promise<ChainExecutionResult | undefined> {
    const gateId = `gate_${recordId}_${start}`;
    for (const step of held)
      await this.write("updateStep", () =>
        this.options.ledger.updateStep(recordId, step.stepId, { status: "held" }),
      );
    await this.write("setApproval", () =>
      this.options.ledger.setApproval(recordId, {
        status: "pending",
        gateId,
        actionIds: held.map((step) => step.action.id),
      }),
    );
    await this.write("appendDisclosure", () =>
      this.options.ledger.appendDisclosure(recordId, {
        kind: "held_suffix",
        message: `Held scope starts at step ${start + 1}.`,
        stepIds: held.map((step) => step.stepId),
      }),
    );
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
      await this.write("setApproval", () =>
        this.options.ledger.setApproval(recordId, {
          status: "declined",
          gateId,
          actionIds: held.map((step) => step.action.id),
          reason: answer.reason,
        }),
      );
      await this.markUnstarted(recordId, held, "skipped");
      return this.result(recordId, "declined");
    }
    // SA-LED-141: the approval record is required before the held scope may run, so its write
    // reports success before any held step is represented as authorized.
    await this.write("setApproval", () =>
      this.options.ledger.setApproval(recordId, {
        status: "approved",
        gateId,
        actionIds: held.map((step) => step.action.id),
        reason: answer.reason,
      }),
    );
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
      await this.write("appendDisclosure", () =>
        this.options.ledger.appendDisclosure(recordId, {
          kind: "cross_surface_wait",
          message: `Awaiting "${step.targetSurfaceId}" before ${step.action.id}.`,
          stepIds: [step.stepId],
        }),
      );
      const ready = await this.readiness.awaitReady({
        targetSurfaceId: step.targetSurfaceId,
        actionIds: [step.action.id],
        timeoutMs: step.surfaceTimeoutMs,
        signal: controller.signal,
      });
      if (!ready.ok) {
        const code = ready.reason === "timeout" ? "surface_readiness_timeout" : ready.reason;
        await this.write("updateStep", () =>
          this.options.ledger.updateStep(recordId, step.stepId, {
            status: ready.reason === "canceled" ? "canceled" : "failed",
            undo: { noUndoReason: "step_never_completed" },
            executionResult: {
              ok: false,
              errorCode: code,
              errorSummary: `Destination "${ready.targetSurfaceId}" is not ready.`,
            },
          }),
        );
        await this.write("appendDisclosure", () =>
          this.options.ledger.appendDisclosure(recordId, {
            kind: "cross_surface_failure",
            message: `Cross-surface continuation failed at "${ready.targetSurfaceId}".`,
            stepIds: [step.stepId],
          }),
        );
        return {
          stepId: step.stepId,
          code,
          message: `Destination surface "${ready.targetSurfaceId}" did not become ready.`,
        };
      }
      surface = step.targetSurfaceId;
      setSurface(surface);
      await this.write("appendDisclosure", () =>
        this.options.ledger.appendDisclosure(recordId, {
          kind: "cross_surface_continue",
          message: `Destination "${surface}" is ready; continuing ${step.action.id}.`,
          stepIds: [step.stepId],
        }),
      );
    }
    if (!this.options.registry.isActionAvailableOnSurface(step.action.id, surface)) {
      await this.write("updateStep", () =>
        this.options.ledger.updateStep(recordId, step.stepId, {
          status: "failed",
          undo: { noUndoReason: "step_never_completed" },
          executionResult: {
            ok: false,
            errorCode: "action_unavailable",
            errorSummary: `Action "${step.action.id}" is unavailable.`,
          },
        }),
      );
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
        await this.write("updateStep", () =>
          this.options.ledger.updateStep(recordId, step.stepId, {
            status: "failed",
            undo: { noUndoReason: "snapshot_capture_unavailable" },
            executionResult: {
              ok: false,
              errorCode: "snapshot_capture_failed",
              errorSummary: error instanceof Error ? error.message : String(error),
            },
          }),
        );
        return {
          stepId: step.stepId,
          code: "snapshot_capture_failed",
          message: "Snapshot capture failed before the action ran.",
        };
      }
    }
    // SA-LED-141: the last write required before this execution is authorized. Awaiting it means a
    // durable backend has confirmed the step is on record before the executor is ever called.
    await this.write("updateStep", () =>
      this.options.ledger.updateStep(recordId, step.stepId, {
        status: "running",
        undo:
          step.action.reversibility.kind === "irreversible"
            ? { noUndoReason: "honest_irreversible" }
            : { status: "pending_snapshot_capture" },
      }),
    );
    // Host-owned barrier: the supported place to enforce additional durability or authorization
    // guarantees the engine cannot know about, without wrapping the registry from outside.
    // Implements SA-EXEC-005 and SA-LED-141.
    try {
      await this.preExecution({
        recordId,
        stepId: step.stepId,
        actionId: step.action.id,
        params: step.params,
        surfaceId: surface,
        writes: [...step.action.writes],
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.write("updateStep", () =>
        this.options.ledger.updateStep(recordId, step.stepId, {
          status: "failed",
          undo: { noUndoReason: "step_never_completed" },
          executionResult: {
            ok: false,
            errorCode: "pre_execution_barrier_failed",
            errorSummary: message,
          },
        }),
      );
      return {
        stepId: step.stepId,
        code: "pre_execution_barrier_failed",
        message: `The pre-execution barrier refused this step, so it was not run: ${message}`,
      };
    }
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
      await this.write("updateStep", () =>
        this.options.ledger.updateStep(recordId, step.stepId, {
          status: "succeeded",
          executionResult: { ok: true, result },
          observations,
        }),
      );
      if ("noUndoReason" in handle) {
        await this.write("updateStep", () =>
          this.options.ledger.updateStep(recordId, step.stepId, { undo: handle }),
        );
        await this.write("appendDisclosure", () =>
          this.options.ledger.appendDisclosure(recordId, {
            kind: "no_undo",
            message: `Step ${step.stepId} has no undo handle: ${handle.noUndoReason}.`,
            stepIds: [step.stepId],
          }),
        );
      } else
        await this.write("attachUndoHandle", () =>
          this.options.ledger.attachUndoHandle(recordId, step.stepId, handle),
        );
      return undefined;
    } catch (error) {
      const canceled = controller.signal.aborted;
      await this.write("updateStep", () =>
        this.options.ledger.updateStep(recordId, step.stepId, {
          status: canceled ? "canceled" : "failed",
          undo: { noUndoReason: "step_never_completed" },
          executionResult: {
            ok: false,
            errorCode: canceled ? "execution_canceled" : "executor_failed",
            errorSummary: error instanceof Error ? error.message : String(error),
          },
        }),
      );
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
  private async markUnstarted(
    recordId: string,
    steps: CompiledStep[],
    status: "skipped" | "canceled",
  ): Promise<void> {
    const record = await this.options.ledger.requireRecord(recordId);
    for (const step of steps) {
      const current = record.steps.find((entry) => entry.stepId === step.stepId);
      if (current && (current.status === "proposed" || current.status === "held"))
        await this.write("updateStep", () =>
          this.options.ledger.updateStep(recordId, step.stepId, {
            status,
            undo: { noUndoReason: "step_never_started" },
            executionResult: {
              ok: false,
              errorCode: status === "canceled" ? "execution_canceled" : "step_skipped",
              errorSummary: "Step did not start.",
            },
          }),
        );
    }
  }
  private async result(
    recordId: string,
    status: ChainExecutionResult["status"],
    failure?: ChainExecutionResult["failure"],
  ): Promise<ChainExecutionResult> {
    return {
      recordId,
      status,
      record: await this.options.ledger.requireRecord(recordId),
      failure,
    };
  }
}
