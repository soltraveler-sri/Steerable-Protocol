export type MaybePromise<T> = T | Promise<T>;

export type CapabilityId = string;
export type SurfaceId = string;
export type StateKey = string;
export type Risk = "safe" | "side_effect" | "mutating" | "destructive";
export type ReversibilityKind = "undoable" | "snapshot" | "irreversible";
export type CostEffect = "none" | "quota" | "money";
export type Confirmation = "never" | "policy" | "always";
export type ExternalExposure = "none" | "eligible";

export interface StrictSchema<Value> {
  parse(input: unknown): Value;
  jsonSchema?: unknown;
}

export interface ActionEffects {
  external: boolean;
  cost: CostEffect;
  sensitive: boolean;
}

export interface CapabilityExample<Params = unknown> {
  user: string;
  params: Params;
}

export interface ActionExecutionContext {
  surfaceId: SurfaceId;
  signal?: AbortSignal;
}

export interface ActionUndoInput<Params = unknown, Result = unknown> {
  params: Params;
  result?: Result;
  snapshot?: unknown;
}

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
  undo?(input: ActionUndoInput<Params, Result>, context: ActionExecutionContext): MaybePromise<unknown>;
  observe?(context: ActionExecutionContext): MaybePromise<unknown>;
  guidance: string;
  examples: CapabilityExample<Params>[];
}

export type CompiledActionDeclaration<Params = unknown, Result = unknown> =
  Omit<ActionDeclaration<Params, Result>, "externalExposure"> & {
    externalExposure: ExternalExposure;
  };

export type AnyActionDeclaration = ActionDeclaration<unknown, unknown>;
export type AnyCompiledActionDeclaration = CompiledActionDeclaration<unknown, unknown>;

export interface ReadToolContext {
  surfaceId: SurfaceId;
  signal?: AbortSignal;
}

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

export type CompiledReadToolDeclaration<Params = unknown, Result = unknown> =
  Omit<ReadToolDeclaration<Params, Result>, "externalExposure"> & {
    externalExposure: ExternalExposure;
  };

export interface FactEntry {
  key: StateKey;
  description: string;
  schema: StrictSchema<unknown>;
}

export interface FactsDeclaration {
  id: CapabilityId;
  title: string;
  description: string;
  surface: SurfaceId;
  facts: FactEntry[];
  publish(): MaybePromise<Record<string, unknown>>;
  update?: "on_registration" | "material_change";
}

export interface SurfaceDeclaration {
  id: SurfaceId;
  title: string;
  description: string;
  capabilities: CapabilityId[];
  location?: { path?: string; label?: string };
}

export interface RegistryDeclarations {
  actions?: AnyActionDeclaration[];
  readTools?: ReadToolDeclaration[];
  facts?: FactsDeclaration[];
  surfaces?: SurfaceDeclaration[];
}

export type CompiledCapability =
  | AnyCompiledActionDeclaration
  | CompiledReadToolDeclaration
  | FactsDeclaration;

export class RegistryCompileError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RegistryCompileError";
    this.code = code;
  }
}

const CAPABILITY_ID = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/;
const SURFACE_ID = /^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*$/;
const STATE_KEY = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/;

export function defineAction<Params, Result = unknown>(
  declaration: ActionDeclaration<Params, Result>,
): ActionDeclaration<Params, Result> {
  return declaration;
}

export function defineReadTool<Params, Result = unknown>(
  declaration: ReadToolDeclaration<Params, Result>,
): ReadToolDeclaration<Params, Result> {
  return declaration;
}

export function defineFacts(declaration: FactsDeclaration): FactsDeclaration {
  return declaration;
}

export function defineSurface(declaration: SurfaceDeclaration): SurfaceDeclaration {
  return declaration;
}

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

export const emptyParamsSchema: StrictSchema<Record<string, never>> =
  createStrictObjectSchema<Record<string, never>>([], () => ({}));

