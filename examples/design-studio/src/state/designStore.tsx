import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  defaultPalette,
  defaultProjectMeta,
  defaultSections,
  defaultTypography,
  designTemplates,
  palettePresets,
} from "../data/designData";
import type {
  DesignState,
  FontPairing,
  HeroLayout,
  LandingSection,
  Palette,
  PalettePresetId,
  PaletteToken,
  ProjectMeta,
  TypeScale,
} from "../types";

export type SectionTextField = "eyebrow" | "title" | "body";

export type DesignStoreEvent =
  | { type: "paletteTokenSet"; token: PaletteToken; value: string }
  | { type: "palettePresetApplied"; presetId: PalettePresetId }
  | { type: "fontPairingSet"; value: FontPairing }
  | { type: "typeScaleSet"; value: TypeScale }
  | { type: "heroLayoutSet"; value: HeroLayout }
  | { type: "sectionVisibilityToggled"; sectionId: string }
  | { type: "sectionMoved"; sectionId: string; direction: "up" | "down" }
  | {
      type: "sectionTextUpdated";
      sectionId: string;
      field: SectionTextField;
      value: string;
    }
  | { type: "templateApplied"; templateId: string }
  | { type: "projectMetaUpdated"; field: keyof ProjectMeta; value: string }
  | { type: "shareMessageSet"; message: string }
  | { type: "projectExported" }
  | { type: "projectReset" }
  | { type: "stateRestored"; state: DesignState };

export interface DesignSetters {
  setPaletteToken: (token: PaletteToken, value: string) => void;
  applyPalettePreset: (presetId: PalettePresetId) => void;
  setFontPairing: (value: FontPairing) => void;
  setTypeScale: (value: TypeScale) => void;
  setHeroLayout: (value: HeroLayout) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  moveSection: (sectionId: string, direction: "up" | "down") => void;
  updateSectionText: (sectionId: string, field: SectionTextField, value: string) => void;
  applyTemplate: (templateId: string) => void;
  updateProjectMeta: (field: keyof ProjectMeta, value: string) => void;
  copyShareLink: () => Promise<void>;
  exportProject: () => void;
  resetProject: () => void;
  restoreState: (state: DesignState) => void;
}

interface DesignContextValue {
  state: DesignState;
  setters: DesignSetters;
}

const DesignContext = createContext<DesignContextValue | null>(null);

function clonePalette(palette: Palette): Palette {
  return { ...palette };
}

function cloneSections(sections: LandingSection[]): LandingSection[] {
  return sections.map((section) => ({ ...section }));
}

export function createInitialDesignState(): DesignState {
  return {
    palette: clonePalette(defaultPalette),
    typography: { ...defaultTypography },
    heroLayout: "split",
    sections: cloneSections(defaultSections),
    templates: designTemplates,
    activeTemplateId: "botanical-waitlist",
    projectMeta: { ...defaultProjectMeta },
    exportQuota: {
      limit: 3,
      remaining: 3,
      lastExportedAt: null,
      message: "Three mock exports are available for this session.",
    },
    shareMessage: "Share link is ready to copy.",
  };
}

function applyTemplateState(state: DesignState, templateId: string): DesignState {
  const template = state.templates.find((item) => item.id === templateId);

  if (!template) {
    return state;
  }

  return {
    ...state,
    palette: clonePalette(template.palette),
    typography: { ...template.typography },
    heroLayout: template.heroLayout,
    sections: cloneSections(template.sections),
    activeTemplateId: template.id,
    projectMeta: {
      ...state.projectMeta,
      ...template.metaPatch,
    },
    exportQuota: {
      ...state.exportQuota,
      message: "Template applied. Export quota is unchanged.",
    },
  };
}

