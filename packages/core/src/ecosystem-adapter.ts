import {
  type PolicyDecision,
  type PolicyInputs,
  type PosturePreset,
  resolveActionPolicy,
} from "./policy.js";
import type { CapabilityRegistry, SurfaceId } from "./registry.js";

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

/** Registry-generated schemas and policy callbacks for an ecosystem bridge. Implements SA-DECL-108–109. */
export interface EcosystemAdapter {
  /** AI-SDK-style `{ description, inputSchema }` definitions, keyed by declared action ID. */
  toolSchemas: Record<string, EcosystemToolSchema>;
  /** Per-tool predicates: true only when policy resolves to a reviewable approval gate. */
  toolApproval: Record<string, ToolApprovalPredicate>;
  canUseTool: CanUseTool;
}

/**
 * Compiles one registry and selected posture into ecosystem-shaped tool primitives.
 * This adapter resolves policy and validates parameters only; it never executes tools.
 * Implements SA-DECL-100, SA-DECL-108–109, and SA-POL-100–108.
 */
export function createEcosystemAdapter(
  registry: CapabilityRegistry,
  posture: PosturePreset,
): EcosystemAdapter {
  const canUseTool: CanUseTool = ({ toolName, params, context }) => {
    const action = registry.getAction(toolName);
    if (!action) return { status: "deny", toolName, reason: "unknown_tool" };

    let parsedParams: unknown;
    try {
      parsedParams = registry.validateActionParams(action, params);
    } catch {
      return { status: "deny", toolName, reason: "invalid_params" };
    }

    const policy = resolveActionPolicy(action, {
      ...context,
      posture,
      currentSurface: context.surfaceId,
      availability: registry,
    });
    if (policy.finalMode === "Refuse / hand off") {
      return { status: "deny", toolName, reason: "policy_refused", rationale: policy.rationale };
    }
    if (requiresApproval(policy.finalMode)) {
      return {
        status: "needs-approval",
        toolName,
        params: parsedParams,
        rationale: policy.rationale,
      };
    }
    return { status: "allow", toolName, params: parsedParams, rationale: policy.rationale };
  };

  const toolSchemas: Record<string, EcosystemToolSchema> = {};
  const toolApproval: Record<string, ToolApprovalPredicate> = {};
  for (const action of registry.getAllActions()) {
    toolApproval[action.id] = (params, context) =>
      canUseTool({ toolName: action.id, params, context }).status === "needs-approval";
    if (action.params.jsonSchema !== undefined) {
      toolSchemas[action.id] = {
        description: action.description,
        inputSchema: action.params.jsonSchema,
      };
    }
  }

  return { toolSchemas, toolApproval, canUseTool };
}

function requiresApproval(mode: PolicyDecision["finalMode"]): boolean {
  return mode === "Gated suffix" || mode === "Plan preview" || mode === "Step-gated";
}
