/**
 * Editor action declarations for palette, typography, layout, and page sections.
 * These local mutations demonstrate undoable single-field changes and snapshot-based bulk changes.
 */

import type { SectionTextField } from "../state/designStore";
import type {
  DesignState,
  FontPairing,
  HeroLayout,
  PalettePresetId,
  PaletteToken,
  TypeScale,
} from "../types";
import { defineAction, type AnyActionDeclaration } from "@steerable/core";
import {
  designStudioStateKeys,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
} from "./capabilityModel";
import {
  clonePalette,
  enumJsonSchema,
  parseBoolean,
  parseEnum,
  parseHex,
  parseNonEmptyString,
  parseString,
  strictObjectSchema,
  surfacePrecondition,
} from "./declarationHelpers";

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
const sectionTextFields = [
  "eyebrow",
  "title",
  "body",
] as const satisfies readonly SectionTextField[];
const moveDirections = ["up", "down"] as const;

const paletteSetColorParams = strictObjectSchema<PaletteSetColorParams>(
  ["token", "hex"],
  (input) => ({
    token: parseEnum(input.token, paletteTokens, "token"),
    hex: parseHex(input.hex, "hex"),
  }),
  { token: enumJsonSchema(paletteTokens), hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" } },
  ["token", "hex"],
);
const paletteApplyPresetParams = strictObjectSchema<PaletteApplyPresetParams>(
  ["presetId"],
  (input) => ({ presetId: parseEnum(input.presetId, palettePresetIds, "presetId") }),
  { presetId: enumJsonSchema(palettePresetIds) },
  ["presetId"],
);
const typographySetPairingParams = strictObjectSchema<TypographySetPairingParams>(
  ["pairing"],
  (input) => ({ pairing: parseEnum(input.pairing, fontPairings, "pairing") }),
  { pairing: enumJsonSchema(fontPairings) },
  ["pairing"],
);
const typographySetScaleParams = strictObjectSchema<TypographySetScaleParams>(
  ["scale"],
  (input) => ({ scale: parseEnum(input.scale, typeScales, "scale") }),
  { scale: enumJsonSchema(typeScales) },
  ["scale"],
);
const layoutSetHeroParams = strictObjectSchema<LayoutSetHeroParams>(
  ["layout"],
  (input) => ({ layout: parseEnum(input.layout, heroLayouts, "layout") }),
  { layout: enumJsonSchema(heroLayouts) },
  ["layout"],
);
const sectionSetVisibilityParams = strictObjectSchema<SectionSetVisibilityParams>(
  ["sectionId", "visible"],
  (input) => ({
    sectionId: parseNonEmptyString(input.sectionId, "sectionId"),
    visible: parseBoolean(input.visible, "visible"),
  }),
  { sectionId: { type: "string", minLength: 1 }, visible: { type: "boolean" } },
  ["sectionId", "visible"],
);
const sectionMoveParams = strictObjectSchema<SectionMoveParams>(
  ["sectionId", "direction"],
  (input) => ({
    sectionId: parseNonEmptyString(input.sectionId, "sectionId"),
    direction: parseEnum(input.direction, moveDirections, "direction"),
  }),
  { sectionId: { type: "string", minLength: 1 }, direction: enumJsonSchema(moveDirections) },
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

function requireSection(state: DesignState, sectionId: string) {
  const section = state.sections.find((candidate) => candidate.id === sectionId);
  if (!section) throw new Error(`Unknown section "${sectionId}".`);
  return section;
}

function assertSectionCanMove(
  state: DesignState,
  sectionId: string,
  direction: "up" | "down",
): void {
  const index = state.sections.findIndex((section) => section.id === sectionId);
  if (index < 0) throw new Error(`Unknown section "${sectionId}".`);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= state.sections.length) {
    throw new Error(`Section "${sectionId}" cannot move ${direction}.`);
  }
}

export function createEditorActions(host: DesignStudioCapabilityHost): AnyActionDeclaration[] {
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
    defineAction<
      TypographySetPairingParams,
      { pairing: FontPairing; previousPairing: FontPairing }
    >({
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
    defineAction<
      SectionUpdateCopyParams,
      { sectionId: string; field: SectionTextField; previousValue: string }
    >({
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

        host.setters.updateSectionText(result.sectionId, result.field, result.previousValue);
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
  ];
}
