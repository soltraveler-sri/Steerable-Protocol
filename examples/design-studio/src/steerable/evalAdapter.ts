import {
  applyDesignStoreEvent,
  createInitialDesignState,
  type DesignSetters,
  type DesignStoreEvent,
} from "../state/designStore";
import type { DesignState, ProjectMeta } from "../types";
import {
  ExecutionEngine,
  RegistrySurfaceReadiness,
  InMemoryLedger,
  extractLedgerTrace,
  runUndoHandle,
  undoAll as undoAllRecord,
  type ApprovalHook,
  type AutonomyMode,
  type PolicyInputs,
  type PolicyRationale,
  type PolicyOverride,
  type PosturePreset,
  type RuntimeSignalDemotion,
  type ScopedGrant,
  resolveActionPolicy,
  resolveChainPolicy,
  type SurfaceId,
} from "@steerable/core";
import type { ActionIntentRoute } from "./router";
import { ScriptedIntentRouter } from "./router";
import {
  createDesignStudioRegistry,
  createDesignStudioSnapshotAdapter,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
  type DesignStudioSurfaceId,
} from "./designStudioCapabilities";

const fixedNow = new Date("2026-07-09T12:00:00.000Z");

export const designStudioEvalTarget = {
  integrationId: "design-studio",
  registry: {
    id: "design-studio.registry",
    version: "2026-07-09",
    ref: "examples/design-studio/src/steerable/designStudioCapabilities.ts",
  },
};

type JsonObject = Record<string, unknown>;

interface EvalFixture {
  kind: string;
  given: JsonObject;
}

interface IntentGiven extends JsonObject {
  surfaceId: DesignStudioSurfaceId;
  utterance: string;
  posturePreset?: PosturePreset;
}

interface PolicyStep {
  stepId: string;
  actionId: string;
  surfaceId?: SurfaceId;
  params?: JsonObject;
}

interface PolicyGiven extends JsonObject {
  posturePreset: PosturePreset;
  surfaceId: SurfaceId;
  sessionContext?: JsonObject;
  runtimeSignals?: JsonObject;
  stickyGrants?: {
    grantId: string;
    subject: string;
    effect: AutonomyMode;
    expires: string;
  }[];
  proposed: {
    kind: "action" | "chain";
    steps: PolicyStep[];
  };
}

interface ReversibilityGiven extends JsonObject {
  executed: {
    scope: "single-action" | "chain";
    steps: {
      stepId: string;
      actionId: string;
      params?: JsonObject;
      status: string;
    }[];
    ledgerState?: JsonObject;
  };
  undoRequest: {
    scope: "single-step" | "chain-executed-scope" | "aggregate-chain";
    targetStepIds?: string[];
  };
}

interface CrossSurfaceStep {
  stepId: string;
  actionId: string;
  targetSurfaceId: DesignStudioSurfaceId;
  params?: JsonObject;
  requiresCapabilities?: string[];
}

interface CrossSurfaceGiven extends JsonObject {
  startSurfaceId: DesignStudioSurfaceId;
  chain: CrossSurfaceStep[];
  registrationScenario: {
    targetSurfaceId: DesignStudioSurfaceId;
    timeoutMs: number;
    registersAtMs?: number;
    capabilitiesAvailableAtMs?: number;
  };
  policyContext?: JsonObject;
}

interface FactsContextGiven extends JsonObject {
  surfaceId: DesignStudioSurfaceId;
  readToolCalls?: {
    id: string;
    params: JsonObject;
  }[];
}

interface HarnessOptions {
  posture?: PosturePreset;
  liveSurfaces?: DesignStudioSurfaceId[];
  registerOnNavigate?: {
    targetSurfaceId: DesignStudioSurfaceId;
    registersAtMs?: number;
    capabilitiesAvailableAtMs?: number;
  };
}

interface Harness {
  host: ReducerBackedHost;
  registry: ReturnType<typeof createDesignStudioRegistry>;
  ledger: InMemoryLedger;
  snapshotStore: ReturnType<typeof createDesignStudioSnapshotAdapter>;
}

