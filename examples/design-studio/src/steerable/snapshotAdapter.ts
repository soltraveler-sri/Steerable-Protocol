/**
 * State snapshot adapter for snapshot-reversible declarations.
 * It translates protocol state keys into the example store and restores only captured domains.
 */

import type { DesignState, HeroLayout, LandingSection, Palette, ProjectMeta } from "../types";
import type { StateKey, StateSnapshot, StateSnapshotAdapter } from "@steerable/core";
import { designStudioStateKeys, type DesignStudioCapabilityHost } from "./capabilityModel";

export function createDesignStudioSnapshotAdapter(
  host: DesignStudioCapabilityHost,
  now: () => Date = () => new Date(),
): StateSnapshotAdapter {
  return {
    capture(keys) {
      const state = host.getState();
      const values = Object.fromEntries(keys.map((key) => [key, readStateKey(state, key)]));

      return {
        capturedAt: now().toISOString(),
        keys: [...keys],
        values,
      };
    },
    restore(snapshot) {
      restoreSnapshot(host, snapshot);
    },
  };
}

function readStateKey(state: DesignState, key: StateKey): unknown {
  switch (key) {
    case designStudioStateKeys.palette:
      return clonePalette(state.palette);
    case designStudioStateKeys.typography:
      return { ...state.typography };
    case designStudioStateKeys.heroLayout:
      return state.heroLayout;
    case designStudioStateKeys.sections:
      return cloneSections(state.sections);
    case designStudioStateKeys.sectionOrder:
      return state.sections.map((section) => section.id);
    case designStudioStateKeys.sectionVisibility:
      return Object.fromEntries(state.sections.map((section) => [section.id, section.visible]));
    case designStudioStateKeys.sectionCopy:
      return Object.fromEntries(
        state.sections.map((section) => [
          section.id,
          {
            eyebrow: section.eyebrow,
            title: section.title,
            body: section.body,
          },
        ]),
      );
    case designStudioStateKeys.template:
      return state.activeTemplateId;
    case designStudioStateKeys.projectMeta:
      return cloneProjectMeta(state.projectMeta);
    case designStudioStateKeys.shareStatus:
      return state.shareMessage;
    case designStudioStateKeys.exportQuota:
      return { ...state.exportQuota };
    default:
      return undefined;
  }
}

function restoreSnapshot(host: DesignStudioCapabilityHost, snapshot: StateSnapshot): void {
  const nextState = cloneDesignState(host.getState());

  snapshot.keys.forEach((key) => {
    const value = snapshot.values[key];

    switch (key) {
      case designStudioStateKeys.palette:
        nextState.palette = clonePalette(value as Palette);
        break;
      case designStudioStateKeys.typography:
        nextState.typography = { ...(value as DesignState["typography"]) };
        break;
      case designStudioStateKeys.heroLayout:
        nextState.heroLayout = value as HeroLayout;
        break;
      case designStudioStateKeys.sections:
        nextState.sections = cloneSections(value as LandingSection[]);
        break;
      case designStudioStateKeys.sectionOrder:
        nextState.sections = reorderSections(nextState.sections, value as string[]);
        break;
      case designStudioStateKeys.sectionVisibility:
        nextState.sections = applySectionVisibility(
          nextState.sections,
          value as Record<string, boolean>,
        );
        break;
      case designStudioStateKeys.sectionCopy:
        nextState.sections = applySectionCopy(
          nextState.sections,
          value as Record<string, Pick<LandingSection, "eyebrow" | "title" | "body">>,
        );
        break;
      case designStudioStateKeys.template:
        nextState.activeTemplateId = value as string;
        break;
      case designStudioStateKeys.projectMeta:
        nextState.projectMeta = cloneProjectMeta(value as ProjectMeta);
        break;
      case designStudioStateKeys.shareStatus:
        nextState.shareMessage = value as string;
        break;
      case designStudioStateKeys.exportQuota:
        nextState.exportQuota = { ...(value as DesignState["exportQuota"]) };
        break;
      default:
        break;
    }
  });

  host.setters.restoreState(nextState);
}

function reorderSections(sections: LandingSection[], orderedIds: string[]): LandingSection[] {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const ordered = orderedIds
    .map((sectionId) => byId.get(sectionId))
    .filter((section): section is LandingSection => Boolean(section));
  const leftovers = sections.filter((section) => !orderedIds.includes(section.id));

  return [...ordered, ...leftovers].map((section) => ({ ...section }));
}

function applySectionVisibility(
  sections: LandingSection[],
  visibility: Record<string, boolean>,
): LandingSection[] {
  return sections.map((section) => ({
    ...section,
    visible: visibility[section.id] ?? section.visible,
  }));
}

function applySectionCopy(
  sections: LandingSection[],
  copy: Record<string, Pick<LandingSection, "eyebrow" | "title" | "body">>,
): LandingSection[] {
  return sections.map((section) => ({
    ...section,
    ...(copy[section.id] ?? {}),
  }));
}

function cloneDesignState(state: DesignState): DesignState {
  return {
    palette: clonePalette(state.palette),
    typography: { ...state.typography },
    heroLayout: state.heroLayout,
    sections: cloneSections(state.sections),
    templates: state.templates.map((template) => ({
      ...template,
      palette: clonePalette(template.palette),
      typography: { ...template.typography },
      sections: cloneSections(template.sections),
      metaPatch: { ...template.metaPatch },
    })),
    activeTemplateId: state.activeTemplateId,
    projectMeta: cloneProjectMeta(state.projectMeta),
    exportQuota: { ...state.exportQuota },
    shareMessage: state.shareMessage,
  };
}

function clonePalette(palette: Palette): Palette {
  return { ...palette };
}

function cloneSections(sections: LandingSection[]): LandingSection[] {
  return sections.map((section) => ({ ...section }));
}

function cloneProjectMeta(meta: ProjectMeta): ProjectMeta {
  return { ...meta };
}
