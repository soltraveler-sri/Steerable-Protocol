import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  createEcosystemAdapter,
  createStrictObjectSchema,
  defineAction,
  defineSurface,
  type ActionDeclaration,
} from "./index.js";

const paramsSchema = {
  ...createStrictObjectSchema<{ value: string }>(["value"], (input) => {
    if (typeof input.value !== "string") throw new Error("value must be a string");
    return { value: input.value };
  }),
  jsonSchema: {
    type: "object",
    properties: { value: { type: "string" } },
    required: ["value"],
    additionalProperties: false,
  },
};

function action(id: string, overrides: Partial<ActionDeclaration<{ value: string }>> = {}) {
  return defineAction({
    id,
    title: id,
    description: `Runs ${id}.`,
    params: paramsSchema,
    reads: ["design.value"],
    writes: ["design.value"],
    risk: "safe",
    reversibility: { kind: "undoable" },
    effects: { external: false, cost: "none", sensitive: false },
    confirmation: "never",
    preconditions: [],
    execute: ({ value }) => value,
    undo: () => undefined,
    guidance: "Use for test work.",
    examples: [{ user: "set a value", params: { value: "x" } }],
    ...overrides,
  });
}

describe("ecosystem compile-down adapter", () => {
  it("derives AI-SDK-style schemas and mock-loop approval outcomes from one registry", () => {
    const safe = action("palette.set_color");
    const quota = action("project.export_quota", {
      risk: "mutating",
      reversibility: { kind: "snapshot" },
      effects: { external: true, cost: "quota", sensitive: false },
      undo: undefined,
    });
    const refused = action("project.delete_project", {
      risk: "destructive",
      reversibility: { kind: "snapshot" },
      confirmation: "always",
      undo: undefined,
    });
    const registry = new CapabilityRegistry({
      actions: [safe, quota, refused],
      surfaces: [defineSurface({ id: "editor", title: "Editor", description: "Test editor.", capabilities: [safe.id, quota.id, refused.id] })],
    });
    registry.registerSurface("editor");
    const adapter = createEcosystemAdapter(registry, "creative-tool");

    expect(adapter.toolSchemas).toEqual({
      "palette.set_color": { description: "Runs palette.set_color.", inputSchema: paramsSchema.jsonSchema },
      "project.export_quota": { description: "Runs project.export_quota.", inputSchema: paramsSchema.jsonSchema },
      "project.delete_project": { description: "Runs project.delete_project.", inputSchema: paramsSchema.jsonSchema },
    });

    const mockProviderLoop = (toolName: string, params: unknown) => adapter.canUseTool({
      toolName,
      params,
      context: {
        surfaceId: "editor",
        overrides: toolName === refused.id
          ? [{ id: "refuse-reset", actionId: refused.id, minimumMode: "Refuse / hand off", reasonCode: "demo_refusal" }]
          : undefined,
      },
    });

    expect(mockProviderLoop(safe.id, { value: "blue" })).toMatchObject({ status: "allow", params: { value: "blue" } });
    expect(mockProviderLoop(quota.id, { value: "pdf" })).toMatchObject({ status: "needs-approval", params: { value: "pdf" } });
    expect(mockProviderLoop(refused.id, { value: "everything" })).toMatchObject({ status: "deny", reason: "policy_refused", rationale: { reasonCodes: expect.arrayContaining(["demo_refusal"]) } });
    expect(adapter.toolApproval[safe.id]({ value: "blue" }, { surfaceId: "editor" })).toBe(false);
    expect(adapter.toolApproval[quota.id]({ value: "pdf" }, { surfaceId: "editor" })).toBe(true);
  });

  it("denies unknown tools and invalid parameters before policy resolution", () => {
    const safe = action("palette.set_color");
    const registry = new CapabilityRegistry({ actions: [safe], surfaces: [defineSurface({ id: "editor", title: "Editor", description: "Test editor.", capabilities: [safe.id] })] });
    registry.registerSurface("editor");
    const adapter = createEcosystemAdapter(registry, "creative-tool");

    expect(adapter.canUseTool({ toolName: "missing.tool", params: {}, context: { surfaceId: "editor" } })).toEqual({ status: "deny", toolName: "missing.tool", reason: "unknown_tool" });
    expect(adapter.canUseTool({ toolName: safe.id, params: { unexpected: true }, context: { surfaceId: "editor" } })).toEqual({ status: "deny", toolName: safe.id, reason: "invalid_params" });
  });
});