type ReducerBackedHost = DesignStudioCapabilityHost & {
  getCurrentSurfaceId: () => DesignStudioSurfaceId;
  setNavigationHandler: (handler?: (surfaceId: DesignStudioSurfaceId) => void) => void;
};

const autoApprove: ApprovalHook = async () => ({
  status: "approved",
  reason: "eval_auto_approve",
});

export function createDesignStudioEvalAdapter() {
  return {
    target: designStudioEvalTarget,
    route,
    resolve,
    execute,
    undo,
    context,
  };
}

export default createDesignStudioEvalAdapter;

async function route(fixture: EvalFixture) {
  const given = fixture.given as IntentGiven;
  const harness = createHarness({
    posture: given.posturePreset,
    liveSurfaces: Object.values(designStudioSurfaceIds),
  });
  const router = new ScriptedIntentRouter();
  const routed = await router.classify({
    intent: given.utterance,
    sourceSurfaceId: given.surfaceId,
    registry: harness.registry,
    state: harness.host.getState(),
  });

  if (routed.routeClass === "single action" || routed.routeClass === "action chain") {
    return {
      routeClass: routed.routeClass,
      negativeCase: "none",
      actions: routed.steps.map((step) => ({
        actionId: step.actionId,
        surfaceId: step.targetSurfaceId,
        params: step.params,
        patternId: step.patternId,
      })),
      trace: {
        sourceSurfaceId: routed.sourceSurfaceId,
        intent: routed.intent,
      },
    };
  }

  if (routed.routeClass === "answer") {
    return {
      routeClass: routed.routeClass,
      negativeCase: "none",
      readTools: routed.readToolIds,
      answer: { message: routed.message },
      trace: {
        sourceSurfaceId: routed.sourceSurfaceId,
        intent: routed.intent,
      },
    };
  }

  if (routed.routeClass === "clarification") {
    return {
      routeClass: routed.routeClass,
      negativeCase: "clarification",
      clarification: {
        missing: routed.missing,
        message: routed.message,
        reasonCode: routed.escalationReason ?? "missing_required_information",
      },
    };
  }

  return {
    routeClass: routed.routeClass,
    negativeCase: "refusal",
    refusal: {
      reasonCode: routed.escalationReason ?? "refusal",
      message: "message" in routed ? routed.message : "No action was routed.",
    },
  };
}

function resolve(fixture: EvalFixture) {
  const given = fixture.given as PolicyGiven;
  const harness = createHarness({
    posture: given.posturePreset,
    liveSurfaces: Object.values(designStudioSurfaceIds),
  });
  const actions = given.proposed.steps.map((step) => harness.registry.requireAction(step.actionId));
  const policyInputs = policyInputsFor(given);
  const decision =
    given.proposed.kind === "action"
      ? resolveActionPolicy(actions[0], policyInputs)
      : resolveChainPolicy(actions, policyInputs);
  const stepModes = given.proposed.steps.map((step, index) => {
    const perAction = decision.perActionModes[index];

    return {
      stepId: step.stepId,
      actionId: step.actionId,
      resolvedMode: perAction?.mode ?? "Read-only",
      reasonCodes: (perAction?.rationale.reasonCodes ?? []).map(normalizeReasonCode),
    };
  });

  return {
    negativeCase: decision.finalMode === "Refuse / hand off" ? "policy-denial" : "none",
    chainMode: decision.chainLevelMode ?? decision.finalMode,
    steps: stepModes,
    boundaries: boundariesFor(given.proposed.steps, decision),
    denial:
      decision.finalMode === "Refuse / hand off"
        ? {
            reasonCode:
              normalizeReasonCode(
                decision.rationale.reasonCodes.find((code) =>
                  code.includes("destructive_confirmation_missing"),
                ) ?? "policy_refused",
              ),
            message: decision.refusalReason ?? "Policy refused the proposed actions.",
          }
        : undefined,
    rationaleText: rationaleTextFor(decision.rationale),
    rawDecision: decision,
  };
}

