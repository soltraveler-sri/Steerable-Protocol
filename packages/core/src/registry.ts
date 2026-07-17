/**
 * A value returned synchronously or through a promise by a trusted host seam.
 * Supports SA-DECL-046, SA-DECL-067, and SA-DECL-075.
 */
export type MaybePromise<T> = T | Promise<T>;

/** Stable declaration identifier. Implements SA-DECL-010–013. */
export type CapabilityId = string;
/** Stable identifier for a declared application surface. Implements SA-DECL-080–083. */
export type SurfaceId = string;
/** Developer-owned state taxonomy key. Implements SA-DECL-019–020. */
export type StateKey = string;
/** Closed action-risk vocabulary. Implements SA-DECL-038. */
export type Risk = "safe" | "side_effect" | "mutating" | "destructive";
/** Closed reversibility vocabulary. Implements SA-DECL-039. */
export type ReversibilityKind = "undoable" | "snapshot" | "irreversible";
/** Closed cost-effect vocabulary. Implements SA-DECL-040–043. */
export type CostEffect = "none" | "quota" | "money";
/** Closed confirmation vocabulary. Implements SA-DECL-044. */
export type Confirmation = "never" | "policy" | "always";
/** Door-two eligibility declared on an action or read tool. Implements SA-DECL-130–135. */
export type ExternalExposure = "none" | "eligible";

/**
 * Strict parser paired with the portable JSON Schema it validates against.
 *
 * `jsonSchema` is required, not optional: `SA-DECL-100` requires the model tool schema for an
 * action to be derivable from its declaration, and a declaration whose schema cannot be
 * serialized is a declaration no provider can call. Registry compilation rejects a missing
 * `jsonSchema` per `SA-DECL-096` rather than compiling an action that is silently invisible to
 * the model. Prefer {@link compileSchema}, which derives `parse` from `jsonSchema` so the two
 * cannot disagree (`SA-DECL-093`, `SA-DECL-095`).
 *
 * Implements SA-DECL-016, SA-DECL-035, SA-DECL-064, and SA-DECL-100.
 */
export interface StrictSchema<Value> {
  parse(input: unknown): Value;
  jsonSchema: unknown;
}

/** Policy-relevant external, cost, and sensitive effects. Implements SA-DECL-040–043. */
export interface ActionEffects {
  external: boolean;
  cost: CostEffect;
  sensitive: boolean;
}

/**
 * A trusted, portable snapshot of the state keys an action may restore.
 * Implements SA-LED-082–083.
 */
export interface StateSnapshot {
  capturedAt: string;
  keys: StateKey[];
  values: Record<StateKey, unknown>;
}

/**
 * Application-owned state capture and restoration seam used for snapshot undo.
 * The host app implements this interface against its authoritative state store. Core calls
 * `capture` after policy authorization and before mutation, then calls `restore` only while
 * executing the resulting undo handle. Capture must cover every requested declared write key;
 * restore must settle only after that snapshot has been applied.
 *
 * Implements SA-LED-082–084.
 */
export interface StateSnapshotAdapter {
  capture(keys: StateKey[]): MaybePromise<StateSnapshot>;
  restore(snapshot: StateSnapshot): MaybePromise<void>;
}

/** Realistic user request paired with strict parameters. Implements SA-DECL-048 and SA-DECL-069. */
export interface CapabilityExample<Params = unknown> {
  user: string;
  params: Params;
}

/** Trusted executor context supplied by the runtime. Implements SA-DECL-046 and SA-EXEC-002. */
export interface ActionExecutionContext {
  registry: CapabilityRegistry;
  surfaceId: SurfaceId;
  snapshotStore?: StateSnapshotAdapter;
  signal?: AbortSignal;
  now: () => Date;
}

/** Inputs preserved for a declared inverse. Implements SA-DECL-049 and SA-LED-080–081. */
export interface ActionUndoInput<Params = unknown, Result = unknown> {
  params: Params;
  result?: Result;
  snapshot?: StateSnapshot;
}

/**
 * Closed escape hatch for a stable product command that predates `verb_noun` IDs.
 * Implements SA-DECL-013 and SA-DECL-054.
 */
export interface EstablishedProductCommandIdException {
  kind: "established_product_command";
  productCommand: string;
}

/** Complete declaration of a trusted, policy-classified action. Implements SA-DECL-030–054. */
export interface ActionDeclaration<Params = unknown, Result = unknown> {
  id: CapabilityId;
  title: string;
  description: string;
  params: StrictSchema<Params>;
  reads: StateKey[];
  writes: StateKey[];
  risk: Risk;
  reversibility: { kind: ReversibilityKind };
  effects: ActionEffects;
  confirmation: Confirmation;
  preconditions: string[];
  externalExposure?: ExternalExposure;
  execute(params: Params, context: ActionExecutionContext): MaybePromise<Result>;
  undo?(
    input: ActionUndoInput<Params, Result>,
    context: ActionExecutionContext,
  ): MaybePromise<unknown>;
  observe?(context: ActionExecutionContext): MaybePromise<unknown>;
  idException?: EstablishedProductCommandIdException;
  guidance: string;
  examples: CapabilityExample<Params>[];
}

/** Registry action with explicit door-two eligibility. Implements SA-DECL-130–135. */
export type CompiledActionDeclaration<Params = unknown, Result = unknown> = Omit<
  ActionDeclaration<Params, Result>,
  "externalExposure"
> & {
  externalExposure: ExternalExposure;
};

/** Type-erased action declaration accepted by registry compilation. Implements SA-DECL-090. */
export type AnyActionDeclaration = ActionDeclaration<unknown, unknown>;
/** Type-erased compiled action returned by registry queries. Implements SA-DECL-091–092. */
export type AnyCompiledActionDeclaration = CompiledActionDeclaration<unknown, unknown>;

/** Trusted read-tool query context. Implements SA-DECL-060–067. */
export interface ReadToolContext {
  surfaceId: SurfaceId;
  signal?: AbortSignal;
}

/** Typed, side-effect-free application query. Implements SA-DECL-060–069. */
export interface ReadToolDeclaration<Params = unknown, Result = unknown> {
  id: CapabilityId;
  title: string;
  description: string;
  params: StrictSchema<Params>;
  reads: StateKey[];
  preconditions: string[];
  externalExposure?: ExternalExposure;
  query(params: Params, context: ReadToolContext): MaybePromise<Result>;
  guidance: string;
  examples: CapabilityExample<Params>[];
}

/** Registry read tool with explicit door-two eligibility. Implements SA-DECL-130–135. */
export type CompiledReadToolDeclaration<Params = unknown, Result = unknown> = Omit<
  ReadToolDeclaration<Params, Result>,
  "externalExposure"
> & {
  externalExposure: ExternalExposure;
};

/** One typed entry in a bounded facts declaration. Implements SA-DECL-074. */
export interface FactEntry {
  key: StateKey;
  description: string;
  schema: StrictSchema<unknown>;
}

/** Curated facts published by a live surface. Implements SA-DECL-070–078. */
export interface FactsDeclaration {
  id: CapabilityId;
  title: string;
  description: string;
  surface: SurfaceId;
  facts: FactEntry[];
  publish(): MaybePromise<Record<string, unknown>>;
  update?: "on_registration" | "material_change";
}

