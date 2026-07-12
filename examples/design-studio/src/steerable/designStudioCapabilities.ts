/**
 * Public entry point for the Design Studio capability registry.
 * It composes domain declarations and preserves one stable import path for integrators.
 */

import { CapabilityRegistry, type RegistryDeclarations } from "@steerable/core";
import {
  designStudioRedactionPolicy,
  designStudioStateKeys,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
  type DesignStudioSurfaceId,
} from "./capabilityModel";
import { createEditorActions } from "./editorActions";
import { createDesignStudioFacts } from "./facts";
import { createNavigationActions } from "./navigationActions";
import { createProjectActions } from "./projectActions";
import { createDesignStudioReadTools } from "./readTools";
import { createDesignStudioSnapshotAdapter } from "./snapshotAdapter";
import { createDesignStudioSurfaces } from "./surfaces";

export {
  createDesignStudioSnapshotAdapter,
  designStudioRedactionPolicy,
  designStudioStateKeys,
  designStudioSurfaceIds,
};
export type { DesignStudioCapabilityHost, DesignStudioSurfaceId };

export function createDesignStudioRegistry(host: DesignStudioCapabilityHost): CapabilityRegistry {
  return new CapabilityRegistry(createDesignStudioDeclarations(host));
}

export function createDesignStudioDeclarations(
  host: DesignStudioCapabilityHost,
): RegistryDeclarations {
  const actions = [
    ...createNavigationActions(host),
    ...createEditorActions(host),
    ...createProjectActions(host),
  ];
  const readTools = createDesignStudioReadTools(host);
  const facts = createDesignStudioFacts(host);
  const surfaces = createDesignStudioSurfaces({
    actionIds: actions.map((action) => action.id),
    readToolIds: readTools.map((readTool) => readTool.id),
    factIds: facts.map((fact) => fact.id),
  });

  return {
    actions,
    readTools,
    facts,
    surfaces,
  };
}
