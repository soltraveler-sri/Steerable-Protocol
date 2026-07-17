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

// In the provider's tool-call dispatch, for each proposed tool call:
const decision = adapter.canUseTool({ toolName, params, context });
if (decision.status === "deny") return denyToolCall(decision.reason);
// decision.toolName is the canonical dotted declaration ID; decision.params is already parsed.
return dispatchToEngine(decision);
```

The predicate only identifies a policy-derived review gate; `canUseTool` remains the enforcement callback and carries the rationale. A clean safe reversible action resolves to `allow` without approval friction. `Gated suffix`, `Plan preview`, and `Step-gated` resolve to `needs-approval`; `Refuse / hand off`, undeclared tools, and invalid parameters resolve to `deny`.

## From a decision to a ledgered execution

`canUseTool` is the **policy-preview seam** (`SA-EXEC-015`): a synchronous, ledger-free policy resolution that returns advice — `allow`, `needs-approval`, or `deny`. It is not execution, and its decision is not a record of anything: the adapter's own doc comment says it "never executes tools." The seam that validates, gates, records, and undoes is the **execution seam** — `ExecutionEngine`, which owns the ledger. `SA-EXEC-016` forbids letting the preview decision be the terminal record of a proposal's use, so the dispatch does not hand off to an opaque "trusted executor"; it routes the decision into the engine over the same registry:

```ts
import { ExecutionEngine } from "@steerable/core";

// Construct once, next to the adapter, over the SAME registry. The engine owns the
// ledger, the gates, and undo. Its ApprovalHook is the single consent point (below).
const engine = new ExecutionEngine({ registry, ledger, approvalHook });

async function dispatchToEngine(decision: CanUseToolDecision) {
  // `allow` and `needs-approval` both carry the canonical action ID and parsed params,
  // and both dispatch through the execution seam. You do NOT gate here for
  // `needs-approval`: the engine re-resolves policy and raises the gate itself.
  const result = await engine.executeAction({
    intent, // the user utterance this proposal came from — kept in the trail (SA-LED-002)
    surfaceId: context.surfaceId,
    posture: "creative-tool",
    actionId: decision.toolName, // canonical dotted declaration ID (SA-LED-009)
    params: decision.params,
    availability: context.availability, // per-request view on a shared-process host
  });
  // result.record is the SteeringInvocationRecord: the policy decision and the execution
  // attempt/result, written to the ledger. That record existing is what SA-EXEC-015/016
  // and SA-LED-002 require — the hop the adapter alone never completed.
  return result;
}
```

The adapter and the engine were always composable with their existing APIs; the defect closed by issue #83 (N6) was that no shown path connected them, so the only documented way to wire a model recorded nothing. `packages/core` now carries a tested composition (`composition.test.ts`) that runs a mock tool call through `canUseTool` and, on `allow`, through `engine.executeAction`, then asserts the ledger holds the invocation record.

## Double gating: one consent point

Two callbacks can each say "this needs approval": the adapter's `needs-approval` / `toolApproval` predicate, and the engine's `ApprovalHook`. They are **not** two prompts. The engine's `ApprovalHook` is the single consent point — the engine re-resolves policy on dispatch and raises its own gate for `Gated suffix`, `Plan preview`, and `Step-gated`. The adapter's synchronous predicate exists only for hosts whose ecosystem loop demands a pre-answer before the tool call resolves (AI-SDK-style `needsApproval`). Such a host wires its `ApprovalHook` to **present or consume that same ecosystem approval**, so one scope is never gated twice.

```text
                    proposed tool call
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  policy-preview seam  (no ledger)      │   adapter.canUseTool / toolApproval
        │  advisory: allow / needs-approval /    │   ← host consults this only if its
        │  deny                                   │     provider loop needs a pre-answer
        └──────────────────────────────────────┘
                           │  decision (allow / needs-approval)
                           ▼
        ┌──────────────────────────────────────┐
        │  execution seam  (ExecutionEngine)     │   validate → policy → GATE via the
        │  the single ApprovalHook consent point │   one ApprovalHook → execute → record
        │  → SteeringInvocationRecord in ledger  │   (SA-EXEC-001–009, SA-LED-002)
        └──────────────────────────────────────┘
```

**Why route denials through the engine too.** An adapter-level `deny` that early-returns records nothing — the refused proposal vanishes. The engine, by contrast, records `unknown_action`, `invalid_params`, and policy refusals as legible `refused` outcomes with their own invocation record. Routing a denied proposal through `engine.executeAction` (which re-resolves policy and settles it `refused`) therefore gives denials the same ledger legibility as allows, which is the honest reading of `SA-LED-002`. An adopter that must answer the provider synchronously may deny at the preview seam, but should still record the refusal on the execution path rather than letting the preview decision be the proposal's only trace (`SA-EXEC-016`).

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