async function execute(fixture: EvalFixture) {
  const given = fixture.given as CrossSurfaceGiven;
  const scenario = given.registrationScenario;
  const harness = createHarness({
    posture: asPosture(given.policyContext?.posturePreset) ?? "creative-tool",
    liveSurfaces: [given.startSurfaceId],
    registerOnNavigate: {
      targetSurfaceId: scenario.targetSurfaceId,
      registersAtMs: scenario.registersAtMs,
      capabilitiesAvailableAtMs: scenario.capabilitiesAvailableAtMs,
    },
  });
  const engine = new ExecutionEngine({
    registry: harness.registry,
    ledger: harness.ledger,
    snapshotStore: harness.snapshotStore,
    surfaceReadiness: new RegistrySurfaceReadiness(harness.registry, scenario.timeoutMs),
    approvalHook: autoApprove,
    now: () => fixedNow,
  });
  const run = engine.executeChain({
    intent: "eval cross-surface chain",
    surfaceId: given.startSurfaceId,
    posture: asPosture(given.policyContext?.posturePreset) ?? "creative-tool",
    steps: given.chain.map((step) => ({
      stepId: step.stepId,
      actionId: step.actionId,
      params: step.params ?? {},
      targetSurfaceId: step.targetSurfaceId,
      surfaceTimeoutMs: scenario.timeoutMs,
    })),
  });
  const result = await run.done;
  const recordBeforeUndo = run.getRecord();
  const failedOrSkipped = recordBeforeUndo.steps
    .filter((step) => step.status === "failed" || step.status === "skipped")
    .map((step) => step.stepId);
  const preservedUndoStepIds = recordBeforeUndo.steps
    .filter((step) => step.status === "succeeded" && "handleId" in step.undo)
    .map((step) => step.stepId);
  const prefixUndo =
    result.status === "failed" && given.policyContext?.undoAfterFailure === true
      ? await run.undoAll()
      : undefined;

  return {
    negativeCase:
      result.failure?.code === "surface_readiness_timeout" ? "timeout-failure" : "none",
    sequence: crossSurfaceSequence(given, result.status, result.failure?.code),
    failure: result.failure
      ? {
          reasonCode: result.failure.code,
          message: result.failure.message,
        }
      : undefined,
    preservedUndoStepIds,
    notExecutedStepIds: failedOrSkipped,
    prefixUndo,
    trace: extractLedgerTrace(harness.ledger.getRecords()),
  };
}

async function context(fixture: EvalFixture) {
  const given = fixture.given as FactsContextGiven;
  const harness = createHarness({ liveSurfaces: [given.surfaceId] });
  const facts = await Promise.all(
    harness.registry.getLiveFacts(given.surfaceId).map(async (declaration) => ({
      id: declaration.id,
      values: await declaration.publish(),
    })),
  );
  const liveReadTools = new Map(
    harness.registry.getLiveReadTools(given.surfaceId).map((readTool) => [readTool.id, readTool]),
  );
  const readTools = await Promise.all(
    (given.readToolCalls ?? []).map(async (call) => {
      const readTool = liveReadTools.get(call.id);

      if (!readTool) {
        throw new Error(`Read tool "${call.id}" is not live on surface "${given.surfaceId}".`);
      }

      const params = readTool.params.parse(call.params);
      const result = await readTool.query(params, {
        surfaceId: given.surfaceId,
      });

      return { id: readTool.id, result };
    }),
  );

  return { facts, readTools };
}

