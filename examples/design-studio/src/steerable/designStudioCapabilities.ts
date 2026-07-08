import type {
  DesignSetters,
  SectionTextField,
} from "../state/designStore";
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
import {
  CapabilityRegistry,
  defineAction,
  defineFacts,
  defineReadTool,
  defineSurface,
  emptyParamsSchema,
  type AnyActionDeclaration,
  type CapabilityId,
  type FactEntry,
  type ReadToolDeclaration,
  type RegistryDeclarations,
  type StateKey,
  type StateSnapshot,
  type StateSnapshotAdapter,
  type StrictParamSchema,
  type SurfaceId,
} from "./registry";

export const designStudioSurfaceIds = {
  editor: "editor",
  templates: "templates",
  settings: "settings",
} as const;

export type DesignStudioSurfaceId =
  (typeof designStudioSurfaceIds)[keyof typeof designStudioSurfaceIds];

export const designStudioStateKeys = {
  route: "ui.route",
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
  setters: DesignSetters;
  getOrigin?: () => string;
}

type EmptyParams = Record<string, never>;

interface PaletteSetColorParams {
  token: PaletteToken;
  hex: string;
}

interface PaletteApplyPresetParams {
  presetId: PalettePresetId;
}

interface TypographySetPairingParams {
  pairing: FontPairing;
}

interface TypographySetScaleParams {
  scale: TypeScale;
}

interface LayoutSetHeroParams {
  layout: HeroLayout;
}

interface SectionSetVisibilityParams {
  sectionId: string;
  visible: boolean;
}

interface SectionMoveParams {
  sectionId: string;
  direction: "up" | "down";
}

interface SectionUpdateCopyParams {
  sectionId: string;
  field: SectionTextField;
  value: string;
}

interface TemplateApplyParams {
  templateId: string;
}

interface ProjectUpdateMetaParams {
  field: keyof ProjectMeta;
  value: string;
}

interface TemplateListParams {
  tone?: ProjectMeta["tone"];
}

const paletteTokens = [
  "background",
  "surface",
  "text",
  "muted",
  "accent",
  "accentContrast",
  "border",
] as const satisfies readonly PaletteToken[];

const palettePresetIds = ["studio", "citrus", "mono"] as const satisfies readonly PalettePresetId[];
const fontPairings = ["atelier", "editorial", "modern"] as const satisfies readonly FontPairing[];
const typeScales = ["compact", "standard", "expressive"] as const satisfies readonly TypeScale[];
const heroLayouts = ["split", "centered", "stacked"] as const satisfies readonly HeroLayout[];
const sectionTextFields = ["eyebrow", "title", "body"] as const satisfies readonly SectionTextField[];
const projectMetaFields = [
  "name",
  "audience",
  "goal",
  "tone",
  "shareSlug",
] as const satisfies readonly (keyof ProjectMeta)[];
const projectTones = ["warm", "direct", "premium"] as const satisfies readonly ProjectMeta["tone"][];
const moveDirections = ["up", "down"] as const;

const emptyObjectSchema: StrictParamSchema<EmptyParams> = {
  ...emptyParamsSchema,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  },
};

const paletteSetColorParams = strictObjectSchema<PaletteSetColorParams>(
  ["token", "hex"],
  (input) => ({
    token: parseEnum(input.token, paletteTokens, "token"),
    hex: parseHex(input.hex, "hex"),
  }),
  {
    token: enumJsonSchema(paletteTokens),
    hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
  },
  ["token", "hex"],
);

const paletteApplyPresetParams = strictObjectSchema<PaletteApplyPresetParams>(
  ["presetId"],
  (input) => ({
    presetId: parseEnum(input.presetId, palettePresetIds, "presetId"),
  }),
  {
    presetId: enumJsonSchema(palettePresetIds),
  },
  ["presetId"],
);

const typographySetPairingParams = strictObjectSchema<TypographySetPairingParams>(
  ["pairing"],
  (input) => ({
    pairing: parseEnum(input.pairing, fontPairings, "pairing"),
  }),
  {
    pairing: enumJsonSchema(fontPairings),
  },
  ["pairing"],
);

