import type {
  ActionEffects,
  CompiledActionDeclaration,
  Confirmation,
  ReversibilityKind,
  Risk,
  SurfaceId,
} from "./registry";

export type PosturePreset = "creative-tool" | "business-app" | "sensitive-domain";

export type AutonomyMode =
  | "Read-only"
  | "Instant execution"
  | "Optimistic chain"
  | "Gated suffix"
  | "Plan preview"
  | "Step-gated"
  | "Refuse / hand off";

export interface PolicyOverride {
  id: string;
  actionId?: string;
  surfaceId?: SurfaceId;
  minimumMode: Exclude<AutonomyMode, "Read-only">;
  reasonCode: string;
}

export interface ScopedGrant {
  id: string;
  actionIds?: string[];
  surfaceId?: SurfaceId;
  expiresAt?: string;
  grantedMode: Exclude<AutonomyMode, "Read-only" | "Refuse / hand off">;
  issuer: string;
  subject: string;
}

export interface RuntimeSignalDemotion {
  id: string;
  reasonCode: string;
  demoteBy?: 1;
}

export interface PolicyInputs {
  posture: PosturePreset;
  currentSurface: SurfaceId;
  overrides?: PolicyOverride[];
  grants?: ScopedGrant[];
  runtimeSignalDemotions?: RuntimeSignalDemotion[];
  userMinimumMode?: Exclude<AutonomyMode, "Read-only">;
  now?: Date;
  allowGrantsToRaiseAutonomy?: boolean;
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
  floorMode?: Exclude<AutonomyMode, "Read-only">;
  applied: boolean;
  reasonCode: string;
}

export interface ConfirmationFloorRecord {
  value: Confirmation;
  floorMode?: Exclude<AutonomyMode, "Read-only">;
  applied: boolean;
  reasonCode: string;
}

export interface GrantUseRecord {
  used: boolean;
  grantIds: string[];
  reason: string;
}

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
  mode: AutonomyMode;
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
  requiredGate?: {
    mode: AutonomyMode;
    startIndex: number;
    actionIds: string[];
  };
  rationale: PolicyRationale;
}

const EXECUTION_MODE_ORDER: Exclude<AutonomyMode, "Read-only">[] = [
  "Instant execution",
  "Optimistic chain",
  "Gated suffix",
  "Plan preview",
  "Step-gated",
  "Refuse / hand off",
];

type PresetGrid = Record<Risk, Record<ReversibilityKind, Exclude<AutonomyMode, "Read-only">>>;

export const posturePresetMappings: Record<PosturePreset, PresetGrid> = {
  "creative-tool": {
    safe: {
      undoable: "Instant execution",
      snapshot: "Instant execution",
      irreversible: "Instant execution",
    },
    side_effect: {
      undoable: "Instant execution",
      snapshot: "Instant execution",
      irreversible: "Instant execution",
    },
    mutating: {
      undoable: "Optimistic chain",
      snapshot: "Gated suffix",
      irreversible: "Gated suffix",
    },
    destructive: {
      undoable: "Gated suffix",
      snapshot: "Gated suffix",
      irreversible: "Step-gated",
    },
  },
  "business-app": {
    safe: {
      undoable: "Optimistic chain",
      snapshot: "Optimistic chain",
      irreversible: "Gated suffix",
    },
    side_effect: {
      undoable: "Optimistic chain",
      snapshot: "Gated suffix",
      irreversible: "Plan preview",
    },
    mutating: {
      undoable: "Gated suffix",
      snapshot: "Plan preview",
      irreversible: "Plan preview",
    },
    destructive: {
      undoable: "Plan preview",
      snapshot: "Plan preview",
      irreversible: "Step-gated",
    },
  },
  "sensitive-domain": {
    safe: {
      undoable: "Optimistic chain",
      snapshot: "Optimistic chain",
      irreversible: "Plan preview",
    },
    side_effect: {
      undoable: "Plan preview",
      snapshot: "Plan preview",
      irreversible: "Step-gated",
    },
    mutating: {
      undoable: "Plan preview",
      snapshot: "Step-gated",
      irreversible: "Step-gated",
    },
    destructive: {
      undoable: "Step-gated",
      snapshot: "Step-gated",
      irreversible: "Refuse / hand off",
    },
  },
};

