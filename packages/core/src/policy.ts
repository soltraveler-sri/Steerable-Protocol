import type {
  ActionEffects,
  AnyCompiledActionDeclaration,
  Confirmation,
  ReversibilityKind,
  Risk,
  SurfaceId,
} from "./registry.js";

/** Framework-supplied posture preset. Implements SA-POL-140–147. */
export type PosturePreset = "creative-tool" | "business-app" | "sensitive-domain";
/** Complete seven-mode autonomy ladder. Implements SA-POL-080–097. */
export type AutonomyMode =
  | "Read-only"
  | "Instant execution"
  | "Optimistic chain"
  | "Gated suffix"
  | "Plan preview"
  | "Step-gated"
  | "Refuse / hand off";
/** Action-executing portion of the autonomy ladder. Implements SA-POL-096–097. */
export type ExecutionMode = Exclude<AutonomyMode, "Read-only">;

/**
 * Developer policy floor scoped to an action, surface, role, session trust, or environment.
 *
 * Implements SA-POL-112–114 and SA-POL-145. SA-POL-112 permits overrides "per action, role,
 * surface, user segment, environment, or declared metadata predicate", and SA-POL-145 makes
 * "per action, role, and surface" a MUST, so `role` is a first-class predicate here.
 *
 * Every predicate is scoping, not a floor: an unset predicate matches anything, and a set
 * predicate matches only an equal value in {@link PolicyInputs}. A role-scoped override
 * therefore does not apply when {@link PolicyInputs.role} is absent — a role-scoped floor
 * has no defined meaning against an unknown role, and applying every role's floor at once
 * would be incoherent. Hosts that need a floor to survive an unknown role must leave the
 * predicate unset.
 */
export interface PolicyOverride {
  id: string;
  actionId?: string;
  surfaceId?: SurfaceId;
  /** Implements SA-POL-145: preset mappings MUST be developer-overridable per role. */
  role?: string;
  /** Implements SA-BRIDGE-044: session trust MUST reach policy as an explicit input. */
  sessionTrust?: string;
  /** Implements SA-POL-112: overrides MAY be scoped per environment. */
  environment?: string;
  minimumMode: ExecutionMode;
  reasonCode: string;
}

/**
 * Explicit grant with action, surface, principal, session, and expiration scope.
 *
 * Implements SA-POL-126–133. SA-POL-126 requires a grant to carry "scope, expiration, issuer,
 * granted subject, and granted policy effect". SA-POL-127 defines the grant *subject* as the
 * thing granted over — "Supported scoped-grant subjects MUST include at least action ID and MAY
 * include surface, session, role, parameter predicate, and action-class predicates over declared
 * metadata" — which is why {@link subject} is the human-readable descriptor of that scope and
 * {@link actionIds}, {@link surfaceId}, {@link role} are its enforced forms.
 *
 * Destructive and confirmation-always actions never use a grant (SA-POL-131, SA-POL-132), and a
 * grant never authorizes an unavailable action (SA-POL-133).
 */
export interface ScopedGrant {
  id: string;
  actionIds: string[];
  surfaceId?: SurfaceId;
  sessionId?: string;
  /**
   * Principal this grant was issued to. Implements SA-POL-126's "granted subject" as an
   * enforced scope: when set, the grant only resolves for a matching
   * {@link PolicyInputs.subjectId}, and fails closed when no principal is supplied.
   */
  subjectId?: string;
  /** Role scope. Implements SA-POL-127's role grant subject. */
  role?: string;
  expiresAt?: string;
  issuer: string;
  /** Human-readable description of the granted scope. See SA-POL-127. */
  subject: string;
  grantedMode: Exclude<ExecutionMode, "Refuse / hand off">;
  /**
   * Who issued the grant, which decides how long it may live.
   *
   * Implements SA-POL-129 — "A framework-supplied scoped grant MUST expire no later than the
   * current session unless developer policy defines a shorter expiration" — and SA-POL-130 —
   * "A persistent grant beyond the current session MAY exist only as developer policy, and MUST
   * be revocable and recordable."
   *
   * An absent value is resolved as `"framework"`, the stricter reading: a grant that does not
   * claim developer provenance cannot be assumed to have it.
   */
  source?: "framework" | "developer";
}