/** Named application region and its potentially live capabilities. Implements SA-DECL-080–087. */
export interface SurfaceDeclaration {
  id: SurfaceId;
  title: string;
  description: string;
  capabilities: CapabilityId[];
  location?: { path?: string; label?: string };
}

/** Four declaration collections consumed by registry compilation. Implements SA-DECL-090. */
export interface RegistryDeclarations {
  actions?: AnyActionDeclaration[];
  readTools?: ReadToolDeclaration[];
  facts?: FactsDeclaration[];
  surfaces?: SurfaceDeclaration[];
}

/** Any non-surface capability queryable from the compiled registry. Implements SA-DECL-091–092. */
export type CompiledCapability =
  AnyCompiledActionDeclaration | CompiledReadToolDeclaration | FactsDeclaration;

/** Conformance error raised when registry compilation rejects declarations. Implements SA-DECL-096. */
export class RegistryCompileError extends Error {
  /** Machine-readable conformance failure category. Implements SA-DECL-096. */
  readonly code: string;

  /** Creates a registry conformance failure. Implements SA-DECL-096. */
  constructor(code: string, message: string) {
    super(message);
    this.name = "RegistryCompileError";
    this.code = code;
  }
}

const CAPABILITY_ID = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/;
const SURFACE_ID = /^[a-z0-9][a-z0-9_-]*$/;
const STATE_KEY = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/;

/** Declares an action while preserving inferred parameter and result types. Implements SA-DECL-030–054. */
export function defineAction<Params, Result = unknown>(
  declaration: ActionDeclaration<Params, Result>,
): ActionDeclaration<Params, Result> {
  return declaration;
}

/** Declares a read tool while preserving inferred parameter and result types. Implements SA-DECL-060–069. */
export function defineReadTool<Params, Result = unknown>(
  declaration: ReadToolDeclaration<Params, Result>,
): ReadToolDeclaration<Params, Result> {
  return declaration;
}

/** Declares a bounded facts source. Implements SA-DECL-070–078. */
export function defineFacts(declaration: FactsDeclaration): FactsDeclaration {
  return declaration;
}

/** Declares a capability-scoping surface. Implements SA-DECL-080–087. */
export function defineSurface(declaration: SurfaceDeclaration): SurfaceDeclaration {
  return declaration;
}

/**
 * The `type` values admitted by the Steerable JSON Schema Profile.
 * Documented in `docs/guides/ecosystem-adapters.md`.
 */
type ProfileType = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";

/** Keywords the profile admits on any node. `anyOf` is additionally barred at the root. */
const PROFILE_UNIVERSAL_KEYWORDS: readonly string[] = [
  "type",
  "description",
  "enum",
  "const",
  "anyOf",
];

/** Keywords the profile admits only alongside a given `type`. */
const PROFILE_TYPE_KEYWORDS: Record<ProfileType, readonly string[]> = {
  object: ["properties", "required", "additionalProperties"],
  array: ["items"],
  string: ["pattern", "format"],
  number: [],
  integer: [],
  boolean: [],
  null: [],
};

/**
 * Why each commonly reached-for keyword sits outside the profile. Used to make the compile-time
 * rejection teach rather than merely refuse: an adopter learns at build time instead of via a
 * silent provider-side downgrade.
 */
const PROFILE_EXCLUSIONS: Record<string, string> = {
  minimum: "numeric bounds are stripped by some providers rather than enforced",
  maximum: "numeric bounds are stripped by some providers rather than enforced",
  exclusiveMinimum: "numeric bounds are stripped by some providers rather than enforced",
  exclusiveMaximum: "numeric bounds are stripped by some providers rather than enforced",
  multipleOf: "numeric bounds are stripped by some providers rather than enforced",
  minLength: "length bounds are stripped by some providers rather than enforced; use `pattern`",
  maxLength: "length bounds are stripped by some providers rather than enforced; use `pattern`",
  minItems: "array bounds are stripped by some providers rather than enforced",
  maxItems: "array bounds are stripped by some providers rather than enforced",
  uniqueItems: "array bounds are stripped by some providers rather than enforced",
  $ref: "references and recursion are rejected by several providers; inline the subschema",
  $defs: "references and recursion are rejected by several providers; inline the subschema",
  definitions: "references and recursion are rejected by several providers; inline the subschema",
  oneOf: "exclusive-union semantics are not portable; use `anyOf` below the root",
  allOf: "schema composition is not portable; inline the merged subschema",
  not: "negation is not portable",
  if: "conditional subschemas are not portable",
  then: "conditional subschemas are not portable",
  else: "conditional subschemas are not portable",
  patternProperties: "only fixed `properties` with `additionalProperties: false` are portable",
  propertyNames: "only fixed `properties` with `additionalProperties: false` are portable",
  dependentSchemas: "conditional subschemas are not portable",
  dependentRequired: "conditional subschemas are not portable",
};

/**
 * Formats the profile validates at runtime. Any other `format` is admitted but treated as an
 * annotation only, matching JSON Schema's default, since providers vary in what they enforce.
 */
const PROFILE_FORMATS: Record<string, RegExp> = {
  "date-time": /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  time: /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  uri: /^[a-zA-Z][a-zA-Z0-9+.-]*:\S*$/,
};

type SchemaNode = Record<string, unknown>;

/**
 * Asserts that one JSON Schema lies inside the Steerable JSON Schema Profile.
 *
 * The profile is the intersection of what mainstream providers actually honor in a tool
 * definition, not all of JSON Schema. A keyword outside it is rejected here, at compile time,
 * with a message naming the keyword — because the alternative is a provider silently dropping
 * the constraint at request time, leaving the declaration and the model's grammar disagreeing in
 * violation of `SA-DECL-095`.
 *
 * The profile, and the provider evidence behind each inclusion and exclusion, is documented in
 * `docs/guides/ecosystem-adapters.md`.
 *
 * Implements SA-DECL-016, SA-DECL-096, and SA-DECL-100.
 *
 * @param jsonSchema - The candidate schema.
 * @param label - Declaration or field name used in error messages.
 * @throws RegistryCompileError When the schema leaves the profile.
 */
export function assertSchemaProfile(jsonSchema: unknown, label = "schema"): void {
  const root = requireSchemaNode(jsonSchema, "(root)", label);
  if (root.type !== "object") {
    throw schemaProfileError(
      label,
      "(root)",
      'the root of a parameter schema must declare `type: "object"`, because every mainstream provider requires a tool input schema to be an object',
    );
  }
  if ("anyOf" in root) {
    throw schemaProfileError(
      label,
      "(root)",
      "`anyOf` is admitted only below the root; a root-level union is not portable",
    );
  }
  assertProfileNode(root, "(root)", label);
}

/**
 * Compiles a profile-conformant JSON Schema into a strict parser paired with that schema.
 *
 * This is the direction information theory allows: a schema cannot be recovered from an arbitrary
 * `parse` closure, but a validator can always be derived from a schema. Deriving `parse` removes
 * the second, hand-maintained representation of the parameter contract that `SA-DECL-093` and
 * `SA-DECL-095` forbid — the schema shown to the model and the parser enforced at dispatch are one
 * source, so they cannot drift.
 *
 * `Params` is supplied by the caller and asserted, not inferred; the returned `parse` is what
 * enforces the contract at runtime.
 *
 * Implements SA-DECL-016, SA-DECL-035, SA-DECL-064, SA-DECL-093, SA-DECL-095, and SA-DECL-100.
 *
 * @param jsonSchema - A schema inside the Steerable JSON Schema Profile.
 * @throws RegistryCompileError When the schema leaves the profile.
 */