const typographySetScaleParams = strictObjectSchema<TypographySetScaleParams>(
  ["scale"],
  (input) => ({
    scale: parseEnum(input.scale, typeScales, "scale"),
  }),
  {
    scale: enumJsonSchema(typeScales),
  },
  ["scale"],
);

const layoutSetHeroParams = strictObjectSchema<LayoutSetHeroParams>(
  ["layout"],
  (input) => ({
    layout: parseEnum(input.layout, heroLayouts, "layout"),
  }),
  {
    layout: enumJsonSchema(heroLayouts),
  },
  ["layout"],
);

const sectionSetVisibilityParams = strictObjectSchema<SectionSetVisibilityParams>(
  ["sectionId", "visible"],
  (input) => ({
    sectionId: parseNonEmptyString(input.sectionId, "sectionId"),
    visible: parseBoolean(input.visible, "visible"),
  }),
  {
    sectionId: { type: "string", minLength: 1 },
    visible: { type: "boolean" },
  },
  ["sectionId", "visible"],
);

const sectionMoveParams = strictObjectSchema<SectionMoveParams>(
  ["sectionId", "direction"],
  (input) => ({
    sectionId: parseNonEmptyString(input.sectionId, "sectionId"),
    direction: parseEnum(input.direction, moveDirections, "direction"),
  }),
  {
    sectionId: { type: "string", minLength: 1 },
    direction: enumJsonSchema(moveDirections),
  },
  ["sectionId", "direction"],
);

const sectionUpdateCopyParams = strictObjectSchema<SectionUpdateCopyParams>(
  ["sectionId", "field", "value"],
  (input) => ({
    sectionId: parseNonEmptyString(input.sectionId, "sectionId"),
    field: parseEnum(input.field, sectionTextFields, "field"),
    value: parseString(input.value, "value"),
  }),
  {
    sectionId: { type: "string", minLength: 1 },
    field: enumJsonSchema(sectionTextFields),
    value: { type: "string" },
  },
  ["sectionId", "field", "value"],
);

const templateApplyParams = strictObjectSchema<TemplateApplyParams>(
  ["templateId"],
  (input) => ({
    templateId: parseNonEmptyString(input.templateId, "templateId"),
  }),
  {
    templateId: { type: "string", minLength: 1 },
  },
  ["templateId"],
);

const projectUpdateMetaParams = strictObjectSchema<ProjectUpdateMetaParams>(
  ["field", "value"],
  (input) => {
    const field = parseEnum(input.field, projectMetaFields, "field");
    const value = parseString(input.value, "value");

    if (field === "tone") {
      parseEnum(value, projectTones, "value");
    }

    return { field, value };
  },
  {
    field: enumJsonSchema(projectMetaFields),
    value: { type: "string" },
  },
  ["field", "value"],
);

const templateListParams = strictObjectSchema<TemplateListParams>(
  ["tone"],
  (input) => {
    if (input.tone === undefined) {
      return {};
    }

    return {
      tone: parseEnum(input.tone, projectTones, "tone"),
    };
  },
  {
    tone: enumJsonSchema(projectTones),
  },
  [],
);

export function createDesignStudioRegistry(
  host: DesignStudioCapabilityHost,
): CapabilityRegistry {
  return new CapabilityRegistry(createDesignStudioDeclarations(host));
}

