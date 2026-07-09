import type {
  ActionEffects,
  AnyCompiledActionDeclaration,
  Confirmation,
  ReversibilityKind,
  Risk,
  SurfaceId,
} from "./registry.js";

export type PosturePreset = "creative-tool" | "business-app" | "sensitive-domain";
export type AutonomyMode =
  | "Read-only"
  | "Instant execution"
  | "Optimistic chain"
  | "Gated suffix"
  | "Plan preview"
  | "Step-gated"
  | "Refuse / hand off";
export type ExecutionMode = Exclude<AutonomyMode, "Read-only">;

export interface PolicyOverride {
  id: string;
  actionId?: string;
  surfaceId?: SurfaceId;
  minimumMode: ExecutionMode;
  reasonCode: string;
}

/** Explicit, scoped grant input. Destructive and confirmation-always actions never use it. */
export interface ScopedGrant {
  id: string;
  actionIds: string[];
  surfaceId?: SurfaceId;
  sessionId?: string;
  expiresAt?: string;
  issuer: string;
  subject: string;
  grantedMode: Exclude<ExecutionMode, "Refuse / hand off">;
  source?: "framework" | "developer";
}

export interface RuntimeSignalDemotion {
  id: string;
  reasonCode: string;
  demoteBy?: 1;
}

export interface PolicyAvailability {
  isActionAvailableOnSurface(actionId: string, surfaceId: SurfaceId): boolean;
}

export interface PolicyInputs {
  posture: PosturePreset;
  currentSurface: SurfaceId;
  availability?: PolicyAvailability;
  overrides?: PolicyOverride[];
  grants?: ScopedGrant[];
  runtimeSignalDemotions?: RuntimeSignalDemotion[];
  userMinimumMode?: ExecutionMode;
  now?: Date;
  sessionId?: string;
  allowGrantsToRaiseAutonomy?: boolean;
  recordable?: boolean;
}

export interface DeclarationPolicyMetadata {
  actionId: string;
  risk: Risk;
  reversibility: ReversibilityKind;
  effects: ActionEffects;
  confirmation: Confirmation;
  reads: string[];
  writes: string[];
  preconditions: string[];
}

export interface EffectFloorRecord {
  dimension: "cost" | "sensitive" | "external";
  value: string | boolean;
  floorMode?: ExecutionMode;
  applied: boolean;
  reasonCode: string;
}

export interface ConfirmationFloorRecord {
  value: Confirmation;
  floorMode?: ExecutionMode;
  applied: boolean;
  reasonCode: string;
}

export interface GrantUseRecord {
  used: boolean;
  grantIds: string[];
  reason: string;
}

/** The SA-POL-108 recordable rationale. */
export interface PolicyRationale {
  actionIds: string[];
  declarationMetadata: DeclarationPolicyMetadata[];
  selectedPosturePreset: PosturePreset;
  applicableOverrides: PolicyOverride[];
  effectFloors: EffectFloorRecord[];
  confirmationFloor: ConfirmationFloorRecord;
  grant: GrantUseRecord;
  runtimeSignalDemotions: RuntimeSignalDemotion[];
  finalMode: AutonomyMode;
  reasonCodes: string[];
}

export interface PerActionPolicyDecision {
  actionId: string;
  mode: ExecutionMode;
  rationale: PolicyRationale;
}

export interface PolicyDecision {
  actionIds: string[];
  finalMode: AutonomyMode;
  perActionModes: PerActionPolicyDecision[];
  chainLevelMode?: AutonomyMode;
  executedPrefixEndIndex?: number;
  heldSuffixStartIndex?: number;
  refusalReason?: string;
  requiredGate?: { mode: ExecutionMode; startIndex: number; actionIds: string[] };
  rationale: PolicyRationale;
}

type PresetGrid = Record<Risk, Record<ReversibilityKind, ExecutionMode>>;

