import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  RegistryCompileError,
  compileValueSchema,
  createStrictObjectSchema,
  defineAction,
  defineFacts,
  defineReadTool,
  defineSurface,
  type ActionDeclaration,
  type AnyCompiledActionDeclaration,
  type FactsDeclaration,
} from "./registry.js";
import {
  posturePresetMappings,
  resolveActionPolicy,
  resolveChainPolicy,
  type RuntimeSignalDemotion,
  type ScopedGrant,
} from "./policy.js";
import { InMemoryLedger } from "./ledger.js";

const stringParams = createStrictObjectSchema<{ value: string }>(
  ["value"],
  (input) => {
    if (typeof input.value !== "string") throw new Error("value must be a string");
    return { value: input.value };
  },
  {
    type: "object",
    properties: { value: { type: "string" } },
    required: ["value"],
    additionalProperties: false,
  },
);

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

describe("SA-CTX-023/024 published-fact validation", () => {
  const quotaSurface = defineSurface({
    id: "design-studio",
    title: "Design Studio",
    description: "The editor surface.",
    capabilities: ["quota.current_facts"],
  });

  function factsRegistry(
    publish: FactsDeclaration["publish"],
    schema = compileValueSchema({ type: "number" }),
  ): CapabilityRegistry {
    return new CapabilityRegistry({
      facts: [
        defineFacts({
          id: "quota.current_facts",
          title: "Quota facts",
          description: "Bounded quota context.",
          surface: "design-studio",
          facts: [
            { key: "quota.exports_remaining", description: "Remaining exports.", schema },
            {
              key: "ui.route",
              description: "Current route.",
              schema: compileValueSchema({ type: "string" }),
            },
          ],
          publish,
        }),
      ],
      surfaces: [quotaSurface],
    });
  }

  it("validates and returns a payload whose values conform to their declared schemas", async () => {
    const registry = factsRegistry(() => ({
      "quota.exports_remaining": 3,
      "ui.route": "/settings",
    }));
    await expect(registry.publishFacts("quota.current_facts")).resolves.toEqual({
      "quota.exports_remaining": 3,
      "ui.route": "/settings",
    });
  });

  it("rejects a value whose type violates its declared fact schema (SA-CTX-024)", async () => {
    const registry = factsRegistry(() => ({
      "quota.exports_remaining": "three",
      "ui.route": "/settings",
    }));
    await expect(registry.publishFacts("quota.current_facts")).rejects.toThrow(
      RegistryCompileError,
    );
    await expect(registry.publishFacts("quota.current_facts")).rejects.toThrow(
      /published fact "quota.exports_remaining" .*SA-CTX-024/s,
    );
  });

  it("rejects a data-dependent undeclared top-level fact key (SA-CTX-023)", async () => {
    const registry = factsRegistry(() => ({
      "quota.exports_remaining": 3,
      "ui.route": "/settings",
      "quota.injected": 9,
    }));
    await expect(registry.publishFacts("quota.current_facts")).rejects.toThrow(
      /undeclared top-level fact key "quota.injected".*SA-CTX-023/s,
    );
  });

  it("rejects a non-object payload and an unknown facts id", async () => {
    const registry = factsRegistry(() => 42 as never);
    await expect(registry.publishFacts("quota.current_facts")).rejects.toThrow(
      /must publish an object/,
    );
    await expect(registry.publishFacts("no.such_facts")).rejects.toThrow(
      /Unknown facts "no.such_facts"/,
    );
  });

  it("gives an identity parser nothing to catch — why real schemas matter (C4)", async () => {
    // The pre-fix reference declared `schema: { parse: (input) => input }`. Routed through the same
    // publishFacts enforcement point, a wrong-typed value still sails through: the point is only as
    // real as the declared parser. This pins the C4 half — compileValueSchema is what makes SA-CTX-024
    // bite in the example an adopter copies.
    const registry = factsRegistry(() => ({ "quota.exports_remaining": "not a number" }), {
      parse: (input) => input,
      jsonSchema: { type: "number" },
    });
    await expect(registry.publishFacts("quota.current_facts")).resolves.toEqual({
      "quota.exports_remaining": "not a number",
    });
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
      resolveActionPolicy(clean, {
        posture: "sensitive-domain",
        currentSurface: "design-studio",
        // SA-POL-147 makes recordability a precondition of any sensitive-domain mode other than
        // `Refuse / hand off`, so the grid is only observable once it is affirmatively supplied.
        recordable: true,
      }).finalMode,
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
            resolveActionPolicy(candidate, {
              posture,
              currentSurface: "design-studio",
              // See SA-POL-147 above: supplied so the grid itself is what this asserts.
              recordable: true,
            }).finalMode,
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

const FIXED_NOW = new Date("2026-01-01T00:00:00.000Z");
const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

function grantFor(overrides: Partial<ScopedGrant> = {}): ScopedGrant {
  return {
    id: "g1",
    actionIds: ["palette.set_color"],
    issuer: "user",
    subject: "action:palette.set_color",
    grantedMode: "Instant execution",
    ...overrides,
  };
}

describe("SA-POL-129/130 grant expiration and session scope", () => {
  it("refuses to apply a framework grant that never expires and is not session-scoped", () => {
    const decision = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grantFor({ source: "framework" })],
      sessionId: "sess-A",
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(decision.rationale.grant.used).toBe(false);
    expect(decision.rationale.grant.reason).toBe("framework_grant_missing_session_scope");
    expect(decision.finalMode).toBe("Optimistic chain");
  });

  it("refuses a framework grant that is session-scoped but has no expiration", () => {
    const decision = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grantFor({ source: "framework", sessionId: "sess-A" })],
      sessionId: "sess-A",
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(decision.rationale.grant.reason).toBe("framework_grant_missing_expiration");
    expect(decision.finalMode).toBe("Optimistic chain");
  });

  it("treats a grant with no declared source as framework-supplied (safe default)", () => {
    const decision = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grantFor({})],
      sessionId: "sess-A",
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(decision.rationale.grant.reason).toBe("framework_grant_missing_session_scope");
  });

  it("does not let one session's framework grant raise autonomy in another session", () => {
    const grant = grantFor({ source: "framework", sessionId: "sess-A", expiresAt: FUTURE });
    const inputs = {
      posture: "creative-tool" as const,
      currentSurface: "design-studio",
      grants: [grant],
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    };
    expect(
      resolveActionPolicy(compiledAction({ risk: "mutating" }), { ...inputs, sessionId: "sess-A" })
        .finalMode,
    ).toBe("Instant execution");
    const other = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      ...inputs,
      sessionId: "sess-B",
    });
    expect(other.rationale.grant.used).toBe(false);
    expect(other.rationale.grant.reason).toBe("grant_session_mismatch");
    expect(other.finalMode).toBe("Optimistic chain");
  });

  it("applies a conformant session-scoped framework grant and rejects it once expired", () => {
    const base = {
      posture: "creative-tool" as const,
      currentSurface: "design-studio",
      sessionId: "sess-A",
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    };
    expect(
      resolveActionPolicy(compiledAction({ risk: "mutating" }), {
        ...base,
        grants: [grantFor({ source: "framework", sessionId: "sess-A", expiresAt: FUTURE })],
      }).rationale.grant.reason,
    ).toBe("grant_applied");
    expect(
      resolveActionPolicy(compiledAction({ risk: "mutating" }), {
        ...base,
        grants: [grantFor({ source: "framework", sessionId: "sess-A", expiresAt: PAST })],
      }).rationale.grant.reason,
    ).toBe("grant_expired");
  });

  it("fails closed and legibly when expiry cannot be evaluated (SA-POL-129, N9b)", () => {
    const noClock = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grantFor({ source: "framework", sessionId: "sess-A", expiresAt: FUTURE })],
      sessionId: "sess-A",
      allowGrantsToRaiseAutonomy: true,
    });
    expect(noClock.rationale.grant.used).toBe(false);
    expect(noClock.rationale.grant.reason).toBe("grant_expiry_unevaluable");

    const unparsable = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grantFor({ source: "framework", sessionId: "sess-A", expiresAt: "not-a-date" })],
      sessionId: "sess-A",
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(unparsable.rationale.grant.used).toBe(false);
    expect(unparsable.rationale.grant.reason).toBe("grant_expiry_unparsable");
  });

  it("lets developer policy hold a persistent grant and records its persistence (SA-POL-130)", () => {
    const decision = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grantFor({ source: "developer" })],
      sessionId: "sess-A",
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(decision.rationale.grant.used).toBe(true);
    expect(decision.rationale.grant.reason).toBe("grant_applied:developer_persistent");
    expect(decision.finalMode).toBe("Instant execution");
  });
});