/**
 * Invocation-specific, single-rung autonomy demotion.
 *
 * Implements SA-POL-120–125. SA-POL-123: "Framework-supplied runtime-signal demotion MUST be
 * invocation-specific, bounded to one rung in the execution-mode ordering, and recorded in the
 * rationale."
 */
export interface RuntimeSignalDemotion {
  id: string;
  reasonCode: string;
  /**
   * Rungs this signal asks to demote. SA-POL-123 bounds framework-supplied demotion to one rung,
   * so `1` is the only in-contract value and the only one the type admits. The resolver reads
   * this field and clamps the *aggregate* demotion across all signals to
   * {@link FRAMEWORK_MAX_DEMOTION_RUNGS}, so an out-of-contract value cast past the type still
   * cannot exceed the bound.
   */
  demoteBy?: 1;
}

/**
 * How an availability provider answered, and whether it answered in full.
 *
 * Implements SA-POL-108 and SA-LED-002. A runtime that continues a chain onto another surface
 * cannot evaluate that surface's liveness and preconditions at plan time — the destination is by
 * definition not yet live — so it may answer from declaration membership alone. That substitution
 * is legitimate and is re-checked at the cross-surface boundary, but SA-POL-106 requires "a
 * resolved autonomy mode and a recordable rationale" and SA-LED-002 requires the ledger to record
 * "each policy decision returned for proposed action use". A decision computed from a weaker
 * predicate than the one it names is not the decision the runtime acted on, so the provider
 * reports the substitution here and the resolver records it.
 */
export interface AvailabilityAnswer {
  available: boolean;
  /**
   * Set when this answer came from declaration membership only, deferring liveness and
   * precondition checks to the cross-surface boundary named here.
   */
  deferredToSurfaceBoundary?: { targetSurfaceId: SurfaceId };
}

/** Registry availability query supplied as an explicit policy input. Implements SA-POL-104–105. */
export interface PolicyAvailability {
  isActionAvailableOnSurface(actionId: string, surfaceId: SurfaceId): boolean;
  /**
   * Richer form of {@link isActionAvailableOnSurface} that also reports whether the answer was
   * complete. Optional: a provider that always evaluates full availability may omit it, and the
   * resolver falls back to {@link isActionAvailableOnSurface} and records no deferral.
   */
  explainActionAvailability?(actionId: string, surfaceId: SurfaceId): AvailabilityAnswer;
}

/**
 * Complete explicit input set for pure policy resolution.
 *
 * Implements SA-POL-102–105. SA-POL-105: "Policy-engine inputs MUST include the proposed action or
 * chain, the relevant registry entries, declared policy metadata, current surface,
 * registry-checkable precondition state, selected posture preset, developer overrides, user role,
 * session trust, user autonomy setting, scoped grants, and runtime signals." SA-BRIDGE-044 adds
 * that external caller, host, transport, and session trust "MUST be supplied to the policy engine
 * through explicit inputs such as session trust, role, environment, scoped grants, developer
 * overrides, or runtime signals".
 *
 * Resolution stays pure over these inputs: nothing here is defaulted from ambient state, and in
 * particular {@link now} is never defaulted from the system clock.
 */
export interface PolicyInputs {
  posture: PosturePreset;
  currentSurface: SurfaceId;
  availability?: PolicyAvailability;
  overrides?: PolicyOverride[];
  grants?: ScopedGrant[];
  runtimeSignalDemotions?: RuntimeSignalDemotion[];
  userMinimumMode?: ExecutionMode;
  /**
   * Clock used to evaluate grant expiration. Left optional to keep resolution pure and to avoid
   * breaking existing callers; when it is absent, any grant carrying `expiresAt` fails closed
   * with `grant_expiry_unevaluable` rather than being honoured.
   */
  now?: Date;
  sessionId?: string;
  /** Principal the decision is being resolved for. Implements SA-POL-105's user identity input. */
  subjectId?: string;
  /** Implements SA-POL-105's "user role" input and SA-POL-145. */
  role?: string;
  /** Implements SA-POL-105's "session trust" input and SA-BRIDGE-044. */
  sessionTrust?: string;
  /** Implements SA-POL-112 and SA-BRIDGE-044's environment input. */
  environment?: string;
  allowGrantsToRaiseAutonomy?: boolean;
  /**
   * Whether this decision can be recorded before execution.
   *
   * Implements SA-POL-147 — "The `sensitive-domain` preset MUST require every policy decision to be
   * recordable before execution; if recording is unavailable, the resolved mode MUST be
   * `Refuse / hand off`" — and SA-LED-008. Under `sensitive-domain` an absent value is resolved as
   * *not* recordable: the requirement exists to fail closed, and an unanswered question about
   * recordability is not an affirmative answer.
   */
  recordable?: boolean;
}