async function undo(fixture: EvalFixture) {
  const given = fixture.given as ReversibilityGiven;
  const surfaceId = asSurface(given.executed.ledgerState?.surfaceId) ?? designStudioSurfaceIds.editor;
  const posture = asPosture(given.executed.ledgerState?.posturePreset) ?? "creative-tool";
  const harness = createHarness({
    posture,
    liveSurfaces: Object.values(designStudioSurfaceIds),
  });
  const engine = new ExecutionEngine({
    registry: harness.registry,
    ledger: harness.ledger,
    snapshotStore: harness.snapshotStore,
    approvalHook: autoApprove,
    now: () => fixedNow,
  });
  const succeededSteps = given.executed.steps.filter((step) => step.status === "succeeded");
  const run = engine.executeChain({
    intent: "eval undo setup",
    surfaceId,
    posture,
    steps: succeededSteps.map((step) => ({
      stepId: step.stepId,
      actionId: step.actionId,
      params: step.params ?? {},
      targetSurfaceId: surfaceId,
    })),
  });
  const setup = await run.done;

  if (setup.status !== "succeeded") {
    throw new Error(`Undo setup execution failed: ${setup.failure?.message ?? setup.status}`);
  }

  const record = run.getRecord();
  const context = {
    registry: harness.registry,
    surfaceId,
    snapshotStore: harness.snapshotStore,
    now: () => fixedNow,
  };

  if (given.undoRequest.scope === "single-step") {
    const targetStepId = given.undoRequest.targetStepIds?.[0];
    const step = record.steps.find((item) => item.stepId === targetStepId);

    if (!step || !("handleId" in step.undo)) {
      return refusedUndoResult(given, [], targetStepId ? [targetStepId] : []);
    }

    const result = await runUndoHandle(harness.ledger, step.undo, context);
    const mechanism = step.undo.mechanism;

    return {
      negativeCase: result.status === "succeeded" ? "none" : "undo-refusal",
      undoOutcome:
        result.status === "succeeded"
          ? mechanism === "runtime_snapshot"
            ? "snapshot-restored"
            : "inverse-applied"
          : "failed-with-disclosure",
      order: [step.stepId],
      stepResults: stepResultsFor(given, run.getRecord()),
      disclosure:
        result.status === "succeeded"
          ? undefined
          : {
              reasonCode: "undo_failed",
              message: result.errorSummary ?? "Undo failed.",
            },
    };
  }

  const allowPartial = given.undoRequest.scope !== "aggregate-chain";
  const undoResult = await undoAllRecord(harness.ledger, record.recordId, context, {
    allowPartial,
  });
  const settled = run.getRecord();
  const order = undoOrderFor(settled);

  return {
    negativeCase:
      undoResult.status === "partial"
        ? "partial-undo"
        : undoResult.status === "refused"
          ? "undo-refusal"
          : "none",
    undoOutcome:
      undoResult.status === "succeeded"
        ? "undo-all-succeeded"
        : undoResult.status === "partial"
          ? "partial-undo-with-disclosure"
          : undoResult.status === "refused"
            ? "refused-with-disclosure"
            : "failed-with-disclosure",
    order,
    stepResults: stepResultsFor(given, settled),
    disclosure: undoResult.disclosure
      ? {
          reasonCode: undoResult.status === "refused" ? "undo_refused" : "partial_undo",
          message: undoResult.disclosure,
        }
      : undefined,
    trace: extractLedgerTrace(harness.ledger.getRecords()),
  };
}

function createHarness(options: HarnessOptions = {}): Harness {
  const host = createReducerBackedHost({ posture: options.posture });
  const registry = createDesignStudioRegistry(host);
  const ledger = new InMemoryLedger(() => fixedNow);
  const snapshotStore = createDesignStudioSnapshotAdapter(host, () => fixedNow);
  const liveSurfaces = options.liveSurfaces ?? Object.values(designStudioSurfaceIds);

  liveSurfaces.forEach((surfaceId) => registry.registerSurface(surfaceId));

  if (options.registerOnNavigate) {
    host.setNavigationHandler((surfaceId) => {
      Object.values(designStudioSurfaceIds).forEach((liveSurfaceId) => {
        registry.deregisterSurface(liveSurfaceId);
      });

      if (surfaceId !== options.registerOnNavigate?.targetSurfaceId) {
        return;
      }

      const registerAt = options.registerOnNavigate.registersAtMs;

      if (registerAt === undefined) {
        return;
      }

      const capabilitiesAt = options.registerOnNavigate.capabilitiesAvailableAtMs ?? registerAt;
      setTimeout(() => registry.registerSurface(surfaceId), Math.max(registerAt, capabilitiesAt));
    });
  }

  return {
    host,
    registry,
    ledger,
    snapshotStore,
  };
}

