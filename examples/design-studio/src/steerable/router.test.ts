import { describe, expect, it } from "vitest";
import {
  applyDesignStoreEvent,
  createInitialDesignState,
  type DesignSetters,
  type DesignStoreEvent,
} from "../state/designStore";
import { resolveChainPolicy } from "./policy";
import type { PosturePreset } from "./policy";
import {
  ExecutionEngine,
  RegistrySurfaceReadiness,
  createManualApprovalController,
} from "./execution";
import { InMemoryLedger } from "./ledger";
import { ScriptedIntentRouter, type ActionIntentRoute } from "./router";
import {
  createDesignStudioRegistry,
  createDesignStudioSnapshotAdapter,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
  type DesignStudioSurfaceId,
} from "./designStudioCapabilities";
import { trailTitleForStep } from "./trail";

const documentedCases = [
  {
    utterance: "make the accent #FF6600",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "single action",
    steps: [{ actionId: "palette.set_color", params: { token: "accent", hex: "#FF6600" } }],
  },
  {
    utterance: "set accent to #FF6600",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "single action",
    steps: [{ actionId: "palette.set_color", params: { token: "accent", hex: "#FF6600" } }],
  },
  {
    utterance: "make the accent forest green",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "single action",
    steps: [{ actionId: "palette.set_color", params: { token: "accent", hex: "#228B22" } }],
  },
  {
    utterance: "switch to citrus",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "single action",
    steps: [{ actionId: "palette.apply_preset", params: { presetId: "citrus" } }],
  },
  {
    utterance: "switch the palette to citrus",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "single action",
    steps: [{ actionId: "palette.apply_preset", params: { presetId: "citrus" } }],
  },
  {
    utterance: "use the modern font pairing",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "single action",
    steps: [{ actionId: "typography.set_pairing", params: { pairing: "modern" } }],
  },
  {
    utterance: "hide pricing",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "single action",
    steps: [{ actionId: "section.set_visibility", params: { sectionId: "pricing", visible: false } }],
  },
  {
    utterance: "move social proof up",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "single action",
    steps: [{ actionId: "section.move_section", params: { sectionId: "social-proof", direction: "up" } }],
  },
  {
    utterance: "apply the SaaS launch template",
    sourceSurfaceId: designStudioSurfaceIds.templates,
    routeClass: "single action",
    steps: [{ actionId: "template.apply_template", params: { templateId: "saas-launch" } }],
  },
  {
    utterance: "apply the SaaS launch template and make the accent forest green",
    sourceSurfaceId: designStudioSurfaceIds.templates,
    routeClass: "action chain",
    steps: [
      { actionId: "template.apply_template", params: { templateId: "saas-launch" } },
      { actionId: "surface.navigate_surface", params: { surfaceId: "editor" } },
      { actionId: "palette.set_color", params: { token: "accent", hex: "#228B22" } },
    ],
  },
  {
    utterance: "copy the share link",
    sourceSurfaceId: designStudioSurfaceIds.settings,
    routeClass: "single action",
    steps: [{ actionId: "share.copy_link", params: {} }],
  },
  {
    utterance: "export this mock page",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "single action",
    steps: [{ actionId: "project.export_project", params: {} }],
  },
  {
    utterance: "reset the project",
    sourceSurfaceId: designStudioSurfaceIds.settings,
    routeClass: "single action",
    steps: [{ actionId: "project.reset_project", params: {} }],
  },
  {
    utterance: "switch to citrus and hide pricing",
    sourceSurfaceId: designStudioSurfaceIds.editor,
    routeClass: "action chain",
    steps: [
      { actionId: "palette.apply_preset", params: { presetId: "citrus" } },
      { actionId: "section.set_visibility", params: { sectionId: "pricing", visible: false } },
    ],
  },
  {
    utterance: "switch posture to cautious",
    sourceSurfaceId: designStudioSurfaceIds.settings,
    routeClass: "single action",
    steps: [{ actionId: "policy.set_posture", params: { posture: "business-app" } }],
  },
] as const;

