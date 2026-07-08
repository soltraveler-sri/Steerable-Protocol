export type MaybePromise<T> = T | Promise<T>;

export type CapabilityId = string;
export type SurfaceId = string;
export type StateKey = string;

export type Risk = "safe" | "side_effect" | "mutating" | "destructive";
export type ReversibilityKind = "undoable" | "snapshot" | "irreversible";
export type CostEffect = "none" | "quota" | "money";
export type Confirmation = "never" | "policy" | "always";
export type ExternalExposure = "none" | "eligible";

export interface StrictParamSchema<Params> {
  parse: (input: unknown) => Params;
  jsonSchema?: unknown;
}

export interface ActionEffects {
  external: boolean;
  cost: CostEffect;
  sensitive: boolean;
}

export interface StateSnapshot {
  capturedAt: string;
  keys: StateKey[];
  values: Record<StateKey, unknown>;
}

export interface StateSnapshotAdapter {
  capture: (keys: StateKey[]) => MaybePromise<StateSnapshot>;
  restore: (snapshot: StateSnapshot) => MaybePromise<void>;
}

export interface ActionExecutionContext {
  registry: CapabilityRegistry;
  surfaceId: SurfaceId;
  snapshotStore?: StateSnapshotAdapter;
  signal?: AbortSignal;
  now: () => Date;
}

export interface ActionUndoInput<Params = unknown, Result = unknown> {
  params: Params;
  result?: Result;
  snapshot?: StateSnapshot;
}

export interface CapabilityExample<Params = unknown> {
  user: string;
  params: Params;
}

export interface ActionDeclaration<Params = unknown, Result = unknown> {
  id: CapabilityId;
  title: string;
  description: string;
  params: StrictParamSchema<Params>;
  reads: StateKey[];
  writes: StateKey[];
  risk: Risk;
  reversibility: { kind: ReversibilityKind };
  effects: ActionEffects;
  confirmation: Confirmation;
  preconditions: string[];
  externalExposure?: ExternalExposure;
  execute: (params: Params, context: ActionExecutionContext) => MaybePromise<Result>;
  undo?: (
    input: ActionUndoInput<Params, Result>,
    context: ActionExecutionContext,
  ) => MaybePromise<unknown>;
  observe?: (context: ActionExecutionContext) => MaybePromise<unknown>;
  guidance: string;
  examples: CapabilityExample<Params>[];
}

export type CompiledActionDeclaration<Params = unknown, Result = unknown> =
  Omit<ActionDeclaration<Params, Result>, "externalExposure"> & {
    externalExposure: ExternalExposure;
  };

export type AnyActionDeclaration = ActionDeclaration<any, any>;
export type AnyCompiledActionDeclaration = CompiledActionDeclaration<any, any>;

export interface ReadToolContext {
  registry: CapabilityRegistry;
  surfaceId: SurfaceId;
  now: () => Date;
}

export interface ReadToolDeclaration<Params = unknown, Result = unknown> {
  id: CapabilityId;
  title: string;
  description: string;
  params: StrictParamSchema<Params>;
  reads: StateKey[];
  preconditions: string[];
  externalExposure?: ExternalExposure;
  query: (params: Params, context: ReadToolContext) => MaybePromise<Result>;
  guidance: string;
  examples: CapabilityExample<Params>[];
}

export type CompiledReadToolDeclaration<Params = unknown, Result = unknown> =
  Omit<ReadToolDeclaration<Params, Result>, "externalExposure"> & {
    externalExposure: ExternalExposure;
  };

export interface FactEntry {
  key: string;
  description: string;
  schema: unknown;
}

export interface FactsDeclaration {
  id: CapabilityId;
  title: string;
  description: string;
  surface: SurfaceId;
  facts: FactEntry[];
  publish: () => MaybePromise<Record<string, unknown>>;
  update?: "on_registration" | "material_change";
}

