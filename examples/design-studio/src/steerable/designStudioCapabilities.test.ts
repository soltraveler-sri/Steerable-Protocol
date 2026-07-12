/**
 * Registry contract tests for the reference capability declarations.
 * They pin public IDs, schemas, policy metadata, facts, surfaces, and store-backed behavior.
 */

import { describe, expect, it } from "vitest";
import {
  applyDesignStoreEvent,
  createInitialDesignState,
  type DesignSetters,
  type DesignStoreEvent,
} from "../state/designStore";
import type { ProjectMeta } from "../types";
import {
  ExecutionEngine,
  InMemoryLedger,
  createEcosystemAdapter,
  type CapabilityRegistry,
  type CompiledReadToolDeclaration,
  type PosturePreset,
} from "@steerable/core";
import {
  createDesignStudioRegistry,
  createDesignStudioSnapshotAdapter,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
} from "./designStudioCapabilities";

function createReducerBackedHost(): DesignStudioCapabilityHost {
  let state = createInitialDesignState();
  let posture: PosturePreset = "creative-tool";
  const dispatch = (event: DesignStoreEvent) => {
    state = applyDesignStoreEvent(state, event);
  };
  const setters: DesignSetters = {
    setPaletteToken: (token, value) => dispatch({ type: "paletteTokenSet", token, value }),
    applyPalettePreset: (presetId) => dispatch({ type: "palettePresetApplied", presetId }),
    setFontPairing: (value) => dispatch({ type: "fontPairingSet", value }),
    setTypeScale: (value) => dispatch({ type: "typeScaleSet", value }),
    setHeroLayout: (value) => dispatch({ type: "heroLayoutSet", value }),
    toggleSectionVisibility: (sectionId) =>
      dispatch({ type: "sectionVisibilityToggled", sectionId }),
    moveSection: (sectionId, direction) => dispatch({ type: "sectionMoved", sectionId, direction }),
    updateSectionText: (sectionId, field, value) =>
      dispatch({ type: "sectionTextUpdated", sectionId, field, value }),
    applyTemplate: (templateId) => dispatch({ type: "templateApplied", templateId }),
    updateProjectMeta: (field, value) => dispatch({ type: "projectMetaUpdated", field, value }),
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
    navigateToSurface: () => undefined,
    setters,
    getOrigin: () => "https://design-studio.test",
  };
}

function liveActionIds(registry: CapabilityRegistry, surfaceId: string): string[] {
  return registry.getLiveActions(surfaceId).map((action) => action.id);
}

function liveReadToolIds(registry: CapabilityRegistry, surfaceId: string): string[] {
  return registry.getLiveReadTools(surfaceId).map((readTool) => readTool.id);
}

