import {
  type PolicyDecision,
  type PolicyInputs,
  type PosturePreset,
  resolveActionPolicy,
} from "./policy.js";
import {
  RegistryCompileError,
  type CapabilityId,
  type CapabilityRegistry,
  type SurfaceId,
} from "./registry.js";

/** Registry-derived portable tool schema. Implements SA-DECL-100 and SA-DECL-108–109. */
export interface EcosystemToolSchema {
  description: string;
  inputSchema: unknown;
}

/** Explicit host context for ecosystem policy resolution. Implements SA-POL-104–105. */
export interface EcosystemToolContext extends Omit<
  PolicyInputs,
  "posture" | "currentSurface" | "availability"
> {
  surfaceId: SurfaceId;
}

/** Untrusted ecosystem tool proposal submitted for validation and policy. Implements SA-POL-100–101. */
export interface EcosystemToolInvocation {
  toolName: string;
  params: unknown;
  context: EcosystemToolContext;
}

/** Policy-backed allow, approval, or deny result for a tool proposal. Implements SA-POL-106–108. */
export type CanUseToolDecision =
  | { status: "allow"; toolName: string; params: unknown; rationale: PolicyDecision["rationale"] }
  | {
      status: "needs-approval";
      toolName: string;
      params: unknown;
      rationale: PolicyDecision["rationale"];
    }
  | {
      status: "deny";
      toolName: string;
      reason: "unknown_tool" | "invalid_params" | "policy_refused";
      rationale?: PolicyDecision["rationale"];
    };

/** Framework-neutral ecosystem authorization callback. Implements SA-POL-100–108. */
export type CanUseTool = (invocation: EcosystemToolInvocation) => CanUseToolDecision;

/** Framework-neutral per-tool approval predicate. Implements SA-POL-106–108. */
export type ToolApprovalPredicate = (params: unknown, context: EcosystemToolContext) => boolean;

/**
 * One provider's tool-name grammar, plus the mapping from declaration IDs onto it.
 *
 * Providers genuinely differ, so this cannot be a constant. `SA-DECL-012` mandates dot-separated
 * declaration IDs; Gemini's documented tool-name charset admits dots, while Anthropic's and
 * OpenAI's do not, and their length limits differ. A hardcoded `.` → `__` rewrite would therefore
 * mangle names on a provider that never needed it, and — because the rewrite lengthens names — a
 * name safe under one limit can overflow another. The target grammar is a property of the
 * deployment, so the adopter names it.
 *
 * Implements SA-BRIDGE-014's semantics at door one.
 */
export interface ProviderToolNameProfile {
  /** Provider identifier, used in construction-time error messages. */
  id: string;
  /** Full-match grammar every wire name must satisfy. */
  pattern: RegExp;
  /** Maximum wire-name length the provider accepts. */
  maxLength: number;
  /**
   * Deterministic declaration ID to wire name mapping. Reversal is not this function's job: the
   * adapter builds the inverse table over the compiled registry, which is what makes reversal
   * total and injectivity checkable.
   */
  toWireName(id: CapabilityId): string;
}

/** Options extending adapter construction without disturbing the registry/posture pair. */
export interface EcosystemAdapterOptions {
  /** The target provider's tool-name grammar. Required: no default is safe for every provider. */
  toolNames: ProviderToolNameProfile;
}

/** Registry-generated schemas and policy callbacks for an ecosystem bridge. Implements SA-DECL-108–109. */
export interface EcosystemAdapter {
  /** AI-SDK-style `{ description, inputSchema }` definitions, keyed by provider-legal wire name. */
  toolSchemas: Record<string, EcosystemToolSchema>;
  /** Per-tool predicates keyed identically to `toolSchemas`: true only when policy resolves to a reviewable approval gate. */
  toolApproval: Record<string, ToolApprovalPredicate>;
  canUseTool: CanUseTool;
  /**
   * Recovers the canonical dotted declaration ID from a wire name, or `undefined` if the name was
   * not generated from this registry. Wire names are an artifact of a provider's namespace and
   * MUST NOT escape this boundary: `SA-LED-009` requires the ledger to record stable declaration
   * IDs and forbids inventing alternate action IDs for ledger use.
   */
  toCapabilityId(wireName: string): CapabilityId | undefined;
  /** Returns the wire name generated for a declared action, or `undefined` if it is not declared. */
  toWireName(id: CapabilityId): string | undefined;
}

