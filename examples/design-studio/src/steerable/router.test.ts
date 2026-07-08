import { describe, expect, it } from "vitest";
import {
  applyDesignStoreEvent,
  createInitialDesignState,
  type DesignSetters,
  type DesignStoreEvent,
} from "../state/designStore";
import { resolveChainPolicy } from "./policy";
import { ExecutionEngine, createManualApprovalController } from "./execution";
import { InMemoryLedger } from "./ledger";
import { ScriptedIntentRouter, type ActionIntentRoute } from "./router";
import {
  createDesignStudioRegistry,
  createDesignStudioSnapshotAdapter,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
} from "./designStudioCapabilities";
import { trailTitleForStep } from "./trail";

const documentedCases = [
  {
    utterance: "make the accent #FF6600",
    routeClass: "single action",
    steps: [{ actionId: "palette.set_color", params: { token: "accent", hex: "#FF6600" } }],
  },
  {
    utterance: "set accent to #FF6600",
    routeClass: "single action",
    steps: [{ actionId: "palette.set_color", params: { token: "accent", hex: "#FF6600" } }],
  },
  {
    utterance: "make the accent forest green",
    routeClass: "single action",
    steps: [{ actionId: "palette.set_color", params: { token: "accent", hex: "#228B22" } }],
  },
  {
    utterance: "switch to citrus",
    routeClass: "single action",
    steps: [{ actionId: "palette.apply_preset", params: { presetId: "citrus" } }],
  },
  {
    utterance: "switch the palette to citrus",
    routeClass: "single action",
    steps: [{ actionId: "palette.apply_preset", params: { presetId: "citrus" } }],
  },
  {
    utterance: "use the modern font pairing",
    routeClass: "single action",
    steps: [{ actionId: "typography.set_pairing", params: { pairing: "modern" } }],
  },
  {
    utterance: "hide pricing",
    routeClass: "single action",
    steps: [{ actionId: "section.set_visibility", params: { sectionId: "pricing", visible: false } }],
  },
  {
    utterance: "move social proof up",
    routeClass: "single action",
    steps: [{ actionId: "section.move_section", params: { sectionId: "social-proof", direction: "up" } }],
  },
  {
    utterance: "apply the SaaS launch template",
    routeClass: "single action",
    steps: [{ actionId: "template.apply_template", params: { templateId: "saas-launch" } }],
  },
  {
    utterance: "copy the share link",
    routeClass: "single action",
    steps: [{ actionId: "share.copy_link", params: {} }],
  },
  {
    utterance: "export this mock page",
    routeClass: "single action",
    steps: [{ actionId: "project.export_project", params: {} }],
  },
  {
    utterance: "reset the project",
    routeClass: "single action",
    steps: [{ actionId: "project.reset_project", params: {} }],
  },
  {
    utterance: "switch to citrus and hide pricing",
    routeClass: "action chain",
    steps: [
      { actionId: "palette.apply_preset", params: { presetId: "citrus" } },
      { actionId: "section.set_visibility", params: { sectionId: "pricing", visible: false } },
    ],
  },
] as const;