export interface SurfaceDeclaration {
  id: SurfaceId;
  title: string;
  description: string;
  capabilities: CapabilityId[];
  location?: {
    path?: string;
    label?: string;
  };
}

export interface RegistryDeclarations {
  actions?: AnyActionDeclaration[];
  readTools?: ReadToolDeclaration[];
  facts?: FactsDeclaration[];
  surfaces?: SurfaceDeclaration[];
}

type RegistryListener = () => void;

const CAPABILITY_ID_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;
const SURFACE_ID_RE = /^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$/;

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
  };
}

export const emptyParamsSchema: StrictParamSchema<Record<string, never>> = {
  parse(input: unknown): Record<string, never> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Expected an empty object parameter payload.");
    }

    const keys = Object.keys(input as Record<string, unknown>);

    if (keys.length > 0) {
      throw new Error(`Unexpected parameter "${keys[0]}".`);
    }

    return {};
  },
};

export class CapabilityRegistry {
  private readonly actions = new Map<CapabilityId, AnyCompiledActionDeclaration>();
  private readonly readTools = new Map<CapabilityId, CompiledReadToolDeclaration>();
  private readonly facts = new Map<CapabilityId, FactsDeclaration>();
  private readonly surfaces = new Map<SurfaceId, SurfaceDeclaration>();
  private readonly liveSurfaces = new Set<SurfaceId>();
  private readonly satisfiedPredicates = new Set<string>();
  private readonly listeners = new Set<RegistryListener>();

  constructor(declarations: RegistryDeclarations = {}) {
    declarations.actions?.forEach((action) => this.registerAction(action));
    declarations.readTools?.forEach((readTool) => this.registerReadTool(readTool));
    declarations.facts?.forEach((facts) => this.registerFacts(facts));
    declarations.surfaces?.forEach((surface) => this.registerSurfaceDeclaration(surface));
    this.validateSurfaceReferences();
  }

  registerAction(declaration: AnyActionDeclaration): AnyCompiledActionDeclaration {
    this.validateCapabilityId(declaration.id);
    this.ensureIdUnused(declaration.id);
    this.validateAction(declaration);

    const compiled = {
      ...declaration,
      externalExposure: declaration.externalExposure ?? "none",
    };

    this.actions.set(compiled.id, compiled);
    this.emit();
    return compiled;
  }

  deregisterAction(id: CapabilityId): void {
    this.actions.delete(id);
    this.emit();
  }

  registerReadTool(declaration: ReadToolDeclaration): CompiledReadToolDeclaration {
    this.validateCapabilityId(declaration.id);
    this.ensureIdUnused(declaration.id);
    this.validateReadTool(declaration);

    const compiled = {
      ...declaration,
      externalExposure: declaration.externalExposure ?? "none",
    };

    this.readTools.set(compiled.id, compiled);
    this.emit();
    return compiled;
  }

  deregisterReadTool(id: CapabilityId): void {
    this.readTools.delete(id);
    this.emit();
  }

  registerFacts(declaration: FactsDeclaration): FactsDeclaration {
    this.validateCapabilityId(declaration.id);
    this.ensureIdUnused(declaration.id);
    this.validateFacts(declaration);
    this.facts.set(declaration.id, declaration);
    this.emit();
    return declaration;
  }

  deregisterFacts(id: CapabilityId): void {
    this.facts.delete(id);
    this.emit();
  }

  registerSurfaceDeclaration(declaration: SurfaceDeclaration): SurfaceDeclaration {
    this.validateSurfaceId(declaration.id);
    this.ensureIdUnused(declaration.id);
    this.validateSurface(declaration);
    this.surfaces.set(declaration.id, declaration);
    this.emit();
    return declaration;
  }

  registerSurface(id: SurfaceId): void {
    if (!this.surfaces.has(id)) {
      throw new Error(`Cannot register undeclared surface "${id}".`);
    }

    this.liveSurfaces.add(id);
    this.emit();
  }

  deregisterSurface(id: SurfaceId): void {
    this.liveSurfaces.delete(id);
    this.emit();
  }