export function resolveActionPolicy(
  action: CompiledActionDeclaration,
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

export function resolveChainPolicy(
  actions: CompiledActionDeclaration[],
  inputs: PolicyInputs,
): PolicyDecision {
  if (actions.length === 0) {
    const rationale = emptyRationale(inputs, "Read-only");

    return {
      actionIds: [],
      finalMode: "Read-only",
      perActionModes: [],
      rationale,
    };
  }

  const perActionModes = actions.map((action) => resolveOneAction(action, inputs));
  const finalMode = leastAutonomous(perActionModes.map((decision) => decision.mode));
  const firstRefusalIndex = perActionModes.findIndex(
    (decision) => decision.mode === "Refuse / hand off",
  );
  const firstGateIndex = perActionModes.findIndex((decision) =>
    requiresGateBoundary(decision.mode),
  );
  const rationale = mergeRationales(perActionModes, inputs, finalMode);
  const decision: PolicyDecision = {
    actionIds: actions.map((action) => action.id),
    finalMode,
    perActionModes,
    chainLevelMode: finalMode,
    rationale,
  };

  if (firstRefusalIndex >= 0) {
    decision.refusalReason = `Policy refused at step ${firstRefusalIndex + 1}.`;
  }

  if (finalMode === "Plan preview") {
    decision.executedPrefixEndIndex = -1;
    decision.heldSuffixStartIndex = 0;
    decision.requiredGate = {
      mode: "Plan preview",
      startIndex: 0,
      actionIds: actions.map((action) => action.id),
    };
    return decision;
  }

  if (firstGateIndex >= 0) {
    decision.executedPrefixEndIndex = firstGateIndex - 1;
    decision.heldSuffixStartIndex = firstGateIndex;
    decision.requiredGate = {
      mode: perActionModes[firstGateIndex].mode,
      startIndex: firstGateIndex,
      actionIds: actions.slice(firstGateIndex).map((action) => action.id),
    };
  }

  return decision;
}

export function isLessAutonomous(
  left: Exclude<AutonomyMode, "Read-only">,
  right: Exclude<AutonomyMode, "Read-only">,
): boolean {
  return EXECUTION_MODE_ORDER.indexOf(left) > EXECUTION_MODE_ORDER.indexOf(right);
}

export function applyModeFloor(
  mode: Exclude<AutonomyMode, "Read-only">,
  floor: Exclude<AutonomyMode, "Read-only">,
): Exclude<AutonomyMode, "Read-only"> {
  return isLessAutonomous(floor, mode) ? floor : mode;
}

function resolveOneAction(
  action: CompiledActionDeclaration,
  inputs: PolicyInputs,
): PerActionPolicyDecision {
  const reasonCodes: string[] = [];
  const metadata = metadataFor(action);
  let mode = posturePresetMappings[inputs.posture][action.risk][action.reversibility.kind];

  reasonCodes.push(
    `preset:${inputs.posture}:${action.risk}:${action.reversibility.kind}:${mode}`,
  );

  const effectFloors = effectFloorsFor(action.effects, inputs.posture);
  effectFloors.forEach((floor) => {
    if (floor.floorMode) {
      const nextMode = applyModeFloor(mode, floor.floorMode);
      floor.applied = nextMode !== mode || floor.floorMode === mode;
      mode = nextMode;

      if (floor.applied) {
        reasonCodes.push(floor.reasonCode);
      }
    }
  });

  const confirmationFloor = confirmationFloorFor(action.confirmation);

  if (confirmationFloor.floorMode) {
    const nextMode = applyModeFloor(mode, confirmationFloor.floorMode);
    confirmationFloor.applied = nextMode !== mode || confirmationFloor.floorMode === mode;
    mode = nextMode;

    if (confirmationFloor.applied) {
      reasonCodes.push(confirmationFloor.reasonCode);
    }
  }

  const applicableOverrides = (inputs.overrides ?? []).filter(
    (override) =>
      (!override.actionId || override.actionId === action.id) &&
      (!override.surfaceId || override.surfaceId === inputs.currentSurface),
  );

  applicableOverrides.forEach((override) => {
    const nextMode = applyModeFloor(mode, override.minimumMode);
    mode = nextMode;
    reasonCodes.push(override.reasonCode);
  });

  const grant = resolveGrantUse(action, inputs, mode);

  if (grant.used && inputs.allowGrantsToRaiseAutonomy) {
    const grantMode = (inputs.grants ?? []).find((item) => item.id === grant.grantIds[0])
      ?.grantedMode;

    if (grantMode && !isLessAutonomous(grantMode, mode)) {
      mode = grantMode;
      reasonCodes.push("grant_used");
    }
  }

  if (inputs.userMinimumMode) {
    const nextMode = applyModeFloor(mode, inputs.userMinimumMode);

    if (nextMode !== mode) {
      reasonCodes.push("user_autonomy_lowered");
    }

    mode = nextMode;
  }

  (inputs.runtimeSignalDemotions ?? []).forEach((demotion) => {
    const nextMode = demoteOneRung(mode);

    if (nextMode !== mode) {
      reasonCodes.push(demotion.reasonCode);
    }

    mode = nextMode;
  });

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

  return {
    actionId: action.id,
    mode,
    rationale,
  };
}

function effectFloorsFor(
  effects: ActionEffects,
  posture: PosturePreset,
): EffectFloorRecord[] {
  const floors: EffectFloorRecord[] = [];

  if (effects.cost === "quota") {
    floors.push({
      dimension: "cost",
      value: "quota",
      floorMode:
        posture === "creative-tool"
          ? "Gated suffix"
          : posture === "business-app"
            ? "Plan preview"
            : "Step-gated",
      applied: false,
      reasonCode: `effect_floor:${posture}:cost_quota`,
    });
  } else if (effects.cost === "money") {
    floors.push({
      dimension: "cost",
      value: "money",
      floorMode:
        posture === "creative-tool"
          ? "Plan preview"
          : posture === "business-app"
            ? "Step-gated"
            : "Step-gated",
      applied: false,
      reasonCode: `effect_floor:${posture}:cost_money`,
    });
  }

  if (effects.sensitive) {
    const floorMode =
      posture === "creative-tool"
        ? effects.external
          ? "Gated suffix"
          : undefined
        : posture === "business-app"
          ? "Plan preview"
          : "Step-gated";

    floors.push({
      dimension: "sensitive",
      value: true,
      floorMode,
      applied: false,
      reasonCode: floorMode
        ? `effect_floor:${posture}:sensitive`
        : `effect_floor:${posture}:sensitive_local_no_floor`,
    });
  }

  if (effects.external) {
    const floorMode = posture === "sensitive-domain" ? "Plan preview" : undefined;

    floors.push({
      dimension: "external",
      value: true,
      floorMode,
      applied: false,
      reasonCode: floorMode
        ? `effect_floor:${posture}:external`
        : `effect_floor:${posture}:external_no_floor`,
    });
  }

  return floors;
}

function confirmationFloorFor(confirmation: Confirmation): ConfirmationFloorRecord {
  if (confirmation === "always") {
    return {
      value: confirmation,
      floorMode: "Gated suffix",
      applied: false,
      reasonCode: "confirmation_floor:always",
    };
  }

  return {
    value: confirmation,
    applied: false,
    reasonCode: `confirmation_floor:${confirmation}:none`,
  };
}

function resolveGrantUse(
  action: CompiledActionDeclaration,
  inputs: PolicyInputs,
  mode: Exclude<AutonomyMode, "Read-only">,
): GrantUseRecord {
  const now = inputs.now ?? new Date();
  const matchingGrant = (inputs.grants ?? []).find((grant) => {
    const surfaceMatches = !grant.surfaceId || grant.surfaceId === inputs.currentSurface;
    const actionMatches = !grant.actionIds || grant.actionIds.includes(action.id);
    const unexpired = !grant.expiresAt || Date.parse(grant.expiresAt) > now.getTime();

    return surfaceMatches && actionMatches && unexpired;
  });

  if (!matchingGrant) {
    return {
      used: false,
      grantIds: [],
      reason: "no_applicable_grant",
    };
  }

  if (action.risk === "destructive") {
    return {
      used: false,
      grantIds: [matchingGrant.id],
      reason: "grant_not_allowed_for_destructive_action",
    };
  }

  if (action.confirmation === "always") {
    return {
      used: false,
      grantIds: [matchingGrant.id],
      reason: "grant_cannot_suppress_confirmation_always",
    };
  }

  if (!inputs.allowGrantsToRaiseAutonomy) {
    return {
      used: false,
      grantIds: [matchingGrant.id],
      reason: "grant_available_but_policy_does_not_raise_autonomy",
    };
  }

  if (isLessAutonomous(matchingGrant.grantedMode, mode)) {
    return {
      used: false,
      grantIds: [matchingGrant.id],
      reason: "grant_would_lower_autonomy",
    };
  }

  return {
    used: true,
    grantIds: [matchingGrant.id],
    reason: "grant_applied",
  };
}

function demoteOneRung(
  mode: Exclude<AutonomyMode, "Read-only">,
): Exclude<AutonomyMode, "Read-only"> {
  const index = EXECUTION_MODE_ORDER.indexOf(mode);

  return EXECUTION_MODE_ORDER[Math.min(index + 1, EXECUTION_MODE_ORDER.length - 1)];
}

function leastAutonomous(modes: AutonomyMode[]): AutonomyMode {
  if (modes.includes("Refuse / hand off")) {
    return "Refuse / hand off";
  }

  const executionModes = modes.filter(
    (mode): mode is Exclude<AutonomyMode, "Read-only"> => mode !== "Read-only",
  );

  if (executionModes.length === 0) {
    return "Read-only";
  }

  return executionModes.reduce((current, next) =>
    isLessAutonomous(next, current) ? next : current,
  );
}

function requiresGateBoundary(mode: AutonomyMode): boolean {
  return mode === "Gated suffix" || mode === "Step-gated" || mode === "Refuse / hand off";
}

function metadataFor(action: CompiledActionDeclaration): DeclarationPolicyMetadata {
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

function mergeRationales(
  perActionModes: PerActionPolicyDecision[],
  inputs: PolicyInputs,
  finalMode: AutonomyMode,
): PolicyRationale {
  return {
    actionIds: perActionModes.map((decision) => decision.actionId),
    declarationMetadata: perActionModes.flatMap(
      (decision) => decision.rationale.declarationMetadata,
    ),
    selectedPosturePreset: inputs.posture,
    applicableOverrides: perActionModes.flatMap(
      (decision) => decision.rationale.applicableOverrides,
    ),
    effectFloors: perActionModes.flatMap((decision) => decision.rationale.effectFloors),
    confirmationFloor: perActionModes.find(
      (decision) => decision.rationale.confirmationFloor.applied,
    )?.rationale.confirmationFloor ?? {
      value: "never",
      applied: false,
      reasonCode: "confirmation_floor:none_applied_in_chain",
    },
    grant: mergeGrantUse(perActionModes),
    runtimeSignalDemotions: inputs.runtimeSignalDemotions ?? [],
    finalMode,
    reasonCodes: [
      ...new Set(perActionModes.flatMap((decision) => decision.rationale.reasonCodes)),
    ],
  };
}

function mergeGrantUse(perActionModes: PerActionPolicyDecision[]): GrantUseRecord {
  const grantIds = perActionModes.flatMap((decision) => decision.rationale.grant.grantIds);
  const used = perActionModes.some((decision) => decision.rationale.grant.used);

  return {
    used,
    grantIds: [...new Set(grantIds)],
    reason: used ? "one_or_more_grants_applied" : "no_grants_applied",
  };
}

function emptyRationale(inputs: PolicyInputs, finalMode: AutonomyMode): PolicyRationale {
  return {
    actionIds: [],
    declarationMetadata: [],
    selectedPosturePreset: inputs.posture,
    applicableOverrides: [],
    effectFloors: [],
    confirmationFloor: {
      value: "never",
      applied: false,
      reasonCode: "no_actions",
    },
    grant: {
      used: false,
      grantIds: [],
      reason: "no_actions",
    },
    runtimeSignalDemotions: [],
    finalMode,
    reasonCodes: ["no_actions"],
  };
}