describe("SA-POL-126/127 grant principal scope", () => {
  it("does not let one principal's grant authorize another principal", () => {
    const grant = grantFor({
      source: "developer",
      subjectId: "user_A",
    });
    const decision = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grant],
      subjectId: "user_B",
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(decision.rationale.grant.used).toBe(false);
    expect(decision.rationale.grant.reason).toBe("grant_subject_mismatch");
    expect(decision.finalMode).toBe("Optimistic chain");
  });

  it("fails closed when a subject-scoped grant cannot be checked against a principal", () => {
    const decision = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grantFor({ source: "developer", subjectId: "user_A" })],
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(decision.rationale.grant.reason).toBe("grant_subject_unverifiable");
  });

  it("honours a role-scoped grant subject (SA-POL-127)", () => {
    const base = {
      posture: "creative-tool" as const,
      currentSurface: "design-studio",
      grants: [grantFor({ source: "developer", role: "editor" })],
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    };
    expect(
      resolveActionPolicy(compiledAction({ risk: "mutating" }), { ...base, role: "editor" })
        .rationale.grant.used,
    ).toBe(true);
    const viewer = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      ...base,
      role: "viewer",
    });
    expect(viewer.rationale.grant.used).toBe(false);
    expect(viewer.rationale.grant.reason).toBe("grant_role_mismatch");
  });
});

