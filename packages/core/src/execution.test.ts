import { describe, expect, it } from "vitest";
import {
  ExecutionEngine,
  InMemoryLedger,
  RegistryCompileError,
  RegistrySurfaceReadiness,
  CapabilityRegistry,
  createMemorySnapshotStore,
  createStrictObjectSchema,
  defineAction,
  defineSurface,
  type ActionDeclaration,
} from "./index.js";

const valueSchema = createStrictObjectSchema<{ value: string }>(
  ["value"],
  (input) => {
    if (typeof input.value !== "string") throw new Error("value must be a string");
    return { value: input.value };
  },
  {
    type: "object",
    properties: { value: { type: "string" } },
    required: ["value"],
    additionalProperties: false,
  },
);

function action(
  id: string,
  overrides: Partial<ActionDeclaration<{ value: string }, string>> = {},
): ActionDeclaration<{ value: string }, string> {
  return defineAction({
    id,
    title: id,
    description: `Runs ${id}.`,
    params: valueSchema,
    reads: ["design.value"],
    writes: ["design.value"],
    risk: "safe",
    reversibility: { kind: "undoable" },
    effects: { external: false, cost: "none", sensitive: false },
    confirmation: "never",
    preconditions: [],
    execute: ({ value }) => value,
    undo: () => undefined,
    guidance: "Use for test work.",
    examples: [{ user: "set a value", params: { value: "x" } }],
    ...overrides,
  });
}

function registry(
  actions: ActionDeclaration<{ value: string }, string>[],
  surfaceCapabilities: Record<string, string[]>,
  live = Object.keys(surfaceCapabilities),
): CapabilityRegistry {
  const result = new CapabilityRegistry({
    actions,
    surfaces: Object.entries(surfaceCapabilities).map(([id, capabilities]) =>
      defineSurface({ id, title: id, description: `${id} surface`, capabilities }),
    ),
  });
  live.forEach((id) => result.registerSurface(id));
  return result;
}

describe("#59 declaration reconciliation", () => {
  it("enforces simple surface keys, closed id exceptions, and capability-list multi-surface scope", () => {
    expect(() =>
      registry([action("palette.set_color")], { "design.studio": ["palette.set_color"] }),
    ).toThrow(RegistryCompileError);
    const established = action("project.publish", {
      idException: { kind: "established_product_command", productCommand: "Publish" },
    });
    const multi = registry([established], {
      editor: ["project.publish"],
      review: ["project.publish"],
    });
    expect(multi.isActionAvailableOnSurface("project.publish", "editor")).toBe(true);
    expect(multi.isActionAvailableOnSurface("project.publish", "review")).toBe(true);
    expect(multi.isPreconditionSatisfied("surface:missing")).toBe(false);
    expect(() =>
      registry(
        [
          action("palette.set_color", {
            idException: { kind: "established_product_command", productCommand: "Set color" },
          }),
        ],
        { editor: ["palette.set_color"] },
      ),
    ).toThrow("must not declare idException");
    expect(() =>
      registry(
        [
          action("project.publish", {
            idException: { kind: "wrong" as never, productCommand: "Publish" },
          }),
        ],
        { editor: ["project.publish"] },
      ),
    ).toThrow("idException");
    expect(() =>
      registry(
        [
          action("project.publish", {
            idException: {
              kind: "established_product_command",
              productCommand: "Publish",
              extra: true,
            } as never,
          }),
        ],
        { editor: ["project.publish"] },
      ),
    ).toThrow("idException");
  });
});