describe("scripted Design Studio intent router", () => {
  it("classifies the full documented action script against the live registry", () => {
    const { host, registry } = createHarness();
    const router = new ScriptedIntentRouter();

    for (const item of documentedCases) {
      const route = router.classify({
        intent: item.utterance,
        sourceSurfaceId: designStudioSurfaceIds.editor,
        registry,
        state: host.getState(),
      });

      expect(route.routeClass, item.utterance).toBe(item.routeClass);
      expect((route as ActionIntentRoute).steps.map((step) => ({
        actionId: step.actionId,
        params: step.params,
      }))).toEqual(item.steps);
    }
  });

  it("routes answer, clarification, and refusal cases without action execution", () => {
    const { host, registry } = createHarness();
    const router = new ScriptedIntentRouter();
    const baseRequest = {
      sourceSurfaceId: designStudioSurfaceIds.editor,
      registry,
      state: host.getState(),
    };

    expect(router.classify({ ...baseRequest, intent: "what templates are available?" })).toEqual(
      expect.objectContaining({
        routeClass: "answer",
        readToolIds: ["template.list_available"],
      }),
    );
    expect(router.classify({ ...baseRequest, intent: "make it pop" })).toEqual(
      expect.objectContaining({
        routeClass: "clarification",
        missing: ["target object", "parameter value"],
      }),
    );
    expect(router.classify({ ...baseRequest, intent: "send this page to Mailchimp" })).toEqual(
      expect.objectContaining({
        routeClass: "refusal/handoff",
        escalationReason: "outside_declared_capabilities",
      }),
    );
  });

  it("executes every documented action utterance end-to-end through policy", async () => {
    for (const item of documentedCases) {
      const { host, registry } = createHarness();
      const ledger = new InMemoryLedger();
      const approval = createManualApprovalController();
      const engine = new ExecutionEngine({
        registry,
        ledger,
        snapshotStore: createDesignStudioSnapshotAdapter(host),
        approvalHook: approval.hook,
      });
      const router = new ScriptedIntentRouter();
      const route = router.classify({
        intent: item.utterance,
        sourceSurfaceId: designStudioSurfaceIds.editor,
        registry,
        state: host.getState(),
      }) as ActionIntentRoute;
      const run = engine.executeChain({
        intent: item.utterance,
        surfaceId: designStudioSurfaceIds.editor,
        posture: "creative-tool",
        steps: route.steps,
      });
      const firstOutcome = await Promise.race([
        run.done.then((result) => ({ kind: "done" as const, result })),
        approval.waitForPendingRequest().then(() => ({ kind: "pending" as const })),
      ]);

      if (firstOutcome.kind === "pending") {
        approval.approve("test inline apply");
      }

      const result = firstOutcome.kind === "done" ? firstOutcome.result : await run.done;

      expect(result.status, item.utterance).toBe("succeeded");
      expect(result.failure, item.utterance).toBeUndefined();
    }
  });

  it("does not gate safe reversible documented routes under creative-tool posture", () => {
    const { host, registry } = createHarness();
    const router = new ScriptedIntentRouter();
    const safeUtterances = [
      "make the accent forest green",
      "switch to citrus",
      "use the modern font pairing",
      "hide pricing",
      "move social proof up",
      "apply the SaaS launch template",
      "switch to citrus and hide pricing",
    ];

    for (const utterance of safeUtterances) {
      const route = router.classify({
        intent: utterance,
        sourceSurfaceId: designStudioSurfaceIds.editor,
        registry,
        state: host.getState(),
      }) as ActionIntentRoute;
      const actions = route.steps.map((step) => registry.requireAction(step.actionId));
      const decision = resolveChainPolicy(actions, {
        posture: "creative-tool",
        currentSurface: designStudioSurfaceIds.editor,
      });

      expect(decision.requiredGate, utterance).toBeUndefined();
      expect(decision.finalMode, utterance).toBe("Instant execution");
    }
  });

  it("keeps export and reset behind one policy gate", () => {
    const { host, registry } = createHarness();
    const router = new ScriptedIntentRouter();

    for (const utterance of ["export this mock page", "reset the project"]) {
      const route = router.classify({
        intent: utterance,
        sourceSurfaceId: designStudioSurfaceIds.editor,
        registry,
        state: host.getState(),
      }) as ActionIntentRoute;
      const decision = resolveChainPolicy(
        route.steps.map((step) => registry.requireAction(step.actionId)),
        {
          posture: "creative-tool",
          currentSurface: designStudioSurfaceIds.editor,
        },
      );

      expect(decision.finalMode, utterance).toBe("Gated suffix");
      expect(decision.requiredGate?.actionIds, utterance).toEqual([
        route.steps[0].actionId,
      ]);
    }
  });

  it("derives trail titles from declarations", () => {
    const { registry } = createHarness();
    const action = registry.requireAction("palette.set_color");

    action.title = "Declaration title changed";

    expect(trailTitleForStep(registry, { actionId: "palette.set_color" })).toBe(
      "Declaration title changed",
    );
  });

  it("executes routed safe, gated, refusal, and undo-all flows against the real registry", async () => {
    const { host, registry } = createHarness();
    const ledger = new InMemoryLedger();
    const approval = createManualApprovalController();
    const engine = new ExecutionEngine({
      registry,
      ledger,
      snapshotStore: createDesignStudioSnapshotAdapter(host),
      approvalHook: approval.hook,
    });
    const router = new ScriptedIntentRouter();
    const requestBase = {
      sourceSurfaceId: designStudioSurfaceIds.editor,
      registry,
      state: host.getState(),
    };

    const safeRoute = router.classify({
      ...requestBase,
      intent: "make the accent forest green",
    }) as ActionIntentRoute;
    const safeResult = await engine.executeChain({
      intent: "make the accent forest green",
      surfaceId: designStudioSurfaceIds.editor,
      posture: "creative-tool",
      steps: safeRoute.steps,
    }).done;

    expect(safeResult.status).toBe("succeeded");
    expect(host.getState().palette.accent).toBe("#228B22");
    expect(safeResult.record.approval.status).toBe("not-required");

    const exportRoute = router.classify({
      ...requestBase,
      state: host.getState(),
      intent: "export this mock page",
    }) as ActionIntentRoute;
    const exportRun = engine.executeChain({
      intent: "export this mock page",
      surfaceId: designStudioSurfaceIds.editor,
      posture: "creative-tool",
      steps: exportRoute.steps,
    });
    const pending = await approval.waitForPendingRequest();

    expect(pending.heldSteps.map((step) => step.title)).toEqual(["Export project"]);
    expect(exportRun.getRecord().steps[0].status).toBe("held");

    approval.approve("test inline apply");

    const exportResult = await exportRun.done;
    expect(exportResult.status).toBe("succeeded");
    expect(exportResult.record.approval.status).toBe("approved");
    expect(host.getState().exportQuota.remaining).toBe(2);

    const refusal = router.classify({
      ...requestBase,
      state: host.getState(),
      intent: "send this page to Mailchimp",
    });

    expect(refusal.routeClass).toBe("refusal/handoff");

    const chainRoute = router.classify({
      ...requestBase,
      state: host.getState(),
      intent: "switch to citrus and hide pricing",
    }) as ActionIntentRoute;
    const chainRun = engine.executeChain({
      intent: "switch to citrus and hide pricing",
      surfaceId: designStudioSurfaceIds.editor,
      posture: "creative-tool",
      steps: chainRoute.steps,
    });
    const chainResult = await chainRun.done;

    expect(chainResult.status).toBe("succeeded");
    expect(host.getState().palette.accent).toBe("#D9480F");
    expect(host.getState().sections.find((section) => section.id === "pricing")?.visible).toBe(
      false,
    );

    const undoResult = await chainRun.undoAll();

    expect(undoResult.status).toBe("succeeded");
    expect(host.getState().palette.accent).toBe("#228B22");
    expect(host.getState().sections.find((section) => section.id === "pricing")?.visible).toBe(
      true,
    );
  });
});