describe("SA-POL-144/162 grants cannot erase floors or overrides", () => {
  const money = () =>
    compiledAction({
      id: "billing.buy_credits",
      risk: "mutating",
      reversibility: { kind: "snapshot" },
      effects: { external: true, cost: "money", sensitive: false },
      undo: undefined,
    });
  const liveGrant = grantFor({
    actionIds: ["billing.buy_credits"],
    source: "developer",
  });

  it("keeps the creative-tool money floor a grant would otherwise erase (SA-POL-162)", () => {
    const baseline = resolveActionPolicy(money(), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      now: FIXED_NOW,
    });
    expect(baseline.finalMode).toBe("Plan preview");

    const granted = resolveActionPolicy(money(), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [liveGrant],
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(granted.finalMode).toBe("Plan preview");
    expect(granted.rationale.grant.used).toBe(false);
    expect(granted.rationale.grant.reason).toBe("grant_capped_by_policy_floor");
  });

  it("keeps a developer override a grant would otherwise erase (SA-POL-114)", () => {
    const granted = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      overrides: [
        {
          id: "sox",
          actionId: "palette.set_color",
          minimumMode: "Step-gated",
          reasonCode: "compliance:sox",
        },
      ],
      grants: [grantFor({ source: "developer" })],
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(granted.finalMode).toBe("Step-gated");
    expect(granted.rationale.reasonCodes).toContain("compliance:sox");
    expect(granted.rationale.grant.reason).toBe("grant_capped_by_policy_floor");
  });

  it("records a surviving floor consistently with the final mode (SA-POL-173)", () => {
    const granted = resolveActionPolicy(money(), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [liveGrant],
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    const floor = granted.rationale.effectFloors.find((item) => item.dimension === "cost");
    expect(floor?.applied).toBe(true);
    // SA-POL-173's `applied` is measured against the incoming mode; the guarantee
    // that makes it honest is that an applied floor now survives to the final mode.
    expect(granted.finalMode).toBe(floor?.floorMode);
  });

  it("still lets a grant raise autonomy when no floor or override applies", () => {
    const granted = resolveActionPolicy(compiledAction({ risk: "mutating" }), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      grants: [grantFor({ source: "developer" })],
      now: FIXED_NOW,
      allowGrantsToRaiseAutonomy: true,
    });
    expect(granted.finalMode).toBe("Instant execution");
  });
});

describe("SA-POL-105/145 role, session trust, and environment are policy inputs", () => {
  it("scopes a developer override by role, session trust, and environment", () => {
    const override = {
      id: "viewer-lock",
      actionId: "palette.set_color",
      role: "viewer",
      sessionTrust: "untrusted",
      environment: "production",
      minimumMode: "Refuse / hand off" as const,
      reasonCode: "role:viewer_may_not_write",
    };
    const inputs = {
      posture: "creative-tool" as const,
      currentSurface: "design-studio",
      overrides: [override],
    };
    expect(
      resolveActionPolicy(compiledAction(), {
        ...inputs,
        role: "viewer",
        sessionTrust: "untrusted",
        environment: "production",
      }).finalMode,
    ).toBe("Refuse / hand off");
    expect(
      resolveActionPolicy(compiledAction(), {
        ...inputs,
        role: "editor",
        sessionTrust: "untrusted",
        environment: "production",
      }).finalMode,
    ).toBe("Instant execution");
    expect(
      resolveActionPolicy(compiledAction(), {
        ...inputs,
        role: "viewer",
        sessionTrust: "trusted",
        environment: "production",
      }).finalMode,
    ).toBe("Instant execution");
  });

  it("records the resolution context in the rationale (SA-POL-105, SA-BRIDGE-044)", () => {
    const decision = resolveActionPolicy(compiledAction(), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      role: "viewer",
      sessionTrust: "untrusted",
      environment: "production",
      subjectId: "user_A",
      sessionId: "sess-A",
    });
    expect(decision.rationale.resolutionContext).toEqual({
      role: "viewer",
      sessionTrust: "untrusted",
      environment: "production",
      subjectId: "user_A",
      sessionId: "sess-A",
    });
  });
});

