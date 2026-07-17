# Ecosystem Adapters

**Status:** Informative guide. The adapter compiles `SA-DECL-100` action schemas and `SA-DECL-101` policy inputs from the same core registry; it is not a second tool layer.

`@steerable/core` deliberately has no `ai` dependency. Its portable `{ description, inputSchema }`, `toolApproval`, and `canUseTool` shapes slot into an AI-SDK-style loop without making a provider part of the core contract.

```ts
import { anthropicToolNameProfile, createEcosystemAdapter } from "@steerable/core";

const adapter = createEcosystemAdapter(registry, "creative-tool", {
  toolNames: anthropicToolNameProfile,
});
const context = { surfaceId: "editor" };
const tools = Object.fromEntries(Object.entries(adapter.toolSchemas).map(([name, tool]) => [name, {
  ...tool,
  needsApproval: (params: unknown) => adapter.toolApproval[name](params, context),
}]));

// In the provider's tool-call dispatch, before invoking trusted app code:
const decision = adapter.canUseTool({ toolName, params, context });
if (decision.status === "deny") return denyToolCall(decision.reason);
if (decision.status === "needs-approval") return showApproval(decision.rationale);
// decision.toolName is the canonical dotted declaration ID — that is what the ledger records.
return handOffToYourTrustedExecutor(decision);
```

The predicate only identifies a policy-derived review gate; `canUseTool` remains the enforcement callback and carries the rationale. A clean safe reversible action resolves to `allow` without approval friction. `Gated suffix`, `Plan preview`, and `Step-gated` resolve to `needs-approval`; `Refuse / hand off`, undeclared tools, and invalid parameters resolve to `deny`.

Every declared action appears in `toolSchemas`. `params.jsonSchema` is required by the registry (`SA-DECL-100`), so there is no longer a class of action that compiles and is then silently absent here. The parser remains authoritative at dispatch time, so provider schemas do not replace strict validation. Read tools and the AG-UI transport seam are intentionally outside this Stage-2 adapter; MCP generation remains Stage 3.

## Tool names

`SA-DECL-012` mandates dot-separated declaration IDs such as `tracker.create_application`. Providers disagree about whether that is a legal tool name, so the mapping is a parameter, not a constant — you name your target provider's grammar and the adapter reconciles the two at construction.

| Profile | Grammar | Limit | Mapping |
|---|---|---|---|
| `anthropicToolNameProfile` | `^[a-zA-Z0-9_-]{1,128}$` | 128 | `.` → `__` |
| `openaiToolNameProfile` | `^[a-zA-Z0-9_-]{1,64}$` | 64 | `.` → `__` |
| `geminiToolNameProfile` | dots and colons admitted | 128 | identity |
| `canonicalToolNameProfile` | the `SA-DECL-012` ID grammar | 128 | identity |

Passing an Anthropic-shaped rewrite to Gemini would mangle names that were already legal, and because `.` → `__` lengthens a name, one safe under Anthropic's 128 can overflow OpenAI's 64. Both are construction-time errors rather than a provider 400 on your first live call.

The mapping is checked for **injectivity against your actual registry**, not merely assumed reversible: `.` → `__` cannot distinguish a real dot from an authored `__`, so `a.b__c_d` and `a__b.c_d` both produce `a__b__c_d`. Only the compiled set of IDs reveals that, and it fails at construction per `SA-DECL-096`.

Wire names never escape the adapter. `canUseTool` accepts the provider's name and returns the canonical declaration ID, and `adapter.toCapabilityId(wireName)` recovers it explicitly — `SA-LED-009` requires the ledger to record stable declaration IDs and forbids inventing alternates. This mirrors `SA-BRIDGE-014`, which already requires door-two transformations to be deterministic, reversible, and traceable to the original declaration ID.

## The Steerable JSON Schema Profile

`compileSchema` accepts a documented subset of JSON Schema, not all of it: the intersection of what mainstream providers actually honor in a tool definition. Anything outside the profile is rejected at compile time with a message naming the keyword, because the alternative is a provider silently dropping the constraint at request time — leaving the declaration and the model's grammar disagreeing, contrary to `SA-DECL-095`.

**Included:** `object`, `string`, `number`, `integer`, `boolean`, `null`, `array`; `properties`, `required`, `additionalProperties: false`, `items`, `enum`, `const`, `description`, `pattern`, `format`, and `anyOf` below the root. The root must be `type: "object"`, and every object node must close itself with `additionalProperties: false`.

**Excluded:** `minimum`/`maximum`/`multipleOf` and `minLength`/`maxLength`/`minItems`/`maxItems` (stripped rather than enforced by some providers — express what you can with `pattern`); `$ref`/`$defs` and recursion (rejected outright by several providers); `oneOf`, `allOf`, `not`, and `if`/`then`/`else` (not portable).

`pattern` is deliberately **in** the profile: it is among the better-supported keywords across Anthropic, OpenAI, Gemini, Cohere, and constrained-decoding libraries, so a constraint like `^#[0-9A-Fa-f]{6}$` is portable and worth declaring. `format` is validated at runtime for `date-time`, `date`, `time`, `email`, `uuid`, and `uri`; any other `format` is admitted but, per JSON Schema's default, treated as an annotation only — so do not rely on it to enforce anything.

`createStrictObjectSchema(keys, parseValues, jsonSchema)` remains available when a parameter contract needs a hand-written parser. Its schema is profile-checked and cross-checked against `keys`, but the parser body is yours: it is an escape hatch, and its `parse` can enforce more than the profile can express.