function createHarness() {
  const host = createReducerBackedHost();
  const registry = createDesignStudioRegistry(host);

  Object.values(designStudioSurfaceIds).forEach((surfaceId) => {
    registry.registerSurface(surfaceId);
  });

  return { host, registry };
}

function createReducerBackedHost(): DesignStudioCapabilityHost {
  let state = createInitialDesignState();
  const dispatch = (event: DesignStoreEvent) => {
    state = applyDesignStoreEvent(state, event);
  };
  const setters: DesignSetters = {
    setPaletteToken: (token, value) =>
      dispatch({ type: "paletteTokenSet", token, value }),
    applyPalettePreset: (presetId) =>
      dispatch({ type: "palettePresetApplied", presetId }),
    setFontPairing: (value) => dispatch({ type: "fontPairingSet", value }),
    setTypeScale: (value) => dispatch({ type: "typeScaleSet", value }),
    setHeroLayout: (value) => dispatch({ type: "heroLayoutSet", value }),
    toggleSectionVisibility: (sectionId) =>
      dispatch({ type: "sectionVisibilityToggled", sectionId }),
    moveSection: (sectionId, direction) =>
      dispatch({ type: "sectionMoved", sectionId, direction }),
    updateSectionText: (sectionId, field, value) =>
      dispatch({ type: "sectionTextUpdated", sectionId, field, value }),
    applyTemplate: (templateId) => dispatch({ type: "templateApplied", templateId }),
    updateProjectMeta: (field, value) =>
      dispatch({ type: "projectMetaUpdated", field, value }),
    copyShareLink: async () => {
      dispatch({
        type: "shareMessageSet",
        message: "Share link copied to clipboard.",
      });
    },
    exportProject: () => dispatch({ type: "projectExported" }),
    resetProject: () => dispatch({ type: "projectReset" }),
    restoreState: (nextState) => dispatch({ type: "stateRestored", state: nextState }),
  };

  return {
    getState: () => state,
    setters,
    getOrigin: () => "https://design-studio.test",
  };
}
