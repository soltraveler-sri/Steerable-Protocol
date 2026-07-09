import { type PolicyDecision, type PolicyInputs, type PosturePreset, resolveActionPolicy } from "./policy.js";
import type { CapabilityRegistry, SurfaceId } from "./registry.js";

/** The portable subset of an AI-SDK-style tool definition generated from an action declaration. */
export interface EcosystemToolSchema {
  description: string;
  inputSchema: unknown;
}

export interface EcosystemToolContext extends Omit<PolicyInputs, "posture" | "currentSurface" | "availability"> {
  surfaceId: SurfaceId;
}

export interface EcosystemToolInvocation {
  toolName: string;
  params: unknown;
  context: EcosystemToolContext;
}

export type CanUseToolDecision =
  | { status: "allow"; toolName: string; params: unknown; rationale: PolicyDecision["rationale"] }
  | { status: "needs-approval"; toolName: string; params: unknown; rationale: PolicyDecision["rationale"] }
  | { status: "deny"; toolName: string; reason: "unknown_tool" | "invalid_params" | "policy_refused"; rationale?: PolicyDecision["rationale"] };

/** A framework-neutral equivalent of an ecosystem canUseTool callback. */
export type CanUseTool = (invocation: EcosystemToolInvocation) => CanUseToolDecision;

/** A framework-neutral equivalent of an ecosystem per-tool approval predicate. */
export type ToolApprovalPredicate = (params: unknown, context: EcosystemToolContext) => boolean;

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
 */
export function createEcosystemAdapter(registry: CapabilityRegistry, posture: PosturePreset): EcosystemAdapter {
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
      return { status: "needs-approval", toolName, params: parsedParams, rationale: policy.rationale };
    }
    return { status: "allow", toolName, params: parsedParams, rationale: policy.rationale };
  };

  const toolSchemas: Record<string, EcosystemToolSchema> = {};
  const toolApproval: Record<string, ToolApprovalPredicate> = {};
  for (const action of registry.getAllActions()) {
    toolApproval[action.id] = (params, context) => canUseTool({ toolName: action.id, params, context }).status === "needs-approval";
    if (action.params.jsonSchema !== undefined) {
      toolSchemas[action.id] = { description: action.description, inputSchema: action.params.jsonSchema };
    }
  }

  return { toolSchemas, toolApproval, canUseTool };
}

function requiresApproval(mode: PolicyDecision["finalMode"]): boolean {
  return mode === "Gated suffix" || mode === "Plan preview" || mode === "Step-gated";
}
