/**
 * Project action declarations for templates, metadata, posture, sharing, export, and reset.
 * This domain makes side effects, quota cost, confirmation, and snapshot restoration explicit.
 */

import type { DesignState, ProjectMeta } from "../types";
import { defineAction, type AnyActionDeclaration, type PosturePreset } from "@steerable/core";
import {
  designStudioStateKeys,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
} from "./capabilityModel";
import {
  buildShareLink,
  emptyObjectSchema,
  enumJsonSchema,
  parseEnum,
  parseNonEmptyString,
  parseString,
  projectTones,
  strictObjectSchema,
  surfacePrecondition,
  type EmptyParams,
} from "./declarationHelpers";

interface TemplateApplyParams {
  templateId: string;
}
interface ProjectUpdateMetaParams {
  field: keyof ProjectMeta;
  value: string;
}
interface PolicySetPostureParams {
  posture: Extract<PosturePreset, "creative-tool" | "business-app">;
}

const projectMetaFields = [
  "name",
  "audience",
  "goal",
  "tone",
  "shareSlug",
] as const satisfies readonly (keyof ProjectMeta)[];
const demoPostures = ["creative-tool", "business-app"] as const satisfies readonly Extract<
  PosturePreset,
  "creative-tool" | "business-app"
>[];

const templateApplyParams = strictObjectSchema<TemplateApplyParams>(
  ["templateId"],
  (input) => ({ templateId: parseNonEmptyString(input.templateId, "templateId") }),
  { templateId: { type: "string", minLength: 1 } },
  ["templateId"],
);
const projectUpdateMetaParams = strictObjectSchema<ProjectUpdateMetaParams>(
  ["field", "value"],
  (input) => {
    const field = parseEnum(input.field, projectMetaFields, "field");
    const value = parseString(input.value, "value");
    if (field === "tone") parseEnum(value, projectTones, "value");
    return { field, value };
  },
  { field: enumJsonSchema(projectMetaFields), value: { type: "string" } },
  ["field", "value"],
);
const policySetPostureParams = strictObjectSchema<PolicySetPostureParams>(
  ["posture"],
  (input) => ({ posture: parseEnum(input.posture, demoPostures, "posture") }),
  { posture: enumJsonSchema(demoPostures) },
  ["posture"],
);

function requireTemplate(state: DesignState, templateId: string): void {
  if (!state.templates.some((template) => template.id === templateId)) {
    throw new Error(`Unknown template "${templateId}".`);
  }
}