export function createDesignStudioDeclarations(
  host: DesignStudioCapabilityHost,
): RegistryDeclarations {
  const actions = createDesignStudioActions(host);
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

export function createDesignStudioSnapshotAdapter(
  host: DesignStudioCapabilityHost,
  now: () => Date = () => new Date(),
): StateSnapshotAdapter {
  return {
    capture(keys) {
      const state = host.getState();
      const values = Object.fromEntries(
        keys.map((key) => [key, readStateKey(state, key)]),
      );

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

function createDesignStudioActions(
  host: DesignStudioCapabilityHost,
): AnyActionDeclaration[] {
  return [
    defineAction<PaletteSetColorParams, { token: PaletteToken; hex: string; previousHex: string }>({
      id: "palette.set_color",
      title: "Set one palette color",
      description: "Set a single palette token to a hex value.",
      params: paletteSetColorParams,
      reads: [designStudioStateKeys.palette],
      writes: [designStudioStateKeys.palette],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.editor)],
      execute: ({ token, hex }) => {
        const previousHex = host.getState().palette[token];

        host.setters.setPaletteToken(token, hex);
        return { token, hex, previousHex };
      },
      undo: ({ params, result }) => {
        const previousHex = result?.previousHex;

        if (!previousHex) {
          throw new Error("Palette color undo requires the previous token value.");
        }

        host.setters.setPaletteToken(params.token, previousHex);
        return { token: params.token, hex: previousHex };
      },
      observe: () => clonePalette(host.getState().palette),
      guidance:
        "Use when the user names one palette token or one hex color. For a complete preset, use palette.apply_preset instead.",
      examples: [
        {
          user: "make the accent #FF6600",
          params: { token: "accent", hex: "#FF6600" },
        },
        {
          user: "set the page background to #F6F8FB",
          params: { token: "background", hex: "#F6F8FB" },
        },
      ],
    }),
    defineAction<PaletteApplyPresetParams, { presetId: PalettePresetId }>({
      id: "palette.apply_preset",
      title: "Apply palette preset",
      description: "Replace the full palette with one named preset.",
      params: paletteApplyPresetParams,
      reads: [designStudioStateKeys.palette],
      writes: [designStudioStateKeys.palette],
      risk: "safe",
      reversibility: { kind: "snapshot" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.editor)],
      execute: ({ presetId }) => {
        host.setters.applyPalettePreset(presetId);
        return { presetId };
      },
      guidance:
        "Use when the user asks for one of the named palette presets or wants the whole palette changed at once. Snapshot restoration is used because every token changes together.",
      examples: [
        {
          user: "switch the palette to citrus",
          params: { presetId: "citrus" },
        },
      ],
    }),
    defineAction<TypographySetPairingParams, { pairing: FontPairing; previousPairing: FontPairing }>({
      id: "typography.set_pairing",
      title: "Set font pairing",
      description: "Set the landing page font pairing.",
      params: typographySetPairingParams,
      reads: [designStudioStateKeys.typography],
      writes: [designStudioStateKeys.typography],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.editor)],
      execute: ({ pairing }) => {
        const previousPairing = host.getState().typography.fontPairing;

        host.setters.setFontPairing(pairing);
        return { pairing, previousPairing };
      },
      undo: ({ result }) => {
        if (!result?.previousPairing) {
          throw new Error("Font pairing undo requires the previous pairing.");
        }

        host.setters.setFontPairing(result.previousPairing);
        return { pairing: result.previousPairing };
      },
      guidance:
        "Use when the user asks for a typography personality such as atelier, editorial, or modern without changing type scale.",
      examples: [
        {
          user: "use the modern font pairing",
          params: { pairing: "modern" },
        },
      ],
    }),
    defineAction<TypographySetScaleParams, { scale: TypeScale; previousScale: TypeScale }>({
      id: "typography.set_scale",
      title: "Set type scale",
      description: "Set the landing page type scale.",
      params: typographySetScaleParams,
      reads: [designStudioStateKeys.typography],
      writes: [designStudioStateKeys.typography],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.editor)],
      execute: ({ scale }) => {
        const previousScale = host.getState().typography.scale;

        host.setters.setTypeScale(scale);
        return { scale, previousScale };
      },
      undo: ({ result }) => {
        if (!result?.previousScale) {
          throw new Error("Type scale undo requires the previous scale.");
        }

        host.setters.setTypeScale(result.previousScale);
        return { scale: result.previousScale };
      },
      guidance:
        "Use when the user asks for compact, standard, or expressive sizing while keeping the font pairing unchanged.",
      examples: [
        {
          user: "make the type scale expressive",
          params: { scale: "expressive" },
        },
      ],
    }),
    defineAction<LayoutSetHeroParams, { layout: HeroLayout; previousLayout: HeroLayout }>({
      id: "layout.set_hero",
      title: "Set hero layout",
      description: "Set the hero section layout mode.",
      params: layoutSetHeroParams,
      reads: [designStudioStateKeys.heroLayout],
      writes: [designStudioStateKeys.heroLayout],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.editor)],
      execute: ({ layout }) => {
        const previousLayout = host.getState().heroLayout;

        host.setters.setHeroLayout(layout);
        return { layout, previousLayout };
      },
      undo: ({ result }) => {
        if (!result?.previousLayout) {
          throw new Error("Hero layout undo requires the previous layout.");
        }

        host.setters.setHeroLayout(result.previousLayout);
        return { layout: result.previousLayout };
      },
      guidance:
        "Use when the user asks to change the hero arrangement to split, centered, or stacked without changing copy.",
      examples: [
        {
          user: "center the hero",
          params: { layout: "centered" },
        },
      ],
    }),
    defineAction<SectionSetVisibilityParams, { sectionId: string; previousVisible: boolean }>({
      id: "section.set_visibility",
      title: "Set section visibility",
      description: "Show or hide one landing page section.",
      params: sectionSetVisibilityParams,
      reads: [designStudioStateKeys.sectionVisibility],
      writes: [designStudioStateKeys.sectionVisibility],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.editor)],
      execute: ({ sectionId, visible }) => {
        const section = requireSection(host.getState(), sectionId);
        const previousVisible = section.visible;

        if (previousVisible !== visible) {
          host.setters.toggleSectionVisibility(sectionId);
        }

        return { sectionId, previousVisible };
      },
      undo: ({ params, result }) => {
        if (result?.previousVisible === undefined) {
          throw new Error("Section visibility undo requires the previous visibility.");
        }

        const section = requireSection(host.getState(), params.sectionId);

        if (section.visible !== result.previousVisible) {
          host.setters.toggleSectionVisibility(params.sectionId);
        }

        return { sectionId: params.sectionId, visible: result.previousVisible };
      },
      guidance:
        "Use when the user asks to show or hide one existing section. Use section.update_copy for text changes.",
      examples: [
        {
          user: "hide the pricing section",
          params: { sectionId: "pricing", visible: false },
        },
      ],
    }),
    defineAction<SectionMoveParams, { sectionId: string; direction: "up" | "down" }>({
      id: "section.move_section",
      title: "Move section",
      description: "Move one landing page section up or down in the page order.",
      params: sectionMoveParams,
      reads: [designStudioStateKeys.sectionOrder],
      writes: [designStudioStateKeys.sectionOrder],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.editor)],
      execute: ({ sectionId, direction }) => {
        assertSectionCanMove(host.getState(), sectionId, direction);
        host.setters.moveSection(sectionId, direction);
        return { sectionId, direction };
      },
      undo: ({ result }) => {
        if (!result?.sectionId || !result.direction) {
          throw new Error("Section move undo requires the moved section and direction.");
        }

        const inverseDirection = result.direction === "up" ? "down" : "up";

        assertSectionCanMove(host.getState(), result.sectionId, inverseDirection);
        host.setters.moveSection(result.sectionId, inverseDirection);
        return { sectionId: result.sectionId, direction: inverseDirection };
      },
      guidance:
        "Use when the user asks to reorder an existing section by one slot. For large ordering changes, propose a short chain of this same action.",
      examples: [
        {
          user: "move social proof above features",
          params: { sectionId: "social-proof", direction: "up" },
        },
      ],
    }),
    defineAction<SectionUpdateCopyParams, { sectionId: string; field: SectionTextField; previousValue: string }>({
      id: "section.update_copy",
      title: "Update section copy",
      description: "Update one text field on one landing page section.",
      params: sectionUpdateCopyParams,
      reads: [designStudioStateKeys.sectionCopy],
      writes: [designStudioStateKeys.sectionCopy],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [surfacePrecondition(designStudioSurfaceIds.editor)],
      execute: ({ sectionId, field, value }) => {
        const section = requireSection(host.getState(), sectionId);
        const previousValue = section[field];

        host.setters.updateSectionText(sectionId, field, value);
        return { sectionId, field, previousValue };
      },
      undo: ({ result }) => {
        if (!result?.sectionId || !result.field) {
          throw new Error("Section copy undo requires the prior field value.");
        }

        host.setters.updateSectionText(
          result.sectionId,
          result.field,
          result.previousValue,
        );
        return {
          sectionId: result.sectionId,
          field: result.field,
          value: result.previousValue,
        };
      },
      guidance:
        "Use when the user gives replacement copy for one eyebrow, title, or body field. Do not use it to answer questions about current copy; use design.get_current_design first.",
      examples: [
        {
          user: "change the footer title to Join the private preview",
          params: {
            sectionId: "footer",
            field: "title",
            value: "Join the private preview",
          },
        },
      ],
    }),
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
    defineAction<EmptyParams, { link: string }>({
      id: "share.copy_link",
      title: "Copy share link",
      description: "Copy the current preview share link to the browser clipboard.",
      params: emptyObjectSchema,
      reads: [designStudioStateKeys.projectMeta, designStudioStateKeys.shareLink],
      writes: [designStudioStateKeys.clipboard, designStudioStateKeys.shareStatus],
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
    defineAction<EmptyParams, { spentQuota: boolean; remainingBefore: number; remainingAfter: number }>({
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
      description: "Reset the design and project metadata to the starter state while keeping export quota.",
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

function createDesignStudioReadTools(
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

function createDesignStudioFacts(host: DesignStudioCapabilityHost) {
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
        fact("design.sections.visible_ids", "Visible section IDs in page order.", stringArraySchema()),
        fact("design.sections.order", "All section IDs in page order.", stringArraySchema()),
        fact("design.template.active_id", "The active template ID.", { type: "string" }),
        fact("quota.exports_remaining", "Remaining fake exports this session.", { type: "number" }),
        fact("policy.posture", "Default example posture for policy fixtures.", { type: "string" }),
      ],
      publish: () => editorFacts(host.getState()),
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
        fact("template.available_ids", "Template IDs available on this surface.", stringArraySchema()),
        fact("template.current_tone", "Tone implied by the active project metadata.", enumJsonSchema(projectTones)),
        fact("project.audience", "Current target audience.", { type: "string" }),
        fact("design.palette.summary", "Current palette token values.", paletteSummarySchema()),
        fact("design.typography.summary", "Current typography choices.", typographySummarySchema()),
        fact("design.hero_layout", "Current hero layout.", enumJsonSchema(heroLayouts)),
        fact("quota.exports_remaining", "Remaining fake exports this session.", { type: "number" }),
        fact("policy.posture", "Default example posture for policy fixtures.", { type: "string" }),
      ],
      publish: () => templatesFacts(host.getState()),
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
        fact("policy.posture", "Default example posture for policy fixtures.", { type: "string" }),
      ],
      publish: () => settingsFacts(host),
      update: "material_change",
    }),
  ];
}

