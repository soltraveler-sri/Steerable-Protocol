import { describe, expect, it, vi } from "vitest";
import {
  CapabilityRegistry,
  ExecutionEngine,
  InMemoryLedger,
  type ApprovalHook,
  type CanUseToolDecision,
  type EcosystemToolContext,
  canonicalToolNameProfile,
  compileSchema,
  createEcosystemAdapter,
  defineAction,
  defineSurface,
  type ActionDeclaration,
} from "./index.js";

// Issue #83 N6: the SDK shipped a model-facing policy-preview seam
// (`createEcosystemAdapter.canUseTool`) and a ledgered execution seam (`ExecutionEngine`) and
// never once composed them. The only documented path for wiring a model resolved policy and
// returned a decision that reached no ledger, violating SA-LED-002 / SA-POL-109 and the seam
// boundary now stated in SA-EXEC-015 / SA-EXEC-016. This file is the proof the two parts compose
// with their existing APIs: a mock tool call runs through `canUseTool`, and on `allow` through
// `engine.executeAction`, and the ledger then holds the invocation record it must. There are no
// real model or provider calls — the "provider loop" is a plain function.

const paramsSchema = compileSchema<{ hex: string }>({
  type: "object",
  properties: { hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" } },
  required: ["hex"],
  additionalProperties: false,
});

let accent = "#3366FF";

function paletteAction(
  overrides: Partial<ActionDeclaration<{ hex: string }, { previousHex: string }>> = {},
) {
  return defineAction<{ hex: string }, { previousHex: string }>({
    id: "palette.set_color",
    title: "Set accent",
    description: "Set the accent color.",
    params: paramsSchema,
    reads: ["design.palette"],
    writes: ["design.palette"],
    risk: "safe",
    reversibility: { kind: "undoable" },
    effects: { external: false, cost: "none", sensitive: false },
    confirmation: "never",
    preconditions: [],
    externalExposure: "none",
    execute: ({ hex }) => {
      const previousHex = accent;
      accent = hex;
      return { previousHex };
    },
    undo: ({ result }) => {
      if (result) accent = result.previousHex;
    },
    guidance: "Use when the user names an exact accent color.",
    examples: [{ user: "make the accent green", params: { hex: "#228B22" } }],
    ...overrides,
  });
}

function buildRegistry(action = paletteAction()) {
  const registry = new CapabilityRegistry({
    actions: [action],
    surfaces: [
      defineSurface({
        id: "editor",
        title: "Editor",
        description: "Design editor.",
        capabilities: [action.id],
      }),
    ],
  });
  registry.registerSurface("editor");
  return registry;
}

describe("adapter -> engine -> ledger composition (SA-EXEC-015, SA-EXEC-016)", () => {
  it("routes a model-authorized allow decision through the engine so the ledger records it", async () => {
    accent = "#3366FF";
    const registry = buildRegistry();
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({ registry, ledger });
    const adapter = createEcosystemAdapter(registry, "creative-tool", {
      toolNames: canonicalToolNameProfile,
    });

    // The last hop the adopter owns: a mock provider proposes a tool call, the preview seam
    // resolves policy, and — on `allow` — the SAME proposal is dispatched into the execution seam.
    const intent = "make the accent forest green";
    const context: EcosystemToolContext = { surfaceId: "editor" };
    const decision = adapter.canUseTool({
      toolName: "palette.set_color",
      params: { hex: "#228B22" },
      context,
    });
    expect(decision).toMatchObject({ status: "allow", toolName: "palette.set_color" });

    // Before dispatch the ledger is empty — the preview decision recorded nothing on its own.
    expect(ledger.getRecords()).toHaveLength(0);

    // This is the composition. If this hop is omitted (the old `handOffToYourTrustedExecutor`
    // hand-wave), every assertion below fails: no record is ever written.
    if (decision.status !== "allow") throw new Error("expected an allow decision");
    const result = await engine.executeAction({
      intent,
      surfaceId: context.surfaceId,
      posture: "creative-tool",
      actionId: decision.toolName, // canonical dotted declaration ID (SA-LED-009)
      params: decision.params,
    });

    // The executor actually ran through trusted app code.
    expect(accent).toBe("#228B22");
    expect(result.status).toBe("succeeded");

    // The ledger now holds exactly one SteeringInvocationRecord for this proposal, and it carries
    // BOTH the policy decision and the execution result — the thing SA-EXEC-016 forbids the
    // adapter-level decision from being the terminal substitute for.
    const records = ledger.getRecords();
    expect(records).toHaveLength(1);
    const record = records[0];
    expect(record.recordId).toBe(result.recordId);
    expect(record).toBe(result.record);
    expect(record.intent.text).toBe(intent);

    // Policy decision recorded (SA-LED-050-052): the same `Instant execution` mode the preview
    // seam read as `allow`, now durably on the record and tied to this action.
    expect(record.policyDecisions.length).toBeGreaterThanOrEqual(1);
    expect(record.policyDecisions.map((decision) => decision.finalMode)).toContain(
      "Instant execution",
    );
    expect(
      record.policyDecisions.some((decision) => decision.actionIds.includes("palette.set_color")),
    ).toBe(true);

    // Execution attempt + result recorded (SA-EXEC-009, SA-LED-028-034).
    expect(record.steps).toHaveLength(1);
    expect(record.steps[0].actionId).toBe("palette.set_color");
    expect(record.steps[0].status).toBe("succeeded");
    expect(record.steps[0].executionResult).toMatchObject({ ok: true });
    // Undoable action left an executable undo handle (SA-EXEC-010, SA-LED-070).
    expect(record.steps[0].undo).toMatchObject({ status: "available" });
  });

  it("makes the engine's ApprovalHook the single consent point for a needs-approval proposal", async () => {
    accent = "#3366FF";
    // A gate-bearing action: business posture + external quota effect resolves to a gate, so the
    // preview seam returns `needs-approval`. The engine — not the adapter — raises the one gate.
    const gated = paletteAction({
      id: "project.export_project",
      title: "Export project",
      description: "Export the project.",
      risk: "mutating",
      reversibility: { kind: "snapshot" },
      effects: { external: true, cost: "quota", sensitive: false },
      undo: undefined,
    });
    const registry = buildRegistry(gated);
    const ledger = new InMemoryLedger();

    // The single consent point. If the host's ecosystem loop demanded a synchronous pre-answer,
    // this same hook is where it would present or consume that one approval — never a second prompt.
    const approvalHook: ApprovalHook = vi.fn(async () => ({ status: "approved" as const }));
    const engine = new ExecutionEngine({ registry, ledger, approvalHook });
    const adapter = createEcosystemAdapter(registry, "business-app", {
      toolNames: canonicalToolNameProfile,
    });

    const context: EcosystemToolContext = { surfaceId: "editor" };
    const decision = adapter.canUseTool({
      toolName: "project.export_project",
      params: { hex: "#228B22" },
      context,
    });
    // The preview seam advises approval — it did NOT gate, prompt, or execute.
    expect(decision).toMatchObject({ status: "needs-approval" });
    expect(approvalHook).not.toHaveBeenCalled();
    expect(ledger.getRecords()).toHaveLength(0);

    // The adopter dispatches the very same proposal into the engine — no second gate here.
    if (decision.status !== "needs-approval") throw new Error("expected needs-approval");
    const result = await engine.executeAction({
      intent: "export the project",
      surfaceId: context.surfaceId,
      posture: "business-app",
      actionId: decision.toolName,
      params: decision.params,
    });

    // Exactly one consent prompt was raised, and it came from the engine's ApprovalHook.
    expect(approvalHook).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
    const record = ledger.getRecords()[0];
    expect(record.approval.status).toBe("approved");
    expect(record.steps[0].status).toBe("succeeded");
  });

  it("gives a denied proposal a ledgered refusal when routed through the engine", async () => {
    accent = "#3366FF";
    const registry = buildRegistry();
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({ registry, ledger });
    const adapter = createEcosystemAdapter(registry, "creative-tool", {
      toolNames: canonicalToolNameProfile,
    });
    const context: EcosystemToolContext = { surfaceId: "editor" };

    // The model hallucinated a tool that does not exist. The preview seam denies it. Routing the
    // proposal through the engine records a legible `refused` outcome (the fringe benefit noted in
    // the guide) rather than letting the denial vanish, honoring SA-LED-002.
    const decision: CanUseToolDecision = adapter.canUseTool({
      toolName: "palette.made_up_tool",
      params: { hex: "#228B22" },
      context,
    });
    expect(decision).toMatchObject({ status: "deny", reason: "unknown_tool" });

    const result = await engine.executeAction({
      intent: "do a thing that isn't a real action",
      surfaceId: context.surfaceId,
      posture: "creative-tool",
      actionId: decision.toolName,
      params: "params" in decision ? decision.params : {},
    });

    expect(result.status).toBe("refused");
    const record = ledger.getRecords()[0];
    // The invocation settles `refused`; the offending step is recorded `failed` with the
    // `unknown_action` code — the split the engine already draws for hallucinated action IDs.
    expect(record.steps[0].status).toBe("failed");
    expect(record.steps[0].executionResult).toMatchObject({
      ok: false,
      errorCode: "unknown_action",
    });
  });
});