describe("SA-EXEC and SA-LED core", () => {
  it("direct-dispatches through registry and policy, then runs a declared inverse", async () => {
    let state = "before";
    const set = action("palette.set_color", {
      execute: ({ value }) => {
        const previous = state;
        state = value;
        return previous;
      },
      undo: ({ result }) => {
        state = result ?? "missing";
        return undefined;
      },
    });
    const core = registry([set], { editor: [set.id] });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({ registry: core, ledger });
    const run = await engine.executeChain({
      intent: "set color",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: set.id, params: { value: "after" } }],
    });
    expect((await run.done).status).toBe("succeeded");
    expect(state).toBe("after");
    expect(await run.undoAll()).toMatchObject({ status: "succeeded", undoneStepIds: ["step_1"] });
    expect(state).toBe("before");
  });

  it("keeps an executed prefix undoable when a gated suffix is declined", async () => {
    const prefix = action("palette.set_color");
    const suffix = action("project.export_file", {
      risk: "mutating",
      reversibility: { kind: "irreversible" },
      effects: { external: true, cost: "quota", sensitive: false },
      undo: undefined,
    });
    const core = registry([prefix, suffix], { editor: [prefix.id, suffix.id] });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({
      registry: core,
      ledger,
      approvalHook: async () => ({ status: "declined", reason: "no export" }),
    });
    const result = await (
      await engine.executeChain({
        intent: "set then export",
        surfaceId: "editor",
        posture: "creative-tool",
        steps: [
          { actionId: prefix.id, params: { value: "green" } },
          { actionId: suffix.id, params: { value: "pdf" } },
        ],
      })
    ).done;
    expect(result.status).toBe("declined");
    expect(result.record.steps.map((step) => step.status)).toEqual(["succeeded", "skipped"]);
    expect(result.record.steps[0].undo).toMatchObject({ status: "available" });
  });

  it("fails a cross-surface continuation legibly after timeout and preserves prefix undo", async () => {
    const prefix = action("palette.set_color");
    const destination = action("settings.set_theme");
    const core = registry(
      [prefix, destination],
      { editor: [prefix.id], settings: [destination.id] },
      ["editor"],
    );
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({
      registry: core,
      ledger,
      surfaceReadiness: {
        awaitReady: async ({ targetSurfaceId }) => ({
          ok: false,
          targetSurfaceId,
          reason: "timeout",
          missingActionIds: [destination.id],
        }),
      },
    });
    const result = await (
      await engine.executeChain({
        intent: "set then switch",
        surfaceId: "editor",
        posture: "creative-tool",
        steps: [
          { actionId: prefix.id, params: { value: "green" } },
          { actionId: destination.id, params: { value: "dark" }, targetSurfaceId: "settings" },
        ],
      })
    ).done;
    expect(result.failure?.code).toBe("surface_readiness_timeout");
    expect(result.record.steps.map((step) => step.status)).toEqual(["succeeded", "failed"]);
    expect(result.record.disclosures.some((item) => item.kind === "cross_surface_failure")).toBe(
      true,
    );
    expect(result.record.steps[0].undo).toMatchObject({ status: "available" });
  });

  it("revalidates registered destination capability readiness before its finite timeout", async () => {
    const destination = action("settings.set_theme");
    const core = registry([destination], { settings: [destination.id] }, []);
    const readiness = new RegistrySurfaceReadiness(core, 50);
    const waiting = readiness.awaitReady({
      targetSurfaceId: "settings",
      actionIds: [destination.id],
    });
    core.registerSurface("settings");
    await expect(waiting).resolves.toEqual({ ok: true, targetSurfaceId: "settings" });
  });

  it("captures snapshots before mutation and records disclosed partial undo", async () => {
    const store = createMemorySnapshotStore({ "design.value": "before" });
    const snapshot = action("template.set_value", {
      reversibility: { kind: "snapshot" },
      undo: undefined,
      execute: ({ value }) => {
        store.write("design.value", value);
        return value;
      },
    });
    const irreversible = action("project.export_file", {
      risk: "mutating",
      reversibility: { kind: "irreversible" },
      effects: { external: true, cost: "none", sensitive: false },
      undo: undefined,
    });
    const core = registry([snapshot, irreversible], { editor: [snapshot.id, irreversible.id] });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({
      registry: core,
      ledger,
      snapshotStore: store.adapter,
      approvalHook: async () => ({ status: "approved" }),
    });
    const run = await engine.executeChain({
      intent: "change then export",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        { actionId: snapshot.id, params: { value: "after" } },
        { actionId: irreversible.id, params: { value: "out" } },
      ],
    });
    expect((await run.done).status).toBe("succeeded");
    expect(store.read("design.value")).toBe("after");
    const undo = await run.undoAll();
    expect(undo.status).toBe("partial");
    expect(store.read("design.value")).toBe("before");
    expect(run.getRecord().disclosures.some((item) => item.kind === "partial_undo")).toBe(true);
  });

  it("uses one whole-plan approval for a plan-preview policy outcome", async () => {
    const planned = action("project.export_file", {
      risk: "mutating",
      reversibility: { kind: "snapshot" },
      effects: { external: true, cost: "quota", sensitive: false },
      undo: undefined,
    });
    const core = registry([planned], { editor: [planned.id] });
    let gates = 0;
    const result = await (
      await new ExecutionEngine({
        registry: core,
        ledger: new InMemoryLedger(),
        snapshotStore: createMemorySnapshotStore({ "design.value": "before" }).adapter,
        approvalHook: async () => {
          gates += 1;
          return { status: "approved" };
        },
      }).executeChain({
        intent: "export",
        surfaceId: "editor",
        posture: "business-app",
        steps: [{ actionId: planned.id, params: { value: "out" } }],
      })
    ).done;
    expect(result.status).toBe("succeeded");
    expect(gates).toBe(1);
    expect(result.record.approval.status).toBe("approved");
  });

  it("cancels, settles, then reverses an in-flight chain step during undo-all", async () => {
    let state = "before";
    let release!: () => void;
    let markStarted!: () => void;
    const settled = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Resolves once the executor has actually been entered. The test previously relied on a single
    // microtask turn to reach the in-flight state, which silently coupled it to the engine's
    // internal await count; awaiting the executor itself asserts the same scenario directly.
    const inFlight = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const set = action("palette.set_color", {
      execute: async ({ value }) => {
        const previous = state;
        markStarted();
        await settled;
        state = value;
        return previous;
      },
      undo: ({ result }) => {
        state = result ?? "missing";
      },
    });
    const core = registry([set], { editor: [set.id] });
    const engine = new ExecutionEngine({ registry: core, ledger: new InMemoryLedger() });
    const run = await engine.executeChain({
      intent: "set color",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: set.id, params: { value: "after" } }],
    });
    await inFlight;
    const undo = run.undoAll();
    release();
    expect((await undo).status).toBe("succeeded");
    expect((await run.done).status).toBe("canceled");
    expect(state).toBe("before");
    expect((await run.getRecord()).steps[0].status).toBe("undone");
  });
});