export const posturePresetMappings: Record<PosturePreset, PresetGrid> = {
  "creative-tool": {
    safe: { undoable: "Instant execution", snapshot: "Instant execution", irreversible: "Instant execution" },
    side_effect: { undoable: "Instant execution", snapshot: "Instant execution", irreversible: "Instant execution" },
    mutating: { undoable: "Optimistic chain", snapshot: "Gated suffix", irreversible: "Gated suffix" },
    destructive: { undoable: "Gated suffix", snapshot: "Gated suffix", irreversible: "Step-gated" },
  },
  "business-app": {
    safe: { undoable: "Optimistic chain", snapshot: "Optimistic chain", irreversible: "Gated suffix" },
    side_effect: { undoable: "Optimistic chain", snapshot: "Gated suffix", irreversible: "Plan preview" },
    mutating: { undoable: "Gated suffix", snapshot: "Plan preview", irreversible: "Plan preview" },
    destructive: { undoable: "Plan preview", snapshot: "Plan preview", irreversible: "Step-gated" },
  },
  "sensitive-domain": {
    safe: { undoable: "Optimistic chain", snapshot: "Optimistic chain", irreversible: "Plan preview" },
    side_effect: { undoable: "Plan preview", snapshot: "Plan preview", irreversible: "Step-gated" },
    mutating: { undoable: "Plan preview", snapshot: "Step-gated", irreversible: "Step-gated" },
    destructive: { undoable: "Step-gated", snapshot: "Step-gated", irreversible: "Refuse / hand off" },
  },
};

const EXECUTION_MODE_ORDER: ExecutionMode[] = [
  "Instant execution",
  "Optimistic chain",
  "Gated suffix",
  "Plan preview",
  "Step-gated",
  "Refuse / hand off",
];

/** Purely resolves a single registry-compiled action; it does not execute or mutate. */
export function resolveActionPolicy(
  action: AnyCompiledActionDeclaration,
  inputs: PolicyInputs,
): PolicyDecision {
  const perAction = resolveOneAction(action, inputs);
  return {
    actionIds: [action.id],
    finalMode: perAction.mode,
    perActionModes: [perAction],
    rationale: perAction.rationale,
  };
}

/** Purely resolves a proposed action chain and exposes its auditable gate boundary. */
export function resolveChainPolicy(
  actions: AnyCompiledActionDeclaration[],
  inputs: PolicyInputs,
): PolicyDecision {
  if (actions.length === 0) {
    return {
      actionIds: [],
      finalMode: "Read-only",
      perActionModes: [],
      rationale: emptyRationale(inputs),
    };
  }

  const perActionModes = actions.map((action) => resolveOneAction(action, inputs));
  const finalMode = leastAutonomous(perActionModes.map((decision) => decision.mode));
  const decision: PolicyDecision = {
    actionIds: actions.map((action) => action.id),
    finalMode,
    perActionModes,
    chainLevelMode: finalMode,
    rationale: mergeRationales(perActionModes, inputs, finalMode),
  };
  const refusalIndex = perActionModes.findIndex((item) => item.mode === "Refuse / hand off");
  if (refusalIndex >= 0) decision.refusalReason = `Policy refused at step ${refusalIndex + 1}.`;
  if (finalMode === "Plan preview") {
    decision.executedPrefixEndIndex = -1;
    decision.heldSuffixStartIndex = 0;
    decision.requiredGate = { mode: "Plan preview", startIndex: 0, actionIds: [...decision.actionIds] };
  } else {
    const gateIndex = perActionModes.findIndex((item) => requiresGateBoundary(item.mode));
    if (gateIndex >= 0) {
      decision.executedPrefixEndIndex = gateIndex - 1;
      decision.heldSuffixStartIndex = gateIndex;
      decision.requiredGate = {
        mode: perActionModes[gateIndex].mode,
        startIndex: gateIndex,
        actionIds: actions.slice(gateIndex).map((action) => action.id),
      };
    }
  }
  return decision;
}

export function isLessAutonomous(left: ExecutionMode, right: ExecutionMode): boolean {
  return EXECUTION_MODE_ORDER.indexOf(left) > EXECUTION_MODE_ORDER.indexOf(right);
}

export function applyModeFloor(mode: ExecutionMode, floor: ExecutionMode): ExecutionMode {
  return isLessAutonomous(floor, mode) ? floor : mode;
}