/** Compiles declarations into the single runtime registry required by SA-DECL-090. */
export class CapabilityRegistry {
  private readonly actions = new Map<CapabilityId, AnyCompiledActionDeclaration>();
  private readonly readTools = new Map<CapabilityId, CompiledReadToolDeclaration>();
  private readonly facts = new Map<CapabilityId, FactsDeclaration>();
  private readonly surfaces = new Map<SurfaceId, SurfaceDeclaration>();
  private readonly liveSurfaces = new Set<SurfaceId>();
  private readonly satisfiedPredicates = new Set<string>();

  constructor(declarations: RegistryDeclarations = {}) {
    for (const action of declarations.actions ?? []) this.compileAction(action);
    for (const readTool of declarations.readTools ?? []) this.compileReadTool(readTool);
    for (const facts of declarations.facts ?? []) this.compileFacts(facts);
    for (const surface of declarations.surfaces ?? []) this.compileSurface(surface);
    this.validateReferences();
  }

  getAction(id: CapabilityId): AnyCompiledActionDeclaration | undefined {
    return this.actions.get(id);
  }

  requireAction(id: CapabilityId): AnyCompiledActionDeclaration {
    const action = this.getAction(id);
    if (!action) throw new RegistryCompileError("unknown_action", `Unknown action \"${id}\".`);
    return action;
  }

  getReadTool(id: CapabilityId): CompiledReadToolDeclaration | undefined {
    return this.readTools.get(id);
  }

  getFacts(id: CapabilityId): FactsDeclaration | undefined {
    return this.facts.get(id);
  }

  getSurface(id: SurfaceId): SurfaceDeclaration | undefined {
    return this.surfaces.get(id);
  }

  getCapability(id: CapabilityId): CompiledCapability | undefined {
    return this.actions.get(id) ?? this.readTools.get(id) ?? this.facts.get(id);
  }

  getAllCapabilities(): CompiledCapability[] {
    return [...this.actions.values(), ...this.readTools.values(), ...this.facts.values()];
  }

  getAllActions(): AnyCompiledActionDeclaration[] {
    return [...this.actions.values()];
  }

  getAllReadTools(): CompiledReadToolDeclaration[] {
    return [...this.readTools.values()];
  }

  getAllFacts(): FactsDeclaration[] {
    return [...this.facts.values()];
  }

  getAllSurfaces(): SurfaceDeclaration[] {
    return [...this.surfaces.values()];
  }

  registerSurface(id: SurfaceId): void {
    if (!this.surfaces.has(id)) {
      throw new RegistryCompileError("undeclared_surface", `Cannot register undeclared surface \"${id}\".`);
    }
    this.liveSurfaces.add(id);
  }

  deregisterSurface(id: SurfaceId): void {
    this.liveSurfaces.delete(id);
  }

  isSurfaceLive(id: SurfaceId): boolean {
    return this.liveSurfaces.has(id);
  }

  setPrecondition(token: string, satisfied: boolean): void {
    if (satisfied) this.satisfiedPredicates.add(token);
    else this.satisfiedPredicates.delete(token);
  }

  isPreconditionSatisfied(token: string): boolean {
    return token.startsWith("surface:")
      ? this.liveSurfaces.has(token.slice("surface:".length))
      : this.satisfiedPredicates.has(token);
  }

  arePreconditionsSatisfied(preconditions: readonly string[]): boolean {
    return preconditions.every((token) => this.isPreconditionSatisfied(token));
  }

  isCapabilityOnSurface(capabilityId: CapabilityId, surfaceId: SurfaceId): boolean {
    return this.surfaces.get(surfaceId)?.capabilities.includes(capabilityId) ?? false;
  }

  isActionAvailableOnSurface(actionId: CapabilityId, surfaceId: SurfaceId): boolean {
    const action = this.actions.get(actionId);
    return Boolean(
      action &&
        this.liveSurfaces.has(surfaceId) &&
        this.isCapabilityOnSurface(actionId, surfaceId) &&
        this.arePreconditionsSatisfied(action.preconditions),
    );
  }

  isReadToolAvailableOnSurface(readToolId: CapabilityId, surfaceId: SurfaceId): boolean {
    const readTool = this.readTools.get(readToolId);
    return Boolean(
      readTool &&
        this.liveSurfaces.has(surfaceId) &&
        this.isCapabilityOnSurface(readToolId, surfaceId) &&
        this.arePreconditionsSatisfied(readTool.preconditions),
    );
  }