export function compileSchema<Params = unknown>(jsonSchema: unknown): StrictSchema<Params> {
  assertSchemaProfile(jsonSchema);
  const root = jsonSchema as SchemaNode;
  return {
    jsonSchema,
    parse(input: unknown): Params {
      parseAgainstNode(root, input, "");
      return input as Params;
    },
  };
}

/**
 * Asserts that a fact-value JSON Schema lies inside the Steerable JSON Schema Profile.
 *
 * The parameter-schema variant {@link assertSchemaProfile} additionally requires an object root,
 * because a provider tool input must be an object. A published fact value carries no such
 * constraint: a fact may be a string, number, array, enum member, nullable union, or object. This
 * relaxes only the root-shape rule and reuses the identical per-node profile checks, so a fact
 * schema is held to the same portability bar as a parameter schema everywhere below the root.
 *
 * Implements SA-DECL-016, SA-DECL-074, and SA-DECL-096.
 *
 * @param jsonSchema - The candidate fact-value schema.
 * @param label - Fact key or declaration name used in error messages.
 * @throws RegistryCompileError When the schema leaves the profile.
 */
export function assertValueSchemaProfile(jsonSchema: unknown, label = "fact"): void {
  const root = requireSchemaNode(jsonSchema, "(root)", label);
  assertProfileNode(root, "(root)", label);
}

/**
 * Compiles a profile-conformant fact-value JSON Schema into a strict parser paired with that schema.
 *
 * This is the fact-value analog of {@link compileSchema}: it derives the validator from the schema
 * so the two representations of a fact's type cannot drift (`SA-DECL-093`, `SA-DECL-095`), and it is
 * what gives `SA-CTX-024` teeth — a fact declared as a `number` whose publisher emits a string is
 * rejected at publish rather than silently corrupting router context. Unlike {@link compileSchema}
 * it admits a non-object root, because a fact value may be a primitive, array, enum, or union.
 *
 * Implements SA-DECL-016, SA-DECL-074, SA-DECL-093, SA-DECL-095, and SA-CTX-024.
 *
 * @param jsonSchema - A fact-value schema inside the Steerable JSON Schema Profile.
 * @throws RegistryCompileError When the schema leaves the profile.
 */
export function compileValueSchema<Value = unknown>(jsonSchema: unknown): StrictSchema<Value> {
  assertValueSchemaProfile(jsonSchema);
  const root = jsonSchema as SchemaNode;
  return {
    jsonSchema,
    parse(input: unknown): Value {
      parseAgainstNode(root, input, "");
      return input as Value;
    },
  };
}

/**
 * Builds an object parser that rejects undeclared keys, paired with its portable JSON Schema.
 *
 * Prefer {@link compileSchema}; reach for this only when the parameter contract genuinely needs a
 * hand-written parser (a custom coercion or a cross-field invariant the profile cannot express).
 * `jsonSchema` is a required argument: an omitted schema previously produced an action that
 * compiled cleanly and was then silently absent from every generated tool surface. The declared
 * `keys` and the schema's `properties` are cross-checked so the two halves cannot drift apart
 * (`SA-DECL-093`).
 *
 * Implements SA-DECL-035, SA-DECL-064, SA-DECL-096, and SA-DECL-100.
 *
 * @throws RegistryCompileError When the schema leaves the profile or disagrees with `keys`.
 */
export function createStrictObjectSchema<Params extends Record<string, unknown>>(
  keys: readonly (keyof Params & string)[],
  parseValues: (input: Record<string, unknown>) => Params,
  jsonSchema: unknown,
): StrictSchema<Params> {
  assertSchemaProfile(jsonSchema);
  const declared = [...keys].sort();
  const described = Object.keys(((jsonSchema as SchemaNode).properties ?? {}) as SchemaNode).sort();
  if (declared.length !== described.length || declared.some((key, i) => key !== described[i])) {
    throw new RegistryCompileError(
      "schema_key_mismatch",
      `Strict object schema declares keys [${declared.join(", ")}] but its jsonSchema describes properties [${described.join(", ")}]. The parser and the model-facing schema must describe the same parameters (SA-DECL-093).`,
    );
  }

  return {
    jsonSchema,
    parse(input: unknown): Params {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Expected an object parameter payload.");
      }

      const record = input as Record<string, unknown>;
      const allowed = new Set<string>(keys);
      const extraKey = Object.keys(record).find((key) => !allowed.has(key));

      if (extraKey) {
        throw new Error(`Unexpected parameter \"${extraKey}\".`);
      }

      return parseValues(record);
    },
  };
}

/** Strict empty-object schema for declarations without parameters. Implements SA-DECL-035 and SA-DECL-064. */
export const emptyParamsSchema: StrictSchema<Record<string, never>> = compileSchema<
  Record<string, never>
>({ type: "object", properties: {}, additionalProperties: false });

function schemaProfileError(label: string, path: string, detail: string): RegistryCompileError {
  return new RegistryCompileError(
    "schema_profile_violation",
    `Schema for \"${label}\" at ${path}: ${detail}. See the Steerable JSON Schema Profile in docs/guides/ecosystem-adapters.md.`,
  );
}

function requireSchemaNode(node: unknown, path: string, label: string): SchemaNode {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    throw schemaProfileError(label, path, "expected a JSON Schema object");
  }
  return node as SchemaNode;
}

function assertProfileNode(node: SchemaNode, path: string, label: string): void {
  const type = node.type;
  const hasAnyOf = "anyOf" in node;

  if (type !== undefined && hasAnyOf) {
    throw schemaProfileError(
      label,
      path,
      "a node must declare either `type` or `anyOf`, not both; combined forms are not portable",
    );
  }
  if (type !== undefined && !isProfileType(type)) {
    throw schemaProfileError(
      label,
      path,
      `\`type: ${JSON.stringify(type)}\` is outside the profile; use one of ${Object.keys(PROFILE_TYPE_KEYWORDS).join(", ")}`,
    );
  }

  // The keyword scan runs before the structural check below so that a schema whose only sin is an
  // excluded keyword is rejected by *name* — `$ref`, `oneOf`, `allOf` and `not` all appear on
  // nodes that declare no `type`, and reporting "declare a type" there would hide the real cause.
  const allowed = new Set<string>([
    ...PROFILE_UNIVERSAL_KEYWORDS,
    ...(isProfileType(type) ? PROFILE_TYPE_KEYWORDS[type] : []),
  ]);
  for (const keyword of Object.keys(node)) {
    if (allowed.has(keyword)) continue;
    const reason = PROFILE_EXCLUSIONS[keyword];
    throw schemaProfileError(
      label,
      path,
      reason
        ? `keyword \`${keyword}\` is outside the profile because ${reason}`
        : `keyword \`${keyword}\` is outside the profile`,
    );
  }

  if (type === undefined && !hasAnyOf && !("enum" in node) && !("const" in node)) {
    throw schemaProfileError(
      label,
      path,
      "a node must declare at least one of `type`, `anyOf`, `enum`, or `const`",
    );
  }

  if (node.description !== undefined && typeof node.description !== "string") {
    throw schemaProfileError(label, path, "`description` must be a string");
  }
  if ("enum" in node && (!Array.isArray(node.enum) || node.enum.length === 0)) {
    throw schemaProfileError(label, path, "`enum` must be a non-empty array");
  }

  if (hasAnyOf) {
    if (!Array.isArray(node.anyOf) || node.anyOf.length === 0) {
      throw schemaProfileError(label, path, "`anyOf` must be a non-empty array of schemas");
    }
    node.anyOf.forEach((member, index) => {
      const child = requireSchemaNode(member, `${path}/anyOf/${index}`, label);
      assertProfileNode(child, `${path}/anyOf/${index}`, label);
    });
  }

  if (type === "object") assertProfileObjectNode(node, path, label);
  if (type === "array") {
    const items = requireSchemaNode(node.items, `${path}/items`, label);
    assertProfileNode(items, `${path}/items`, label);
  }
  if (type === "string") assertProfileStringNode(node, path, label);
}