describe("Design Studio capability declarations", () => {
  it("registers the required action, read tool, facts, and surface coverage", () => {
    const registry = createDesignStudioRegistry(createReducerBackedHost());
    const actions = registry.getAllActions();
    const riskCounts = countBy(actions, (action) => action.risk);
    const reversibilityCounts = countBy(actions, (action) => action.reversibility.kind);

    expect(actions).toHaveLength(15);
    expect(registry.getAllReadTools()).toHaveLength(3);
    expect(registry.getAllFacts()).toHaveLength(3);
    expect(registry.getAllSurfaces().map((surface) => surface.id)).toEqual([
      "editor",
      "templates",
      "settings",
    ]);
    expect(riskCounts).toEqual({
      safe: 12,
      side_effect: 1,
      mutating: 1,
      destructive: 1,
    });
    expect(reversibilityCounts).toEqual({
      undoable: 10,
      snapshot: 3,
      irreversible: 2,
    });
    expect(actions.every((action) => action.externalExposure === "none")).toBe(true);
    expect(
      registry.getAllReadTools().every((readTool) => readTool.externalExposure === "none"),
    ).toBe(true);
  });

  it("queries live actions, read tools, and facts by surface", () => {
    const registry = createDesignStudioRegistry(createReducerBackedHost());

    expect(liveActionIds(registry, designStudioSurfaceIds.editor)).toEqual([]);

    registry.registerSurface(designStudioSurfaceIds.editor);
    expect(liveActionIds(registry, designStudioSurfaceIds.editor)).toEqual([
      "surface.navigate_surface",
      "palette.set_color",
      "palette.apply_preset",
      "typography.set_pairing",
      "typography.set_scale",
      "layout.set_hero",
      "section.set_visibility",
      "section.move_section",
      "section.update_copy",
      "project.export_project",
    ]);
    expect(liveReadToolIds(registry, designStudioSurfaceIds.editor)).toEqual([
      "design.get_current_design",
      "quota.get_status",
    ]);
    expect(registry.getLiveFacts(designStudioSurfaceIds.editor).map((facts) => facts.id)).toEqual([
      "editor.current_facts",
    ]);

    registry.registerSurface(designStudioSurfaceIds.templates);
    expect(liveActionIds(registry, designStudioSurfaceIds.templates)).toEqual([
      "surface.navigate_surface",
      "template.apply_template",
    ]);
    expect(liveReadToolIds(registry, designStudioSurfaceIds.templates)).toEqual([
      "design.get_current_design",
      "template.list_available",
    ]);

    registry.registerSurface(designStudioSurfaceIds.settings);
    expect(liveActionIds(registry, designStudioSurfaceIds.settings)).toEqual([
      "surface.navigate_surface",
      "project.update_meta",
      "policy.set_posture",
      "share.copy_link",
      "project.export_project",
      "project.reset_project",
    ]);
    expect(liveReadToolIds(registry, designStudioSurfaceIds.settings)).toEqual([
      "design.get_current_design",
      "quota.get_status",
    ]);
  });

  it("requires every mutating or destructive action to have a gate or undo path", () => {
    const registry = createDesignStudioRegistry(createReducerBackedHost());
    const mutatingOrDestructive = registry
      .getAllActions()
      .filter((action) => action.risk === "mutating" || action.risk === "destructive");

    expect(mutatingOrDestructive.map((action) => action.id)).toEqual([
      "project.export_project",
      "project.reset_project",
    ]);

    mutatingOrDestructive.forEach((action) => {
      const hasGate = action.confirmation !== "never" || action.effects.cost !== "none";
      const hasUndoPath = action.reversibility.kind !== "irreversible";

      expect(hasGate || hasUndoPath, action.id).toBe(true);
    });
  });

  it("keeps facts bounded and publishes only declared fact keys", async () => {
    const registry = createDesignStudioRegistry(createReducerBackedHost());

    for (const facts of registry.getAllFacts()) {
      expect(facts.facts.length, facts.id).toBeLessThanOrEqual(12);
      expect(Object.keys(await facts.publish())).toEqual(facts.facts.map((entry) => entry.key));
    }
  });

  it("executes the north-star palette.set_color action against the real reducer store", async () => {
    const host = createReducerBackedHost();
    const registry = createDesignStudioRegistry(host);
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({
      registry,
      ledger,
      snapshotStore: createDesignStudioSnapshotAdapter(host),
    });

    registry.registerSurface(designStudioSurfaceIds.editor);

    const action = registry.requireAction("palette.set_color");
    expect(action).toEqual(
      expect.objectContaining({
        id: "palette.set_color",
        risk: "safe",
        reversibility: { kind: "undoable" },
        effects: { external: false, cost: "none", sensitive: false },
        confirmation: "never",
        reads: ["design.palette"],
        writes: ["design.palette"],
        preconditions: ["surface:editor"],
      }),
    );
    expect(() =>
      registry.validateActionParams(action, {
        token: "accent",
        hex: "#FF6600",
        extra: true,
      }),
    ).toThrow(/Unexpected parameter/);

    const result = await engine.executeAction({
      intent: "make the accent #FF6600",
      surfaceId: designStudioSurfaceIds.editor,
      posture: "creative-tool",
      actionId: "palette.set_color",
      params: { token: "accent", hex: "#FF6600" },
    });

    expect(result.status).toBe("succeeded");
    expect(host.getState().palette.accent).toBe("#FF6600");
    expect(result.record.steps[0].undo).toEqual(
      expect.objectContaining({
        actionId: "palette.set_color",
        mechanism: "declared_inverse",
        restoration: "full",
        status: "available",
      }),
    );
  });

  it("read tools return bounded live store summaries", async () => {
    const host = createReducerBackedHost();
    const registry = createDesignStudioRegistry(host);
    const designTool = requireReadTool(registry, "design.get_current_design");
    const templatesTool = requireReadTool(registry, "template.list_available");
    const quotaTool = requireReadTool(registry, "quota.get_status");

    host.setters.updateProjectMeta("tone", "premium");
    host.setters.exportProject();

    await expect(
      Promise.resolve(designTool.query({}, { surfaceId: designStudioSurfaceIds.editor })),
    ).resolves.toEqual(
      expect.objectContaining({
        activeTemplateId: "botanical-waitlist",
        project: expect.objectContaining({ tone: "premium" as ProjectMeta["tone"] }),
        sections: expect.arrayContaining([expect.objectContaining({ id: "hero", visible: true })]),
      }),
    );
    await expect(
      Promise.resolve(
        templatesTool.query({ tone: "premium" }, { surfaceId: designStudioSurfaceIds.templates }),
      ),
    ).resolves.toEqual({
      activeTemplateId: "botanical-waitlist",
      templates: [
        expect.objectContaining({
          id: "atelier-drop",
          tone: "premium",
        }),
      ],
    });
    await expect(
      Promise.resolve(quotaTool.query({}, { surfaceId: designStudioSurfaceIds.settings })),
    ).resolves.toEqual(
      expect.objectContaining({
        limit: 3,
        remaining: 2,
        canExport: true,
      }),
    );
  });

  it("exports JSON schemas for every Design Studio action through the ecosystem adapter", () => {
    const registry = createDesignStudioRegistry(createReducerBackedHost());
    const adapter = createEcosystemAdapter(registry, "creative-tool");

    expect(Object.keys(adapter.toolSchemas).sort()).toEqual(
      registry
        .getAllActions()
        .map((action) => action.id)
        .sort(),
    );
    expect(Object.values(adapter.toolSchemas).every((tool) => tool.inputSchema !== undefined)).toBe(
      true,
    );
  });
});

function countBy<T>(values: T[], getKey: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = getKey(value);

    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function requireReadTool(registry: CapabilityRegistry, id: string): CompiledReadToolDeclaration {
  const readTool = registry.getReadTool(id);

  if (!readTool) {
    throw new Error(`Missing read tool "${id}".`);
  }

  return readTool;
}

function fixedNow(): Date {
  return new Date("2026-07-08T12:00:00.000Z");
}