function createReducerBackedHost(options: { posture?: PosturePreset } = {}): ReducerBackedHost {
  let state = createInitialDesignState();
  let posture = options.posture ?? "creative-tool";
  let currentSurfaceId: DesignStudioSurfaceId = designStudioSurfaceIds.editor;
  let navigationHandler: ((surfaceId: DesignStudioSurfaceId) => void) | undefined;
  const dispatch = (event: DesignStoreEvent) => {
    state = applyDesignStoreEvent(state, event);
  };
  const setters: DesignSetters = {
    setPaletteToken: (token, value) => dispatch({ type: "paletteTokenSet", token, value }),
    applyPalettePreset: (presetId) => dispatch({ type: "palettePresetApplied", presetId }),
    setFontPairing: (value) => dispatch({ type: "fontPairingSet", value }),
    setTypeScale: (value) => dispatch({ type: "typeScaleSet", value }),
    setHeroLayout: (value) => dispatch({ type: "heroLayoutSet", value }),
    toggleSectionVisibility: (sectionId) =>
      dispatch({ type: "sectionVisibilityToggled", sectionId }),
    moveSection: (sectionId, direction) => dispatch({ type: "sectionMoved", sectionId, direction }),
    updateSectionText: (sectionId, field, value) =>
      dispatch({ type: "sectionTextUpdated", sectionId, field, value }),
    applyTemplate: (templateId) => dispatch({ type: "templateApplied", templateId }),
    updateProjectMeta: (field: keyof ProjectMeta, value: string) =>
      dispatch({ type: "projectMetaUpdated", field, value }),
    copyShareLink: async () => {
      dispatch({ type: "shareMessageSet", message: "Share link copied to clipboard." });
    },
    exportProject: () => dispatch({ type: "projectExported" }),
    resetProject: () => dispatch({ type: "projectReset" }),
    restoreState: (nextState: DesignState) => dispatch({ type: "stateRestored", state: nextState }),
  };

  return {
    getState: () => state,
    getPosture: () => posture,
    setPosture: (nextPosture) => {
      posture = nextPosture;
    },
    navigateToSurface: (surfaceId) => {
      currentSurfaceId = surfaceId;
      navigationHandler?.(surfaceId);
    },
    getCurrentSurfaceId: () => currentSurfaceId,
    setNavigationHandler: (handler) => {
      navigationHandler = handler;
    },
    setters,
    getOrigin: () => "https://design-studio.test",
  };
}

function policyInputsFor(given: PolicyGiven): PolicyInputs {
  const sessionContext = given.sessionContext ?? {};
  const runtimeSignals = given.runtimeSignals ?? {};

  return {
    posture: given.posturePreset,
    currentSurface: given.surfaceId,
    grants: mapStickyGrants(given.stickyGrants ?? []),
    allowGrantsToRaiseAutonomy: sessionContext.allowGrantsToRaiseAutonomy === true,
    userMinimumMode: asExecutionMode(sessionContext.userMinimumMode),
    overrides: mapPolicyOverrides(given),
    runtimeSignalDemotions: mapRuntimeSignalDemotions(runtimeSignals),
    now: fixedNow,
  };
}

function mapStickyGrants(
  grants: NonNullable<PolicyGiven["stickyGrants"]>,
): ScopedGrant[] {
  return grants.map((grant) => {
    const subject = grant.subject.startsWith("action:")
      ? grant.subject.slice("action:".length)
      : grant.subject;

    return {
      id: grant.grantId,
      actionIds: [subject],
      expiresAt: grant.expires,
      grantedMode: asExecutionMode(grant.effect) ?? "Instant execution",
      issuer: "eval-fixture",
      subject: grant.subject,
    };
  });
}

