/**
 * Surface declarations group capabilities by where they are available.
 * Registry composition passes known IDs in so a typo fails during startup instead of at execution time.
 */

import { defineSurface, type CapabilityId } from "@steerable/core";
import { designStudioSurfaceIds } from "./capabilityModel";

export function createDesignStudioSurfaces(ids: {
  actionIds: CapabilityId[];
  readToolIds: CapabilityId[];
  factIds: CapabilityId[];
}) {
  const action = (id: CapabilityId) => {
    if (!ids.actionIds.includes(id)) {
      throw new Error(`Unknown action id "${id}".`);
    }

    return id;
  };
  const readTool = (id: CapabilityId) => {
    if (!ids.readToolIds.includes(id)) {
      throw new Error(`Unknown read tool id "${id}".`);
    }

    return id;
  };
  const facts = (id: CapabilityId) => {
    if (!ids.factIds.includes(id)) {
      throw new Error(`Unknown facts id "${id}".`);
    }

    return id;
  };

  return [
    defineSurface({
      id: designStudioSurfaceIds.editor,
      title: "Editor",
      description: "Brand kit, section, layout, and live preview editing surface.",
      capabilities: [
        action("surface.navigate_surface"),
        action("palette.set_color"),
        action("palette.apply_preset"),
        action("typography.set_pairing"),
        action("typography.set_scale"),
        action("layout.set_hero"),
        action("section.set_visibility"),
        action("section.move_section"),
        action("section.update_copy"),
        action("project.export_project"),
        readTool("design.get_current_design"),
        readTool("quota.get_status"),
        facts("editor.current_facts"),
      ],
      location: { path: "/", label: "Editor" },
    }),
    defineSurface({
      id: designStudioSurfaceIds.templates,
      title: "Templates",
      description: "Starting direction gallery for applying complete template states.",
      capabilities: [
        action("surface.navigate_surface"),
        action("template.apply_template"),
        readTool("design.get_current_design"),
        readTool("template.list_available"),
        facts("templates.current_facts"),
      ],
      location: { path: "/templates", label: "Templates" },
    }),
    defineSurface({
      id: designStudioSurfaceIds.settings,
      title: "Settings",
      description: "Project metadata, share link, export quota, and reset operations surface.",
      capabilities: [
        action("surface.navigate_surface"),
        action("policy.set_posture"),
        action("project.update_meta"),
        action("share.copy_link"),
        action("project.export_project"),
        action("project.reset_project"),
        readTool("design.get_current_design"),
        readTool("quota.get_status"),
        facts("settings.current_facts"),
      ],
      location: { path: "/settings", label: "Settings" },
    }),
  ];
}