function assertProfileObjectNode(node: SchemaNode, path: string, label: string): void {
  if (node.additionalProperties !== false) {
    throw schemaProfileError(
      label,
      path,
      "an object node must declare `additionalProperties: false`; declared parameters are closed (SA-DECL-035) and several providers require it",
    );
  }
  const properties = requireSchemaNode(node.properties ?? {}, `${path}/properties`, label);
  for (const [key, child] of Object.entries(properties)) {
    const childPath = `${path}/properties/${key}`;
    assertProfileNode(requireSchemaNode(child, childPath, label), childPath, label);
  }
  if (node.required !== undefined) {
    if (
      !Array.isArray(node.required) ||
      node.required.some((key) => typeof key !== "string" || !(key in properties))
    ) {
      throw schemaProfileError(
        label,
        path,
        "`required` must be an array of names declared in `properties`",
      );
    }
  }
}

function assertProfileStringNode(node: SchemaNode, path: string, label: string): void {
  if (node.pattern !== undefined) {
    if (typeof node.pattern !== "string") {
      throw schemaProfileError(label, path, "`pattern` must be a string");
    }
    try {
      new RegExp(node.pattern);
    } catch {
      throw schemaProfileError(label, path, `\`pattern\` is not a valid regular expression`);
    }
  }
  if (node.format !== undefined && typeof node.format !== "string") {
    throw schemaProfileError(label, path, "`format` must be a string");
  }
}

function isProfileType(value: unknown): value is ProfileType {
  return typeof value === "string" && value in PROFILE_TYPE_KEYWORDS;
}