  getLiveCapabilities(surfaceId: SurfaceId): CompiledCapability[] {
    if (!this.liveSurfaces.has(surfaceId)) return [];
    return this.getAllCapabilities().filter((capability) => {
      if (!this.isCapabilityOnSurface(capability.id, surfaceId)) return false;
      if ("preconditions" in capability) return this.arePreconditionsSatisfied(capability.preconditions);
      return capability.surface === surfaceId;
    });
  }

  validateActionParams<Params>(action: CompiledActionDeclaration<Params>, params: unknown): Params {
    return action.params.parse(params);
  }

  private compileAction(declaration: AnyActionDeclaration): void {
    this.ensureUnusedId(declaration.id);
    this.validateCapabilityId(declaration.id);
    this.validateAction(declaration);
    this.actions.set(declaration.id, { ...declaration, externalExposure: declaration.externalExposure ?? "none" });
  }

  private compileReadTool(declaration: ReadToolDeclaration): void {
    this.ensureUnusedId(declaration.id);
    this.validateCapabilityId(declaration.id);
    this.validateReadTool(declaration);
    this.readTools.set(declaration.id, { ...declaration, externalExposure: declaration.externalExposure ?? "none" });
  }

  private compileFacts(declaration: FactsDeclaration): void {
    this.ensureUnusedId(declaration.id);
    this.validateCapabilityId(declaration.id);
    this.validateFacts(declaration);
    this.facts.set(declaration.id, declaration);
  }

  private compileSurface(declaration: SurfaceDeclaration): void {
    this.ensureUnusedId(declaration.id);
    if (!SURFACE_ID.test(declaration.id)) this.fail("invalid_surface_id", `Invalid surface id \"${declaration.id}\".`);
    this.validateSurface(declaration);
    this.surfaces.set(declaration.id, declaration);
  }

  private validateAction(declaration: AnyActionDeclaration): void {
    this.validateCommon(declaration, true);
    this.ensureSchema(declaration.params, declaration.id);
    this.ensureStringArray("reads", declaration.reads, true);
    this.ensureStringArray("writes", declaration.writes, true);
    this.ensureStringArray("preconditions", declaration.preconditions, false);
    if (!isRisk(declaration.risk)) this.fail("invalid_risk", `Invalid risk for action \"${declaration.id}\".`);
    if (!declaration.reversibility || !isReversibility(declaration.reversibility.kind)) this.fail("invalid_reversibility", `Invalid reversibility for action \"${declaration.id}\".`);
    if (!declaration.effects || typeof declaration.effects.external !== "boolean" || typeof declaration.effects.sensitive !== "boolean" || !isCost(declaration.effects.cost)) this.fail("invalid_effects", `Invalid effects for action \"${declaration.id}\".`);
    if (!isConfirmation(declaration.confirmation)) this.fail("invalid_confirmation", `Invalid confirmation for action \"${declaration.id}\".`);
    this.validateExternalExposure(declaration.externalExposure, declaration.id);
    if (typeof declaration.execute !== "function") this.fail("missing_execute", `Action \"${declaration.id}\" must declare an executor.`);
    if (declaration.reversibility.kind === "undoable" && typeof declaration.undo !== "function") this.fail("missing_undo", `Undoable action \"${declaration.id}\" must declare undo.`);
    if (declaration.effects.cost !== "none" && (declaration.risk === "safe" || declaration.risk === "side_effect")) this.fail("invalid_cost_risk", `Action \"${declaration.id}\" spends ${declaration.effects.cost} and must be mutating or destructive.`);
  }

  private validateReadTool(declaration: ReadToolDeclaration): void {
    this.validateCommon(declaration, true);
    this.ensureSchema(declaration.params, declaration.id);
    this.ensureStringArray("reads", declaration.reads, true);
    this.ensureStringArray("preconditions", declaration.preconditions, false);
    this.validateExternalExposure(declaration.externalExposure, declaration.id);
    if (typeof declaration.query !== "function") this.fail("missing_query", `Read tool \"${declaration.id}\" must declare a query.`);
    for (const forbidden of ["writes", "risk", "reversibility", "effects", "confirmation", "execute", "undo"] as const) {
      if (forbidden in (declaration as object)) this.fail("invalid_read_tool_field", `Read tool \"${declaration.id}\" must not declare \"${forbidden}\".`);
    }
  }

