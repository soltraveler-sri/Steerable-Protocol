/**
 * Read-tool declarations for bounded inspection of design, template, and quota state.
 * Routers use these non-mutating queries when facts are insufficient for an informed action.
 */

import type { DesignState, ProjectMeta } from "../types";
import { defineReadTool, type ReadToolDeclaration } from "@steerable/core";
import {
  designStudioStateKeys,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
} from "./capabilityModel";
import {
  clonePalette,
  emptyObjectSchema,
  enumJsonSchema,
  parseEnum,
  projectTones,
  strictObjectSchema,
  surfacePrecondition,
  type EmptyParams,
} from "./declarationHelpers";

interface TemplateListParams {
  tone?: ProjectMeta["tone"];
}

const templateListParams = strictObjectSchema<TemplateListParams>(
  ["tone"],
  (input) => {
    if (input.tone === undefined) return {};
    return { tone: parseEnum(input.tone, projectTones, "tone") };
  },
  { tone: enumJsonSchema(projectTones) },
  [],
);

export function createDesignStudioReadTools(
  host: DesignStudioCapabilityHost,
): ReadToolDeclaration<any, any>[] {
  return [
    defineReadTool<EmptyParams, ReturnType<typeof summarizeCurrentDesign>>({
      id: "design.get_current_design",
      title: "Get current design",
      description: "Return a bounded summary of the current design state.",
      params: emptyObjectSchema,
      reads: [
        designStudioStateKeys.palette,
        designStudioStateKeys.typography,
        designStudioStateKeys.heroLayout,
        designStudioStateKeys.sections,
        designStudioStateKeys.template,
        designStudioStateKeys.projectMeta,
      ],
      preconditions: [],
      query: () => summarizeCurrentDesign(host.getState()),
      guidance:
        "Use before answering detailed questions about current palette, typography, sections, active template, or project metadata.",
      examples: [
        {
          user: "what design is currently applied?",
          params: {},
        },
      ],
    }),
    defineReadTool<TemplateListParams, ReturnType<typeof summarizeTemplates>>({
      id: "template.list_available",
      title: "List templates",
      description: "List available starting templates with bounded metadata.",
      params: templateListParams,
      reads: [designStudioStateKeys.template],
      preconditions: [surfacePrecondition(designStudioSurfaceIds.templates)],
      query: ({ tone }) => summarizeTemplates(host.getState(), tone),
      guidance:
        "Use when the user asks what templates exist, wants a style match, or names a template imprecisely before template.apply_template.",
      examples: [
        {
          user: "which templates are premium?",
          params: { tone: "premium" },
        },
        {
          user: "show me the available templates",
          params: {},
        },
      ],
    }),
    defineReadTool<EmptyParams, ReturnType<typeof summarizeQuota>>({
      id: "quota.get_status",
      title: "Get export quota status",
      description: "Return the current fake export quota status.",
      params: emptyObjectSchema,
      reads: [designStudioStateKeys.exportQuota],
      preconditions: [],
      query: () => summarizeQuota(host.getState()),
      guidance:
        "Use before proposing project.export_project when facts do not already show whether quota remains.",
      examples: [
        {
          user: "do I have exports left?",
          params: {},
        },
      ],
    }),
  ];
}

function summarizeCurrentDesign(state: DesignState) {
  return {
    project: { ...state.projectMeta },
    activeTemplateId: state.activeTemplateId,
    palette: clonePalette(state.palette),
    typography: { ...state.typography },
    heroLayout: state.heroLayout,
    sections: state.sections.map((section) => ({
      id: section.id,
      kind: section.kind,
      visible: section.visible,
      eyebrow: section.eyebrow,
      title: section.title,
      body: section.body,
    })),
  };
}

function summarizeTemplates(state: DesignState, tone?: ProjectMeta["tone"]) {
  const templates = state.templates
    .filter((template) => !tone || template.metaPatch.tone === tone)
    .map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      tone: template.metaPatch.tone,
      audience: template.metaPatch.audience,
      goal: template.metaPatch.goal,
      heroLayout: template.heroLayout,
      typography: { ...template.typography },
    }));
  return { activeTemplateId: state.activeTemplateId, templates };
}

function summarizeQuota(state: DesignState) {
  return {
    limit: state.exportQuota.limit,
    remaining: state.exportQuota.remaining,
    lastExportedAt: state.exportQuota.lastExportedAt,
    message: state.exportQuota.message,
    canExport: state.exportQuota.remaining > 0,
  };
}