function resolveOneAction(action: AnyCompiledActionDeclaration, inputs: PolicyInputs): PerActionPolicyDecision {
  const metadata = metadataFor(action);
  const reasonCodes: string[] = [];
  let mode = posturePresetMappings[inputs.posture][action.risk][action.reversibility.kind];
  reasonCodes.push(`preset:${inputs.posture}:${action.risk}:${action.reversibility.kind}:${mode}`);

  const unavailable = inputs.availability && !inputs.availability.isActionAvailableOnSurface(action.id, inputs.currentSurface);
  const effectFloors = effectFloorsFor(action.effects, inputs.posture);
  for (const floor of effectFloors) {
    if (floor.floorMode) {
      const next = applyModeFloor(mode, floor.floorMode);
      floor.applied = next !== mode || floor.floorMode === mode;
      mode = next;
      if (floor.applied) reasonCodes.push(floor.reasonCode);
    }
  }

  const confirmationFloor = confirmationFloorFor(action.confirmation);
  if (confirmationFloor.floorMode) {
    const next = applyModeFloor(mode, confirmationFloor.floorMode);
    confirmationFloor.applied = next !== mode || confirmationFloor.floorMode === mode;
    mode = next;
    if (confirmationFloor.applied) reasonCodes.push(confirmationFloor.reasonCode);
  }

  const applicableOverrides = (inputs.overrides ?? []).filter(
    (override) => (!override.actionId || override.actionId === action.id) && (!override.surfaceId || override.surfaceId === inputs.currentSurface),
  );
  for (const override of applicableOverrides) {
    mode = applyModeFloor(mode, override.minimumMode);
    reasonCodes.push(override.reasonCode);
  }

  const grant = resolveGrantUse(action, inputs, mode, unavailable === true);
  if (grant.used && inputs.allowGrantsToRaiseAutonomy) {
    const grantMode = (inputs.grants ?? []).find((grantItem) => grantItem.id === grant.grantIds[0])?.grantedMode;
    if (grantMode && !isLessAutonomous(grantMode, mode)) {
      mode = grantMode;
      reasonCodes.push("grant_used");
    }
  }

  if (inputs.userMinimumMode) {
    const next = applyModeFloor(mode, inputs.userMinimumMode);
    if (next !== mode) reasonCodes.push("user_autonomy_lowered");
    mode = next;
  }
  for (const demotion of inputs.runtimeSignalDemotions ?? []) {
    const next = demoteOneRung(mode);
    if (next !== mode) reasonCodes.push(demotion.reasonCode);
    mode = next;
  }
  if (unavailable) {
    mode = "Refuse / hand off";
    reasonCodes.push("action_unavailable");
  }
  if (inputs.posture === "sensitive-domain" && inputs.recordable === false) {
    mode = "Refuse / hand off";
    reasonCodes.push("recording_unavailable");
  }

  const rationale: PolicyRationale = {
    actionIds: [action.id],
    declarationMetadata: [metadata],
    selectedPosturePreset: inputs.posture,
    applicableOverrides,
    effectFloors,
    confirmationFloor,
    grant,
    runtimeSignalDemotions: inputs.runtimeSignalDemotions ?? [],
    finalMode: mode,
    reasonCodes,
  };
  return { actionId: action.id, mode, rationale };
}

function effectFloorsFor(effects: ActionEffects, posture: PosturePreset): EffectFloorRecord[] {
  const floors: EffectFloorRecord[] = [];
  if (effects.cost === "quota") {
    floors.push({ dimension: "cost", value: "quota", floorMode: posture === "creative-tool" ? "Gated suffix" : posture === "business-app" ? "Plan preview" : "Step-gated", applied: false, reasonCode: `effect_floor:${posture}:cost_quota` });
  } else if (effects.cost === "money") {
    floors.push({ dimension: "cost", value: "money", floorMode: posture === "creative-tool" ? "Plan preview" : "Step-gated", applied: false, reasonCode: `effect_floor:${posture}:cost_money` });
  }
  if (effects.sensitive) {
    const floorMode = posture === "creative-tool" ? (effects.external ? "Gated suffix" : undefined) : posture === "business-app" ? "Plan preview" : "Step-gated";
    floors.push({ dimension: "sensitive", value: true, floorMode, applied: false, reasonCode: floorMode ? `effect_floor:${posture}:sensitive` : `effect_floor:${posture}:sensitive_local_no_floor` });
  }
  if (effects.external) {
    const floorMode = posture === "sensitive-domain" ? "Plan preview" : undefined;
    floors.push({ dimension: "external", value: true, floorMode, applied: false, reasonCode: floorMode ? `effect_floor:${posture}:external` : `effect_floor:${posture}:external_no_floor` });
  }
  return floors;
}

function confirmationFloorFor(confirmation: Confirmation): ConfirmationFloorRecord {
  return confirmation === "always"
    ? { value: confirmation, floorMode: "Gated suffix", applied: false, reasonCode: "confirmation_floor:always" }
    : { value: confirmation, applied: false, reasonCode: `confirmation_floor:${confirmation}:none` };
}

