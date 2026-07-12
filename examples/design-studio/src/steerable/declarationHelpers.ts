/**
 * Reusable schema and declaration helpers for the example capability modules.
 * They keep parameter validation strict while leaving domain intent beside each declaration.
 */

import type { Palette, ProjectMeta } from "../types";
import {
  emptyParamsSchema,
  type FactEntry,
  type StrictSchema,
  type SurfaceId,
} from "@steerable/core";
import { type DesignStudioCapabilityHost, type DesignStudioSurfaceId } from "./capabilityModel";

export type EmptyParams = Record<string, never>;

export const emptyObjectSchema: StrictSchema<EmptyParams> = {
  ...emptyParamsSchema,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  },
};

export const designStudioSurfaceIdList = [
  "editor",
  "templates",
  "settings",
] as const satisfies readonly DesignStudioSurfaceId[];

export const projectTones = [
  "warm",
  "direct",
  "premium",
] as const satisfies readonly ProjectMeta["tone"][];

export const heroLayouts = ["split", "centered", "stacked"] as const;

export function strictObjectSchema<Params extends object>(
  allowedKeys: readonly string[],
  parse: (input: Record<string, unknown>) => Params,
  properties: Record<string, unknown>,
  required: readonly string[],
): StrictSchema<Params> {
  return {
    parse(input) {
      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        throw new Error("Expected an object.");
      }

      const record = input as Record<string, unknown>;
      const unknownKeys = Object.keys(record).filter((key) => !allowedKeys.includes(key));

      if (unknownKeys.length > 0) {
        throw new Error(`Unexpected parameter(s): ${unknownKeys.join(", ")}.`);
      }

      return parse(record);
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties,
      required: [...required],
    },
  };
}

export function parseString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`"${field}" must be a string.`);
  }

  return value;
}

export function parseNonEmptyString(value: unknown, field: string): string {
  const parsed = parseString(value, field).trim();

  if (!parsed) {
    throw new Error(`"${field}" must not be empty.`);
  }

  return parsed;
}

export function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`"${field}" must be a boolean.`);
  }

  return value;
}

export function parseHex(value: unknown, field: string): string {
  const parsed = parseString(value, field);

  if (!/^#[0-9A-Fa-f]{6}$/.test(parsed)) {
    throw new Error(`"${field}" must be a six-digit hex color.`);
  }

  return parsed.toUpperCase();
}

export function parseEnum<const Values extends readonly string[]>(
  value: unknown,
  allowed: Values,
  field: string,
): Values[number] {
  const parsed = parseString(value, field);

  if (!allowed.includes(parsed)) {
    throw new Error(`"${field}" must be one of: ${allowed.join(", ")}.`);
  }

  return parsed as Values[number];
}

export function isDesignStudioSurfaceId(value: unknown): value is DesignStudioSurfaceId {
  return (
    typeof value === "string" && designStudioSurfaceIdList.includes(value as DesignStudioSurfaceId)
  );
}

export function enumJsonSchema(values: readonly string[]) {
  return {
    type: "string",
    enum: [...values],
  };
}

export function stringArraySchema() {
  return {
    type: "array",
    items: { type: "string" },
  };
}

export function nullableStringSchema() {
  return {
    type: ["string", "null"],
  };
}

export function paletteSummarySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      accent: { type: "string" },
      background: { type: "string" },
      text: { type: "string" },
    },
    required: ["accent", "background", "text"],
  };
}

export function typographySummarySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      fontPairing: { type: "string" },
      scale: { type: "string" },
    },
    required: ["fontPairing", "scale"],
  };
}

export function fact(key: string, description: string, schema: unknown): FactEntry {
  return {
    key,
    description,
    schema: { parse: (input) => input, jsonSchema: schema },
  };
}

export function surfacePrecondition(surfaceId: SurfaceId): string {
  return `surface:${surfaceId}`;
}

export function buildShareLink(host: DesignStudioCapabilityHost): string {
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

export function clonePalette(palette: Palette): Palette {
  return { ...palette };
}
