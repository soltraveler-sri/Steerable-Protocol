/**
 * Runtime contract tests for execution, policy, ledger, undo, and cross-surface behavior.
 * These tests pin the protocol engine seams exercised by the reference integration.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SURFACE_READINESS_TIMEOUT_MS,
  ExecutionEngine,
  RegistrySurfaceReadiness,
  InMemoryLedger,
  resolveActionPolicy,
  CapabilityRegistry,
  compileSchema,
  createMemorySnapshotStore,
  extractLedgerTrace,
  defineAction,
  defineSurface,
  type ActionDeclaration,
  type AnyActionDeclaration,
  type SteeringInvocationRecord,
} from "@steerable/core";
import { createManualApprovalController } from "./testUtils";
import { undoToastLabelForRecord } from "./trail";

const hexSchema = compileSchema<{ hex: string }>({
  type: "object",
  properties: { hex: { type: "string" } },
  required: ["hex"],
  additionalProperties: false,
});

const valueSchema = compileSchema<{ value: string }>({
  type: "object",
  properties: { value: { type: "string" } },
  required: ["value"],
  additionalProperties: false,
});

function paletteAction(): ActionDeclaration<{ hex: string }, { accent: string }> {
  return defineAction({
    id: "palette.set_accent",
    title: "Set accent",
    description: "Set the local accent color.",
    params: hexSchema,
    reads: ["design.palette"],
    writes: ["design.palette"],
    risk: "safe",
    reversibility: { kind: "undoable" },
    effects: { external: false, cost: "none", sensitive: false },
    confirmation: "never",
    preconditions: ["surface:editor"],
    execute: ({ hex }, context) => {
      const palette = context.snapshotStore
        ? ((testStore(context).read("design.palette") as Record<string, string>) ?? {})
        : {};
      testStore(context).write("design.palette", { ...palette, accent: hex });
      return { accent: hex };
    },
    undo: ({ snapshot }, context) => {
      if (!snapshot) {
        throw new Error("Palette undo requires a snapshot.");
      }

      return context.snapshotStore?.restore(snapshot);
    },
    guidance: "Use when the user asks to change the accent color.",
    examples: [{ user: "make the accent #123456", params: { hex: "#123456" } }],
  });
}

function typographyAction(): ActionDeclaration<{ value: string }, { value: string }> {
  return defineAction({
    id: "fixture.set_typography",
    title: "Set font pairing",
    description: "Set the local typography pairing.",
    params: valueSchema,
    reads: ["design.typography"],
    writes: ["design.typography"],
    risk: "safe",
    reversibility: { kind: "undoable" },
    effects: { external: false, cost: "none", sensitive: false },
    confirmation: "never",
    preconditions: ["surface:editor"],
    execute: ({ value }, context) => {
      testStore(context).write("design.typography", { fontPairing: value });
      return { value };
    },
    undo: ({ snapshot }, context) => {
      if (!snapshot) {
        throw new Error("Typography undo requires a snapshot.");
      }

      return context.snapshotStore?.restore(snapshot);
    },
    guidance: "Use when the user asks to change the font pairing.",
    examples: [{ user: "use the modern pairing", params: { value: "modern" } }],
  });
}

function copyShareAction(): ActionDeclaration<{ value: string }, { copied: true }> {
  return defineAction({
    id: "fixture.copy_share",
    title: "Copy share link",
    description: "Copy a share link to the browser clipboard.",
    params: valueSchema,
    reads: ["project.meta"],
    writes: ["browser.clipboard"],
    risk: "side_effect",
    reversibility: { kind: "irreversible" },
    effects: { external: false, cost: "none", sensitive: false },
    confirmation: "never",
    preconditions: ["surface:editor"],
    execute: ({ value }, context) => {
      testStore(context).write("browser.clipboard", value);
      return { copied: true };
    },
    guidance: "Use when the user asks to copy the current share link.",
    examples: [{ user: "copy the share link", params: { value: "https://example.test" } }],
  });
}

function quotaExportAction(): ActionDeclaration<{ value: string }, { exported: string }> {
  return defineAction({
    id: "project.export_quota",
    title: "Export project",
    description: "Spend a mock export quota unit.",
    params: valueSchema,
    reads: ["project.export_quota"],
    writes: ["project.export_quota"],
    risk: "mutating",
    reversibility: { kind: "irreversible" },
    effects: { external: true, cost: "quota", sensitive: false },
    confirmation: "policy",
    preconditions: ["surface:editor"],
    execute: ({ value }, context) => {
      testStore(context).write("project.export_quota", value);
      return { exported: value };
    },
    guidance: "Use when the user asks to export and spend quota.",
    examples: [{ user: "export this page", params: { value: "page" } }],
  });
}

function sensitiveTextAction(): ActionDeclaration<{ value: string }, { value: string }> {
  return defineAction({
    id: "copy.update_sensitive",
    title: "Update sensitive copy",
    description: "Update copy that product policy treats as sensitive.",
    params: valueSchema,
    reads: ["design.copy"],
    writes: ["design.copy"],
    risk: "safe",
    reversibility: { kind: "undoable" },
    effects: { external: false, cost: "none", sensitive: true },
    confirmation: "never",
    preconditions: ["surface:editor"],
    execute: ({ value }, context) => {
      testStore(context).write("design.copy", value);
      return { value };
    },
    undo: ({ snapshot }, context) => {
      if (!snapshot) {
        throw new Error("Sensitive copy undo requires a snapshot.");
      }

      return context.snapshotStore?.restore(snapshot);
    },
    guidance: "Use when the user asks to update sensitive local copy.",
    examples: [{ user: "change the private note", params: { value: "private" } }],
  });
}

function createEditorRegistry(actions: AnyActionDeclaration[]) {
  const registry = new CapabilityRegistry({
    actions,
    surfaces: [
      defineSurface({
        id: "editor",
        title: "Editor",
        description: "The design editor surface.",
        capabilities: actions.map((action) => action.id),
      }),
    ],
  });

  registry.registerSurface("editor");
  return registry;
}

function createHarness(actions: AnyActionDeclaration[]) {
  const registry = createEditorRegistry(actions);
  const ledger = new InMemoryLedger();
  const store = createMemorySnapshotStore({
    "design.palette": { accent: "#000000" },
    "design.typography": { fontPairing: "atelier" },
    "browser.clipboard": null,
    "project.export_quota": "available",
    "design.copy": "before",
  });
  const engine = new ExecutionEngine({
    registry,
    ledger,
    snapshotStore: store.adapter,
  });

  setActiveTestStore(store);

  return { registry, ledger, store, engine };
}

describe("inline steerable proto-runtime", () => {
  it("resolves policy under both shipped postures and applies the creative quota floor", () => {
    const registry = createEditorRegistry([paletteAction(), quotaExportAction()]);
    const palette = registry.requireAction("palette.set_accent");
    const exportAction = registry.requireAction("project.export_quota");

    expect(palette.externalExposure).toBe("none");
    expect(
      resolveActionPolicy(palette, {
        posture: "creative-tool",
        currentSurface: "editor",
      }).finalMode,
    ).toBe("Instant execution");
    expect(
      resolveActionPolicy(palette, {
        posture: "business-app",
        currentSurface: "editor",
      }).finalMode,
    ).toBe("Optimistic chain");

    const exportDecision = resolveActionPolicy(exportAction, {
      posture: "creative-tool",
      currentSurface: "editor",
    });

    expect(exportDecision.finalMode).toBe("Gated suffix");
    expect(exportDecision.rationale.effectFloors).toContainEqual(
      expect.objectContaining({
        dimension: "cost",
        value: "quota",
        floorMode: "Gated suffix",
        applied: true,
      }),
    );
    expect(exportDecision.rationale).toEqual(
      expect.objectContaining({
        actionIds: ["project.export_quota"],
        selectedPosturePreset: "creative-tool",
        applicableOverrides: [],
        grant: expect.objectContaining({ used: false }),
        runtimeSignalDemotions: [],
        finalMode: "Gated suffix",
        reasonCodes: expect.arrayContaining(["effect_floor:creative-tool:cost_quota"]),
      }),
    );
  });

  it("undoes reversible completed steps in reverse order and discloses an irreversible partial undo", async () => {
    const { engine, store } = createHarness([
      paletteAction(),
      copyShareAction(),
      typographyAction(),
    ]);
    const run = await engine.executeChain({
      intent: "Set accent, copy link, and change typography",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        { actionId: "palette.set_accent", params: { hex: "#123456" } },
        { actionId: "fixture.copy_share", params: { value: "https://example.test" } },
        { actionId: "fixture.set_typography", params: { value: "modern" } },
      ],
    });

    const result = await run.done;
    expect(result.status).toBe("succeeded");
    expectMinimalLedgerRecord(result.record);
    expect(store.read("design.palette")).toEqual({ accent: "#123456" });
    expect(store.read("design.typography")).toEqual({ fontPairing: "modern" });

    const undoResult = await run.undoAll();

    expect(undoResult.status).toBe("partial");
    expect(undoResult.undoneStepIds).toEqual(["step_3", "step_1"]);
    expect(undoResult.notUndoneStepIds).toEqual(["step_2"]);
    expect(undoResult.disclosure).toContain("Partial undo");
    expect(store.read("design.palette")).toEqual({ accent: "#000000" });
    expect(store.read("design.typography")).toEqual({ fontPairing: "atelier" });
    expect((await run.getRecord()).disclosures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "partial_undo", stepIds: ["step_2"] }),
      ]),
    );
  });

  it("pauses a gated suffix, resumes after approval, and preserves prefix undo on decline", async () => {
    const approval = createManualApprovalController();
    const { registry, ledger, store } = createHarness([paletteAction(), quotaExportAction()]);
    const approvingEngine = new ExecutionEngine({
      registry,
      ledger,
      snapshotStore: store.adapter,
      approvalHook: approval.hook,
    });
    const approvingRun = await approvingEngine.executeChain({
      intent: "Change accent then export",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        { actionId: "palette.set_accent", params: { hex: "#ABCDEF" } },
        { actionId: "project.export_quota", params: { value: "landing" } },
      ],
    });
    const pending = await approval.waitForPendingRequest();

    expect(pending.heldSteps.map((step) => step.actionId)).toEqual(["project.export_quota"]);
    expect((await approvingRun.getRecord()).steps.map((step) => step.status)).toEqual([
      "succeeded",
      "held",
    ]);

    approval.approve("user approved export");
    const approvedResult = await approvingRun.done;

    expect(approvedResult.status).toBe("succeeded");
    expectMinimalLedgerRecord(approvedResult.record);
    expect(approvedResult.record.approval.status).toBe("approved");
    expect(approvedResult.record.steps.map((step) => step.status)).toEqual([
      "succeeded",
      "succeeded",
    ]);

    const declineApproval = createManualApprovalController();
    const declinedStore = createMemorySnapshotStore({
      "design.palette": { accent: "#000000" },
      "project.export_quota": "available",
    });
    setActiveTestStore(declinedStore);
    const declinedLedger = new InMemoryLedger();
    const declinedEngine = new ExecutionEngine({
      registry,
      ledger: declinedLedger,
      snapshotStore: declinedStore.adapter,
      approvalHook: declineApproval.hook,
    });
    const declinedRun = await declinedEngine.executeChain({
      intent: "Change accent then export",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        { actionId: "palette.set_accent", params: { hex: "#BADA55" } },
        { actionId: "project.export_quota", params: { value: "landing" } },
      ],
    });

    await declineApproval.waitForPendingRequest();
    declineApproval.decline("not now");

    const declinedResult = await declinedRun.done;
    expect(declinedResult.status).toBe("declined");
    expectMinimalLedgerRecord(declinedResult.record);
    expect(declinedResult.record.approval.status).toBe("declined");
    expect(declinedResult.record.steps.map((step) => step.status)).toEqual([
      "succeeded",
      "skipped",
    ]);
    expect(declinedStore.read("design.palette")).toEqual({ accent: "#BADA55" });

    const prefixUndo = await declinedRun.undoAll();
    expect(prefixUndo.status).toBe("succeeded");
    expect(prefixUndo.undoneStepIds).toEqual(["step_1"]);
    expect(declinedStore.read("design.palette")).toEqual({ accent: "#000000" });
  });

  it("awaits cross-surface readiness successfully and fails legibly on timeout", async () => {
    const success = createCrossSurfaceHarness({ registerSettings: true });
    const successRun = await success.engine.executeChain({
      intent: "Open settings and set the theme",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        { actionId: "surface.navigate_settings", params: { value: "settings" } },
        {
          actionId: "settings.set_theme",
          params: { value: "premium" },
          targetSurfaceId: "settings",
          surfaceTimeoutMs: 100,
        },
      ],
    });
    const successResult = await successRun.done;

    expect(successResult.status).toBe("succeeded");
    expectMinimalLedgerRecord(successResult.record);
    expect(success.store.read("settings.theme")).toBe("premium");

    const timeout = createCrossSurfaceHarness({ registerSettings: false });
    const timeoutRun = await timeout.engine.executeChain({
      intent: "Open settings and set the theme",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        { actionId: "surface.navigate_settings", params: { value: "settings" } },
        {
          actionId: "settings.set_theme",
          params: { value: "premium" },
          targetSurfaceId: "settings",
          surfaceTimeoutMs: 5,
        },
      ],
    });
    const timeoutResult = await timeoutRun.done;

    expect(timeoutResult.status).toBe("failed");
    expect(timeoutResult.failure?.code).toBe("surface_readiness_timeout");
    expectMinimalLedgerRecord(timeoutResult.record);
    expect(timeoutResult.record.steps.map((step) => step.status)).toEqual(["succeeded", "failed"]);
    expect(timeoutResult.record.disclosures).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "cross_surface_failure" })]),
    );
    expect("handleId" in timeoutResult.record.steps[0].undo).toBe(true);
    expect(undoToastLabelForRecord(timeoutResult.record)).toBe(
      "Chain failed. Completed steps can be undone.",
    );
    expect(DEFAULT_SURFACE_READINESS_TIMEOUT_MS).toBe(5000);
  });

  it("records the minimal ledger model with SA-POL-108 rationale fields and redacted eval traces", async () => {
    const { engine, ledger } = createHarness([sensitiveTextAction()]);
    const result = await engine.executeAction({
      intent: "Update the private note",
      surfaceId: "editor",
      posture: "creative-tool",
      actionId: "copy.update_sensitive",
      params: { value: "private launch detail" },
    });

    expect(result.status).toBe("succeeded");
    expectMinimalLedgerRecord(result.record);

    const decision = result.record.policyDecisions[0];
    expect(decision.rationale).toEqual(
      expect.objectContaining({
        actionIds: ["copy.update_sensitive"],
        declarationMetadata: [
          expect.objectContaining({
            actionId: "copy.update_sensitive",
            effects: expect.objectContaining({ sensitive: true }),
          }),
        ],
        selectedPosturePreset: "creative-tool",
        applicableOverrides: [],
        effectFloors: expect.arrayContaining([
          expect.objectContaining({
            dimension: "sensitive",
            applied: false,
          }),
        ]),
        confirmationFloor: expect.objectContaining({ value: "never", applied: false }),
        grant: expect.objectContaining({ used: false }),
        runtimeSignalDemotions: [],
        finalMode: "Instant execution",
        reasonCodes: expect.any(Array),
      }),
    );

    const [trace] = extractLedgerTrace(ledger.getRecords(), { redactSensitive: true });
    expect(trace.steps[0].params).toBe("[redacted]");
    expect(trace.policy[0].finalMode).toBe("Instant execution");
  });
});

function createCrossSurfaceHarness(options: { registerSettings: boolean }) {
  const store = createMemorySnapshotStore({
    "ui.route": "editor",
    "settings.theme": "standard",
  });
  const actions = [
    defineAction({
      id: "surface.navigate_settings",
      title: "Navigate to settings",
      description: "Navigate from editor to settings.",
      params: valueSchema,
      reads: ["ui.route"],
      writes: ["ui.route"],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: ["surface:editor"],
      execute: ({ value }, context) => {
        testStore(context).write("ui.route", value);

        if (options.registerSettings) {
          setTimeout(() => context.registry.registerSurface("settings"), 10);
        }

        return { value };
      },
      undo: ({ snapshot }, context) => {
        if (!snapshot) {
          throw new Error("Navigation undo requires a snapshot.");
        }

        return context.snapshotStore?.restore(snapshot);
      },
      guidance: "Use when a chain needs the settings surface.",
      examples: [{ user: "open settings", params: { value: "settings" } }],
    }),
    defineAction({
      id: "settings.set_theme",
      title: "Set workspace theme",
      description: "Set the theme on the settings surface.",
      params: valueSchema,
      reads: ["settings.theme"],
      writes: ["settings.theme"],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: ["surface:settings"],
      execute: ({ value }, context) => {
        testStore(context).write("settings.theme", value);
        return { value };
      },
      undo: ({ snapshot }, context) => {
        if (!snapshot) {
          throw new Error("Theme undo requires a snapshot.");
        }

        return context.snapshotStore?.restore(snapshot);
      },
      guidance: "Use when the user asks to change the workspace theme.",
      examples: [{ user: "set theme to premium", params: { value: "premium" } }],
    }),
  ];
  const registry = new CapabilityRegistry({
    actions,
    surfaces: [
      defineSurface({
        id: "editor",
        title: "Editor",
        description: "Editor surface.",
        capabilities: ["surface.navigate_settings"],
      }),
      defineSurface({
        id: "settings",
        title: "Settings",
        description: "Settings surface.",
        capabilities: ["settings.set_theme"],
      }),
    ],
  });
  const ledger = new InMemoryLedger();

  registry.registerSurface("editor");
  setActiveTestStore(store);

  return {
    registry,
    ledger,
    store,
    engine: new ExecutionEngine({
      registry,
      ledger,
      snapshotStore: store.adapter,
      surfaceReadiness: new RegistrySurfaceReadiness(registry, 50),
    }),
  };
}

function expectMinimalLedgerRecord(record: SteeringInvocationRecord) {
  expect(record.recordId).toMatch(/^inv_/);
  expect(record.schemaVersion).toBe("steerable-ledger.v0");
  expect(record.order.sequence).toBeGreaterThan(0);
  expect(record.order.recordedAt).toEqual(expect.any(String));
  expect(record.surfaceRef).toEqual(expect.any(String));
  expect(record.intent.text ?? record.intent.redactedText ?? record.intent.ref).toBeTruthy();
  expect(record.initiator.kind).toMatch(/user|system|external_agent/);
  expect(record.approval.status).toMatch(/not-required|pending|approved|declined|expired|canceled/);
  expect(record.policyDecisions.length).toBeGreaterThan(0);

  record.policyDecisions.forEach((decision) => {
    expect(decision.decisionId).toMatch(/^pol_/);
    expect(decision.rationale).toEqual(
      expect.objectContaining({
        actionIds: expect.any(Array),
        declarationMetadata: expect.any(Array),
        selectedPosturePreset: expect.any(String),
        applicableOverrides: expect.any(Array),
        effectFloors: expect.any(Array),
        confirmationFloor: expect.any(Object),
        grant: expect.any(Object),
        runtimeSignalDemotions: expect.any(Array),
        finalMode: expect.any(String),
        reasonCodes: expect.any(Array),
      }),
    );
  });

  record.steps.forEach((step) => {
    expect(step.stepId).toEqual(expect.any(String));
    expect(step.order).toEqual(expect.any(Number));
    expect(step.actionId).toEqual(expect.any(String));
    expect(step.status).toMatch(/proposed|held|running|succeeded|failed|skipped|undone|canceled/);
    expect(step.writes).toEqual(expect.any(Array));
    expect(step.undo).toBeTruthy();
  });
}

let activeStore: ReturnType<typeof createMemorySnapshotStore> | undefined;

function setActiveTestStore(store: ReturnType<typeof createMemorySnapshotStore>) {
  activeStore = store;
}

function testStore(_context: { snapshotStore?: unknown }) {
  if (!activeStore) {
    throw new Error("No active test store.");
  }

  return activeStore;
}