describe("scripted Design Studio intent router", () => {
  it("classifies the full documented action script against the live registry", () => {
    const { host, registry } = createHarness();
    const router = new ScriptedIntentRouter();

    for (const item of documentedCases) {
      const route = router.classify({
        intent: item.utterance,
        sourceSurfaceId: item.sourceSurfaceId,
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
        sourceSurfaceId: item.sourceSurfaceId,
        registry,
        state: host.getState(),
      }) as ActionIntentRoute;
      const run = engine.executeChain({
        intent: item.utterance,
        surfaceId: item.sourceSurfaceId,
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
      { utterance: "make the accent forest green", sourceSurfaceId: designStudioSurfaceIds.editor },
      { utterance: "switch to citrus", sourceSurfaceId: designStudioSurfaceIds.editor },
      { utterance: "use the modern font pairing", sourceSurfaceId: designStudioSurfaceIds.editor },
      { utterance: "hide pricing", sourceSurfaceId: designStudioSurfaceIds.editor },
      { utterance: "move social proof up", sourceSurfaceId: designStudioSurfaceIds.editor },
      { utterance: "apply the SaaS launch template", sourceSurfaceId: designStudioSurfaceIds.templates },
      {
        utterance: "apply the SaaS launch template and make the accent forest green",
        sourceSurfaceId: designStudioSurfaceIds.templates,
      },
      { utterance: "switch to citrus and hide pricing", sourceSurfaceId: designStudioSurfaceIds.editor },
    ];

    for (const { utterance, sourceSurfaceId } of safeUtterances) {
      const route = router.classify({
        intent: utterance,
        sourceSurfaceId,
        registry,
        state: host.getState(),
      }) as ActionIntentRoute;
      const actions = route.steps.map((step) => registry.requireAction(step.actionId));
      const decision = resolveChainPolicy(actions, {
        posture: "creative-tool",
        currentSurface: sourceSurfaceId,
      });

      expect(decision.requiredGate, utterance).toBeUndefined();
      expect(decision.finalMode, utterance).toBe("Instant execution");
    }
  });

  it("keeps export and reset behind one policy gate", () => {
    const { host, registry } = createHarness();
    const router = new ScriptedIntentRouter();

    const gatedCases = [
      { utterance: "export this mock page", sourceSurfaceId: designStudioSurfaceIds.editor },
      { utterance: "reset the project", sourceSurfaceId: designStudioSurfaceIds.settings },
    ];

    for (const { utterance, sourceSurfaceId } of gatedCases) {
      const route = router.classify({
        intent: utterance,
        sourceSurfaceId,
        registry,
        state: host.getState(),
      }) as ActionIntentRoute;
      const decision = resolveChainPolicy(
        route.steps.map((step) => registry.requireAction(step.actionId)),
        {
          posture: "creative-tool",
          currentSurface: sourceSurfaceId,
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

  it("executes the documented cross-surface chain by awaiting route registration", async () => {
    const { host, registry } = createHarness({
      liveSurfaces: [designStudioSurfaceIds.templates],
      registerOnNavigate: true,
    });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({
      registry,
      ledger,
      snapshotStore: createDesignStudioSnapshotAdapter(host),
      surfaceReadiness: new RegistrySurfaceReadiness(registry, 50),
    });
    const router = new ScriptedIntentRouter();
    const utterance = "apply the SaaS launch template and make the accent forest green";
    const route = router.classify({
      intent: utterance,
      sourceSurfaceId: designStudioSurfaceIds.templates,
      registry,
      state: host.getState(),
    }) as ActionIntentRoute;

    expect(registry.isSurfaceLive(designStudioSurfaceIds.editor)).toBe(false);
    expect(route.steps.map((step) => step.actionId)).toEqual([
      "template.apply_template",
      "surface.navigate_surface",
      "palette.set_color",
    ]);

    const result = await engine.executeChain({
      intent: utterance,
      surfaceId: designStudioSurfaceIds.templates,
      posture: "creative-tool",
      steps: route.steps,
    }).done;

    expect(result.status).toBe("succeeded");
    expect(host.getCurrentSurfaceId()).toBe(designStudioSurfaceIds.editor);
    expect(host.getState().activeTemplateId).toBe("saas-launch");
    expect(host.getState().palette.accent).toBe("#228B22");
    expect(result.record.disclosures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "cross_surface_wait" }),
        expect.objectContaining({ kind: "cross_surface_continue" }),
      ]),
    );
  });

  it("fails legibly when destination registration times out and keeps prefix undoable", async () => {
    const { host, registry } = createHarness({
      liveSurfaces: [designStudioSurfaceIds.templates],
    });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({
      registry,
      ledger,
      snapshotStore: createDesignStudioSnapshotAdapter(host),
      surfaceReadiness: new RegistrySurfaceReadiness(registry, 5),
    });
    const router = new ScriptedIntentRouter();
    const utterance = "apply the SaaS launch template and make the accent forest green";
    const route = router.classify({
      intent: utterance,
      sourceSurfaceId: designStudioSurfaceIds.templates,
      registry,
      state: host.getState(),
    }) as ActionIntentRoute;
    const run = engine.executeChain({
      intent: utterance,
      surfaceId: designStudioSurfaceIds.templates,
      posture: "creative-tool",
      steps: route.steps,
    });
    const result = await run.done;

    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("surface_readiness_timeout");
    expect(result.record.steps.map((step) => step.status)).toEqual([
      "succeeded",
      "succeeded",
      "failed",
    ]);
    expect(result.record.disclosures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "cross_surface_wait" }),
        expect.objectContaining({ kind: "cross_surface_failure" }),
      ]),
    );
    expect(result.record.steps.slice(0, 2).every((step) => "handleId" in step.undo)).toBe(true);
    expect(host.getState().activeTemplateId).toBe("saas-launch");
    expect(host.getCurrentSurfaceId()).toBe(designStudioSurfaceIds.editor);

    const undo = await run.undoAll();

    expect(undo.status).toBe("succeeded");
    expect(undo.undoneStepIds).toEqual(["step_2", "step_1"]);
    expect(host.getState().activeTemplateId).toBe("botanical-waitlist");
    expect(host.getCurrentSurfaceId()).toBe(designStudioSurfaceIds.templates);
  });

  it("resolves the same chain to gated suffix in creative posture and plan preview in business posture", async () => {
    const utterance = "apply the SaaS launch template and export this mock page";
    const { host, registry } = createHarness();
    const router = new ScriptedIntentRouter();
    const route = router.classify({
      intent: utterance,
      sourceSurfaceId: designStudioSurfaceIds.templates,
      registry,
      state: host.getState(),
    }) as ActionIntentRoute;
    const actions = route.steps.map((step) => registry.requireAction(step.actionId));
    const creativeDecision = resolveChainPolicy(actions, {
      posture: "creative-tool",
      currentSurface: designStudioSurfaceIds.templates,
    });
    const businessDecision = resolveChainPolicy(actions, {
      posture: "business-app",
      currentSurface: designStudioSurfaceIds.templates,
    });

    expect(route.steps.map((step) => step.actionId)).toEqual([
      "template.apply_template",
      "surface.navigate_surface",
      "project.export_project",
    ]);
    expect(creativeDecision.finalMode).toBe("Gated suffix");
    expect(creativeDecision.requiredGate).toEqual(
      expect.objectContaining({
        startIndex: 2,
        actionIds: ["project.export_project"],
      }),
    );
    expect(businessDecision.finalMode).toBe("Plan preview");
    expect(businessDecision.requiredGate).toEqual(
      expect.objectContaining({
        mode: "Plan preview",
        startIndex: 0,
        actionIds: [
          "template.apply_template",
          "surface.navigate_surface",
          "project.export_project",
        ],
      }),
    );

    const creative = createHarness({
      liveSurfaces: [designStudioSurfaceIds.templates],
      registerOnNavigate: true,
    });
    const creativeApproval = createManualApprovalController();
    const creativeEngine = new ExecutionEngine({
      registry: creative.registry,
      ledger: new InMemoryLedger(),
      snapshotStore: createDesignStudioSnapshotAdapter(creative.host),
      approvalHook: creativeApproval.hook,
      surfaceReadiness: new RegistrySurfaceReadiness(creative.registry, 50),
    });
    const creativeRoute = router.classify({
      intent: utterance,
      sourceSurfaceId: designStudioSurfaceIds.templates,
      registry: creative.registry,
      state: creative.host.getState(),
    }) as ActionIntentRoute;
    const creativeRun = creativeEngine.executeChain({
      intent: utterance,
      surfaceId: designStudioSurfaceIds.templates,
      posture: "creative-tool",
      steps: creativeRoute.steps,
    });
    const creativePending = await creativeApproval.waitForPendingRequest();

    expect(creativePending.mode).toBe("Gated suffix");
    expect(creativePending.heldSteps.map((step) => step.actionId)).toEqual([
      "project.export_project",
    ]);
    expect(creative.host.getState().activeTemplateId).toBe("saas-launch");
    expect(creative.host.getState().exportQuota.remaining).toBe(3);

    creativeApproval.approve("test export gate");
    await expect(creativeRun.done).resolves.toEqual(
      expect.objectContaining({ status: "succeeded" }),
    );
    expect(creative.host.getState().exportQuota.remaining).toBe(2);

    const business = createHarness({
      liveSurfaces: [designStudioSurfaceIds.templates],
      posture: "business-app",
      registerOnNavigate: true,
    });
    const businessApproval = createManualApprovalController();
    const businessEngine = new ExecutionEngine({
      registry: business.registry,
      ledger: new InMemoryLedger(),
      snapshotStore: createDesignStudioSnapshotAdapter(business.host),
      approvalHook: businessApproval.hook,
      surfaceReadiness: new RegistrySurfaceReadiness(business.registry, 50),
    });
    const businessRoute = router.classify({
      intent: utterance,
      sourceSurfaceId: designStudioSurfaceIds.templates,
      registry: business.registry,
      state: business.host.getState(),
    }) as ActionIntentRoute;
    const businessRun = businessEngine.executeChain({
      intent: utterance,
      surfaceId: designStudioSurfaceIds.templates,
      posture: "business-app",
      steps: businessRoute.steps,
    });
    const businessPending = await businessApproval.waitForPendingRequest();

    expect(businessPending.mode).toBe("Plan preview");
    expect(businessPending.heldSteps.map((step) => step.actionId)).toEqual([
      "template.apply_template",
      "surface.navigate_surface",
      "project.export_project",
    ]);
    expect(businessRun.getRecord().steps.map((step) => step.status)).toEqual([
      "held",
      "held",
      "held",
    ]);
    expect(business.host.getState().activeTemplateId).toBe("botanical-waitlist");
    expect(business.host.getState().exportQuota.remaining).toBe(3);

    businessApproval.approve("test plan apply");
    await expect(businessRun.done).resolves.toEqual(
      expect.objectContaining({ status: "succeeded" }),
    );
    expect(business.host.getState().activeTemplateId).toBe("saas-launch");
    expect(business.host.getState().exportQuota.remaining).toBe(2);
  });
});

