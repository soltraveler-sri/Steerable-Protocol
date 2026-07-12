import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  RegistryCompileError,
  createStrictObjectSchema,
  defineAction,
  defineFacts,
  defineReadTool,
  defineSurface,
  type ActionDeclaration,
  type AnyCompiledActionDeclaration,
} from "./registry.js";
import { posturePresetMappings, resolveActionPolicy } from "./policy.js";
import { InMemoryLedger } from "./ledger.js";

const stringParams = createStrictObjectSchema<{ value: string }>(["value"], (input) => {
  if (typeof input.value !== "string") throw new Error("value must be a string");
  return { value: input.value };
});

function action(overrides: Partial<ActionDeclaration<{ value: string }>> = {}) {
  return defineAction({
    id: "palette.set_color",
    title: "Set color",
    description: "Set one local palette color.",
    params: stringParams,
    reads: ["design.palette"],
    writes: ["design.palette"],
    risk: "safe",
    reversibility: { kind: "undoable" },
    effects: { external: false, cost: "none", sensitive: false },
    confirmation: "never",
    preconditions: ["surface:design-studio"],
    execute: ({ value }) => value,
    undo: () => undefined,
    guidance: "Use for one palette color.",
    examples: [{ user: "make the accent blue", params: { value: "#00F" } }],
    ...overrides,
  });
}

function compiledAction(
  overrides: Partial<ActionDeclaration<{ value: string }>> = {},
): AnyCompiledActionDeclaration {
  const declaration = action(overrides);
  return new CapabilityRegistry({ actions: [declaration] }).requireAction(declaration.id);
}

describe("SA-DECL registry compilation", () => {
  it("compiles all declaration kinds, materializes exposure, and answers live capability queries", () => {
    const readTool = defineReadTool({
      id: "palette.get_colors",
      title: "Get colors",
      description: "Read the current palette.",
      params: stringParams,
      reads: ["design.palette"],
      preconditions: ["surface:design-studio"],
      query: ({ value }) => value,
      guidance: "Use before proposing a palette change.",
      examples: [{ user: "what is the accent?", params: { value: "accent" } }],
      externalExposure: "eligible",
    });
    const facts = defineFacts({
      id: "palette.current_facts",
      title: "Current palette facts",
      description: "Bounded palette context.",
      surface: "design-studio",
      facts: [{ key: "design.palette", description: "Current colors.", schema: stringParams }],
      publish: () => ({ "design.palette": "#00F" }),
    });
    const registry = new CapabilityRegistry({
      actions: [action()],
      readTools: [readTool],
      facts: [facts],
      surfaces: [
        defineSurface({
          id: "design-studio",
          title: "Design Studio",
          description: "The editor surface.",
          capabilities: ["palette.set_color", "palette.get_colors", "palette.current_facts"],
        }),
      ],
    });

    expect(registry.requireAction("palette.set_color").externalExposure).toBe("none");
    expect(registry.getReadTool("palette.get_colors")?.externalExposure).toBe("eligible");
    expect(registry.getAllCapabilities()).toHaveLength(3);
    expect(registry.getLiveCapabilities("design-studio")).toEqual([]);

    registry.registerSurface("design-studio");
    expect(registry.isActionAvailableOnSurface("palette.set_color", "design-studio")).toBe(true);
    expect(
      registry.getLiveCapabilities("design-studio").map((capability) => capability.id),
    ).toEqual(["palette.set_color", "palette.get_colors", "palette.current_facts"]);
    expect(() =>
      registry.validateActionParams(registry.requireAction("palette.set_color"), {
        value: "#0AF",
        extra: true,
      }),
    ).toThrow('Unexpected parameter "extra".');
  });

  it.each([
    [
      "duplicate IDs",
      () =>
        new CapabilityRegistry({
          actions: [action()],
          readTools: [defineReadTool({ ...action(), query: () => undefined } as never)],
        }),
    ],
    [
      "invalid schema",
      () => new CapabilityRegistry({ actions: [{ ...action(), params: {} } as never] }),
    ],
    [
      "missing required executor",
      () => new CapabilityRegistry({ actions: [{ ...action(), execute: undefined } as never] }),
    ],
    [
      "invalid value set member",
      () => new CapabilityRegistry({ actions: [{ ...action(), risk: "risky" } as never] }),
    ],
    [
      "unsatisfied surface reference",
      () =>
        new CapabilityRegistry({
          actions: [action()],
          surfaces: [
            defineSurface({
              id: "design-studio",
              title: "Studio",
              description: "Editor.",
              capabilities: ["missing.do_thing"],
            }),
          ],
        }),
    ],
  ])("reports SA-DECL-096 errors for %s", (_label, compile) => {
    expect(compile).toThrow(RegistryCompileError);
  });
});