/** Registry-derived action metadata used by policy. Implements SA-POL-001–010. */
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

/** Auditable effect-floor application. Implements SA-POL-160–171. */
export interface EffectFloorRecord {
  dimension: "cost" | "sensitive" | "external";
  value: string | boolean;
  floorMode?: ExecutionMode;
  applied: boolean;
  reasonCode: string;
}

/** Auditable confirmation floor. Implements SA-POL-069–073. */
export interface ConfirmationFloorRecord {
  value: Confirmation;
  floorMode?: ExecutionMode;
  applied: boolean;
  reasonCode: string;
}

/** Auditable grant use or non-use. Implements SA-POL-126–133. */
export interface GrantUseRecord {
  used: boolean;
  grantIds: string[];
  reason: string;
}

/**
 * Auditable record that plan-time availability for one action was answered by declaration
 * membership only. Implements SA-POL-108 and SA-LED-002.
 */
export interface AvailabilityDeferralRecord {
  actionId: string;
  targetSurfaceId: SurfaceId;
  reasonCode: string;
}

/**
 * Non-declaration identity and environment inputs this decision was resolved against.
 * Implements SA-POL-105, SA-POL-108, and SA-BRIDGE-044 by making the inputs that gate
 * role-scoped overrides and principal-scoped grants recoverable from the rationale alone.
 */
export interface PolicyResolutionContext {
  subjectId?: string;
  role?: string;
  sessionTrust?: string;
  environment?: string;
  sessionId?: string;
}

/** Recordable explanation of every policy input and floor that affected the result. Implements SA-POL-108. */
export interface PolicyRationale {
  actionIds: string[];
  declarationMetadata: DeclarationPolicyMetadata[];
  selectedPosturePreset: PosturePreset;
  applicableOverrides: PolicyOverride[];
  effectFloors: EffectFloorRecord[];
  confirmationFloor: ConfirmationFloorRecord;
  grant: GrantUseRecord;
  runtimeSignalDemotions: RuntimeSignalDemotion[];
  /** Implements SA-POL-108 and SA-LED-002; empty when every availability answer was complete. */
  availabilityDeferrals: AvailabilityDeferralRecord[];
  /** Implements SA-POL-105 and SA-BRIDGE-044. */
  resolutionContext: PolicyResolutionContext;
  finalMode: AutonomyMode;
  reasonCodes: string[];
}

/** Resolved mode and rationale for one action in a chain. Implements SA-POL-107–108. */
export interface PerActionPolicyDecision {
  actionId: string;
  mode: ExecutionMode;
  rationale: PolicyRationale;
}

/** Auditable policy output for an action or chain. Implements SA-POL-106–108. */
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

