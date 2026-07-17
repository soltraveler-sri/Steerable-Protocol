import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  RegistryCompileError,
  anthropicToolNameProfile,
  canonicalToolNameProfile,
  compileSchema,
  createEcosystemAdapter,
  defineAction,
  defineSurface,
  geminiToolNameProfile,
  openaiToolNameProfile,
  type ActionDeclaration,
  type StrictSchema,
} from "./index.js";

// Previously this spread `createStrictObjectSchema(...)` and then hand-added `jsonSchema` — the
// workaround the core README's own canonical example omitted, which is precisely why the suite
// stayed green while that example produced a model-invisible action. `compileSchema` derives the
// parser from the schema, so the workaround has nothing left to work around.
const paramsSchema = compileSchema<{ value: string }>({
  type: "object",
  properties: { value: { type: "string" } },
  required: ["value"],
  additionalProperties: false,
});

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
      surfaces: [
        defineSurface({
          id: "editor",
          title: "Editor",
          description: "Test editor.",
          capabilities: [safe.id, quota.id, refused.id],
        }),
      ],
    });
    registry.registerSurface("editor");
    const adapter = createEcosystemAdapter(registry, "creative-tool", {
      toolNames: canonicalToolNameProfile,
    });

    expect(adapter.toolSchemas).toEqual({
      "palette.set_color": {
        description: "Runs palette.set_color.",
        inputSchema: paramsSchema.jsonSchema,
      },
      "project.export_quota": {
        description: "Runs project.export_quota.",
        inputSchema: paramsSchema.jsonSchema,
      },
      "project.delete_project": {
        description: "Runs project.delete_project.",
        inputSchema: paramsSchema.jsonSchema,
      },
    });

    const mockProviderLoop = (toolName: string, params: unknown) =>
      adapter.canUseTool({
        toolName,
        params,
        context: {
          surfaceId: "editor",
          overrides:
            toolName === refused.id
              ? [
                  {
                    id: "refuse-reset",
                    actionId: refused.id,
                    minimumMode: "Refuse / hand off",
                    reasonCode: "demo_refusal",
                  },
                ]
              : undefined,
        },
      });

    expect(mockProviderLoop(safe.id, { value: "blue" })).toMatchObject({
      status: "allow",
      params: { value: "blue" },
    });
    expect(mockProviderLoop(quota.id, { value: "pdf" })).toMatchObject({
      status: "needs-approval",
      params: { value: "pdf" },
    });
    expect(mockProviderLoop(refused.id, { value: "everything" })).toMatchObject({
      status: "deny",
      reason: "policy_refused",
      rationale: { reasonCodes: expect.arrayContaining(["demo_refusal"]) },
    });
    expect(adapter.toolApproval[safe.id]({ value: "blue" }, { surfaceId: "editor" })).toBe(false);
    expect(adapter.toolApproval[quota.id]({ value: "pdf" }, { surfaceId: "editor" })).toBe(true);
  });

  it("exposes the core README's canonical action to the model", () => {
    // Copied verbatim from packages/core/README.md "Define an action". This action reaching
    // `toolSchemas` is the whole point: the previous canonical example compiled cleanly and was
    // then silently absent here, unreachable by any model (SA-DECL-100).
    let accent = "#3366FF";
    const setAccent = defineAction<{ hex: string }, { previousHex: string }>({
      id: "palette.set_color",
      title: "Set accent",
      description: "Set the accent color.",
      params: compileSchema({
        type: "object",
        properties: { hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" } },
        required: ["hex"],
        additionalProperties: false,
      }),
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
    });

    const registry = new CapabilityRegistry({
      actions: [setAccent],
      surfaces: [
        defineSurface({
          id: "editor",
          title: "Editor",
          description: "Design editor.",
          capabilities: [setAccent.id],
        }),
      ],
    });
    registry.registerSurface("editor");
    const adapter = createEcosystemAdapter(registry, "creative-tool", {
      toolNames: canonicalToolNameProfile,
    });

    expect(Object.keys(adapter.toolSchemas)).toContain("palette.set_color");
    expect(adapter.toolSchemas["palette.set_color"].inputSchema).toEqual(
      setAccent.params.jsonSchema,
    );
    // The parser the README example gets is derived from that same schema, not hand-written
    // alongside it (SA-DECL-093, SA-DECL-095).
    expect(() => setAccent.params.parse({ hex: "not-a-hex" })).toThrow();
    expect(setAccent.params.parse({ hex: "#228B22" })).toEqual({ hex: "#228B22" });
  });

  it("rejects a parameter schema no model could ever be shown", () => {
    // The shape the old canonical example produced: a `parse` closure and nothing serializable.
    // A schema cannot be recovered from an arbitrary closure, so this must fail at compile time
    // rather than compile into a silently uncallable action (SA-DECL-096, SA-DECL-100).
    const invisible = action("palette.set_color", {
      params: { parse: (input: unknown) => input as { value: string } } as unknown as StrictSchema<{
        value: string;
      }>,
    });

    expect(() => new CapabilityRegistry({ actions: [invisible] })).toThrow(RegistryCompileError);
    expect(() => new CapabilityRegistry({ actions: [invisible] })).toThrow(
      /must declare `params.jsonSchema`/,
    );
  });

  it("maps dotted declaration IDs onto provider-legal wire names", () => {
    const safe = action("tracker.create_application");
    const registry = new CapabilityRegistry({
      actions: [safe],
      surfaces: [
        defineSurface({
          id: "editor",
          title: "Editor",
          description: "Test editor.",
          capabilities: [safe.id],
        }),
      ],
    });
    registry.registerSurface("editor");

    const anthropic = createEcosystemAdapter(registry, "creative-tool", {
      toolNames: anthropicToolNameProfile,
    });
    // Anthropic's documented grammar, per the live 400 in issue #83 §5 C2.
    for (const wireName of Object.keys(anthropic.toolSchemas)) {
      expect(wireName).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
    }
    expect(Object.keys(anthropic.toolSchemas)).toEqual(["tracker__create_application"]);

    // Reversible: the canonical dotted ID is recoverable from the wire name.
    expect(anthropic.toCapabilityId("tracker__create_application")).toBe(
      "tracker.create_application",
    );
    expect(anthropic.toWireName("tracker.create_application")).toBe("tracker__create_application");
    expect(anthropic.toCapabilityId("never.generated")).toBeUndefined();

    // Gemini admits dots, so the mapping is the identity — rewriting would mangle for no reason.
    const gemini = createEcosystemAdapter(registry, "creative-tool", {
      toolNames: geminiToolNameProfile,
    });
    expect(Object.keys(gemini.toolSchemas)).toEqual(["tracker.create_application"]);
  });

  it("recovers the canonical declaration ID before policy, execution, and the ledger", () => {
    const safe = action("tracker.create_application");
    const registry = new CapabilityRegistry({
      actions: [safe],
      surfaces: [
        defineSurface({
          id: "editor",
          title: "Editor",
          description: "Test editor.",
          capabilities: [safe.id],
        }),
      ],
    });
    registry.registerSurface("editor");
    const adapter = createEcosystemAdapter(registry, "creative-tool", {
      toolNames: anthropicToolNameProfile,
    });

    // The provider calls the wire name; the decision the host hands to its executor and ledger
    // carries the stable declaration ID, never the wire name (SA-LED-009).
    const decision = adapter.canUseTool({
      toolName: "tracker__create_application",
      params: { value: "x" },
      context: { surfaceId: "editor" },
    });
    expect(decision).toMatchObject({ status: "allow", toolName: "tracker.create_application" });

    // A wire name is not a declaration ID: the dotted ID is not in the provider's namespace.
    expect(
      adapter.canUseTool({
        toolName: "tracker.create_application",
        params: { value: "x" },
        context: { surfaceId: "editor" },
      }),
    ).toEqual({ status: "deny", toolName: "tracker.create_application", reason: "unknown_tool" });
  });

  it("detects a wire-name collision at construction against the actual registry", () => {
    // `.` -> `__` is reversible in the abstract but not injective. Note the witness: issue #83
    // offers `a.b_c` vs `a_b.c`, which do NOT collide (`a__b_c` vs `a_b__c`). A collision needs a
    // literal `__` already inside a segment, so that a real dot and an authored underscore pair
    // become indistinguishable. Both of these produce "a__b__c_d". No abstract argument finds
    // this; only the compiled set of IDs does, which is why the check belongs at construction.
    const first = action("a.b__c_d");
    const second = action("a__b.c_d");
    const registry = new CapabilityRegistry({ actions: [first, second] });

    expect(() =>
      createEcosystemAdapter(registry, "creative-tool", { toolNames: anthropicToolNameProfile }),
    ).toThrow(RegistryCompileError);
    expect(() =>
      createEcosystemAdapter(registry, "creative-tool", { toolNames: anthropicToolNameProfile }),
    ).toThrow(/both map to tool name "a__b__c_d"/);

    // The pair issue #83 names is in fact injective under this mapping — a reminder that the
    // property must be tested, not reasoned about from an example.
    const uncolliding = new CapabilityRegistry({ actions: [action("a.b_c"), action("a_b.c_d")] });
    const fine = createEcosystemAdapter(uncolliding, "creative-tool", {
      toolNames: anthropicToolNameProfile,
    });
    expect(Object.keys(fine.toolSchemas).sort()).toEqual(["a__b_c", "a_b__c_d"]);

    // The same registry is fine on a provider that needs no rewrite.
    expect(() =>
      createEcosystemAdapter(registry, "creative-tool", { toolNames: geminiToolNameProfile }),
    ).not.toThrow();
  });

  it("maps every declared action injectively and reversibly", () => {
    const ids = [
      "palette.set_color",
      "palette.set_colour",
      "project.export_quota",
      "tracker.create_application",
      "a.b_c",
      "a_b.c_d",
    ];
    const registry = new CapabilityRegistry({ actions: ids.map((id) => action(id)) });

    for (const toolNames of [anthropicToolNameProfile, geminiToolNameProfile]) {
      const adapter = createEcosystemAdapter(registry, "creative-tool", { toolNames });
      const wireNames = Object.keys(adapter.toolSchemas);

      // Total: every declared action is exposed. Injective: no two share a wire name.
      expect(wireNames).toHaveLength(ids.length);
      expect(new Set(wireNames).size).toBe(ids.length);
      // Reversible: round-tripping every ID recovers exactly the canonical ID.
      for (const id of ids) {
        expect(adapter.toCapabilityId(adapter.toWireName(id) as string)).toBe(id);
      }
    }
  });

  it("rejects a wire name that overflows the provider's length limit", () => {
    // `.` -> `__` lengthens names, so a name safe on one provider can overflow another.
    const long = action(`tracker.${"create_application_".repeat(3)}x`);
    const registry = new CapabilityRegistry({ actions: [long] });

    expect(() =>
      createEcosystemAdapter(registry, "creative-tool", { toolNames: openaiToolNameProfile }),
    ).toThrow(/exceeding provider "openai"'s limit of 64/);
    expect(() =>
      createEcosystemAdapter(registry, "creative-tool", { toolNames: anthropicToolNameProfile }),
    ).not.toThrow();
  });

  it("denies unknown tools and invalid parameters before policy resolution", () => {
    const safe = action("palette.set_color");
    const registry = new CapabilityRegistry({
      actions: [safe],
      surfaces: [
        defineSurface({
          id: "editor",
          title: "Editor",
          description: "Test editor.",
          capabilities: [safe.id],
        }),
      ],
    });
    registry.registerSurface("editor");
    const adapter = createEcosystemAdapter(registry, "creative-tool", {
      toolNames: canonicalToolNameProfile,
    });

    expect(
      adapter.canUseTool({
        toolName: "missing.tool",
        params: {},
        context: { surfaceId: "editor" },
      }),
    ).toEqual({ status: "deny", toolName: "missing.tool", reason: "unknown_tool" });
    expect(
      adapter.canUseTool({
        toolName: safe.id,
        params: { unexpected: true },
        context: { surfaceId: "editor" },
      }),
    ).toEqual({ status: "deny", toolName: safe.id, reason: "invalid_params" });
  });
});
