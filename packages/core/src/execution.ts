import type {
  ActionExecutionContext,
  AnyCompiledActionDeclaration,
  CapabilityRegistry,
  MaybePromise,
  RegistryAvailabilityView,
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
/**
 * Engine-internal sentinel returned by the approval wait when its finite bound elapses before the
 * host answers. It is intentionally *not* an `ApprovalDecision`: expiry is derived by the engine,
 * never a host decision, so it cannot be confused with an `approved`/`declined`/`canceled` answer
 * the host actually returned. Implements SA-LED-036.
 */
const APPROVAL_EXPIRED = Symbol("approval-expired");
/** Target surface, required actions, and cancellation bounds for a readiness wait. Implements SA-EXEC-163–168. */
export interface SurfaceReadinessRequest {
  targetSurfaceId: SurfaceId;
  actionIds: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
  /**
   * Per-request availability view whose liveness the readiness check reads, instead of the
   * registry's shared instance state. Optional and backward compatible: when omitted, a
   * registry-backed readiness reads its own instance liveness (the SPA path). Supplying it keeps a
   * cross-surface readiness wait scoped to the requesting principal (`SA-DECL-097`).
   */
  availability?: RegistryAvailabilityView;
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
/**
 * Host decision for exactly the supplied approval scope.
 *
 * `canceled` exists so a hook honoring `request.signal` — a user invoking aggregate undo mid-gate —
 * can report an honest cancellation instead of fabricating a `declined` the user never made. It
 * settles the held scope as `canceled` (never `succeeded`) and records a `canceled` approval, making
 * SA-LED-036's already-declared `canceled` approval vocabulary reachable.
 *
 * Implements SA-EXEC-088, SA-EXEC-094–096, SA-EXEC-132–136, and SA-LED-036.
 */
export type ApprovalDecision =
  | { status: "approved"; approvedBy?: string; reason?: string }
  | { status: "declined"; declinedBy?: string; reason?: string }
  | { status: "canceled"; canceledBy?: string; reason?: string };
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
  /**
   * Per-request availability view the engine resolves policy and re-checks surface availability
   * against. Optional and backward compatible: when omitted, the engine uses the registry's own
   * default view (the single-principal SPA path, unchanged). A server that hoists one compiled
   * registry to a module singleton passes `registry.withLiveness(perRequestState)` so this
   * invocation's liveness and precondition state are scoped to its principal and never satisfied by
   * another principal's registrations (`SA-DECL-097`). Implements SA-DECL-097 and SA-POL-104–105.
   */
  availability?: RegistryAvailabilityView;
}
/** Single-action direct-dispatch request. Implements SA-EXEC-060–068. */
export interface ExecuteActionRequest extends Omit<ExecuteChainRequest, "steps"> {
  actionId: string;
  params: unknown;
  targetSurfaceId?: SurfaceId;
  surfaceTimeoutMs?: number;
}
/**
 * Settled execution status with its authoritative ledger record.
 *
 * `expired` is the terminal state for a gate whose bounded approval wait elapsed before the host
 * answered (see `ExecutionEngine`'s `approvalTimeoutMs`). It is a distinct outcome from `declined`
 * (the host answered "no") and `canceled` (aggregate undo cut the gate short): the held scope did
 * not run and no host decision was ever made, so the honest record is `expired`, the `SA-LED-036`
 * approval vocabulary that B2 left declared-but-unreachable.
 *
 * Implements SA-EXEC-009, SA-EXEC-012, and SA-LED-036.
 */
export interface ChainExecutionResult {
  recordId: string;
  status: "succeeded" | "failed" | "declined" | "canceled" | "refused" | "expired";
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
          missingActionIds: this.missing(request, request.availability ?? this.registry),
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
    // Read liveness through the per-request view when one is supplied, so a cross-surface wait for
    // one principal never observes another principal's registrations (SA-DECL-097). Absent a view,
    // this reads the registry's own instance liveness, unchanged for the SPA path. The subscription
    // in `awaitReady` remains instance-based: it is the reactive SPA mechanism for a surface that
    // mounts asynchronously; a per-request state is fixed for the request and settles on the
    // immediate check below.
    const availability = request.availability ?? this.registry;
    const missingActionIds = this.missing(request, availability);
    return missingActionIds.length === 0
      ? { ok: true, targetSurfaceId: request.targetSurfaceId }
      : {
          ok: false,
          targetSurfaceId: request.targetSurfaceId,
          reason: availability.isSurfaceLive(request.targetSurfaceId)
            ? "capability_unavailable"
            : "timeout",
          missingActionIds,
        };
  }
  private missing(
    request: SurfaceReadinessRequest,
    availability: RegistryAvailabilityView,
  ): string[] {
    return request.actionIds.filter(
      (actionId) => !availability.isActionAvailableOnSurface(actionId, request.targetSurfaceId),
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
  private readonly approvalTimeoutMs: number | undefined;
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
      /**
       * Finite upper bound, in milliseconds, on how long a gate waits for the host `ApprovalHook`
       * before the wait *expires*: the approval is recorded `expired`, its held steps are marked
       * `skipped`, and the chain settles `expired` (`SA-LED-036`). This is the approval-gate analogue
       * of `DEFAULT_SURFACE_READINESS_TIMEOUT_MS` for the cross-surface readiness wait
       * (`SA-EXEC-166`/`SA-EXEC-167`), and it exists so a server adopter awaiting `executeChain().done`
       * across an HTTP request whose user closes the tab or never answers does not hold the promise,
       * the record at `pending`, and the steps at `held` forever — the "stale approvals" door-two
       * blocker named in `SA-BRIDGE` §11.
       *
       * Unlike surface readiness — whose finite bound and 5000 ms default are a normative MUST
       * (`SA-EXEC-166`/`SA-EXEC-167`) because it waits on a surface mounting — an approval waits on a
       * *human*, and no spec requirement bounds that wait to any particular value. So the default is
       * deliberately `undefined` (equivalently `Infinity`): **no timeout**, preserving the pre-N10
       * indefinite wait byte-for-byte for every existing caller and keeping the change non-breaking.
       * A host that needs the bound opts in by supplying a finite value.
       */
      approvalTimeoutMs?: number;
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
    this.approvalTimeoutMs = options.approvalTimeoutMs;
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
    // Every availability read for this invocation — the policy shim below, the cross-surface
    // readiness wait, and the boundary re-check in `executeStep` — goes through this one view. When
    // the caller supplies none, it is the registry's own default view, so the SPA path is byte-for-
    // byte unchanged; a server passes `registry.withLiveness(perRequestState)` and this invocation's
    // liveness is scoped to its principal (SA-DECL-097). B1 is only fully closed because all three
    // sites read the same view, not raw instance liveness.
    const availabilityView = request.availability ?? this.options.registry.defaultView;
    const policyInputs: PolicyInputs = {
      ...request,
      currentSurface: request.surfaceId,
      availability: {
        isActionAvailableOnSurface: (actionId, surfaceId) => {
          const declaredTarget = steps.find((step) => step.action.id === actionId)?.targetSurfaceId;
          // B11 preserved: a declared destination may register after navigation, so plan-time
          // availability collapses to declared surface membership and SA-EXEC re-validates the
          // destination's liveness and predicates at the actual cross-surface boundary (the
          // `executeStep` check below). The refactor only changes the *source* of liveness from raw
          // instance state to the per-request view; the deferral shape is unchanged.
          return declaredTarget
            ? availabilityView.isCapabilityOnSurface(actionId, declaredTarget)
            : availabilityView.isActionAvailableOnSurface(actionId, surfaceId);
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
    // A gate is a settleable segment just like an in-flight step: `pendingGate` resolves when the
    // current gate has fully settled, so undo-all can *await* it rather than race it (SA-EXEC-088).
    let pendingGate: Promise<void> | undefined;
    /**
     * Runs one gate with its settlement registered, so undo-all can await it, and always clears the
     * pending handle even if the gate throws. Implements SA-EXEC-088 and SA-EXEC-092–096.
     */
    const runGate = async (
      held: CompiledStep[],
      decision: PolicyDecision,
      start: number,
    ): Promise<ChainExecutionResult | undefined> => {
      let settleGate!: () => void;
      pendingGate = new Promise<void>((resolve) => {
        settleGate = resolve;
      });
      try {
        return await this.gate(record.recordId, held, decision, start, (controller) => {
          approvalController = controller;
        });
      } finally {
        pendingGate = undefined;
        settleGate();
      }
    };
    const undoAll = async () => {
      undoRequested = true;
      approvalController?.abort();
      active?.controller.abort();
      // SA-EXEC-088: await gate settlement instead of racing it. When undo-all lands during a held
      // gate, `active` is undefined, so the previous code awaited nothing and returned
      // `succeeded`/`[]` while the held step then ran. Awaiting the pending gate lets the held step
      // settle as `canceled` first, so the reported outcome and the ledger agree.
      if (pendingGate) await pendingGate.catch(() => undefined);
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
          const gate = await runGate(steps, chainPolicy, 0);
          if (gate) return gate;
          // SA-EXEC-088: undo-all may have landed while this gate was held. A held step is
          // not-yet-started, so it MUST NOT run; settle canceled before building any executor.
          if (undoRequested) return await this.settleCanceled(record.recordId, steps);
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
            const gate = await runGate(steps.slice(index), chainPolicy, index);
            if (gate) return gate;
            // SA-EXEC-088: re-check after the gate — undo-all during the held gate cancels the
            // not-yet-started suffix before a fresh executor controller is ever built below.
            if (undoRequested)
              return await this.settleCanceled(record.recordId, steps.slice(index));
            approvedSuffixAt = index;
          }
          if (chainPolicy.finalMode !== "Plan preview" && stepPolicy.finalMode === "Step-gated") {
            const gate = await runGate([step], stepPolicy, index);
            if (gate) {
              await this.markUnstarted(record.recordId, steps.slice(index + 1), "skipped");
              return gate;
            }
            // SA-EXEC-088: the held step is not-yet-started; undo-all during its gate must cancel it
            // rather than fall through to execution.
            if (undoRequested)
              return await this.settleCanceled(record.recordId, steps.slice(index));
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
            availabilityView,
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
  /**
   * Waits for the host approval decision under the engine's configured finite bound.
   *
   * With no `approvalTimeoutMs` configured (the default), this is exactly `await this.approval(...)`:
   * the pre-N10 indefinite wait, byte-for-byte, so every existing caller and gate test is unchanged.
   * With a finite bound, the host decision races a timer; whichever settles first wins. A real answer
   * clears the timer (in `finally`, so a rejected hook clears it too and its rejection still
   * propagates, settling the chain `failed` exactly as before). If the timer wins, the wait expired
   * and the caller records the honest `expired` outcome. This composes with B2's cancellation model:
   * `request.signal` still fires only for aggregate undo, so a signal-honoring hook can still resolve
   * `canceled` — a decision that wins the same race — and expiry never masquerades as cancellation.
   *
   * Implements SA-LED-036 and mirrors the SA-EXEC-166–167 readiness-timeout defaulting discipline.
   */
  private async awaitApproval(
    request: ApprovalRequest,
  ): Promise<ApprovalDecision | typeof APPROVAL_EXPIRED> {
    const timeoutMs = this.approvalTimeoutMs;
    if (timeoutMs === undefined || timeoutMs === Infinity) return this.approval(request);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race<ApprovalDecision | typeof APPROVAL_EXPIRED>([
        this.approval(request),
        new Promise<typeof APPROVAL_EXPIRED>((resolve) => {
          timer = setTimeout(() => resolve(APPROVAL_EXPIRED), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
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
    const answer = await this.awaitApproval({
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
    if (answer === APPROVAL_EXPIRED) {
      // SA-LED-036 / SA-EXEC-166–167 precedent: the bounded approval wait elapsed with no host
      // answer. Expiry is a distinct terminal state from `canceled` (aggregate undo) and `declined`
      // (a "no" the host actually gave). The approval is recorded `expired` — not a fabricated
      // `declined`, the exact dishonesty B2 removed — the held steps are `skipped` (they never ran
      // and no one canceled them), and the chain settles `expired`. The host hook promise is
      // abandoned, never rejected; the engine does not abort `controller` here, so `request.signal`
      // keeps meaning exactly "aggregate-undo cancellation" as B2 defined it, never expiry.
      await this.write("setApproval", () =>
        this.options.ledger.setApproval(recordId, {
          status: "expired",
          gateId,
          actionIds: held.map((step) => step.action.id),
          reason: `Approval was not answered within ${this.approvalTimeoutMs} ms.`,
        }),
      );
      await this.markUnstarted(recordId, held, "skipped");
      return this.result(recordId, "expired");
    }
    if (answer.status === "canceled") {
      // SA-EXEC-088 / SA-LED-003: a hook honoring the undo signal cancels the held scope honestly.
      // The held steps settle as `canceled` (never rewritten to `succeeded`) and the approval is
      // recorded `canceled` — the vocabulary SA-LED-036 already declares — not a fabricated decline.
      await this.write("setApproval", () =>
        this.options.ledger.setApproval(recordId, {
          status: "canceled",
          gateId,
          actionIds: held.map((step) => step.action.id),
          reason: answer.reason,
        }),
      );
      await this.markUnstarted(recordId, held, "canceled");
      return this.result(recordId, "canceled");
    }
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
    availability: RegistryAvailabilityView,
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
        // Scope the readiness wait to this invocation's principal (SA-DECL-097). The default
        // RegistrySurfaceReadiness reads this view; a host-injected readiness may ignore it.
        availability,
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
    // B11 boundary re-check, now against the same per-request view policy was resolved with: the
    // plan-time shim deferred a cross-surface step's liveness/predicates to here, and this is where
    // they are honored for the actual destination surface — scoped to this invocation's principal
    // (SA-DECL-097), never raw shared instance liveness.
    if (!availability.isActionAvailableOnSurface(step.action.id, surface)) {
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
      // SA-LED-077: eagerly, in this same post-success write sequence, supersede any still-available
      // undo handle in *other* invocation records whose state keys this step just overwrote. Doing it
      // here — not lazily at undo time — is what keeps a stale successful undo promise from staying
      // visible in every trail and undo affordance for the whole window, and keeps a crash from ever
      // showing the new effect recorded while a superseded promise still reads as available.
      await this.supersedeStaleHandles(recordId, step);
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
  /**
   * Supersedes every still-available undo handle in *other* invocation records whose state keys the
   * just-succeeded step overwrote.
   *
   * Scope is cross-invocation only (Fable ruling 2): handles in the *same* record are left alone so
   * the chain's reverse-order aggregate undo (SA-LED-110/112) keeps composing. A superseded handle is
   * a persisted status transition on the handle record (SA-LED-077), not runtime-memory state, so it
   * survives restart and shows up in a durable trail; `runUndoHandle` then hard-refuses it.
   *
   * The supersede write is a post-success "later fact" (SA-LED-003 permits it, SA-LED-142 governs it).
   * If it fails, the step already ran and MUST NOT be retroactively failed; but leaving stale
   * availability would violate SA-LED-146, so the failure is disclosed as `degraded_ledger` and
   * surfaced rather than swallowed.
   *
   * Implements SA-LED-077, SA-LED-146, SA-LED-003, and SA-LED-142.
   */
  private async supersedeStaleHandles(recordId: string, step: CompiledStep): Promise<void> {
    if (step.action.writes.length === 0) return;
    // The whole sweep is a post-success later fact: the step already ran, so nothing here may throw
    // back into `executeStep` and retroactively fail it (SA-LED-003). Any failure — the query itself
    // or an individual supersede write — is disclosed as `degraded_ledger` (SA-LED-146) and swallowed.
    try {
      const stale = (await this.options.ledger.findAvailableUndoHandles(step.action.writes)).filter(
        (handle) => handle.recordId !== recordId,
      );
      for (const handle of stale) {
        const overlap = handle.stateKeys.filter((key) => step.action.writes.includes(key));
        const reason =
          `Superseded by step ${step.stepId} of ${recordId} (${step.action.id}), which overwrote ` +
          `shared state ${overlap.join(", ")}. Undoing this handle would destroy that later effect.`;
        try {
          await this.options.ledger.supersedeUndoHandle(handle.handleId, reason);
        } catch (error) {
          await this.discloseDegradedSupersede(recordId, step, handle, overlap, error);
        }
      }
    } catch (error) {
      // The state-key query itself failed; stale handles across other records may still read as
      // available. Disclose the degraded state against this record rather than failing the step.
      await this.discloseDegradedSupersede(
        recordId,
        step,
        undefined,
        [...step.action.writes],
        error,
      );
    }
  }
  /** Records a best-effort `degraded_ledger` disclosure for a failed supersession. Implements SA-LED-146. */
  private async discloseDegradedSupersede(
    recordId: string,
    step: CompiledStep,
    handle: { handleId: string; recordId: string } | undefined,
    keys: StateKey[],
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const target = handle
      ? `stale undo handle "${handle.handleId}" of ${handle.recordId}`
      : `stale undo handles overlapping ${keys.join(", ")}`;
    try {
      await this.options.ledger.appendDisclosure(recordId, {
        kind: "degraded_ledger",
        message:
          `Could not supersede ${target} after ${step.action.id} overwrote ${keys.join(", ")}: ` +
          `${message}. Those handles may still read as available; undoing one would destroy this ` +
          `step's effect.`,
        stepIds: [step.stepId],
      });
    } catch {
      // The ledger is unreachable for the disclosure too; the step still genuinely ran, so it is not
      // retroactively failed (SA-LED-003). Nothing further can be recorded here.
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
  /**
   * Settles a chain as canceled after aggregate undo landed during a gate, marking the remaining
   * not-yet-started steps canceled first so no held step is left runnable and the chain outcome is
   * internally consistent (`canceled` chain with `canceled`/`skipped` steps, never a `succeeded`
   * step). `markUnstarted` only patches `proposed`/`held` steps, so it composes safely with the
   * marking undo-all performs concurrently. Implements SA-EXEC-088, SA-EXEC-012, and SA-LED-003.
   */
  private async settleCanceled(
    recordId: string,
    remaining: CompiledStep[],
  ): Promise<ChainExecutionResult> {
    await this.markUnstarted(recordId, remaining, "canceled");
    return this.result(recordId, "canceled");
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