export function applyDesignStoreEvent(
  state: DesignState,
  event: DesignStoreEvent,
): DesignState {
  switch (event.type) {
    case "paletteTokenSet":
      return {
        ...state,
        palette: {
          ...state.palette,
          [event.token]: event.value,
        },
      };
    case "palettePresetApplied": {
      const preset = palettePresets.find((item) => item.id === event.presetId);

      if (!preset) {
        return state;
      }

      return {
        ...state,
        palette: clonePalette(preset.palette),
      };
    }
    case "fontPairingSet":
      return {
        ...state,
        typography: {
          ...state.typography,
          fontPairing: event.value,
        },
      };
    case "typeScaleSet":
      return {
        ...state,
        typography: {
          ...state.typography,
          scale: event.value,
        },
      };
    case "heroLayoutSet":
      return {
        ...state,
        heroLayout: event.value,
      };
    case "sectionVisibilityToggled":
      return {
        ...state,
        sections: state.sections.map((section) =>
          section.id === event.sectionId
            ? { ...section, visible: !section.visible }
            : section,
        ),
      };
    case "sectionMoved": {
      const index = state.sections.findIndex((section) => section.id === event.sectionId);
      const nextIndex = event.direction === "up" ? index - 1 : index + 1;

      if (index < 0 || nextIndex < 0 || nextIndex >= state.sections.length) {
        return state;
      }

      const sections = cloneSections(state.sections);
      const [section] = sections.splice(index, 1);
      sections.splice(nextIndex, 0, section);

      return {
        ...state,
        sections,
      };
    }
    case "sectionTextUpdated":
      return {
        ...state,
        sections: state.sections.map((section) =>
          section.id === event.sectionId
            ? {
                ...section,
                [event.field]: event.value,
              }
            : section,
        ),
      };
    case "templateApplied":
      return applyTemplateState(state, event.templateId);
    case "projectMetaUpdated":
      return {
        ...state,
        projectMeta: {
          ...state.projectMeta,
          [event.field]: event.value,
        } as ProjectMeta,
      };
    case "shareMessageSet":
      return {
        ...state,
        shareMessage: event.message,
      };
    case "projectExported": {
      if (state.exportQuota.remaining <= 0) {
        return {
          ...state,
          exportQuota: {
            ...state.exportQuota,
            message: "Export blocked: the fake daily quota is exhausted. Reload to reset it.",
          },
        };
      }

      const remaining = state.exportQuota.remaining - 1;

      return {
        ...state,
        exportQuota: {
          ...state.exportQuota,
          remaining,
          lastExportedAt: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          message:
            remaining === 0
              ? "Mock export complete. The fake daily quota is now exhausted."
              : `Mock export complete. ${remaining} export${remaining === 1 ? "" : "s"} left today.`,
        },
      };
    }
    case "projectReset": {
      const initialState = createInitialDesignState();

      return {
        ...initialState,
        exportQuota: {
          ...state.exportQuota,
          message: "Project reset to the starter design. Export quota is unchanged.",
        },
      };
    }
    case "stateRestored":
      return {
        ...event.state,
        palette: clonePalette(event.state.palette),
        typography: { ...event.state.typography },
        sections: cloneSections(event.state.sections),
        templates: event.state.templates.map((template) => ({
          ...template,
          palette: clonePalette(template.palette),
          typography: { ...template.typography },
          sections: cloneSections(template.sections),
          metaPatch: { ...template.metaPatch },
        })),
        projectMeta: { ...event.state.projectMeta },
        exportQuota: { ...event.state.exportQuota },
      };
    default:
      return state;
  }
}

export function DesignProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    applyDesignStoreEvent,
    undefined,
    createInitialDesignState,
  );

  const copyShareLink = useCallback(async () => {
    const link = `${window.location.origin}/preview/${state.projectMeta.shareSlug}`;

    if (!navigator.clipboard) {
      dispatch({
        type: "shareMessageSet",
        message: `Clipboard unavailable. Share link: ${link}`,
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      dispatch({
        type: "shareMessageSet",
        message: "Share link copied to clipboard.",
      });
    } catch {
      dispatch({
        type: "shareMessageSet",
        message: `Copy failed. Share link: ${link}`,
      });
    }
  }, [state.projectMeta.shareSlug]);

  const setters = useMemo<DesignSetters>(
    () => ({
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
      copyShareLink,
      exportProject: () => dispatch({ type: "projectExported" }),
      resetProject: () => dispatch({ type: "projectReset" }),
      restoreState: (state) => dispatch({ type: "stateRestored", state }),
    }),
    [copyShareLink],
  );

  const value = useMemo(() => ({ state, setters }), [state, setters]);

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}

export function useDesignStudio() {
  const context = useContext(DesignContext);

  if (!context) {
    throw new Error("useDesignStudio must be used inside DesignProvider.");
  }

  return context;
}