function mapPolicyOverrides(given: PolicyGiven): PolicyOverride[] {
  const runtimeSignals = given.runtimeSignals ?? {};

  if (runtimeSignals.destructiveConfirmation === "missing") {
    return given.proposed.steps
      .filter((step) => step.actionId === "project.reset_project")
      .map((step) => ({
        id: "eval.destructive_confirmation_missing",
        actionId: step.actionId,
        minimumMode: "Refuse / hand off",
        reasonCode: "destructive_confirmation_missing",
      }));
  }

  return [];
}

function mapRuntimeSignalDemotions(runtimeSignals: JsonObject): RuntimeSignalDemotion[] {
  if (typeof runtimeSignals.demoteOneRungReasonCode !== "string") {
    return [];
  }

  return [
    {
      id: "eval.runtime_signal",
      reasonCode: runtimeSignals.demoteOneRungReasonCode,
      demoteBy: 1,
    },
  ];
}

function boundariesFor(
  steps: PolicyStep[],
  decision: ReturnType<typeof resolveChainPolicy>,
) {
  if (
    decision.executedPrefixEndIndex === undefined &&
    decision.heldSuffixStartIndex === undefined &&
    !decision.requiredGate
  ) {
    return undefined;
  }

  return {
    executedPrefixThroughStepId:
      decision.executedPrefixEndIndex !== undefined && decision.executedPrefixEndIndex >= 0
        ? steps[decision.executedPrefixEndIndex]?.stepId
        : undefined,
    heldSuffixFromStepId:
      decision.heldSuffixStartIndex !== undefined
        ? steps[decision.heldSuffixStartIndex]?.stepId
        : undefined,
    requiredGate: decision.requiredGate
      ? gateNameFor(decision.requiredGate.mode, decision.requiredGate.actionIds)
      : undefined,
  };
}

function gateNameFor(mode: AutonomyMode, actionIds: string[]): string {
  if (actionIds.includes("project.export_project")) {
    return mode === "Plan preview" ? "plan_preview" : "quota_spend";
  }

  if (actionIds.includes("project.reset_project")) {
    return "destructive_confirmation";
  }

  return mode.toLowerCase().replaceAll(" ", "_").replaceAll("/", "_");
}

function rationaleTextFor(rationale: PolicyRationale) {
  const effectFloors = Array.isArray(rationale.effectFloors)
    ? rationale.effectFloors
        .map((floor) =>
          floor &&
          typeof floor === "object" &&
          "dimension" in floor &&
          "value" in floor &&
          "floorMode" in floor
            ? `${String(floor.dimension)} floor ${String(floor.value)} to ${String(
                floor.floorMode,
              )}`
            : "",
        )
        .filter(Boolean)
    : [];
  const grant =
    rationale.grant && typeof rationale.grant === "object" && "reason" in rationale.grant
      ? [`grant ${String(rationale.grant.reason)}`]
      : [];

  return [
    `selected posture ${String(rationale.selectedPosturePreset)}`,
    ...effectFloors,
    ...grant,
    ...rationale.reasonCodes,
  ].join("\n");
}

function normalizeReasonCode(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "reason";
}

function crossSurfaceSequence(
  given: CrossSurfaceGiven,
  status: string,
  failureCode: string | undefined,
) {
  const navigation = given.chain.find((step) => step.actionId === "surface.navigate_surface");
  const continuation = given.chain.find(
    (step) => step.actionId !== "surface.navigate_surface" && step.targetSurfaceId === given.registrationScenario.targetSurfaceId,
  );
  const sequence: JsonObject[] = [];

  if (navigation) {
    sequence.push({
      kind: "navigate",
      stepId: navigation.stepId,
      actionId: navigation.actionId,
      surfaceId: navigation.params?.surfaceId ?? given.registrationScenario.targetSurfaceId,
    });
  }

  sequence.push({
    kind: "await-surface-registration",
    surfaceId: given.registrationScenario.targetSurfaceId,
    timeoutMs: given.registrationScenario.timeoutMs,
  });
  sequence.push({
    kind: "await-capabilities",
    surfaceId: given.registrationScenario.targetSurfaceId,
    capabilityIds: continuation?.requiresCapabilities ?? (continuation ? [continuation.actionId] : []),
    timeoutMs: given.registrationScenario.timeoutMs,
  });

  if (status === "succeeded" && continuation) {
    sequence.push({
      kind: "continue",
      stepId: continuation.stepId,
      actionId: continuation.actionId,
      surfaceId: given.registrationScenario.targetSurfaceId,
    });
  } else if (failureCode) {
    sequence.push({
      kind: failureCode === "surface_readiness_timeout" ? "fail-timeout" : "fail-capability-unavailable",
      stepId: continuation?.stepId,
      actionId: continuation?.actionId,
      surfaceId: given.registrationScenario.targetSurfaceId,
      timeoutMs: given.registrationScenario.timeoutMs,
    });
    sequence.push({ kind: "preserve-undo-prefix" });
    sequence.push({ kind: "stop-suffix" });
  }

  return sequence;
}