describe("SA-POL resolver", () => {
  it("keeps the clean creative action instant and contrasts the same action under every preset", () => {
    const clean = compiledAction();
    expect(
      resolveActionPolicy(clean, { posture: "creative-tool", currentSurface: "design-studio" })
        .finalMode,
    ).toBe("Instant execution");
    expect(
      resolveActionPolicy(clean, { posture: "business-app", currentSurface: "design-studio" })
        .finalMode,
    ).toBe("Optimistic chain");
    expect(
      resolveActionPolicy(clean, { posture: "sensitive-domain", currentSurface: "design-studio" })
        .finalMode,
    ).toBe("Optimistic chain");
  });

  it("implements every shipped posture grid", () => {
    for (const [posture, grid] of Object.entries(posturePresetMappings) as [
      keyof typeof posturePresetMappings,
      (typeof posturePresetMappings)["creative-tool"],
    ][]) {
      for (const [risk, reversibilities] of Object.entries(grid) as [
        keyof typeof grid,
        typeof grid.safe,
      ][]) {
        for (const [kind, expected] of Object.entries(reversibilities) as [
          keyof typeof reversibilities,
          string,
        ][]) {
          const candidate = compiledAction({ risk, reversibility: { kind } });
          expect(
            resolveActionPolicy(candidate, { posture, currentSurface: "design-studio" }).finalMode,
          ).toBe(expected);
        }
      }
    }
  });

  it("floors quota to a creative-tool gate and records the complete SA-POL-108 rationale", () => {
    const quota = compiledAction({
      id: "project.export_quota",
      risk: "mutating",
      reversibility: { kind: "snapshot" },
      effects: { external: true, cost: "quota", sensitive: false },
      confirmation: "policy",
      undo: undefined,
    });
    const decision = resolveActionPolicy(quota, {
      posture: "creative-tool",
      currentSurface: "design-studio",
    });
    expect(decision.finalMode).toBe("Gated suffix");
    expect(decision.rationale).toEqual(
      expect.objectContaining({
        actionIds: ["project.export_quota"],
        declarationMetadata: [
          expect.objectContaining({
            risk: "mutating",
            effects: { external: true, cost: "quota", sensitive: false },
          }),
        ],
        selectedPosturePreset: "creative-tool",
        applicableOverrides: [],
        effectFloors: expect.arrayContaining([
          expect.objectContaining({
            dimension: "cost",
            value: "quota",
            floorMode: "Gated suffix",
            applied: true,
          }),
        ]),
        confirmationFloor: expect.objectContaining({ value: "policy" }),
        grant: expect.objectContaining({ used: false }),
        runtimeSignalDemotions: [],
        finalMode: "Gated suffix",
        reasonCodes: expect.arrayContaining(["effect_floor:creative-tool:cost_quota"]),
      }),
    );
  });

  it("does not let sticky grants bypass confirmation floors or destructive actions", () => {
    const grant = {
      id: "session-grant",
      actionIds: ["palette.set_color"],
      sessionId: "session-1",
      issuer: "user",
      subject: "palette action",
      grantedMode: "Instant execution" as const,
    };
    const always = compiledAction({ confirmation: "always" });
    const decision = resolveActionPolicy(always, {
      posture: "business-app",
      currentSurface: "design-studio",
      grants: [grant],
      sessionId: "session-1",
      allowGrantsToRaiseAutonomy: true,
    });
    expect(decision.finalMode).toBe("Gated suffix");
    expect(decision.rationale.grant.reason).toBe("grant_cannot_suppress_confirmation_always");

    const destructive = compiledAction({ risk: "destructive", confirmation: "policy" });
    const destructiveDecision = resolveActionPolicy(destructive, {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grant],
      sessionId: "session-1",
      allowGrantsToRaiseAutonomy: true,
    });
    expect(destructiveDecision.rationale.grant.reason).toBe(
      "grant_not_allowed_for_destructive_action",
    );
  });
});

describe("SA-LED read model", () => {
  it("notifies subscribers when a record is created or updated", () => {
    const ledger = new InMemoryLedger();
    let notifications = 0;
    const unsubscribe = ledger.subscribe(() => {
      notifications += 1;
    });
    const record = ledger.createInvocation({
      intent: { text: "set color" },
      steps: [
        {
          stepId: "step_1",
          actionId: "palette.set_color",
          params: { value: "blue" },
          writes: ["design.palette"],
        },
      ],
    });
    ledger.updateStep(record.recordId, "step_1", { status: "running" });
    unsubscribe();
    ledger.updateStep(record.recordId, "step_1", { status: "succeeded" });
    expect(notifications).toBe(2);
    expect(ledger.getRecords()).toHaveLength(1);
  });
});
