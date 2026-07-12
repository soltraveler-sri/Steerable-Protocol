/**
 * Navigation action declarations for moving between registered surfaces.
 * This domain shows how a router targets another surface without bypassing the registry.
 */

import { defineAction, type AnyActionDeclaration, type SurfaceId } from "@steerable/core";
import {
  designStudioStateKeys,
  type DesignStudioCapabilityHost,
  type DesignStudioSurfaceId,
} from "./capabilityModel";
import {
  designStudioSurfaceIdList,
  enumJsonSchema,
  isDesignStudioSurfaceId,
  parseEnum,
  strictObjectSchema,
} from "./declarationHelpers";

interface SurfaceNavigateParams {
  surfaceId: DesignStudioSurfaceId;
}

const surfaceNavigateParams = strictObjectSchema<SurfaceNavigateParams>(
  ["surfaceId"],
  (input) => ({
    surfaceId: parseEnum(input.surfaceId, designStudioSurfaceIdList, "surfaceId"),
  }),
  {
    surfaceId: enumJsonSchema(designStudioSurfaceIdList),
  },
  ["surfaceId"],
);

export function createNavigationActions(host: DesignStudioCapabilityHost): AnyActionDeclaration[] {
  return [
    defineAction<
      SurfaceNavigateParams,
      { surfaceId: DesignStudioSurfaceId; previousSurfaceId: SurfaceId }
    >({
      id: "surface.navigate_surface",
      title: "Navigate to surface",
      description: "Navigate to a declared Design Studio surface.",
      params: surfaceNavigateParams,
      reads: [designStudioStateKeys.route],
      writes: [designStudioStateKeys.route],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [],
      execute: ({ surfaceId }, context) => {
        const previousSurfaceId = context.surfaceId;

        host.navigateToSurface(surfaceId);
        return { surfaceId, previousSurfaceId };
      },
      undo: ({ result }) => {
        const previousSurfaceId = result?.previousSurfaceId;

        if (!isDesignStudioSurfaceId(previousSurfaceId)) {
          throw new Error("Navigation undo requires a previous Design Studio surface.");
        }

        host.navigateToSurface(previousSurfaceId);
        return { surfaceId: previousSurfaceId };
      },
      guidance:
        "Use inside a cross-surface chain when the next declared action lives on a different Design Studio surface. In-app route changes are local, safe, and undoable through ordinary navigation.",
      examples: [
        {
          user: "open settings",
          params: { surfaceId: "settings" },
        },
      ],
    }),
  ];
}