function stepResultsFor(given: ReversibilityGiven, record: ReturnType<InMemoryLedger["requireRecord"]>) {
  return given.executed.steps.map((fixtureStep) => {
    const recordStep = record.steps.find((step) => step.stepId === fixtureStep.stepId);

    if (!recordStep || fixtureStep.status !== "succeeded") {
      return {
        stepId: fixtureStep.stepId,
        result: "not-executed",
      };
    }

    if (recordStep.status === "undone" && "handleId" in recordStep.undo) {
      return {
        stepId: fixtureStep.stepId,
        result:
          recordStep.undo.mechanism === "runtime_snapshot"
            ? "snapshot-restored"
            : "inverse-applied",
      };
    }

    if (!("handleId" in recordStep.undo)) {
      return {
        stepId: fixtureStep.stepId,
        result: "not-undoable",
      };
    }

    if (recordStep.undo.status === "failed") {
      return {
        stepId: fixtureStep.stepId,
        result: "undo-failed",
      };
    }

    return {
      stepId: fixtureStep.stepId,
      result: "not-in-scope",
    };
  });
}

function undoOrderFor(record: ReturnType<InMemoryLedger["requireRecord"]>): string[] {
  const attempt = record.undoAttempts.at(-1);

  if (!attempt) {
    return [];
  }

  return attempt.targetHandleIds
    .map((handleId) =>
      record.steps.find((step) => "handleId" in step.undo && step.undo.handleId === handleId),
    )
    .filter((step): step is NonNullable<typeof step> => Boolean(step))
    .map((step) => step.stepId);
}

function refusedUndoResult(
  given: ReversibilityGiven,
  undoneStepIds: string[],
  notUndoneStepIds: string[],
) {
  return {
    negativeCase: "undo-refusal",
    undoOutcome: "refused-with-disclosure",
    order: undoneStepIds,
    stepResults: given.executed.steps.map((step) => ({
      stepId: step.stepId,
      result: notUndoneStepIds.includes(step.stepId) ? "not-undoable" : "not-in-scope",
    })),
    disclosure: {
      reasonCode: "undo_refused",
      message: `Partial undo: reversed ${undoneStepIds.join(", ") || "none"}; not reversed ${
        notUndoneStepIds.join(", ") || "none"
      }.`,
    },
  };
}

function asExecutionMode(value: unknown): Exclude<AutonomyMode, "Read-only" | "Refuse / hand off"> | undefined {
  const modes = [
    "Instant execution",
    "Optimistic chain",
    "Gated suffix",
    "Plan preview",
    "Step-gated",
  ] as const;

  return typeof value === "string" && modes.includes(value as (typeof modes)[number])
    ? (value as Exclude<AutonomyMode, "Read-only" | "Refuse / hand off">)
    : undefined;
}

function asPosture(value: unknown): PosturePreset | undefined {
  return value === "creative-tool" || value === "business-app" || value === "sensitive-domain"
    ? value
    : undefined;
}

function asSurface(value: unknown): DesignStudioSurfaceId | undefined {
  return value === "editor" || value === "templates" || value === "settings"
    ? value
    : undefined;
}