function createDesignStudioSurfaces(ids: {
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

function strictObjectSchema<Params extends object>(
  keys: readonly (keyof Params & string)[],
  parseValues: (input: Record<string, unknown>) => Params,
  properties: Record<string, unknown>,
  required: readonly string[],
): StrictParamSchema<Params> {
  return {
    parse(input: unknown): Params {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Expected an object parameter payload.");
      }

      const record = input as Record<string, unknown>;
      const allowed = new Set<string>(keys);
      const extraKey = Object.keys(record).find((key) => !allowed.has(key));

      if (extraKey) {
        throw new Error(`Unexpected parameter "${extraKey}".`);
      }

      return parseValues(record);
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties,
      required: [...required],
    },
  };
}

function parseString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }

  return value;
}

function parseNonEmptyString(value: unknown, field: string): string {
  const parsed = parseString(value, field);

  if (parsed.length === 0) {
    throw new Error(`${field} must not be empty.`);
  }

  return parsed;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean.`);
  }

  return value;
}

function parseHex(value: unknown, field: string): string {
  const parsed = parseString(value, field);

  if (!/^#[0-9A-Fa-f]{6}$/.test(parsed)) {
    throw new Error(`${field} must be a six-digit hex color.`);
  }

  return parsed;
}

function parseEnum<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  field: string,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`${field} must be one of ${values.join(", ")}.`);
  }

  return value;
}

function enumJsonSchema(values: readonly string[]) {
  return {
    type: "string",
    enum: [...values],
  };
}

function stringArraySchema() {
  return {
    type: "array",
    items: { type: "string" },
  };
}

function nullableStringSchema() {
  return {
    anyOf: [{ type: "string" }, { type: "null" }],
  };
}

function paletteSummarySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(
      paletteTokens.map((token) => [token, { type: "string" }]),
    ),
    required: [...paletteTokens],
  };
}

function typographySummarySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      fontPairing: enumJsonSchema(fontPairings),
      scale: enumJsonSchema(typeScales),
    },
    required: ["fontPairing", "scale"],
  };
}

function fact(key: string, description: string, schema: unknown): FactEntry {
  return {
    key,
    description,
    schema,
  };
}

function surfacePrecondition(surfaceId: SurfaceId): string {
  return `surface:${surfaceId}`;
}

function requireSection(state: DesignState, sectionId: string): LandingSection {
  const section = state.sections.find((item) => item.id === sectionId);

  if (!section) {
    throw new Error(`Unknown section "${sectionId}".`);
  }

  return section;
}

function assertSectionCanMove(
  state: DesignState,
  sectionId: string,
  direction: "up" | "down",
): void {
  const index = state.sections.findIndex((section) => section.id === sectionId);
  const nextIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0) {
    throw new Error(`Unknown section "${sectionId}".`);
  }

  if (nextIndex < 0 || nextIndex >= state.sections.length) {
    throw new Error(`Section "${sectionId}" cannot move ${direction}.`);
  }
}

function requireTemplate(state: DesignState, templateId: string): void {
  if (!state.templates.some((template) => template.id === templateId)) {
    throw new Error(`Unknown template "${templateId}".`);
  }
}

function summarizeCurrentDesign(state: DesignState) {
  return {
    project: cloneProjectMeta(state.projectMeta),
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

  return {
    activeTemplateId: state.activeTemplateId,
    templates,
  };
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

function editorFacts(state: DesignState) {
  return {
    "ui.route": "/",
    "project.name": state.projectMeta.name,
    "project.goal": state.projectMeta.goal,
    "design.selection": "landing-page",
    "design.palette.summary": clonePalette(state.palette),
    "design.typography.summary": { ...state.typography },
    "design.hero_layout": state.heroLayout,
    "design.sections.visible_ids": state.sections
      .filter((section) => section.visible)
      .map((section) => section.id),
    "design.sections.order": state.sections.map((section) => section.id),
    "design.template.active_id": state.activeTemplateId,
    "quota.exports_remaining": state.exportQuota.remaining,
    "policy.posture": "creative-tool",
  };
}

function templatesFacts(state: DesignState) {
  return {
    "ui.route": "/templates",
    "template.active_id": state.activeTemplateId,
    "template.count": state.templates.length,
    "template.available_ids": state.templates.map((template) => template.id),
    "template.current_tone": state.projectMeta.tone,
    "project.audience": state.projectMeta.audience,
    "design.palette.summary": clonePalette(state.palette),
    "design.typography.summary": { ...state.typography },
    "design.hero_layout": state.heroLayout,
    "quota.exports_remaining": state.exportQuota.remaining,
    "policy.posture": "creative-tool",
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
    "policy.posture": "creative-tool",
  };
}

function buildShareLink(host: DesignStudioCapabilityHost): string {
  return `${shareOrigin(host)}/preview/${host.getState().projectMeta.shareSlug}`;
}

function shareOrigin(host: DesignStudioCapabilityHost): string {
  if (host.getOrigin) {
    return host.getOrigin();
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "https://design-studio.local";
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
      return Object.fromEntries(
        state.sections.map((section) => [section.id, section.visible]),
      );
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

function restoreSnapshot(
  host: DesignStudioCapabilityHost,
  snapshot: StateSnapshot,
): void {
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

function reorderSections(
  sections: LandingSection[],
  orderedIds: string[],
): LandingSection[] {
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