function resolveGrantUse(action: AnyCompiledActionDeclaration, inputs: PolicyInputs, mode: ExecutionMode, unavailable: boolean): GrantUseRecord {
  const matching = (inputs.grants ?? []).find((grant) => {
    const actionMatches = grant.actionIds.includes(action.id);
    const surfaceMatches = !grant.surfaceId || grant.surfaceId === inputs.currentSurface;
    const sessionMatches = !grant.sessionId || grant.sessionId === inputs.sessionId;
    const unexpired = !grant.expiresAt || (inputs.now !== undefined && Date.parse(grant.expiresAt) > inputs.now.getTime());
    return actionMatches && surfaceMatches && sessionMatches && unexpired;
  });
  if (!matching) return { used: false, grantIds: [], reason: "no_applicable_grant" };
  if (unavailable) return { used: false, grantIds: [matching.id], reason: "grant_cannot_authorize_unavailable_action" };
  if (action.risk === "destructive") return { used: false, grantIds: [matching.id], reason: "grant_not_allowed_for_destructive_action" };
  if (action.confirmation === "always") return { used: false, grantIds: [matching.id], reason: "grant_cannot_suppress_confirmation_always" };
  if (!inputs.allowGrantsToRaiseAutonomy) return { used: false, grantIds: [matching.id], reason: "grant_available_but_policy_does_not_raise_autonomy" };
  if (isLessAutonomous(matching.grantedMode, mode)) return { used: false, grantIds: [matching.id], reason: "grant_would_lower_autonomy" };
  return { used: true, grantIds: [matching.id], reason: "grant_applied" };
}

function demoteOneRung(mode: ExecutionMode): ExecutionMode {
  return EXECUTION_MODE_ORDER[Math.min(EXECUTION_MODE_ORDER.indexOf(mode) + 1, EXECUTION_MODE_ORDER.length - 1)];
}

function leastAutonomous(modes: ExecutionMode[]): ExecutionMode {
  return modes.reduce((current, next) => (isLessAutonomous(next, current) ? next : current));
}

function requiresGateBoundary(mode: ExecutionMode): boolean {
  return mode === "Gated suffix" || mode === "Step-gated" || mode === "Refuse / hand off";
}

function metadataFor(action: AnyCompiledActionDeclaration): DeclarationPolicyMetadata {
  return {
    actionId: action.id,
    risk: action.risk,
    reversibility: action.reversibility.kind,
    effects: { ...action.effects },
    confirmation: action.confirmation,
    reads: [...action.reads],
    writes: [...action.writes],
    preconditions: [...action.preconditions],
  };
}

function emptyRationale(inputs: PolicyInputs): PolicyRationale {
  return {
    actionIds: [], declarationMetadata: [], selectedPosturePreset: inputs.posture,
    applicableOverrides: [], effectFloors: [],
    confirmationFloor: { value: "never", applied: false, reasonCode: "confirmation_floor:none" },
    grant: { used: false, grantIds: [], reason: "no_action" },
    runtimeSignalDemotions: inputs.runtimeSignalDemotions ?? [], finalMode: "Read-only", reasonCodes: ["read_only"],
  };
}

function mergeRationales(perAction: PerActionPolicyDecision[], inputs: PolicyInputs, finalMode: AutonomyMode): PolicyRationale {
  return {
    actionIds: perAction.map((item) => item.actionId),
    declarationMetadata: perAction.flatMap((item) => item.rationale.declarationMetadata),
    selectedPosturePreset: inputs.posture,
    applicableOverrides: perAction.flatMap((item) => item.rationale.applicableOverrides),
    effectFloors: perAction.flatMap((item) => item.rationale.effectFloors),
    confirmationFloor: perAction.find((item) => item.rationale.confirmationFloor.applied)?.rationale.confirmationFloor ?? { value: "never", applied: false, reasonCode: "confirmation_floor:none_applied_in_chain" },
    grant: mergeGrantUse(perAction),
    runtimeSignalDemotions: inputs.runtimeSignalDemotions ?? [],
    finalMode,
    reasonCodes: [...new Set(perAction.flatMap((item) => item.rationale.reasonCodes))],
  };
}

function mergeGrantUse(perAction: PerActionPolicyDecision[]): GrantUseRecord {
  const grantIds = perAction.flatMap((item) => item.rationale.grant.grantIds);
  const used = perAction.some((item) => item.rationale.grant.used);
  return { used, grantIds, reason: used ? "grant_applied" : perAction[0]?.rationale.grant.reason ?? "no_action" };
}