export function createProjectActions(host: DesignStudioCapabilityHost): AnyActionDeclaration[] {
  return [
    defineAction<TemplateApplyParams, { templateId: string }>({
      id: "template.apply_template",
      title: "Apply template",
      description: "Apply a complete starting direction to the current project.",
      params: templateApplyParams,
      reads: [
        designStudioStateKeys.template,
        designStudioStateKeys.palette,
        designStudioStateKeys.typography,
        designStudioStateKeys.heroLayout,
        designStudioStateKeys.sections,
        designStudioStateKeys.projectMeta,
        designStudioStateKeys.exportQuota,
      ],
      writes: [
        designStudioStateKeys.template,
        designStudioStateKeys.palette,
        designStudioStateKeys.typography,
        designStudioStateKeys.heroLayout,
        designStudioStateKeys.sections,
        designStudioStateKeys.projectMeta,
        designStudioStateKeys.exportQuota,
      ],
      risk: "safe",
      reversibility: { kind: "snapshot" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.templates)],
      execute: ({ templateId }) => {
        requireTemplate(host.getState(), templateId);
        host.setters.applyTemplate(templateId);
        return { templateId };
      },
      guidance:
        "Use when the user asks for a named starting direction or a whole-page restyle. Snapshot restoration is used because palette, type, layout, sections, active template, and metadata change together.",
      examples: [
        {
          user: "apply the SaaS launch template",
          params: { templateId: "saas-launch" },
        },
      ],
    }),
    defineAction<ProjectUpdateMetaParams, { field: keyof ProjectMeta; previousValue: string }>({
      id: "project.update_meta",
      title: "Update project metadata",
      description: "Update one project detail used by the preview and share link.",
      params: projectUpdateMetaParams,
      reads: [designStudioStateKeys.projectMeta],
      writes: [designStudioStateKeys.projectMeta, designStudioStateKeys.shareLink],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.settings)],
      execute: ({ field, value }) => {
        const previousValue = host.getState().projectMeta[field];

        host.setters.updateProjectMeta(field, value);
        return { field, previousValue };
      },
      undo: ({ result }) => {
        if (!result?.field) {
          throw new Error("Project metadata undo requires the previous field value.");
        }

        host.setters.updateProjectMeta(result.field, result.previousValue);
        return { field: result.field, value: result.previousValue };
      },
      guidance:
        "Use for one Settings metadata field: name, audience, goal, tone, or share slug. Use share.copy_link only when the user wants the link copied.",
      examples: [
        {
          user: "set the audience to product marketers",
          params: { field: "audience", value: "product marketers" },
        },
        {
          user: "make the project tone direct",
          params: { field: "tone", value: "direct" },
        },
      ],
    }),
    defineAction<
      PolicySetPostureParams,
      { posture: PosturePreset; previousPosture: PosturePreset }
    >({
      id: "policy.set_posture",
      title: "Set steering posture",
      description: "Switch the Design Studio steering posture.",
      params: policySetPostureParams,
      reads: [designStudioStateKeys.posture],
      writes: [designStudioStateKeys.posture],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.settings)],
      execute: ({ posture }) => {
        const previousPosture = host.getPosture();

        host.setPosture(posture);
        return { posture, previousPosture };
      },
      undo: ({ result }) => {
        if (!result?.previousPosture) {
          throw new Error("Posture undo requires the previous posture.");
        }

        host.setPosture(result.previousPosture);
        return { posture: result.previousPosture };
      },
      guidance:
        "Use when the user changes the runtime posture between the default creative tool and the cautious business-app policy preset.",
      examples: [
        {
          user: "switch posture to cautious",
          params: { posture: "business-app" },
        },
        {
          user: "switch posture to creative tool",
          params: { posture: "creative-tool" },
        },
      ],
    }),
    defineAction<EmptyParams, { link: string }>({
      id: "share.copy_link",
      title: "Copy share link",
      description: "Copy the current preview share link to the browser clipboard.",
      params: emptyObjectSchema,
      reads: [designStudioStateKeys.projectMeta, designStudioStateKeys.shareLink],
      writes: [designStudioStateKeys.clipboard, designStudioStateKeys.shareStatus],
      // Clipboard writes cross the app boundary and cannot be reversed by restoring app state.
      risk: "side_effect",
      reversibility: { kind: "irreversible" },
      effects: { external: true, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.settings)],
      execute: async () => {
        const link = buildShareLink(host);

        await host.setters.copyShareLink();
        return { link };
      },
      guidance:
        "Use only when the user asks to copy the current share link. This writes to the browser clipboard and cannot honestly be undone.",
      examples: [
        {
          user: "copy the share link",
          params: {},
        },
      ],
    }),
    defineAction<
      EmptyParams,
      { spentQuota: boolean; remainingBefore: number; remainingAfter: number }
    >({
      id: "project.export_project",
      title: "Export project",
      description: "Run the mock export and spend one fake export quota unit when available.",
      params: emptyObjectSchema,
      reads: [designStudioStateKeys.exportQuota, designStudioStateKeys.projectMeta],
      writes: [designStudioStateKeys.exportQuota],
      risk: "mutating",
      reversibility: { kind: "irreversible" },
      effects: { external: false, cost: "quota", sensitive: false },
      confirmation: "policy",
      preconditions: [],
      execute: () => {
        const remainingBefore = host.getState().exportQuota.remaining;

        host.setters.exportProject();

        const remainingAfter = host.getState().exportQuota.remaining;

        return {
          spentQuota: remainingAfter < remainingBefore,
          remainingBefore,
          remainingAfter,
        };
      },
      guidance:
        "Use when the user explicitly asks to export the mock project. Check quota.get_status first when quota availability is not already clear from facts.",
      examples: [
        {
          user: "export this mock page",
          params: {},
        },
      ],
    }),
    defineAction<EmptyParams, { reset: true }>({
      id: "project.reset_project",
      title: "Reset project",
      description:
        "Reset the design and project metadata to the starter state while keeping export quota.",
      params: emptyObjectSchema,
      reads: [
        designStudioStateKeys.palette,
        designStudioStateKeys.typography,
        designStudioStateKeys.heroLayout,
        designStudioStateKeys.sections,
        designStudioStateKeys.template,
        designStudioStateKeys.projectMeta,
        designStudioStateKeys.exportQuota,
      ],
      writes: [
        designStudioStateKeys.palette,
        designStudioStateKeys.typography,
        designStudioStateKeys.heroLayout,
        designStudioStateKeys.sections,
        designStudioStateKeys.template,
        designStudioStateKeys.projectMeta,
        designStudioStateKeys.shareLink,
        designStudioStateKeys.shareStatus,
        designStudioStateKeys.exportQuota,
      ],
      risk: "destructive",
      reversibility: { kind: "snapshot" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "always",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.settings)],
      execute: () => {
        host.setters.resetProject();
        return { reset: true };
      },
      guidance:
        "Use only when the user clearly asks to reset the project. It is destructive because it overwrites the current design and metadata, even though a runtime snapshot can restore the local session.",
      examples: [
        {
          user: "reset this project to the starter design",
          params: {},
        },
      ],
    }),
  ];
}
