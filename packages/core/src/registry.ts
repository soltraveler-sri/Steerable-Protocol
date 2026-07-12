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

/** Strict parser and optional generated tool schema. Implements SA-DECL-035 and SA-DECL-064. */
export interface StrictSchema<Value> {
  parse(input: unknown): Value;
  jsonSchema?: unknown;
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

/** Builds an object parser that rejects undeclared keys. Implements SA-DECL-035 and SA-DECL-064. */
export function createStrictObjectSchema<Params extends Record<string, unknown>>(
  keys: readonly (keyof Params & string)[],
  parseValues: (input: Record<string, unknown>) => Params,
): StrictSchema<Params> {
  return {
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
export const emptyParamsSchema: StrictSchema<Record<string, never>> = createStrictObjectSchema<
  Record<string, never>
>([], () => ({}));

/**
 * Compiles declarations into the single runtime source of capability truth.
 * Construction validates IDs, required metadata, schemas, value sets, and surface references;
 * runtime queries preserve declaration semantics for policy, execution, evals, and bridges.
 * Implements SA-DECL-090–096 and SA-DECL-130–136.
 */
export class CapabilityRegistry {
  private readonly actions = new Map<CapabilityId, AnyCompiledActionDeclaration>();
  private readonly readTools = new Map<CapabilityId, CompiledReadToolDeclaration>();
  private readonly facts = new Map<CapabilityId, FactsDeclaration>();
  private readonly surfaces = new Map<SurfaceId, SurfaceDeclaration>();
  private readonly liveSurfaces = new Set<SurfaceId>();
  private readonly satisfiedPredicates = new Set<string>();
  private readonly listeners = new Set<() => void>();

  /** Compiles and validates the supplied declarations. Implements SA-DECL-090–096. */
  constructor(declarations: RegistryDeclarations = {}) {
    for (const action of declarations.actions ?? []) this.compileAction(action);
    for (const readTool of declarations.readTools ?? []) this.compileReadTool(readTool);
    for (const facts of declarations.facts ?? []) this.compileFacts(facts);
    for (const surface of declarations.surfaces ?? []) this.compileSurface(surface);
    this.validateReferences();
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

  /** Reports current surface liveness. Implements SA-DECL-084–086. */
  isSurfaceLive(id: SurfaceId): boolean {
    return this.liveSurfaces.has(id);
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

  /** Evaluates one surface or host predicate. Implements SA-DECL-045 and SA-DECL-085. */
  isPreconditionSatisfied(token: string): boolean {
    return token.startsWith("surface:")
      ? this.liveSurfaces.has(token.slice("surface:".length))
      : this.satisfiedPredicates.has(token);
  }

  /** Evaluates conjunctive capability preconditions. Implements SA-DECL-045 and SA-DECL-085. */
  arePreconditionsSatisfied(preconditions: readonly string[]): boolean {
    return preconditions.every((token) => this.isPreconditionSatisfied(token));
  }

  /** Checks whether a surface declares a capability. Implements SA-DECL-083 and SA-DECL-085. */
  isCapabilityOnSurface(capabilityId: CapabilityId, surfaceId: SurfaceId): boolean {
    return this.surfaces.get(surfaceId)?.capabilities.includes(capabilityId) ?? false;
  }

  /** Checks live, scoped action availability. Implements SA-DECL-085. */
  isActionAvailableOnSurface(actionId: CapabilityId, surfaceId: SurfaceId): boolean {
    const action = this.actions.get(actionId);
    return Boolean(
      action &&
      this.liveSurfaces.has(surfaceId) &&
      this.isCapabilityOnSurface(actionId, surfaceId) &&
      this.arePreconditionsSatisfied(action.preconditions),
    );
  }

  /** Checks live, scoped read-tool availability. Implements SA-DECL-085. */
  isReadToolAvailableOnSurface(readToolId: CapabilityId, surfaceId: SurfaceId): boolean {
    const readTool = this.readTools.get(readToolId);
    return Boolean(
      readTool &&
      this.liveSurfaces.has(surfaceId) &&
      this.isCapabilityOnSurface(readToolId, surfaceId) &&
      this.arePreconditionsSatisfied(readTool.preconditions),
    );
  }

  /** Lists live capabilities for a surface. Implements SA-DECL-085 and SA-DECL-091. */
  getLiveCapabilities(surfaceId: SurfaceId): CompiledCapability[] {
    if (!this.liveSurfaces.has(surfaceId)) return [];
    return this.getAllCapabilities().filter((capability) => {
      if (!this.isCapabilityOnSurface(capability.id, surfaceId)) return false;
      if ("preconditions" in capability)
        return this.arePreconditionsSatisfied(capability.preconditions);
      return capability.surface === surfaceId;
    });
  }

  /** Lists live actions for a surface. Implements SA-DECL-085 and SA-DECL-091. */
  getLiveActions(surfaceId: SurfaceId): AnyCompiledActionDeclaration[] {
    return [...this.actions.values()].filter((action) =>
      this.isActionAvailableOnSurface(action.id, surfaceId),
    );
  }

  /** Lists live read tools for a surface. Implements SA-DECL-085 and SA-DECL-091. */
  getLiveReadTools(surfaceId: SurfaceId): CompiledReadToolDeclaration[] {
    return [...this.readTools.values()].filter((readTool) =>
      this.isReadToolAvailableOnSurface(readTool.id, surfaceId),
    );
  }

  /** Lists live facts for a surface. Implements SA-DECL-071, SA-DECL-083, and SA-DECL-085. */
  getLiveFacts(surfaceId: SurfaceId): FactsDeclaration[] {
    return [...this.facts.values()].filter(
      (facts) =>
        facts.surface === surfaceId &&
        this.liveSurfaces.has(surfaceId) &&
        this.isCapabilityOnSurface(facts.id, surfaceId),
    );
  }

  /** Parses action parameters through the declaration schema. Implements SA-DECL-035 and SA-EXEC-001. */
  validateActionParams<Params>(action: CompiledActionDeclaration<Params>, params: unknown): Params {
    return action.params.parse(params);
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

  private ensureSchema(schema: unknown, id: string): void {
    if (!schema || typeof (schema as StrictSchema<unknown>).parse !== "function")
      this.fail("invalid_schema", `Capability \"${id}\" must declare a strict parse schema.`);
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