/** Replaces the dot separator mandated by SA-DECL-012 with the underscore pair both dot-free providers admit. */
function dotsToUnderscores(id: CapabilityId): string {
  return id.split(".").join("__");
}

/**
 * Anthropic tool names: `^[a-zA-Z0-9_-]{1,128}$`, per the live 400 a dotted ID provokes
 * (`tools.0.custom.name: String should match pattern '^[a-zA-Z0-9_-]{1,128}$'`).
 */
export const anthropicToolNameProfile: ProviderToolNameProfile = {
  id: "anthropic",
  pattern: /^[a-zA-Z0-9_-]{1,128}$/,
  maxLength: 128,
  toWireName: dotsToUnderscores,
};

/** OpenAI tool names: the same dot-free charset under a shorter documented limit. */
export const openaiToolNameProfile: ProviderToolNameProfile = {
  id: "openai",
  pattern: /^[a-zA-Z0-9_-]{1,64}$/,
  maxLength: 64,
  toWireName: dotsToUnderscores,
};

/**
 * Gemini tool names admit dots, so the declaration ID is already legal and the mapping is the
 * identity. Rewriting here would obscure the canonical ID for no protocol reason.
 */
export const geminiToolNameProfile: ProviderToolNameProfile = {
  id: "gemini",
  pattern: /^[a-zA-Z0-9_.:-]{1,128}$/,
  maxLength: 128,
  toWireName: (id) => id,
};

/**
 * The identity mapping, for a loop whose tool namespace is the protocol's own — a direct
 * dispatcher, an evaluation harness, or a provider that admits `SA-DECL-012` IDs verbatim.
 */
export const canonicalToolNameProfile: ProviderToolNameProfile = {
  id: "canonical",
  pattern: /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/,
  maxLength: 128,
  toWireName: (id) => id,
};

/**
 * Compiles one registry and selected posture into ecosystem-shaped tool primitives.
 * This adapter resolves policy and validates parameters only; it never executes tools.
 *
 * Construction is where the provider's tool namespace is reconciled with `SA-DECL-012`'s dotted
 * IDs. The mapping must be injective over *this* registry rather than merely reversible in the
 * abstract: `.` → `__` cannot distinguish a real dot from an authored underscore pair, so
 * `a.b__c_d` and `a__b.c_d` both produce `a__b__c_d`. Only the actual set of compiled IDs reveals
 * that, so collisions and grammar violations fail here, loudly, per `SA-DECL-096`, rather than
 * surfacing as a provider 400 on an adopter's first live call.
 *
 * Implements SA-DECL-096, SA-DECL-100, SA-DECL-108–109, SA-POL-100–108, and SA-BRIDGE-014's
 * semantics at door one.
 *
 * @throws RegistryCompileError When a declared action maps onto an illegal or colliding wire name.
 */