function parseAgainstNode(node: SchemaNode, value: unknown, path: string): void {
  const where = path === "" ? "parameters" : `\"${path}\"`;

  if (Array.isArray(node.anyOf)) {
    const matched = node.anyOf.some((member) => {
      try {
        parseAgainstNode(member as SchemaNode, value, path);
        return true;
      } catch {
        return false;
      }
    });
    if (!matched) throw new Error(`${where} matched none of the permitted shapes.`);
    return;
  }
  if ("const" in node && !deepEquals(value, node.const)) {
    throw new Error(`${where} must equal ${JSON.stringify(node.const)}.`);
  }
  if (Array.isArray(node.enum) && !node.enum.some((option) => deepEquals(value, option))) {
    throw new Error(`${where} must be one of ${JSON.stringify(node.enum)}.`);
  }
  if (node.type === undefined) return;

  switch (node.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${where} must be an object.`);
      }
      const record = value as Record<string, unknown>;
      const properties = (node.properties ?? {}) as SchemaNode;
      const extraKey = Object.keys(record).find((key) => !(key in properties));
      if (extraKey) throw new Error(`${where} has an undeclared property \"${extraKey}\".`);
      for (const key of (node.required as string[] | undefined) ?? []) {
        if (!(key in record)) throw new Error(`${where} is missing required property \"${key}\".`);
      }
      for (const [key, child] of Object.entries(properties)) {
        if (key in record) {
          parseAgainstNode(child as SchemaNode, record[key], path === "" ? key : `${path}.${key}`);
        }
      }
      return;
    }
    case "array": {
      if (!Array.isArray(value)) throw new Error(`${where} must be an array.`);
      value.forEach((entry, index) => {
        parseAgainstNode(node.items as SchemaNode, entry, `${path}[${index}]`);
      });
      return;
    }
    case "string": {
      if (typeof value !== "string") throw new Error(`${where} must be a string.`);
      if (typeof node.pattern === "string" && !new RegExp(node.pattern).test(value)) {
        throw new Error(`${where} must match ${node.pattern}.`);
      }
      const format = typeof node.format === "string" ? PROFILE_FORMATS[node.format] : undefined;
      if (format && !format.test(value)) {
        throw new Error(`${where} must be a valid ${String(node.format)}.`);
      }
      return;
    }
    case "integer": {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new Error(`${where} must be an integer.`);
      }
      return;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${where} must be a finite number.`);
      }
      return;
    }
    case "boolean": {
      if (typeof value !== "boolean") throw new Error(`${where} must be a boolean.`);
      return;
    }
    case "null": {
      if (value !== null) throw new Error(`${where} must be null.`);
      return;
    }
  }
}

function deepEquals(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => deepEquals(entry, right[index]));
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left as object);
  const rightKeys = Object.keys(right as object);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) =>
      key in (right as object) && deepEquals((left as SchemaNode)[key], (right as SchemaNode)[key]),
  );
}

/**
 * Mutable surface-liveness and precondition state for one requesting session or principal.
 *
 * The compiled registry (IDs, schemas, metadata, surface capability lists) is immutable and safe to
 * share across principals; only this state is per-principal. Isolating it is what `SA-DECL-097`
 * requires: on a shared-process host that compiles the registry once, one principal's live surfaces
 * and satisfied predicates MUST NOT leak into another principal's availability queries or policy
 * resolution. A server adopter builds one `LivenessState` per request, populates it for that
 * request's principal, and reads availability through {@link CapabilityRegistry.withLiveness}.
 *
 * Implements SA-DECL-084–085 and SA-DECL-097.
 */
export interface LivenessState {
  /** Surfaces currently live for this principal. */
  liveSurfaces: Set<SurfaceId>;
  /** Non-surface host predicates currently satisfied for this principal. */
  satisfiedPredicates: Set<string>;
}

/** Creates an empty per-principal {@link LivenessState}. Implements SA-DECL-097. */
export function createLivenessState(): LivenessState {
  return { liveSurfaces: new Set<SurfaceId>(), satisfiedPredicates: new Set<string>() };
}

/**
 * The liveness-dependent availability reads of the registry, scoped to one {@link LivenessState}.
 *
 * Every method here answers "is this live/available/satisfied?" against a specific principal's
 * liveness state rather than shared instance state. Policy resolution (`SA-POL-105`) and execution
 * consume this view so that surface liveness and precondition state are principal-scoped per
 * `SA-DECL-097`. The compiled, immutable declaration data (schemas, metadata, surface membership)
 * is read straight from the registry and is identical for every view.
 *
 * Implements SA-DECL-085 and SA-DECL-097.
 */
export interface RegistryAvailabilityView {
  /** Reports current surface liveness for this principal. Implements SA-DECL-084–086. */
  isSurfaceLive(id: SurfaceId): boolean;
  /** Evaluates one surface or host predicate for this principal. Implements SA-DECL-045 and SA-DECL-085. */
  isPreconditionSatisfied(token: string): boolean;
  /** Evaluates conjunctive capability preconditions for this principal. Implements SA-DECL-045 and SA-DECL-085. */
  arePreconditionsSatisfied(preconditions: readonly string[]): boolean;
  /** Checks whether a surface declares a capability (liveness-independent). Implements SA-DECL-083. */
  isCapabilityOnSurface(capabilityId: CapabilityId, surfaceId: SurfaceId): boolean;
  /** Checks live, scoped action availability for this principal. Implements SA-DECL-085. */
  isActionAvailableOnSurface(actionId: CapabilityId, surfaceId: SurfaceId): boolean;
  /** Checks live, scoped read-tool availability for this principal. Implements SA-DECL-085. */
  isReadToolAvailableOnSurface(readToolId: CapabilityId, surfaceId: SurfaceId): boolean;
  /** Lists live capabilities for a surface for this principal. Implements SA-DECL-085 and SA-DECL-091. */
  getLiveCapabilities(surfaceId: SurfaceId): CompiledCapability[];
  /** Lists live actions for a surface for this principal. Implements SA-DECL-085 and SA-DECL-091. */
  getLiveActions(surfaceId: SurfaceId): AnyCompiledActionDeclaration[];
  /** Lists live read tools for a surface for this principal. Implements SA-DECL-085 and SA-DECL-091. */
  getLiveReadTools(surfaceId: SurfaceId): CompiledReadToolDeclaration[];
  /** Lists live facts for a surface for this principal. Implements SA-DECL-071, SA-DECL-083, and SA-DECL-085. */
  getLiveFacts(surfaceId: SurfaceId): FactsDeclaration[];
}

/**
 * A {@link RegistryAvailabilityView} over one {@link LivenessState}.
 *
 * Liveness and precondition answers come from the supplied `state`; all immutable declaration data
 * (surface membership, action preconditions, the capability collections) is read from the registry,
 * so two views over the same registry differ only in which surfaces and predicates they consider
 * live. This is the mechanism behind `SA-DECL-097`: the registry hands out one view per principal
 * instead of exposing shared mutable liveness. Implements SA-DECL-085 and SA-DECL-097.
 */
class LivenessView implements RegistryAvailabilityView {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly state: LivenessState,
  ) {}

  isSurfaceLive(id: SurfaceId): boolean {
    return this.state.liveSurfaces.has(id);
  }

  isPreconditionSatisfied(token: string): boolean {
    return token.startsWith("surface:")
      ? this.state.liveSurfaces.has(token.slice("surface:".length))
      : this.state.satisfiedPredicates.has(token);
  }

  arePreconditionsSatisfied(preconditions: readonly string[]): boolean {
    return preconditions.every((token) => this.isPreconditionSatisfied(token));
  }

  isCapabilityOnSurface(capabilityId: CapabilityId, surfaceId: SurfaceId): boolean {
    return this.registry.isCapabilityOnSurface(capabilityId, surfaceId);
  }

  isActionAvailableOnSurface(actionId: CapabilityId, surfaceId: SurfaceId): boolean {
    const action = this.registry.getAction(actionId);
    return Boolean(
      action &&
      this.state.liveSurfaces.has(surfaceId) &&
      this.registry.isCapabilityOnSurface(actionId, surfaceId) &&
      this.arePreconditionsSatisfied(action.preconditions),
    );
  }

  isReadToolAvailableOnSurface(readToolId: CapabilityId, surfaceId: SurfaceId): boolean {
    const readTool = this.registry.getReadTool(readToolId);
    return Boolean(
      readTool &&
      this.state.liveSurfaces.has(surfaceId) &&
      this.registry.isCapabilityOnSurface(readToolId, surfaceId) &&
      this.arePreconditionsSatisfied(readTool.preconditions),
    );
  }

  getLiveCapabilities(surfaceId: SurfaceId): CompiledCapability[] {
    if (!this.state.liveSurfaces.has(surfaceId)) return [];
    return this.registry.getAllCapabilities().filter((capability) => {
      if (!this.registry.isCapabilityOnSurface(capability.id, surfaceId)) return false;
      if ("preconditions" in capability)
        return this.arePreconditionsSatisfied(capability.preconditions);
      return capability.surface === surfaceId;
    });
  }

  getLiveActions(surfaceId: SurfaceId): AnyCompiledActionDeclaration[] {
    return this.registry
      .getAllActions()
      .filter((action) => this.isActionAvailableOnSurface(action.id, surfaceId));
  }

  getLiveReadTools(surfaceId: SurfaceId): CompiledReadToolDeclaration[] {
    return this.registry
      .getAllReadTools()
      .filter((readTool) => this.isReadToolAvailableOnSurface(readTool.id, surfaceId));
  }

  getLiveFacts(surfaceId: SurfaceId): FactsDeclaration[] {
    return this.registry
      .getAllFacts()
      .filter(
        (facts) =>
          facts.surface === surfaceId &&
          this.state.liveSurfaces.has(surfaceId) &&
          this.registry.isCapabilityOnSurface(facts.id, surfaceId),
      );
  }
}

/**
 * Compiles declarations into the single runtime source of capability truth.
 * Construction validates IDs, required metadata, schemas, value sets, and surface references;
 * runtime queries preserve declaration semantics for policy, execution, evals, and bridges.
 *
 * Surface liveness and precondition state are held as mutable per-instance sets that back the
 * registry's own default availability view (the SPA path: one process, one principal, calling
 * `registerSurface`/`setPrecondition` directly). A server that compiles the registry once and
 * serves many principals MUST NOT read availability off that shared instance state; it obtains a
 * per-request {@link RegistryAvailabilityView} from {@link withLiveness} so one principal's live
 * surfaces never satisfy another principal's availability (`SA-DECL-097`).
 *
 * Implements SA-DECL-090–096, SA-DECL-097, and SA-DECL-130–136.
 */
export class CapabilityRegistry {
  private readonly actions = new Map<CapabilityId, AnyCompiledActionDeclaration>();
  private readonly readTools = new Map<CapabilityId, CompiledReadToolDeclaration>();
  private readonly facts = new Map<CapabilityId, FactsDeclaration>();
  private readonly surfaces = new Map<SurfaceId, SurfaceDeclaration>();
  private readonly liveSurfaces = new Set<SurfaceId>();
  private readonly satisfiedPredicates = new Set<string>();
  private readonly listeners = new Set<() => void>();
  /**
   * The default availability view over this registry's own instance liveness state. The mutators
   * (`registerSurface`, `deregisterSurface`, `setPrecondition`) and this view share the same `Set`
   * instances, so the SPA path — register on the instance, read through the registry — is
   * unchanged. Server code that needs per-principal isolation uses {@link withLiveness} instead.
   * Implements SA-DECL-097.
   */
  private readonly defaultLivenessView: RegistryAvailabilityView = new LivenessView(this, {
    liveSurfaces: this.liveSurfaces,
    satisfiedPredicates: this.satisfiedPredicates,
  });

  /** Compiles and validates the supplied declarations. Implements SA-DECL-090–096. */
  constructor(declarations: RegistryDeclarations = {}) {
    for (const action of declarations.actions ?? []) this.compileAction(action);
    for (const readTool of declarations.readTools ?? []) this.compileReadTool(readTool);
    for (const facts of declarations.facts ?? []) this.compileFacts(facts);
    for (const surface of declarations.surfaces ?? []) this.compileSurface(surface);
    this.validateReferences();
  }

  /**
   * Returns a {@link RegistryAvailabilityView} scoped to a caller-owned {@link LivenessState}.
   *
   * This is the request-scoped read path a server adopter falls into: compile the registry once,
   * build one `LivenessState` per request, and answer availability and policy through the returned
   * view. Because liveness comes from the supplied state and not from the shared instance sets, one
   * principal's surface registration or satisfied precondition can never make a capability available
   * for another principal's invocation. Implements SA-DECL-085 and SA-DECL-097.
   */
  withLiveness(state: LivenessState): RegistryAvailabilityView {
    return new LivenessView(this, state);
  }

  /**
   * The registry's own availability view over its instance liveness state — the default consulted by
   * policy and execution when no per-request view is supplied, preserving the single-principal SPA
   * path unchanged. Implements SA-DECL-097.
   */
  get defaultView(): RegistryAvailabilityView {
    return this.defaultLivenessView;
  }

  /** Returns a compiled action by stable ID. Implements SA-DECL-091–092. */
  getAction(id: CapabilityId): AnyCompiledActionDeclaration | undefined {
    return this.actions.get(id);
  }

  /** Returns a compiled action or raises a registry error. Implements SA-DECL-091 and SA-DECL-096. */
  requireAction(id: CapabilityId): AnyCompiledActionDeclaration {
    const action = this.getAction(id);
    if (!action) throw new RegistryCompileError("unknown_action", `Unknown action \"${id}\".`);
    return action;
  }

  /** Returns a compiled read tool by stable ID. Implements SA-DECL-091–092. */
  getReadTool(id: CapabilityId): CompiledReadToolDeclaration | undefined {
    return this.readTools.get(id);
  }

  /** Returns a facts declaration by stable ID. Implements SA-DECL-091–092. */
  getFacts(id: CapabilityId): FactsDeclaration | undefined {
    return this.facts.get(id);
  }

  /** Returns a surface declaration by stable ID. Implements SA-DECL-091–092. */
  getSurface(id: SurfaceId): SurfaceDeclaration | undefined {
    return this.surfaces.get(id);
  }

  /** Returns any non-surface capability by stable ID. Implements SA-DECL-091–092. */
  getCapability(id: CapabilityId): CompiledCapability | undefined {
    return this.actions.get(id) ?? this.readTools.get(id) ?? this.facts.get(id);
  }

  /** Lists all compiled non-surface capabilities. Implements SA-DECL-091–092. */
  getAllCapabilities(): CompiledCapability[] {
    return [...this.actions.values(), ...this.readTools.values(), ...this.facts.values()];
  }

  /** Lists all compiled actions. Implements SA-DECL-091–092. */
  getAllActions(): AnyCompiledActionDeclaration[] {
    return [...this.actions.values()];
  }

  /** Lists all compiled read tools. Implements SA-DECL-091–092. */
  getAllReadTools(): CompiledReadToolDeclaration[] {
    return [...this.readTools.values()];
  }

  /** Lists all declared facts sources. Implements SA-DECL-091–092. */
  getAllFacts(): FactsDeclaration[] {
    return [...this.facts.values()];
  }

  /** Lists all declared surfaces. Implements SA-DECL-091–092. */
  getAllSurfaces(): SurfaceDeclaration[] {
    return [...this.surfaces.values()];
  }

  /** Marks a declared surface live. Implements SA-DECL-084–086. */
  registerSurface(id: SurfaceId): void {
    if (!this.surfaces.has(id)) {
      throw new RegistryCompileError(
        "undeclared_surface",
        `Cannot register undeclared surface \"${id}\".`,
      );
    }
    this.liveSurfaces.add(id);
    this.emit();
  }

  /** Marks a surface no longer live. Implements SA-DECL-084–086. */
  deregisterSurface(id: SurfaceId): void {
    this.liveSurfaces.delete(id);
    this.emit();
  }

  /** Reports current surface liveness on the default view. Implements SA-DECL-084–086. */
  isSurfaceLive(id: SurfaceId): boolean {
    return this.defaultLivenessView.isSurfaceLive(id);
  }

  /** Updates a host-known availability predicate. Implements SA-DECL-045 and SA-DECL-085. */
  setPrecondition(token: string, satisfied: boolean): void {
    if (satisfied) this.satisfiedPredicates.add(token);
    else this.satisfiedPredicates.delete(token);
    this.emit();
  }

  /** Subscribes to liveness or predicate changes. Implements SA-DECL-084–086. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Evaluates one surface or host predicate on the default view. Implements SA-DECL-045 and SA-DECL-085. */
  isPreconditionSatisfied(token: string): boolean {
    return this.defaultLivenessView.isPreconditionSatisfied(token);
  }

  /** Evaluates conjunctive capability preconditions on the default view. Implements SA-DECL-045 and SA-DECL-085. */
  arePreconditionsSatisfied(preconditions: readonly string[]): boolean {
    return this.defaultLivenessView.arePreconditionsSatisfied(preconditions);
  }

  /**
   * Checks whether a surface declares a capability. Liveness-independent: it reads only the compiled,
   * immutable surface membership, so it is identical for every principal and lives on the registry
   * itself rather than a per-principal view. Implements SA-DECL-083 and SA-DECL-085.
   */
  isCapabilityOnSurface(capabilityId: CapabilityId, surfaceId: SurfaceId): boolean {
    return this.surfaces.get(surfaceId)?.capabilities.includes(capabilityId) ?? false;
  }

  /** Checks live, scoped action availability on the default view. Implements SA-DECL-085. */
  isActionAvailableOnSurface(actionId: CapabilityId, surfaceId: SurfaceId): boolean {
    return this.defaultLivenessView.isActionAvailableOnSurface(actionId, surfaceId);
  }

  /** Checks live, scoped read-tool availability on the default view. Implements SA-DECL-085. */
  isReadToolAvailableOnSurface(readToolId: CapabilityId, surfaceId: SurfaceId): boolean {
    return this.defaultLivenessView.isReadToolAvailableOnSurface(readToolId, surfaceId);
  }

  /** Lists live capabilities for a surface on the default view. Implements SA-DECL-085 and SA-DECL-091. */
  getLiveCapabilities(surfaceId: SurfaceId): CompiledCapability[] {
    return this.defaultLivenessView.getLiveCapabilities(surfaceId);
  }

  /** Lists live actions for a surface on the default view. Implements SA-DECL-085 and SA-DECL-091. */
  getLiveActions(surfaceId: SurfaceId): AnyCompiledActionDeclaration[] {
    return this.defaultLivenessView.getLiveActions(surfaceId);
  }

  /** Lists live read tools for a surface on the default view. Implements SA-DECL-085 and SA-DECL-091. */
  getLiveReadTools(surfaceId: SurfaceId): CompiledReadToolDeclaration[] {
    return this.defaultLivenessView.getLiveReadTools(surfaceId);
  }

  /** Lists live facts for a surface on the default view. Implements SA-DECL-071, SA-DECL-083, and SA-DECL-085. */
  getLiveFacts(surfaceId: SurfaceId): FactsDeclaration[] {
    return this.defaultLivenessView.getLiveFacts(surfaceId);
  }

  /** Parses action parameters through the declaration schema. Implements SA-DECL-035 and SA-EXEC-001. */
  validateActionParams<Params>(action: CompiledActionDeclaration<Params>, params: unknown): Params {
    return action.params.parse(params);
  }

  /**
   * Publishes a facts source through value validation.
   *
   * Awaits the declaration's `publish()` and validates the returned values with
   * {@link validatePublishedFacts}. This is the facts-layer analog of {@link validateActionParams}:
   * action parameters were already parsed at dispatch, but a facts publisher declared the same strict
   * typed schemas (`SA-DECL-074`) with no equivalent enforcement point, so a lying or malformed fact
   * reached the router unchecked. Routing every read of published facts through this method closes
   * that asymmetry — the reference facts-read path validates here rather than calling `publish()`
   * directly.
   *
   * Liveness-independent by design, so it composes with B1's per-principal availability views: a
   * caller lists the facts live for a principal through a {@link RegistryAvailabilityView}
   * (`view.getLiveFacts(surfaceId)`) and validates each published payload here by ID. Which facts are
   * live is a per-principal question answered by the view; whether a published value conforms to its
   * declared schema is a per-declaration question answered here against immutable compiled data.
   *
   * Implements SA-CTX-023, SA-CTX-024, and SA-DECL-074.
   *
   * @throws RegistryCompileError When the facts ID is unknown, the payload is not an object, a
   * top-level key is undeclared, or a value fails its declared schema.
   */
  async publishFacts(factsId: CapabilityId): Promise<Record<string, unknown>> {
    const declaration = this.getFacts(factsId);
    if (!declaration)
      throw new RegistryCompileError("unknown_facts", `Unknown facts \"${factsId}\".`);
    return this.validatePublishedFacts(declaration, await declaration.publish());
  }

  /**
   * Validates already-published fact values against a facts declaration.
   *
   * Enforces the two facts-integrity contracts a declared-but-unenforced schema left open:
   * `SA-CTX-023` — every published top-level key MUST be one the declaration enumerates, so a
   * publisher cannot mint a data-dependent or unbounded set of fact keys at runtime; and
   * `SA-CTX-024` — every published value MUST parse against its declared fact schema. Present
   * declared keys are validated against their schema; a declared fact the publisher omits is not an
   * error here, because only a value that is actually published can misrepresent state.
   *
   * Implements SA-CTX-023 and SA-CTX-024.
   *
   * @throws RegistryCompileError When the payload is not an object, a key is undeclared, or a value
   * fails its declared schema.
   */
  validatePublishedFacts(
    declaration: FactsDeclaration,
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!values || typeof values !== "object" || Array.isArray(values))
      throw new RegistryCompileError(
        "invalid_facts_payload",
        `Facts \"${declaration.id}\" must publish an object of fact values.`,
      );
    const declared = new Map(declaration.facts.map((fact) => [fact.key, fact]));
    for (const [key, value] of Object.entries(values)) {
      const fact = declared.get(key);
      if (!fact)
        throw new RegistryCompileError(
          "undeclared_fact_key",
          `Facts \"${declaration.id}\" published undeclared top-level fact key \"${key}\". A facts publisher must not create top-level keys outside its declared facts list (SA-CTX-023).`,
        );
      try {
        fact.schema.parse(value);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new RegistryCompileError(
          "fact_value_invalid",
          `Facts \"${declaration.id}\" published fact \"${key}\" with a value outside its declared schema (SA-CTX-024): ${detail}`,
        );
      }
    }
    return values;
  }

  private compileAction(declaration: AnyActionDeclaration): void {
    this.ensureUnusedId(declaration.id);
    this.validateCapabilityId(declaration.id);
    this.validateAction(declaration);
    this.actions.set(declaration.id, {
      ...declaration,
      externalExposure: declaration.externalExposure ?? "none",
    });
  }

  private compileReadTool(declaration: ReadToolDeclaration): void {
    this.ensureUnusedId(declaration.id);
    this.validateCapabilityId(declaration.id);
    this.validateReadTool(declaration);
    this.readTools.set(declaration.id, {
      ...declaration,
      externalExposure: declaration.externalExposure ?? "none",
    });
  }

  private compileFacts(declaration: FactsDeclaration): void {
    this.ensureUnusedId(declaration.id);
    this.validateCapabilityId(declaration.id);
    this.validateFacts(declaration);
    this.facts.set(declaration.id, declaration);
  }

  private compileSurface(declaration: SurfaceDeclaration): void {
    this.ensureUnusedId(declaration.id);
    if (!SURFACE_ID.test(declaration.id))
      this.fail("invalid_surface_id", `Invalid surface id \"${declaration.id}\".`);
    this.validateSurface(declaration);
    this.surfaces.set(declaration.id, declaration);
  }

  private validateAction(declaration: AnyActionDeclaration): void {
    this.validateCommon(declaration, true);
    this.ensureSchema(declaration.params, declaration.id);
    this.ensureStringArray("reads", declaration.reads, true);
    this.ensureStringArray("writes", declaration.writes, true);
    this.ensureStringArray("preconditions", declaration.preconditions, false);
    if (!isRisk(declaration.risk))
      this.fail("invalid_risk", `Invalid risk for action \"${declaration.id}\".`);
    if (!declaration.reversibility || !isReversibility(declaration.reversibility.kind))
      this.fail("invalid_reversibility", `Invalid reversibility for action \"${declaration.id}\".`);
    if (
      !declaration.effects ||
      typeof declaration.effects.external !== "boolean" ||
      typeof declaration.effects.sensitive !== "boolean" ||
      !isCost(declaration.effects.cost)
    )
      this.fail("invalid_effects", `Invalid effects for action \"${declaration.id}\".`);
    if (!isConfirmation(declaration.confirmation))
      this.fail("invalid_confirmation", `Invalid confirmation for action \"${declaration.id}\".`);
    this.validateActionIdException(declaration);
    this.validateExternalExposure(declaration.externalExposure, declaration.id);
    if (typeof declaration.execute !== "function")
      this.fail("missing_execute", `Action \"${declaration.id}\" must declare an executor.`);
    if (declaration.reversibility.kind === "undoable" && typeof declaration.undo !== "function")
      this.fail("missing_undo", `Undoable action \"${declaration.id}\" must declare undo.`);
    if (declaration.reversibility.kind === "snapshot" && declaration.writes.length === 0)
      this.fail(
        "snapshot_without_writes",
        `Snapshot-reversible action \"${declaration.id}\" must declare the state keys it writes: ` +
          `snapshot undo captures and restores exactly those keys, so an empty writes list makes the ` +
          `declared reversibility unrecoverable. Declare writes, or use reversibility.kind "irreversible" ` +
          `with an honest no-undo reason. Implements SA-EXEC-010 and SA-DECL-039.`,
      );
    if (
      declaration.effects.cost !== "none" &&
      (declaration.risk === "safe" || declaration.risk === "side_effect")
    )
      this.fail(
        "invalid_cost_risk",
        `Action \"${declaration.id}\" spends ${declaration.effects.cost} and must be mutating or destructive.`,
      );
  }

  private validateReadTool(declaration: ReadToolDeclaration): void {
    this.validateCommon(declaration, true);
    this.ensureSchema(declaration.params, declaration.id);
    this.ensureStringArray("reads", declaration.reads, true);
    this.ensureStringArray("preconditions", declaration.preconditions, false);
    this.validateExternalExposure(declaration.externalExposure, declaration.id);
    if (typeof declaration.query !== "function")
      this.fail("missing_query", `Read tool \"${declaration.id}\" must declare a query.`);
    for (const forbidden of [
      "writes",
      "risk",
      "reversibility",
      "effects",
      "confirmation",
      "execute",
      "undo",
    ] as const) {
      if (forbidden in (declaration as object))
        this.fail(
          "invalid_read_tool_field",
          `Read tool \"${declaration.id}\" must not declare \"${forbidden}\".`,
        );
    }
  }

  private validateFacts(declaration: FactsDeclaration): void {
    this.validateCommon(declaration, false);
    if (!declaration.surface)
      this.fail("missing_facts_surface", `Facts \"${declaration.id}\" must name a surface.`);
    if (!Array.isArray(declaration.facts) || declaration.facts.length === 0)
      this.fail("missing_facts", `Facts \"${declaration.id}\" must declare at least one fact.`);
    for (const fact of declaration.facts) {
      if (!fact || !STATE_KEY.test(fact.key) || !nonEmpty(fact.description))
        this.fail("invalid_fact", `Facts \"${declaration.id}\" contains an invalid fact entry.`);
      this.ensureSchema(fact.schema, declaration.id);
    }
    if (typeof declaration.publish !== "function")
      this.fail("missing_publish", `Facts \"${declaration.id}\" must declare a publisher.`);
    if (
      declaration.update !== undefined &&
      declaration.update !== "on_registration" &&
      declaration.update !== "material_change"
    )
      this.fail(
        "invalid_facts_update",
        `Facts \"${declaration.id}\" has an invalid update policy.`,
      );
  }

  private validateSurface(declaration: SurfaceDeclaration): void {
    this.validateCommon(declaration, false);
    this.ensureStringArray("capabilities", declaration.capabilities, false);
  }

  private validateCommon(
    declaration: {
      id: string;
      title: string;
      description: string;
      guidance?: string;
      examples?: CapabilityExample[];
    },
    needsGuidance: boolean,
  ): void {
    if (!nonEmpty(declaration.title) || !nonEmpty(declaration.description))
      this.fail(
        "missing_copy",
        `Capability \"${declaration.id}\" must include title and description.`,
      );
    if (needsGuidance && !nonEmpty(declaration.guidance))
      this.fail("missing_guidance", `Capability \"${declaration.id}\" must include guidance.`);
    if (
      needsGuidance &&
      (!Array.isArray(declaration.examples) ||
        declaration.examples.length === 0 ||
        declaration.examples.some((example) => !example || !nonEmpty(example.user)))
    )
      this.fail("invalid_examples", `Capability \"${declaration.id}\" must include examples.`);
  }

  private validateReferences(): void {
    for (const facts of this.facts.values()) {
      if (!this.surfaces.has(facts.surface))
        this.fail(
          "unknown_facts_surface",
          `Facts \"${facts.id}\" references unknown surface \"${facts.surface}\".`,
        );
    }
    for (const surface of this.surfaces.values()) {
      for (const capabilityId of surface.capabilities) {
        if (!this.getCapability(capabilityId))
          this.fail(
            "unknown_surface_capability",
            `Surface \"${surface.id}\" references unknown capability \"${capabilityId}\".`,
          );
      }
    }
  }

  private ensureUnusedId(id: string): void {
    if (
      this.actions.has(id) ||
      this.readTools.has(id) ||
      this.facts.has(id) ||
      this.surfaces.has(id)
    )
      this.fail("duplicate_id", `Duplicate declaration id \"${id}\".`);
  }

  private validateCapabilityId(id: string): void {
    if (!CAPABILITY_ID.test(id))
      this.fail("invalid_capability_id", `Invalid capability id \"${id}\".`);
  }

  private validateActionIdException(declaration: AnyActionDeclaration): void {
    const finalSegment = declaration.id.split(".").at(-1) ?? "";
    const hasVerbNounFinalSegment = /^[a-z0-9]+_[a-z0-9_]+$/.test(finalSegment);
    const exception = declaration.idException;
    if (hasVerbNounFinalSegment) {
      if (exception !== undefined)
        this.fail(
          "unnecessary_id_exception",
          `Action \"${declaration.id}\" must not declare idException for a verb_noun ID.`,
        );
      return;
    }
    if (
      !exception ||
      typeof exception !== "object" ||
      Array.isArray(exception) ||
      Object.keys(exception).length !== 2 ||
      exception.kind !== "established_product_command" ||
      !nonEmpty(exception.productCommand)
    ) {
      this.fail(
        "invalid_id_exception",
        `Action \"${declaration.id}\" must declare the closed established-product-command idException.`,
      );
    }
  }

  /**
   * Rejects a schema that cannot reach a model.
   *
   * `SA-DECL-100` requires the model tool schema to be derivable from the declaration, and
   * `SA-DECL-096` requires compilation to fail on an invalid schema. A `parse` closure alone is not
   * derivable into anything a provider can be handed, so an action declaring one used to compile
   * cleanly and then be absent from every generated tool surface — unreachable by the model, with
   * no error. Requiring `jsonSchema` here turns that silent invisibility into a build failure.
   */
  private ensureSchema(schema: unknown, id: string): void {
    const candidate = schema as StrictSchema<unknown> | undefined;
    if (!candidate || typeof candidate.parse !== "function")
      this.fail("invalid_schema", `Capability \"${id}\" must declare a strict parse schema.`);
    if (!candidate.jsonSchema || typeof candidate.jsonSchema !== "object")
      this.fail(
        "missing_json_schema",
        `Capability \"${id}\" must declare \`params.jsonSchema\`: the model tool schema is derived from it (SA-DECL-100), so without it the capability compiles but no model can ever call it. Build the schema with \`compileSchema\`, or pass an explicit jsonSchema to \`createStrictObjectSchema\`.`,
      );
  }

  private ensureStringArray(field: string, value: unknown, stateKeys: boolean): void {
    if (
      !Array.isArray(value) ||
      value.some((entry) => typeof entry !== "string" || (stateKeys && !STATE_KEY.test(entry)))
    )
      this.fail(
        "invalid_array",
        `Declaration field \"${field}\" must be an array of valid ${stateKeys ? "state keys" : "predicate tokens"}.`,
      );
  }

  private validateExternalExposure(value: unknown, id: string): void {
    if (value !== undefined && value !== "none" && value !== "eligible")
      this.fail("invalid_external_exposure", `Capability \"${id}\" has invalid externalExposure.`);
  }

  private fail(code: string, message: string): never {
    throw new RegistryCompileError(code, message);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRisk(value: unknown): value is Risk {
  return (
    value === "safe" || value === "side_effect" || value === "mutating" || value === "destructive"
  );
}

function isReversibility(value: unknown): value is ReversibilityKind {
  return value === "undoable" || value === "snapshot" || value === "irreversible";
}

function isCost(value: unknown): value is CostEffect {
  return value === "none" || value === "quota" || value === "money";
}

function isConfirmation(value: unknown): value is Confirmation {
  return value === "never" || value === "policy" || value === "always";
}
