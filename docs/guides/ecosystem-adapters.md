# Ecosystem Adapters

**Status:** Informative guide. The adapter compiles `SA-DECL-100` action schemas and `SA-DECL-101` policy inputs from the same core registry; it is not a second tool layer.

`@steerable/core` deliberately has no `ai` dependency. Its portable `{ description, inputSchema }`, `toolApproval`, and `canUseTool` shapes slot into an AI-SDK-style loop without making a provider part of the core contract.

```ts
import { createEcosystemAdapter } from "@steerable/core";

const adapter = createEcosystemAdapter(registry, "creative-tool");
const context = { surfaceId: "editor" };
const tools = Object.fromEntries(Object.entries(adapter.toolSchemas).map(([name, tool]) => [name, {
  ...tool,
  needsApproval: (params: unknown) => adapter.toolApproval[name](params, context),
}]));

// In the provider's tool-call dispatch, before invoking trusted app code:
const decision = adapter.canUseTool({ toolName, params, context });
if (decision.status === "deny") return denyToolCall(decision.reason);
if (decision.status === "needs-approval") return showApproval(decision.rationale);
return handOffToYourTrustedExecutor(decision);
```

The predicate only identifies a policy-derived review gate; `canUseTool` remains the enforcement callback and carries the rationale. A clean safe reversible action resolves to `allow` without approval friction. `Gated suffix`, `Plan preview`, and `Step-gated` resolve to `needs-approval`; `Refuse / hand off`, undeclared tools, and invalid parameters resolve to `deny`.

Actions need `params.jsonSchema` to appear in `toolSchemas`, because a provider tool definition needs a serializable schema. The parser remains authoritative at dispatch time, so generated provider schemas do not replace strict validation. Read tools and the AG-UI transport seam are intentionally outside this Stage-2 adapter; MCP generation remains Stage 3.