  setPrecondition(token: string, satisfied: boolean): void {
    if (satisfied) {
      this.satisfiedPredicates.add(token);
    } else {
      this.satisfiedPredicates.delete(token);
    }

    this.emit();
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getAction(id: CapabilityId): AnyCompiledActionDeclaration | undefined {
    return this.actions.get(id);
  }

  requireAction(id: CapabilityId): AnyCompiledActionDeclaration {
    const action = this.getAction(id);

    if (!action) {
      throw new Error(`Unknown action "${id}".`);
    }

    return action;
  }

  validateActionParams<Params>(
    action: CompiledActionDeclaration<Params>,
    params: unknown,
  ): Params {
    return action.params.parse(params);
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

  isSurfaceLive(id: SurfaceId): boolean {
    return this.liveSurfaces.has(id);
  }

  isPreconditionSatisfied(token: string): boolean {
    if (token.startsWith("surface:")) {
      return this.liveSurfaces.has(token.slice("surface:".length));
    }

    return this.satisfiedPredicates.has(token);
  }

  arePreconditionsSatisfied(preconditions: string[]): boolean {
    return preconditions.every((token) => this.isPreconditionSatisfied(token));
  }

  isCapabilityOnSurface(capabilityId: CapabilityId, surfaceId: SurfaceId): boolean {
    const surface = this.surfaces.get(surfaceId);

    return Boolean(surface?.capabilities.includes(capabilityId));
  }

  isActionAvailableOnSurface(actionId: CapabilityId, surfaceId: SurfaceId): boolean {
    const action = this.actions.get(actionId);

    if (!action || !this.liveSurfaces.has(surfaceId)) {
      return false;
    }

    return (
      this.isCapabilityOnSurface(actionId, surfaceId) &&
      this.arePreconditionsSatisfied(action.preconditions)
    );
  }

  getLiveActions(surfaceId: SurfaceId): AnyCompiledActionDeclaration[] {
    return Array.from(this.actions.values()).filter((action) =>
      this.isActionAvailableOnSurface(action.id, surfaceId),
    );
  }

  getLiveReadTools(surfaceId: SurfaceId): CompiledReadToolDeclaration[] {
    return Array.from(this.readTools.values()).filter(
      (readTool) =>
        this.liveSurfaces.has(surfaceId) &&
        this.isCapabilityOnSurface(readTool.id, surfaceId) &&
        this.arePreconditionsSatisfied(readTool.preconditions),
    );
  }

  getLiveFacts(surfaceId: SurfaceId): FactsDeclaration[] {
    return Array.from(this.facts.values()).filter(
      (facts) =>
        facts.surface === surfaceId &&
        this.liveSurfaces.has(surfaceId) &&
        this.isCapabilityOnSurface(facts.id, surfaceId),
    );
  }

  getAllActions(): AnyCompiledActionDeclaration[] {
    return Array.from(this.actions.values());
  }

  getAllReadTools(): CompiledReadToolDeclaration[] {
    return Array.from(this.readTools.values());
  }

  getAllFacts(): FactsDeclaration[] {
    return Array.from(this.facts.values());
  }

  getAllSurfaces(): SurfaceDeclaration[] {
    return Array.from(this.surfaces.values());
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  private ensureIdUnused(id: string): void {
    if (
      this.actions.has(id) ||
      this.readTools.has(id) ||
      this.facts.has(id) ||
      this.surfaces.has(id)
    ) {
      throw new Error(`Duplicate capability id "${id}".`);
    }
  }

  private validateCapabilityId(id: CapabilityId): void {
    if (!CAPABILITY_ID_RE.test(id)) {
      throw new Error(`Invalid capability id "${id}".`);
    }
  }

  private validateSurfaceId(id: SurfaceId): void {
    if (!SURFACE_ID_RE.test(id)) {
      throw new Error(`Invalid surface id "${id}".`);
    }
  }

  private validateAction(declaration: AnyActionDeclaration): void {
    this.validateCommonCapability(declaration);

    const finalSegment = declaration.id.split(".").at(-1) ?? "";

    if (!finalSegment.includes("_")) {
      throw new Error(`Action id "${declaration.id}" must end with a verb_noun segment.`);
    }

    this.ensureArray("reads", declaration.reads);
    this.ensureArray("writes", declaration.writes);
    this.ensureArray("preconditions", declaration.preconditions);
    this.validateExternalExposure(declaration.externalExposure);

    if (!["safe", "side_effect", "mutating", "destructive"].includes(declaration.risk)) {
      throw new Error(`Invalid risk for action "${declaration.id}".`);
    }

    if (!["undoable", "snapshot", "irreversible"].includes(declaration.reversibility.kind)) {
      throw new Error(`Invalid reversibility for action "${declaration.id}".`);
    }

    if (!["none", "quota", "money"].includes(declaration.effects.cost)) {
      throw new Error(`Invalid cost effect for action "${declaration.id}".`);
    }

    if (!["never", "policy", "always"].includes(declaration.confirmation)) {
      throw new Error(`Invalid confirmation for action "${declaration.id}".`);
    }

    if (declaration.reversibility.kind === "undoable" && !declaration.undo) {
      throw new Error(`Undoable action "${declaration.id}" must declare an undo handler.`);
    }

    if (
      declaration.effects.cost !== "none" &&
      (declaration.risk === "safe" || declaration.risk === "side_effect")
    ) {
      throw new Error(
        `Action "${declaration.id}" spends ${declaration.effects.cost} and must be mutating or destructive.`,
      );
    }
  }

  private validateReadTool(declaration: ReadToolDeclaration): void {
    this.validateCommonCapability(declaration);
    this.ensureArray("reads", declaration.reads);
    this.ensureArray("preconditions", declaration.preconditions);
    this.validateExternalExposure(declaration.externalExposure);
  }

  private validateFacts(declaration: FactsDeclaration): void {
    this.validateCommonCapability(declaration);

    if (!declaration.surface) {
      throw new Error(`Facts declaration "${declaration.id}" must name a surface.`);
    }

    if (!Array.isArray(declaration.facts) || declaration.facts.length === 0) {
      throw new Error(`Facts declaration "${declaration.id}" must declare facts.`);
    }
  }

  private validateSurface(declaration: SurfaceDeclaration): void {
    this.validateCommonCapability(declaration);
    this.ensureArray("capabilities", declaration.capabilities);
  }

  private validateCommonCapability(declaration: {
    id: CapabilityId;
    title: string;
    description: string;
    guidance?: string;
    examples?: CapabilityExample[];
  }): void {
    if (!declaration.title || !declaration.description) {
      throw new Error(`Capability "${declaration.id}" must include title and description.`);
    }

    if ("guidance" in declaration && !declaration.guidance) {
      throw new Error(`Capability "${declaration.id}" must include guidance.`);
    }

    if ("examples" in declaration) {
      if (!Array.isArray(declaration.examples) || declaration.examples.length === 0) {
        throw new Error(`Capability "${declaration.id}" must include examples.`);
      }
    }
  }

  private validateExternalExposure(value: ExternalExposure | undefined): void {
    if (value !== undefined && value !== "none" && value !== "eligible") {
      throw new Error(`Invalid externalExposure value "${value}".`);
    }
  }

  private ensureArray(field: string, value: unknown): void {
    if (!Array.isArray(value)) {
      throw new Error(`Declaration field "${field}" must be an array.`);
    }
  }

  private validateSurfaceReferences(): void {
    this.surfaces.forEach((surface) => {
      surface.capabilities.forEach((capabilityId) => {
        if (
          !this.actions.has(capabilityId) &&
          !this.readTools.has(capabilityId) &&
          !this.facts.has(capabilityId)
        ) {
          throw new Error(
            `Surface "${surface.id}" references unknown capability "${capabilityId}".`,
          );
        }
      });
    });
  }
}
