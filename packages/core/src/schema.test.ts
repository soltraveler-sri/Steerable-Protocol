import { describe, expect, it } from "vitest";
import {
  RegistryCompileError,
  assertSchemaProfile,
  compileSchema,
  compileValueSchema,
  createStrictObjectSchema,
  emptyParamsSchema,
} from "./index.js";

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  ...(required.length > 0 ? { required } : {}),
  additionalProperties: false,
});

describe("Steerable JSON Schema Profile", () => {
  describe("accept set", () => {
    it("admits every keyword in the cross-provider intersection", () => {
      const schema = objectSchema(
        {
          hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", description: "Accent color." },
          when: { type: "string", format: "date-time" },
          count: { type: "integer" },
          ratio: { type: "number" },
          enabled: { type: "boolean" },
          nothing: { type: "null" },
          mode: { enum: ["fast", "slow"] },
          kind: { const: "palette" },
          tags: { type: "array", items: { type: "string" } },
          target: {
            anyOf: [{ type: "string" }, objectSchema({ id: { type: "string" } }, ["id"])],
          },
        },
        ["hex"],
      );

      expect(() => assertSchemaProfile(schema)).not.toThrow();
    });

    it("keeps `pattern`, which is in the intersection, not outside it", () => {
      // Issue #83 §5 suspects the canonical `z.string().regex(/^#[0-9A-Fa-f]{6}$/)` is
      // unportable. It is not: `pattern` is among the better-supported keywords.
      const params = compileSchema<{ hex: string }>(
        objectSchema({ hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" } }, ["hex"]),
      );

      expect(params.parse({ hex: "#228B22" })).toEqual({ hex: "#228B22" });
      expect(() => params.parse({ hex: "green" })).toThrow(/must match/);
    });
  });

  describe("reject set", () => {
    it("rejects an excluded keyword legibly, naming it and why", () => {
      const schema = objectSchema({ count: { type: "integer", minimum: 1 } });

      expect(() => assertSchemaProfile(schema, "palette.set_color")).toThrow(RegistryCompileError);
      expect(() => assertSchemaProfile(schema, "palette.set_color")).toThrow(
        /keyword `minimum` is outside the profile because numeric bounds are stripped/,
      );
      // The message must locate the offender and point at the profile.
      expect(() => assertSchemaProfile(schema, "palette.set_color")).toThrow(
        /"palette.set_color" at \(root\)\/properties\/count/,
      );
    });

    it.each([
      ["maxLength", objectSchema({ v: { type: "string", maxLength: 8 } })],
      ["$ref", objectSchema({ v: { $ref: "#/$defs/x" } })],
      ["oneOf", objectSchema({ v: { oneOf: [{ type: "string" }] } })],
      ["allOf", objectSchema({ v: { allOf: [{ type: "string" }] } })],
      ["not", objectSchema({ v: { not: { type: "string" } } })],
      ["if", objectSchema({ v: { type: "string", if: { const: "x" } } })],
    ])("rejects excluded keyword `%s`, naming it", (keyword, schema) => {
      // Each of these sits on a node declaring no `type`; the error must still name the keyword
      // rather than complain about the missing type.
      expect(() => assertSchemaProfile(schema)).toThrow(RegistryCompileError);
      expect(() => assertSchemaProfile(schema)).toThrow(`keyword \`${keyword}\``);
    });

    it("rejects a root that is not an object, or a root-level union", () => {
      expect(() => assertSchemaProfile({ type: "string" })).toThrow(/root of a parameter schema/);
      // A bare `anyOf` root fails on the object-root rule it also breaks.
      expect(() => assertSchemaProfile({ anyOf: [objectSchema({})] })).toThrow(
        /root of a parameter schema/,
      );
      expect(() => assertSchemaProfile({ ...objectSchema({}), anyOf: [objectSchema({})] })).toThrow(
        /`anyOf` is admitted only below the root/,
      );
    });

    it("rejects an open object, because declared parameters are closed", () => {
      expect(() => assertSchemaProfile({ type: "object", properties: {} })).toThrow(
        /must declare `additionalProperties: false`/,
      );
    });

    it("rejects an unknown type and a `required` naming an undeclared property", () => {
      expect(() => assertSchemaProfile(objectSchema({ v: { type: "tuple" } }))).toThrow(
        /`type: "tuple"` is outside the profile/,
      );
      expect(() =>
        assertSchemaProfile(objectSchema({ v: { type: "string" } }, ["missing"])),
      ).toThrow(/`required` must be an array of names declared in `properties`/);
    });
  });

  describe("derived parser", () => {
    it("enforces the schema it publishes", () => {
      const params = compileSchema<{ name: string; count?: number }>(
        objectSchema({ name: { type: "string" }, count: { type: "integer" } }, ["name"]),
      );

      expect(params.parse({ name: "a" })).toEqual({ name: "a" });
      expect(params.parse({ name: "a", count: 2 })).toEqual({ name: "a", count: 2 });
      expect(() => params.parse({ name: "a", count: 1.5 })).toThrow(/must be an integer/);
      expect(() => params.parse({ name: "a", extra: true })).toThrow(/undeclared property "extra"/);
      expect(() => params.parse({})).toThrow(/missing required property "name"/);
      expect(() => params.parse([])).toThrow(/must be an object/);
      expect(() => params.parse(null)).toThrow(/must be an object/);
    });

    it("validates enum, const, arrays, nested objects, and unions", () => {
      const params = compileSchema<unknown>(
        objectSchema({
          mode: { enum: ["fast", "slow"] },
          kind: { const: "palette" },
          tags: { type: "array", items: { type: "string" } },
          nested: objectSchema({ id: { type: "integer" } }, ["id"]),
          target: { anyOf: [{ type: "string" }, { type: "null" }] },
        }),
      );

      expect(() => params.parse({ mode: "fast", kind: "palette", tags: ["a"] })).not.toThrow();
      expect(() => params.parse({ target: null })).not.toThrow();
      expect(() => params.parse({ mode: "medium" })).toThrow(/must be one of/);
      expect(() => params.parse({ kind: "layout" })).toThrow(/must equal "palette"/);
      expect(() => params.parse({ tags: ["a", 2] })).toThrow(/"tags\[1\]" must be a string/);
      expect(() => params.parse({ nested: {} })).toThrow(/missing required property "id"/);
      expect(() => params.parse({ target: 5 })).toThrow(/matched none of the permitted shapes/);
    });

    it("checks known formats and treats unknown ones as annotations", () => {
      const known = compileSchema<{ at: string }>(
        objectSchema({ at: { type: "string", format: "date-time" } }),
      );
      expect(() => known.parse({ at: "2026-07-17T09:00:00Z" })).not.toThrow();
      expect(() => known.parse({ at: "yesterday" })).toThrow(/must be a valid date-time/);

      const unknownFormat = compileSchema<{ host: string }>(
        objectSchema({ host: { type: "string", format: "hostname" } }),
      );
      expect(() => unknownFormat.parse({ host: "anything at all" })).not.toThrow();
    });
  });

  describe("hand-written parsers", () => {
    it("requires an explicit schema and cross-checks it against the declared keys", () => {
      expect(() =>
        createStrictObjectSchema<{ value: string }>(
          ["value"],
          (input) => ({ value: String(input.value) }),
          objectSchema({ different: { type: "string" } }),
        ),
      ).toThrow(/declares keys \[value\] but its jsonSchema describes properties \[different\]/);

      expect(() =>
        createStrictObjectSchema<{ value: string }>(
          ["value"],
          (input) => ({ value: String(input.value) }),
          objectSchema({ value: { type: "string" } }, ["value"]),
        ),
      ).not.toThrow();
    });
  });

  describe("fact-value schemas (compileValueSchema)", () => {
    it("admits the non-object roots a parameter schema forbids, and validates them", () => {
      // A fact value may be a primitive, array, enum member, or union — none of which is an object
      // root, so `compileSchema` would reject them. `compileValueSchema` relaxes only that rule.
      const count = compileValueSchema<number>({ type: "number" });
      expect(count.parse(3)).toBe(3);
      expect(() => count.parse("3")).toThrow(/must be a finite number/);

      const route = compileValueSchema<string>({ type: "string" });
      expect(() => route.parse(7)).toThrow(/must be a string/);

      const tone = compileValueSchema({ type: "string", enum: ["warm", "direct"] });
      expect(() => tone.parse("warm")).not.toThrow();
      expect(() => tone.parse("cold")).toThrow(/must be one of/);

      const ids = compileValueSchema({ type: "array", items: { type: "string" } });
      expect(() => ids.parse(["a", "b"])).not.toThrow();
      expect(() => ids.parse(["a", 2])).toThrow(/must be a string/);

      const nullable = compileValueSchema({ anyOf: [{ type: "string" }, { type: "null" }] });
      expect(() => nullable.parse(null)).not.toThrow();
      expect(() => nullable.parse(3)).toThrow(/matched none of the permitted shapes/);
    });

    it("holds fact schemas to the same profile as parameter schemas below the root", () => {
      expect(() => compileValueSchema({ type: "number", minimum: 1 })).toThrow(
        RegistryCompileError,
      );
      expect(() => compileValueSchema({ type: ["string", "null"] })).toThrow(/outside the profile/);
    });
  });

  it("gives no-parameter declarations a schema a provider can serialize", () => {
    expect(emptyParamsSchema.jsonSchema).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    });
    expect(emptyParamsSchema.parse({})).toEqual({});
    expect(() => emptyParamsSchema.parse({ a: 1 })).toThrow(/undeclared property "a"/);
  });
});