  private validateFacts(declaration: FactsDeclaration): void {
    this.validateCommon(declaration, false);
    if (!declaration.surface) this.fail("missing_facts_surface", `Facts \"${declaration.id}\" must name a surface.`);
    if (!Array.isArray(declaration.facts) || declaration.facts.length === 0) this.fail("missing_facts", `Facts \"${declaration.id}\" must declare at least one fact.`);
    for (const fact of declaration.facts) {
      if (!fact || !STATE_KEY.test(fact.key) || !nonEmpty(fact.description)) this.fail("invalid_fact", `Facts \"${declaration.id}\" contains an invalid fact entry.`);
      this.ensureSchema(fact.schema, declaration.id);
    }
    if (typeof declaration.publish !== "function") this.fail("missing_publish", `Facts \"${declaration.id}\" must declare a publisher.`);
    if (declaration.update !== undefined && declaration.update !== "on_registration" && declaration.update !== "material_change") this.fail("invalid_facts_update", `Facts \"${declaration.id}\" has an invalid update policy.`);
  }

  private validateSurface(declaration: SurfaceDeclaration): void {
    this.validateCommon(declaration, false);
    this.ensureStringArray("capabilities", declaration.capabilities, false);
  }

  private validateCommon(declaration: { id: string; title: string; description: string; guidance?: string; examples?: CapabilityExample[] }, needsGuidance: boolean): void {
    if (!nonEmpty(declaration.title) || !nonEmpty(declaration.description)) this.fail("missing_copy", `Capability \"${declaration.id}\" must include title and description.`);
    if (needsGuidance && !nonEmpty(declaration.guidance)) this.fail("missing_guidance", `Capability \"${declaration.id}\" must include guidance.`);
    if (needsGuidance && (!Array.isArray(declaration.examples) || declaration.examples.length === 0 || declaration.examples.some((example) => !example || !nonEmpty(example.user)))) this.fail("invalid_examples", `Capability \"${declaration.id}\" must include examples.`);
  }

  private validateReferences(): void {
    for (const facts of this.facts.values()) {
      if (!this.surfaces.has(facts.surface)) this.fail("unknown_facts_surface", `Facts \"${facts.id}\" references unknown surface \"${facts.surface}\".`);
    }
    for (const surface of this.surfaces.values()) {
      for (const capabilityId of surface.capabilities) {
        if (!this.getCapability(capabilityId)) this.fail("unknown_surface_capability", `Surface \"${surface.id}\" references unknown capability \"${capabilityId}\".`);
      }
    }
  }

  private ensureUnusedId(id: string): void {
    if (this.actions.has(id) || this.readTools.has(id) || this.facts.has(id) || this.surfaces.has(id)) this.fail("duplicate_id", `Duplicate declaration id \"${id}\".`);
  }

  private validateCapabilityId(id: string): void {
    if (!CAPABILITY_ID.test(id)) this.fail("invalid_capability_id", `Invalid capability id \"${id}\".`);
  }

  private ensureSchema(schema: unknown, id: string): void {
    if (!schema || typeof (schema as StrictSchema<unknown>).parse !== "function") this.fail("invalid_schema", `Capability \"${id}\" must declare a strict parse schema.`);
  }

  private ensureStringArray(field: string, value: unknown, stateKeys: boolean): void {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || (stateKeys && !STATE_KEY.test(entry)))) this.fail("invalid_array", `Declaration field \"${field}\" must be an array of valid ${stateKeys ? "state keys" : "predicate tokens"}.`);
  }

  private validateExternalExposure(value: unknown, id: string): void {
    if (value !== undefined && value !== "none" && value !== "eligible") this.fail("invalid_external_exposure", `Capability \"${id}\" has invalid externalExposure.`);
  }

  private fail(code: string, message: string): never {
    throw new RegistryCompileError(code, message);
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRisk(value: unknown): value is Risk {
  return value === "safe" || value === "side_effect" || value === "mutating" || value === "destructive";
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
