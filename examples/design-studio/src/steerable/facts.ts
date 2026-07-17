/**
 * Fact declarations publish small, surface-specific router context.
 * Each publisher exposes stable semantic data rather than DOM-derived presentation details.
 */

import { defineFacts } from "@steerable/core";
import { designStudioSurfaceIds, type DesignStudioCapabilityHost } from "./capabilityModel";
import {
  buildShareLink,
  enumJsonSchema,
  fact,
  heroLayouts,
  nullableStringSchema,
  paletteSummary,
  paletteSummarySchema,
  projectTones,
  stringArraySchema,
  typographySummarySchema,
} from "./declarationHelpers";

export function createDesignStudioFacts(host: DesignStudioCapabilityHost) {
  return [
    defineFacts({
      id: "editor.current_facts",
      title: "Editor facts",
      description: "Curated context for the Editor surface.",
      surface: designStudioSurfaceIds.editor,
      facts: [
        fact("ui.route", "The current route path.", { type: "string" }),
        fact("project.name", "The current project name.", { type: "string" }),
        fact("project.goal", "The current page goal.", { type: "string" }),
        fact("design.selection", "The current broad editing target.", { type: "string" }),
        fact("design.palette.summary", "Current palette token values.", paletteSummarySchema()),
        fact("design.typography.summary", "Current typography choices.", typographySummarySchema()),
        fact("design.hero_layout", "Current hero layout.", enumJsonSchema(heroLayouts)),
        fact(
          "design.sections.visible_ids",
          "Visible section IDs in page order.",
          stringArraySchema(),
        ),
        fact("design.sections.order", "All section IDs in page order.", stringArraySchema()),
        fact("design.template.active_id", "The active template ID.", { type: "string" }),
        fact("quota.exports_remaining", "Remaining fake exports this session.", { type: "number" }),
        fact("policy.posture", "Current example posture preset.", { type: "string" }),
      ],
      publish: () => editorFacts(host),
      update: "material_change",
    }),
    defineFacts({
      id: "templates.current_facts",
      title: "Templates facts",
      description: "Curated context for the Templates surface.",
      surface: designStudioSurfaceIds.templates,
      facts: [
        fact("ui.route", "The current route path.", { type: "string" }),
        fact("template.active_id", "The currently active template ID.", { type: "string" }),
        fact("template.count", "Number of templates in the gallery.", { type: "number" }),
        fact(
          "template.available_ids",
          "Template IDs available on this surface.",
          stringArraySchema(),
        ),
        fact(
          "template.current_tone",
          "Tone implied by the active project metadata.",
          enumJsonSchema(projectTones),
        ),
        fact("project.audience", "Current target audience.", { type: "string" }),
        fact("design.palette.summary", "Current palette token values.", paletteSummarySchema()),
        fact("design.typography.summary", "Current typography choices.", typographySummarySchema()),
        fact("design.hero_layout", "Current hero layout.", enumJsonSchema(heroLayouts)),
        fact("quota.exports_remaining", "Remaining fake exports this session.", { type: "number" }),
        fact("policy.posture", "Current example posture preset.", { type: "string" }),
      ],
      publish: () => templatesFacts(host),
      update: "material_change",
    }),
    defineFacts({
      id: "settings.current_facts",
      title: "Settings facts",
      description: "Curated context for the Settings surface.",
      surface: designStudioSurfaceIds.settings,
      facts: [
        fact("ui.route", "The current route path.", { type: "string" }),
        fact("project.name", "The current project name.", { type: "string" }),
        fact("project.audience", "Current target audience.", { type: "string" }),
        fact("project.goal", "Current page goal.", { type: "string" }),
        fact("project.tone", "Current project tone.", enumJsonSchema(projectTones)),
        fact("project.share_slug", "Current share slug.", { type: "string" }),
        fact("project.share_url", "Current derived share URL.", { type: "string" }),
        fact("quota.exports_remaining", "Remaining fake exports this session.", { type: "number" }),
        fact("quota.limit", "Fake export quota limit for this session.", { type: "number" }),
        fact("quota.last_exported_at", "Last mock export time, if any.", nullableStringSchema()),
        fact("share.status", "Current share-link status message.", { type: "string" }),
        fact("policy.posture", "Current example posture preset.", { type: "string" }),
      ],
      publish: () => settingsFacts(host),
      update: "material_change",
    }),
  ];
}

function editorFacts(host: DesignStudioCapabilityHost) {
  const state = host.getState();
  return {
    "ui.route": "/",
    "project.name": state.projectMeta.name,
    "project.goal": state.projectMeta.goal,
    "design.selection": "landing-page",
    "design.palette.summary": paletteSummary(state.palette),
    "design.typography.summary": { ...state.typography },
    "design.hero_layout": state.heroLayout,
    "design.sections.visible_ids": state.sections
      .filter((section) => section.visible)
      .map((section) => section.id),
    "design.sections.order": state.sections.map((section) => section.id),
    "design.template.active_id": state.activeTemplateId,
    "quota.exports_remaining": state.exportQuota.remaining,
    "policy.posture": host.getPosture(),
  };
}

function templatesFacts(host: DesignStudioCapabilityHost) {
  const state = host.getState();
  return {
    "ui.route": "/templates",
    "template.active_id": state.activeTemplateId,
    "template.count": state.templates.length,
    "template.available_ids": state.templates.map((template) => template.id),
    "template.current_tone": state.projectMeta.tone,
    "project.audience": state.projectMeta.audience,
    "design.palette.summary": paletteSummary(state.palette),
    "design.typography.summary": { ...state.typography },
    "design.hero_layout": state.heroLayout,
    "quota.exports_remaining": state.exportQuota.remaining,
    "policy.posture": host.getPosture(),
  };
}

function settingsFacts(host: DesignStudioCapabilityHost) {
  const state = host.getState();
  return {
    "ui.route": "/settings",
    "project.name": state.projectMeta.name,
    "project.audience": state.projectMeta.audience,
    "project.goal": state.projectMeta.goal,
    "project.tone": state.projectMeta.tone,
    "project.share_slug": state.projectMeta.shareSlug,
    "project.share_url": buildShareLink(host),
    "quota.exports_remaining": state.exportQuota.remaining,
    "quota.limit": state.exportQuota.limit,
    "quota.last_exported_at": state.exportQuota.lastExportedAt,
    "share.status": state.shareMessage,
    "policy.posture": host.getPosture(),
  };
}