/** Complete risk-by-reversibility grids for the three posture presets. Implements SA-POL-140–147. */
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
    destructive: { undoable: "Gated suffix", snapshot: "Gated suffix", irreversible: "Step-gated" },
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
    mutating: { undoable: "Gated suffix", snapshot: "Plan preview", irreversible: "Plan preview" },
    destructive: { undoable: "Plan preview", snapshot: "Plan preview", irreversible: "Step-gated" },
  },
  "sensitive-domain": {
    safe: {
      undoable: "Optimistic chain",
      snapshot: "Optimistic chain",
      irreversible: "Plan preview",
    },
    side_effect: { undoable: "Plan preview", snapshot: "Plan preview", irreversible: "Step-gated" },
    mutating: { undoable: "Plan preview", snapshot: "Step-gated", irreversible: "Step-gated" },
    destructive: {
      undoable: "Step-gated",
      snapshot: "Step-gated",
      irreversible: "Refuse / hand off",
    },
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

/**
 * Purely resolves one registry-compiled action without executing or mutating state.
 * Implements SA-POL-100–106 and SA-POL-108.
 */
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

/**
 * Purely resolves a proposed action chain and exposes its auditable gate boundary.
 * Implements SA-POL-100–108.
 */
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
    decision.requiredGate = {
      mode: "Plan preview",
      startIndex: 0,
      actionIds: [...decision.actionIds],
    };
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

/** Reports whether `left` is lower on the autonomy ladder than `right`. Implements SA-POL-096. */
export function isLessAutonomous(left: ExecutionMode, right: ExecutionMode): boolean {
  return EXECUTION_MODE_ORDER.indexOf(left) > EXECUTION_MODE_ORDER.indexOf(right);
}

/** Applies the least-autonomous of a mode and policy floor. Implements SA-POL-096 and SA-POL-144. */
export function applyModeFloor(mode: ExecutionMode, floor: ExecutionMode): ExecutionMode {
  return isLessAutonomous(floor, mode) ? floor : mode;
}

function resolveOneAction(
  action: AnyCompiledActionDeclaration,
  inputs: PolicyInputs,
): PerActionPolicyDecision {
  const metadata = metadataFor(action);
  const reasonCodes: string[] = [];
  let mode = posturePresetMappings[inputs.posture][action.risk][action.reversibility.kind];
  reasonCodes.push(`preset:${inputs.posture}:${action.risk}:${action.reversibility.kind}:${mode}`);

  const availability = queryAvailability(action.id, inputs);
  const unavailable = availability && !availability.available;
  const availabilityDeferrals: AvailabilityDeferralRecord[] = [];
  if (availability?.deferredToSurfaceBoundary) {
    const { targetSurfaceId } = availability.deferredToSurfaceBoundary;
    const reasonCode = `availability:deferred_to_cross_surface_boundary:${targetSurfaceId}`;
    availabilityDeferrals.push({ actionId: action.id, targetSurfaceId, reasonCode });
    reasonCodes.push(reasonCode);
  }
  const effectFloors = effectFloorsFor(action.effects, inputs.posture);
  for (const floor of effectFloors) {
    if (floor.floorMode) {
      // SA-POL-173: participation is measured against the incoming mode, so an
      // equal floor is applied even though it does not change the result.
      floor.applied = floor.floorMode === mode || isLessAutonomous(floor.floorMode, mode);
      const next = applyModeFloor(mode, floor.floorMode);
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

  const applicableOverrides = (inputs.overrides ?? []).filter((override) =>
    overrideApplies(override, action.id, inputs),
  );
  for (const override of applicableOverrides) {
    mode = applyModeFloor(mode, override.minimumMode);
    reasonCodes.push(override.reasonCode);
  }

  // Every floor that has been established so far bounds how far a grant may raise autonomy.
  // SA-POL-144: "When more than one floor applies, the policy engine MUST choose the least
  // autonomous applicable mode according to SA-POL-096." Capturing the floor here — rather than
  // relying on `mode`, which a grant is about to overwrite — is what stops a grant from erasing
  // an effect floor (SA-POL-160–172) or a developer override (SA-POL-114).
  const policyFloor = leastAutonomousOrUndefined([
    ...effectFloors.map((floor) => floor.floorMode),
    confirmationFloor.floorMode,
    ...applicableOverrides.map((override) => override.minimumMode),
  ]);

  const grant = resolveGrantUse(action, inputs, mode, unavailable === true, policyFloor);
  if (grant.used && inputs.allowGrantsToRaiseAutonomy) {
    const grantMode = (inputs.grants ?? []).find(
      (grantItem) => grantItem.id === grant.grantIds[0],
    )?.grantedMode;
    if (grantMode) {
      const cappedMode = policyFloor ? applyModeFloor(grantMode, policyFloor) : grantMode;
      if (cappedMode !== grantMode) reasonCodes.push(`grant_capped_by_policy_floor:${policyFloor}`);
      if (!isLessAutonomous(cappedMode, mode)) {
        mode = cappedMode;
        reasonCodes.push("grant_used");
      }
    }
  }

  if (inputs.userMinimumMode) {
    const next = applyModeFloor(mode, inputs.userMinimumMode);
    if (next !== mode) reasonCodes.push("user_autonomy_lowered");
    mode = next;
  }
  mode = applyRuntimeSignalDemotion(mode, inputs.runtimeSignalDemotions ?? [], reasonCodes);
  if (unavailable) {
    mode = "Refuse / hand off";
    reasonCodes.push("action_unavailable");
  }
  // SA-POL-147 and SA-LED-008 fail closed: an unknown recordability is not a recordable one.
  if (inputs.posture === "sensitive-domain" && inputs.recordable !== true) {
    mode = "Refuse / hand off";
    reasonCodes.push(
      inputs.recordable === false ? "recording_unavailable" : "recording_unconfirmed",
    );
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
    availabilityDeferrals,
    resolutionContext: resolutionContextFor(inputs),
    finalMode: mode,
    reasonCodes,
  };
  return { actionId: action.id, mode, rationale };
}

/**
 * Reads the availability provider through its richest supported form.
 * Implements SA-POL-104–105 and, via {@link AvailabilityAnswer}, SA-POL-108.
 */
function queryAvailability(actionId: string, inputs: PolicyInputs): AvailabilityAnswer | undefined {
  if (!inputs.availability) return undefined;
  if (inputs.availability.explainActionAvailability) {
    return inputs.availability.explainActionAvailability(actionId, inputs.currentSurface);
  }
  return {
    available: inputs.availability.isActionAvailableOnSurface(actionId, inputs.currentSurface),
  };
}

/** Implements SA-POL-112 and SA-POL-145 override scoping. */
function overrideApplies(
  override: PolicyOverride,
  actionId: string,
  inputs: PolicyInputs,
): boolean {
  return (
    (!override.actionId || override.actionId === actionId) &&
    (!override.surfaceId || override.surfaceId === inputs.currentSurface) &&
    (!override.role || override.role === inputs.role) &&
    (!override.sessionTrust || override.sessionTrust === inputs.sessionTrust) &&
    (!override.environment || override.environment === inputs.environment)
  );
}

function resolutionContextFor(inputs: PolicyInputs): PolicyResolutionContext {
  const context: PolicyResolutionContext = {};
  if (inputs.subjectId !== undefined) context.subjectId = inputs.subjectId;
  if (inputs.role !== undefined) context.role = inputs.role;
  if (inputs.sessionTrust !== undefined) context.sessionTrust = inputs.sessionTrust;
  if (inputs.environment !== undefined) context.environment = inputs.environment;
  if (inputs.sessionId !== undefined) context.sessionId = inputs.sessionId;
  return context;
}

function effectFloorsFor(effects: ActionEffects, posture: PosturePreset): EffectFloorRecord[] {
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
      floorMode: posture === "creative-tool" ? "Plan preview" : "Step-gated",
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
  return confirmation === "always"
    ? {
        value: confirmation,
        floorMode: "Gated suffix",
        applied: false,
        reasonCode: "confirmation_floor:always",
      }
    : {
        value: confirmation,
        applied: false,
        reasonCode: `confirmation_floor:${confirmation}:none`,
      };
}

/**
 * Reports why a grant's scope does not admit this resolution, or `undefined` when it does.
 *
 * Implements SA-POL-126, SA-POL-127, SA-POL-129, and SA-POL-130.
 *
 * SA-POL-129 (MUST): "A framework-supplied scoped grant MUST expire no later than the current
 * session unless developer policy defines a shorter expiration." A framework grant therefore has
 * to name both the session it belongs to and an expiration; without them there is no bound to
 * enforce, and an unbounded framework grant would raise autonomy forever and across sessions.
 *
 * SA-POL-130 (MUST): "A persistent grant beyond the current session MAY exist only as developer
 * policy, and MUST be revocable and recordable." Only `source: "developer"` may omit `expiresAt`.
 * Revocation is the host's: grants are explicit inputs, so withdrawing one revokes it. Recording
 * is {@link GrantUseRecord.reason}, which discloses persistence when such a grant is applied.
 */
function grantScopeViolation(grant: ScopedGrant, inputs: PolicyInputs): string | undefined {
  // SA-POL-129/130: absent provenance resolves to the stricter "framework" reading.
  const source = grant.source ?? "framework";
  if (source === "framework") {
    if (!grant.sessionId) return "framework_grant_missing_session_scope";
    if (!grant.expiresAt) return "framework_grant_missing_expiration";
  }
  if (grant.sessionId && grant.sessionId !== inputs.sessionId) return "grant_session_mismatch";
  // SA-POL-126's granted subject, enforced. Failing closed when no principal is supplied keeps a
  // host that forgets to pass `subjectId` from silently widening a grant to every principal.
  if (grant.subjectId) {
    if (inputs.subjectId === undefined) return "grant_subject_unverifiable";
    if (grant.subjectId !== inputs.subjectId) return "grant_subject_mismatch";
  }
  if (grant.role) {
    if (inputs.role === undefined) return "grant_role_unverifiable";
    if (grant.role !== inputs.role) return "grant_role_mismatch";
  }
  if (grant.expiresAt) {
    // Expiry is evaluated against an explicit clock so resolution stays pure. Every branch below
    // fails closed: an unevaluable or unparsable expiry never resolves as unexpired.
    if (inputs.now === undefined) return "grant_expiry_unevaluable";
    const expiresAt = Date.parse(grant.expiresAt);
    if (!Number.isFinite(expiresAt)) return "grant_expiry_unparsable";
    if (expiresAt <= inputs.now.getTime()) return "grant_expired";
  }
  return undefined;
}

/**
 * Resolves grant use or non-use with a legible reason. Implements SA-POL-126–133.
 *
 * The absolute prohibitions (SA-POL-131 destructive, SA-POL-132 `confirmation: always`,
 * SA-POL-133 unavailable) are reported before scope problems: they hold for any grant naming this
 * action regardless of its expiry or principal, so they are the more useful disclosure.
 */
function resolveGrantUse(
  action: AnyCompiledActionDeclaration,
  inputs: PolicyInputs,
  mode: ExecutionMode,
  unavailable: boolean,
  policyFloor: ExecutionMode | undefined,
): GrantUseRecord {
  const candidates = (inputs.grants ?? []).filter(
    (grant) =>
      grant.actionIds.includes(action.id) &&
      (!grant.surfaceId || grant.surfaceId === inputs.currentSurface),
  );
  if (candidates.length === 0) return { used: false, grantIds: [], reason: "no_applicable_grant" };
  const inScope = candidates.find((grant) => grantScopeViolation(grant, inputs) === undefined);
  const matching = inScope ?? candidates[0];
  if (unavailable)
    return {
      used: false,
      grantIds: [matching.id],
      reason: "grant_cannot_authorize_unavailable_action",
    };
  if (action.risk === "destructive")
    return {
      used: false,
      grantIds: [matching.id],
      reason: "grant_not_allowed_for_destructive_action",
    };
  if (action.confirmation === "always")
    return {
      used: false,
      grantIds: [matching.id],
      reason: "grant_cannot_suppress_confirmation_always",
    };
  if (!inScope)
    return {
      used: false,
      grantIds: [matching.id],
      reason: grantScopeViolation(matching, inputs) ?? "grant_out_of_scope",
    };
  if (!inputs.allowGrantsToRaiseAutonomy)
    return {
      used: false,
      grantIds: [matching.id],
      reason: "grant_available_but_policy_does_not_raise_autonomy",
    };
  // SA-POL-144: a grant may not raise autonomy past a floor that already applies.
  const cappedMode = policyFloor
    ? applyModeFloor(matching.grantedMode, policyFloor)
    : matching.grantedMode;
  if (cappedMode !== matching.grantedMode && !isLessAutonomous(mode, cappedMode))
    return { used: false, grantIds: [matching.id], reason: "grant_capped_by_policy_floor" };
  if (isLessAutonomous(matching.grantedMode, mode))
    return { used: false, grantIds: [matching.id], reason: "grant_would_lower_autonomy" };
  return {
    used: true,
    grantIds: [matching.id],
    // SA-POL-130 requires a persistent grant to be recordable; this is that record.
    reason:
      matching.source === "developer" && !matching.expiresAt
        ? "grant_applied:developer_persistent"
        : "grant_applied",
  };
}

/**
 * The one-rung bound SA-POL-123 places on framework-supplied runtime-signal demotion:
 * "Framework-supplied runtime-signal demotion MUST be invocation-specific, bounded to one rung in
 * the execution-mode ordering, and recorded in the rationale."
 */
const FRAMEWORK_MAX_DEMOTION_RUNGS = 1;

/**
 * Applies at most one rung of demotion for an entire invocation, however many signals fired.
 *
 * Implements SA-POL-123 and SA-POL-125 — "Runtime-signal demotion MUST NOT be implemented as a
 * hidden global rule that gates all safe reversible actions." Demoting once per signal let N
 * independent signals walk a clean safe reversible action down N rungs to `Refuse / hand off`,
 * which is exactly the gating SA-POL-125 and SA-POL-073 forbid.
 *
 * Every signal is still recorded, both in {@link PolicyRationale.runtimeSignalDemotions} and by
 * pushing each signal's reason code, so bounding the effect does not cost the audit trail.
 */
function applyRuntimeSignalDemotion(
  mode: ExecutionMode,
  demotions: RuntimeSignalDemotion[],
  reasonCodes: string[],
): ExecutionMode {
  if (demotions.length === 0) return mode;
  const requestedRungs = demotions.reduce((total, demotion) => total + (demotion.demoteBy ?? 1), 0);
  const rungs = Math.min(requestedRungs, FRAMEWORK_MAX_DEMOTION_RUNGS);
  const next = demoteRungs(mode, rungs);
  if (next === mode) return mode;
  for (const demotion of demotions) reasonCodes.push(demotion.reasonCode);
  if (requestedRungs > FRAMEWORK_MAX_DEMOTION_RUNGS) {
    reasonCodes.push("runtime_signal_demotion:bounded_to_one_rung");
  }
  return next;
}

function demoteRungs(mode: ExecutionMode, rungs: number): ExecutionMode {
  return EXECUTION_MODE_ORDER[
    Math.min(EXECUTION_MODE_ORDER.indexOf(mode) + rungs, EXECUTION_MODE_ORDER.length - 1)
  ];
}

function leastAutonomousOrUndefined(
  modes: (ExecutionMode | undefined)[],
): ExecutionMode | undefined {
  const present = modes.filter((mode): mode is ExecutionMode => mode !== undefined);
  return present.length === 0 ? undefined : leastAutonomous(present);
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
    actionIds: [],
    declarationMetadata: [],
    selectedPosturePreset: inputs.posture,
    applicableOverrides: [],
    effectFloors: [],
    confirmationFloor: { value: "never", applied: false, reasonCode: "confirmation_floor:none" },
    grant: { used: false, grantIds: [], reason: "no_action" },
    runtimeSignalDemotions: inputs.runtimeSignalDemotions ?? [],
    availabilityDeferrals: [],
    resolutionContext: resolutionContextFor(inputs),
    finalMode: "Read-only",
    reasonCodes: ["read_only"],
  };
}

function mergeRationales(
  perAction: PerActionPolicyDecision[],
  inputs: PolicyInputs,
  finalMode: AutonomyMode,
): PolicyRationale {
  return {
    actionIds: perAction.map((item) => item.actionId),
    declarationMetadata: perAction.flatMap((item) => item.rationale.declarationMetadata),
    selectedPosturePreset: inputs.posture,
    applicableOverrides: perAction.flatMap((item) => item.rationale.applicableOverrides),
    effectFloors: perAction.flatMap((item) => item.rationale.effectFloors),
    confirmationFloor: perAction.find((item) => item.rationale.confirmationFloor.applied)?.rationale
      .confirmationFloor ?? {
      value: "never",
      applied: false,
      reasonCode: "confirmation_floor:none_applied_in_chain",
    },
    grant: mergeGrantUse(perAction),
    runtimeSignalDemotions: inputs.runtimeSignalDemotions ?? [],
    availabilityDeferrals: perAction.flatMap((item) => item.rationale.availabilityDeferrals),
    resolutionContext: resolutionContextFor(inputs),
    finalMode,
    reasonCodes: [...new Set(perAction.flatMap((item) => item.rationale.reasonCodes))],
  };
}

function mergeGrantUse(perAction: PerActionPolicyDecision[]): GrantUseRecord {
  const grantIds = perAction.flatMap((item) => item.rationale.grant.grantIds);
  const applied = perAction.find((item) => item.rationale.grant.used);
  return {
    used: applied !== undefined,
    grantIds,
    // Preserve the per-action reason verbatim so a chain-level record cannot lose an
    // SA-POL-130 persistence disclosure.
    reason: applied
      ? applied.rationale.grant.reason
      : (perAction[0]?.rationale.grant.reason ?? "no_action"),
  };
}