describe("SA-POL-147 sensitive-domain recordability fails closed", () => {
  it("refuses when recordability is unknown, not just when it is known-false", () => {
    expect(
      resolveActionPolicy(compiledAction(), {
        posture: "sensitive-domain",
        currentSurface: "design-studio",
      }).finalMode,
    ).toBe("Refuse / hand off");
    expect(
      resolveActionPolicy(compiledAction(), {
        posture: "sensitive-domain",
        currentSurface: "design-studio",
        recordable: true,
      }).finalMode,
    ).toBe("Optimistic chain");
  });

  it("leaves other postures unaffected by an unknown recordability", () => {
    expect(
      resolveActionPolicy(compiledAction(), {
        posture: "creative-tool",
        currentSurface: "design-studio",
      }).finalMode,
    ).toBe("Instant execution");
  });
});

describe("SA-POL-123 runtime-signal demotion is bounded to one rung", () => {
  const signals = (count: number): RuntimeSignalDemotion[] =>
    Array.from({ length: count }, (_unused, index) => ({
      id: `signal_${index}`,
      reasonCode: `low_confidence_${index}`,
    }));

  it("demotes a clean safe reversible action at most one rung for any number of signals", () => {
    const clean = compiledAction();
    const modeFor = (count: number) =>
      resolveActionPolicy(clean, {
        posture: "creative-tool",
        currentSurface: "design-studio",
        runtimeSignalDemotions: signals(count),
      }).finalMode;
    expect(modeFor(0)).toBe("Instant execution");
    expect(modeFor(1)).toBe("Optimistic chain");
    expect(modeFor(3)).toBe("Optimistic chain");
    expect(modeFor(5)).toBe("Optimistic chain");
  });

  it("clamps an out-of-contract demoteBy to one rung", () => {
    const decision = resolveActionPolicy(compiledAction(), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      runtimeSignalDemotions: [
        { id: "s1", reasonCode: "low_confidence", demoteBy: 5 as unknown as 1 },
      ],
    });
    expect(decision.finalMode).toBe("Optimistic chain");
    expect(decision.rationale.reasonCodes).toContain("runtime_signal_demotion:bounded_to_one_rung");
  });

  it("still records every signal in the rationale while demoting once (SA-POL-123)", () => {
    const decision = resolveActionPolicy(compiledAction(), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      runtimeSignalDemotions: signals(3),
    });
    expect(decision.rationale.runtimeSignalDemotions).toHaveLength(3);
    expect(decision.rationale.reasonCodes).toEqual(
      expect.arrayContaining(["low_confidence_0", "low_confidence_1", "low_confidence_2"]),
    );
  });
});

describe("SA-POL-108 / SA-LED-002 availability deferral is auditable", () => {
  const deferring = (targetSurfaceId: string) => ({
    isActionAvailableOnSurface: () => true,
    explainActionAvailability: () => ({
      available: true,
      deferredToSurfaceBoundary: { targetSurfaceId },
    }),
  });

  it("records that plan-time availability was answered by declaration membership only", () => {
    const decision = resolveActionPolicy(compiledAction(), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      availability: deferring("export-view"),
    });
    expect(decision.finalMode).toBe("Instant execution");
    expect(decision.rationale.availabilityDeferrals).toEqual([
      {
        actionId: "palette.set_color",
        targetSurfaceId: "export-view",
        reasonCode: "availability:deferred_to_cross_surface_boundary:export-view",
      },
    ]);
    expect(decision.rationale.reasonCodes).toContain(
      "availability:deferred_to_cross_surface_boundary:export-view",
    );
  });

  it("records no deferral when availability was fully checked", () => {
    const decision = resolveActionPolicy(compiledAction(), {
      posture: "creative-tool",
      currentSurface: "design-studio",
      availability: { isActionAvailableOnSurface: () => true },
    });
    expect(decision.rationale.availabilityDeferrals).toEqual([]);
    expect(
      decision.rationale.reasonCodes.some((code) => code.startsWith("availability:deferred")),
    ).toBe(false);
  });

  it("carries deferrals through a chain rationale", () => {
    const decision = resolveChainPolicy([compiledAction()], {
      posture: "creative-tool",
      currentSurface: "design-studio",
      availability: deferring("export-view"),
    });
    expect(decision.rationale.availabilityDeferrals).toHaveLength(1);
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