export function createEcosystemAdapter(
  registry: CapabilityRegistry,
  posture: PosturePreset,
  options: EcosystemAdapterOptions,
): EcosystemAdapter {
  const { toolNames } = options;
  const canonicalByWireName = new Map<string, CapabilityId>();
  const wireNameByCanonical = new Map<CapabilityId, string>();

  for (const action of registry.getAllActions()) {
    const wireName = toolNames.toWireName(action.id);
    if (typeof wireName !== "string") {
      throw new RegistryCompileError(
        "invalid_tool_name",
        `Action \"${action.id}\" mapped to ${String(wireName)} rather than a tool name for provider \"${toolNames.id}\".`,
      );
    }
    // Length is checked before the grammar because most grammars already bound length, and
    // "too long" is the legible diagnosis when a rewrite such as `.` -> `__` is what pushed the
    // name over a provider's limit.
    if (wireName.length > toolNames.maxLength) {
      throw new RegistryCompileError(
        "invalid_tool_name",
        `Action \"${action.id}\" maps to tool name \"${wireName}\" (${wireName.length} characters), exceeding provider \"${toolNames.id}\"'s limit of ${toolNames.maxLength}.`,
      );
    }
    if (!toolNames.pattern.test(wireName)) {
      throw new RegistryCompileError(
        "invalid_tool_name",
        `Action \"${action.id}\" maps to tool name \"${wireName}\", which provider \"${toolNames.id}\" rejects (${String(toolNames.pattern)}).`,
      );
    }
    const collidesWith = canonicalByWireName.get(wireName);
    if (collidesWith !== undefined) {
      throw new RegistryCompileError(
        "tool_name_collision",
        `Actions \"${collidesWith}\" and \"${action.id}\" both map to tool name \"${wireName}\" for provider \"${toolNames.id}\". The mapping must be injective so every tool call is traceable back to one declaration ID (SA-LED-009); rename one of the declarations.`,
      );
    }
    canonicalByWireName.set(wireName, action.id);
    wireNameByCanonical.set(action.id, wireName);
  }

  const canUseTool: CanUseTool = ({ toolName, params, context }) => {
    // `toolName` arrives in the provider's namespace; everything downstream of this line —
    // policy, the returned decision, the caller's executor and ledger write — sees only the
    // canonical declaration ID (SA-LED-009).
    const actionId = canonicalByWireName.get(toolName);
    const action = actionId === undefined ? undefined : registry.getAction(actionId);
    if (!action) return { status: "deny", toolName, reason: "unknown_tool" };

    let parsedParams: unknown;
    try {
      parsedParams = registry.validateActionParams(action, params);
    } catch {
      return { status: "deny", toolName: action.id, reason: "invalid_params" };
    }

    const policy = resolveActionPolicy(action, {
      ...context,
      posture,
      currentSurface: context.surfaceId,
      availability: registry,
    });
    if (policy.finalMode === "Refuse / hand off") {
      return {
        status: "deny",
        toolName: action.id,
        reason: "policy_refused",
        rationale: policy.rationale,
      };
    }
    if (requiresApproval(policy.finalMode)) {
      return {
        status: "needs-approval",
        toolName: action.id,
        params: parsedParams,
        rationale: policy.rationale,
      };
    }
    return {
      status: "allow",
      toolName: action.id,
      params: parsedParams,
      rationale: policy.rationale,
    };
  };

  const toolSchemas: Record<string, EcosystemToolSchema> = {};
  const toolApproval: Record<string, ToolApprovalPredicate> = {};
  for (const action of registry.getAllActions()) {
    // Every declared action reaches the model. `params.jsonSchema` is required by SA-DECL-100 and
    // enforced at registry compilation, so there is no longer a schema-less action to skip — the
    // guard that used to stand here silently dropped exactly those actions.
    const wireName = wireNameByCanonical.get(action.id) as string;
    toolApproval[wireName] = (params, context) =>
      canUseTool({ toolName: wireName, params, context }).status === "needs-approval";
    toolSchemas[wireName] = {
      description: action.description,
      inputSchema: action.params.jsonSchema,
    };
  }

  return {
    toolSchemas,
    toolApproval,
    canUseTool,
    toCapabilityId: (wireName) => canonicalByWireName.get(wireName),
    toWireName: (id) => wireNameByCanonical.get(id),
  };
}

function requiresApproval(mode: PolicyDecision["finalMode"]): boolean {
  return mode === "Gated suffix" || mode === "Plan preview" || mode === "Step-gated";
}