interface HarnessOptions {
  liveSurfaces?: DesignStudioSurfaceId[];
  posture?: PosturePreset;
  registerOnNavigate?: boolean;
  navigationDelayMs?: number;
}

type ReducerBackedHost = DesignStudioCapabilityHost & {
  getCurrentSurfaceId: () => DesignStudioSurfaceId;
  setNavigationHandler: (handler?: (surfaceId: DesignStudioSurfaceId) => void) => void;
};

function createHarness(options: HarnessOptions = {}) {
  const host = createReducerBackedHost({ posture: options.posture });
  const registry = createDesignStudioRegistry(host);
  const liveSurfaces = options.liveSurfaces ?? Object.values(designStudioSurfaceIds);

  liveSurfaces.forEach((surfaceId) => {
    registry.registerSurface(surfaceId);
  });

  if (options.registerOnNavigate) {
    host.setNavigationHandler((surfaceId) => {
      Object.values(designStudioSurfaceIds).forEach((liveSurfaceId) => {
        registry.deregisterSurface(liveSurfaceId);
      });
      setTimeout(() => {
        registry.registerSurface(surfaceId);
      }, options.navigationDelayMs ?? 0);
    });
  }

  return { host, registry };
}

function createReducerBackedHost(
  options: { posture?: PosturePreset } = {},
): ReducerBackedHost {
  let state = createInitialDesignState();
  let posture = options.posture ?? "creative-tool";
  let currentSurfaceId: DesignStudioSurfaceId = designStudioSurfaceIds.editor;
  let navigationHandler: ((surfaceId: DesignStudioSurfaceId) => void) | undefined;
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
    getPosture: () => posture,
    setPosture: (nextPosture) => {
      posture = nextPosture;
    },
    navigateToSurface: (surfaceId) => {
      currentSurfaceId = surfaceId;
      navigationHandler?.(surfaceId);
    },
    getCurrentSurfaceId: () => currentSurfaceId,
    setNavigationHandler: (handler) => {
      navigationHandler = handler;
    },
    setters,
    getOrigin: () => "https://design-studio.test",
  };
}
