/**
 * Shared declaration vocabulary for the Design Studio integration.
 * Domain modules use these IDs and host adapters to describe capabilities without owning UI state.
 */

import type { DesignSetters } from "../state/designStore";
import type { DesignState } from "../types";
import type { PosturePreset, StateKey } from "@steerable/core";

export const designStudioSurfaceIds = {
  editor: "editor",
  templates: "templates",
  settings: "settings",
} as const;

export type DesignStudioSurfaceId =
  (typeof designStudioSurfaceIds)[keyof typeof designStudioSurfaceIds];

export const designStudioStateKeys = {
  route: "ui.route",
  posture: "policy.posture",
  palette: "design.palette",
  typography: "design.typography",
  heroLayout: "design.hero_layout",
  sections: "design.sections",
  sectionOrder: "design.sections.order",
  sectionVisibility: "design.sections.visibility",
  sectionCopy: "design.sections.copy",
  template: "design.template",
  projectMeta: "project.meta",
  shareLink: "project.share_link",
  shareStatus: "project.share_status",
  exportQuota: "project.export_quota",
  clipboard: "browser.clipboard",
} as const satisfies Record<string, StateKey>;

export const designStudioRedactionPolicy =
  "No Design Studio declaration currently accepts sensitive parameters. If a future declaration sets effects.sensitive true, ledger and eval exports redact the entire params payload for that action rather than attempting field-level partial redaction.";

export interface DesignStudioCapabilityHost {
  getState: () => DesignState;
  getPosture: () => PosturePreset;
  setPosture: (posture: PosturePreset) => void;
  navigateToSurface: (surfaceId: DesignStudioSurfaceId) => void;
  setters: DesignSetters;
  getOrigin?: () => string;
}
