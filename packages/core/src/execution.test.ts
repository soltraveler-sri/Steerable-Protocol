import { describe, expect, it } from "vitest";
import {
  ExecutionEngine,
  InMemoryLedger,
  RegistryCompileError,
  RegistrySurfaceReadiness,
  CapabilityRegistry,
  createLivenessState,
  createMemorySnapshotStore,
  createStrictObjectSchema,
  defineAction,
  defineSurface,
  runUndoHandle,
  type ActionDeclaration,
  type ActionExecutionContext,
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
    expect((await run.getRecord()).disclosures.some((item) => item.kind === "partial_undo")).toBe(
      true,
    );
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

describe("N2 — undo-handle supersession (SA-LED-077, SA-LED-146)", () => {
  it("supersedes a stale cross-invocation handle, refuses undoing it, and preserves the newer effect", async () => {
    let state = "initial";
    const set = action("palette.set_color", {
      execute: ({ value }) => {
        const previous = state;
        state = value;
        return previous;
      },
      undo: ({ result }) => {
        state = result ?? "missing";
      },
    });
    const core = registry([set], { editor: [set.id] });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({ registry: core, ledger });

    // Older invocation writes design.value = "old" and keeps an available, full undo handle.
    const older = await engine.executeChain({
      intent: "set old",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: set.id, params: { value: "old" } }],
    });
    expect((await older.done).status).toBe("succeeded");
    expect(state).toBe("old");

    // Newer invocation writes the SAME state key. This must eagerly supersede the older handle.
    const newer = await engine.executeChain({
      intent: "set new",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: set.id, params: { value: "new" } }],
    });
    expect((await newer.done).status).toBe("succeeded");
    expect(state).toBe("new");

    // The supersession is a persisted status transition on the older handle, visible in the trail.
    const olderRecord = await older.getRecord();
    const staleHandle = olderRecord.steps[0].undo;
    expect(staleHandle).toMatchObject({ status: "superseded" });
    if (!("handleId" in staleHandle)) throw new Error("expected a superseded handle record");

    // Undoing the older handle directly is HARD-REFUSED with a reason naming supersession, and the
    // newer effect is never destroyed — there is no "undo anyway" bypass.
    const context: ActionExecutionContext = {
      registry: core,
      surfaceId: "editor",
      now: () => new Date(),
    };
    const refusal = await runUndoHandle(ledger, staleHandle, context);
    expect(refusal.status).toBe("superseded");
    expect(refusal.errorSummary).toMatch(/[Ss]upersed/);
    expect(state).toBe("new");

    // Aggregate undo of the older invocation surfaces the supersession reason and reverses nothing.
    const undo = await older.undoAll();
    expect(undo.undoneStepIds).toEqual([]);
    expect(undo.notUndoneStepIds).toEqual(["step_1"]);
    expect(undo.disclosure).toMatch(/[Ss]upersed/);
    expect(state).toBe("new");
    expect(
      olderRecord.disclosures.some(
        (item) => item.kind === "partial_undo" && /[Ss]upersed/.test(item.message),
      ),
    ).toBe(true);
  });

  it("discloses degraded_ledger without failing the executed step when the supersede write fails (SA-LED-146/003)", async () => {
    class FailingSupersedeLedger extends InMemoryLedger {
      supersedeUndoHandle(_handleId: string, _reason: string): void {
        throw new Error("durable supersede write rejected");
      }
    }
    let state = "initial";
    const set = action("palette.set_color", {
      execute: ({ value }) => {
        const previous = state;
        state = value;
        return previous;
      },
      undo: ({ result }) => {
        state = result ?? "missing";
      },
    });
    const core = registry([set], { editor: [set.id] });
    const ledger = new FailingSupersedeLedger();
    const engine = new ExecutionEngine({ registry: core, ledger });

    await (
      await engine.executeChain({
        intent: "set old",
        surfaceId: "editor",
        posture: "creative-tool",
        steps: [{ actionId: set.id, params: { value: "old" } }],
      })
    ).done;
    const newer = await engine.executeChain({
      intent: "set new",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: set.id, params: { value: "new" } }],
    });
    const done = await newer.done;

    // The executed step ran; a failed post-success supersede write MUST NOT retroactively fail it.
    expect(done.status).toBe("succeeded");
    expect(done.record.steps[0].status).toBe("succeeded");
    // The stale availability is disclosed, never left silent.
    expect(done.record.disclosures.some((item) => item.kind === "degraded_ledger")).toBe(true);
  });

  it("still undoes a same-key chain fully in reverse order (ruling 2 — supersession is cross-invocation only)", async () => {
    let state = "s0";
    const set = action("palette.set_color", {
      execute: ({ value }) => {
        const previous = state;
        state = value;
        return previous;
      },
      undo: ({ result }) => {
        state = result ?? "missing";
      },
    });
    const core = registry([set], { editor: [set.id] });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({ registry: core, ledger });

    // Two steps of ONE invocation write the same state key. Neither supersedes the other.
    const run = await engine.executeChain({
      intent: "two same-key writes",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        { actionId: set.id, params: { value: "s1" } },
        { actionId: set.id, params: { value: "s2" } },
      ],
    });
    expect((await run.done).status).toBe("succeeded");
    expect(state).toBe("s2");

    const record = await run.getRecord();
    expect(
      record.steps.map((step) => ("handleId" in step.undo ? step.undo.status : "none")),
    ).toEqual(["available", "available"]);

    // Aggregate undo composes over the whole chain in reverse execution order back to the start.
    const undo = await run.undoAll();
    expect(undo.status).toBe("succeeded");
    expect(undo.undoneStepIds).toEqual(["step_2", "step_1"]);
    expect(state).toBe("s0");
  });
});

describe("B2 — gate/undo cancellation race (SA-EXEC-088, SA-LED-003)", () => {
  // creative-tool + destructive + irreversible resolves to Step-gated: an *in-loop* gate, which is
  // exactly the site the B2 race lives at (a Plan-preview gate sits before the loop and is already
  // guarded by the loop's top-of-iteration `undoRequested` check).
  function gatedAction(execute: () => string) {
    return action("project.export_file", {
      risk: "destructive",
      reversibility: { kind: "irreversible" },
      effects: { external: false, cost: "none", sensitive: false },
      undo: undefined,
      execute,
    });
  }

  it("cancels a held gate on undo-all and never runs the held step, even if the hook ignores the signal", async () => {
    let executed = false;
    let reached!: () => void;
    let release!: () => void;
    const atGate = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const planned = gatedAction(() => {
      executed = true;
      return "exported";
    });
    const core = registry([planned], { editor: [planned.id] });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({
      registry: core,
      ledger,
      snapshotStore: createMemorySnapshotStore({ "design.value": "before" }).adapter,
      approvalHook: async () => {
        reached();
        await held; // block at the gate, deliberately ignoring request.signal
        return { status: "approved" };
      },
    });
    const run = await engine.executeChain({
      intent: "export",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: planned.id, params: { value: "out" } }],
    });
    await atGate; // the gate is held; the approval is pending
    const undo = run.undoAll(); // undo-all lands DURING the held gate
    release(); // the hook now returns "approved", still ignoring the signal
    await undo;
    const done = await run.done;

    expect(executed).toBe(false); // SA-EXEC-088: the not-yet-started held step must not run
    expect(done.status).toBe("canceled"); // legible, consistent chain outcome
    expect(done.record.steps[0].status).toBe("canceled");
    expect(done.record.steps[0].executionResult?.ok).not.toBe(true);
    // SA-LED-003: no historical fact was rewritten from canceled to succeeded.
    expect(done.record.steps.some((step) => step.status === "succeeded")).toBe(false);
  });

  it("lets a signal-honoring gate hook return canceled honestly instead of fabricating a decline", async () => {
    let executed = false;
    let reached!: () => void;
    const atGate = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const planned = gatedAction(() => {
      executed = true;
      return "exported";
    });
    const core = registry([planned], { editor: [planned.id] });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({
      registry: core,
      ledger,
      snapshotStore: createMemorySnapshotStore({ "design.value": "before" }).adapter,
      approvalHook: (request) =>
        new Promise((resolve) => {
          reached();
          request.signal?.addEventListener(
            "abort",
            () => resolve({ status: "canceled", reason: "user invoked undo mid-gate" }),
            { once: true },
          );
        }),
    });
    const run = await engine.executeChain({
      intent: "export",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: planned.id, params: { value: "out" } }],
    });
    await atGate;
    const undo = run.undoAll();
    const done = await run.done;
    await undo;

    expect(executed).toBe(false);
    expect(done.status).toBe("canceled");
    // SA-LED-036: the approval is recorded canceled — the honest, now-reachable vocabulary — not a
    // fabricated decline the user never made.
    expect(done.record.approval.status).toBe("canceled");
    expect(done.record.steps[0].status).toBe("canceled");
  });
});

// B1 (issue #83 §7): surface liveness consumed by policy resolution and by the cross-surface
// boundary re-check MUST be scoped to the requesting principal (SA-DECL-097). The engine resolves
// policy and re-validates availability against one per-request view; these prove one principal's
// registration never authorizes another's invocation, and that the SPA default path is unchanged.
describe("B1 — request-scoped availability in the execution engine (SA-DECL-097)", () => {
  it("refuses an action for a principal whose view lacks the surface, even after another registered it on the shared instance", async () => {
    const act = action("admin.purge_accounts");
    const reg = new CapabilityRegistry({
      actions: [act],
      surfaces: [
        defineSurface({
          id: "admin",
          title: "admin",
          description: "admin surface",
          capabilities: [act.id],
        }),
      ],
    });
    // Principal A registered the surface on the SHARED instance — the module-singleton hoist hazard.
    reg.registerSurface("admin");
    const engine = new ExecutionEngine({ registry: reg, ledger: new InMemoryLedger() });

    // Principal B executes with its own per-request view, where "admin" is not live.
    const refused = await engine.executeAction({
      intent: "purge",
      surfaceId: "admin",
      actionId: act.id,
      params: { value: "x" },
      posture: "creative-tool",
      availability: reg.withLiveness(createLivenessState()),
    });
    // Chain policy sees the action unavailable in B's view → refused. Pre-fix, the engine read the
    // shared instance liveness (admin live via A) and would have executed and succeeded.
    expect(refused.status).toBe("refused");

    // Principal A, with a view where "admin" is live, succeeds against the same shared registry.
    const stateA = createLivenessState();
    stateA.liveSurfaces.add("admin");
    const ok = await engine.executeAction({
      intent: "purge",
      surfaceId: "admin",
      actionId: act.id,
      params: { value: "x" },
      posture: "creative-tool",
      availability: reg.withLiveness(stateA),
    });
    expect(ok.status).toBe("succeeded");
  });

  it("uses the registry default view when no per-request availability is supplied (SPA unchanged)", async () => {
    const act = action("admin.purge_accounts");
    const reg = new CapabilityRegistry({
      actions: [act],
      surfaces: [
        defineSurface({
          id: "admin",
          title: "admin",
          description: "admin surface",
          capabilities: [act.id],
        }),
      ],
    });
    const engine = new ExecutionEngine({ registry: reg, ledger: new InMemoryLedger() });

    // No view supplied: availability defaults to the registry's instance liveness, exactly as before.
    const before = await engine.executeAction({
      intent: "purge",
      surfaceId: "admin",
      actionId: act.id,
      params: { value: "x" },
      posture: "creative-tool",
    });
    expect(before.status).toBe("refused");

    reg.registerSurface("admin");
    const after = await engine.executeAction({
      intent: "purge",
      surfaceId: "admin",
      actionId: act.id,
      params: { value: "x" },
      posture: "creative-tool",
    });
    expect(after.status).toBe("succeeded");
  });

  it("runs a cross-surface chain entirely on the per-request view, preserving the B11 boundary re-check (SA-DECL-097)", async () => {
    const first = action("home.write_note");
    const second = action("settings.save_note");
    const reg = new CapabilityRegistry({
      actions: [first, second],
      surfaces: [
        defineSurface({
          id: "home",
          title: "home",
          description: "home surface",
          capabilities: [first.id],
        }),
        defineSurface({
          id: "settings",
          title: "settings",
          description: "settings surface",
          capabilities: [second.id],
        }),
      ],
    });
    // Neither surface is registered on the shared instance; only this principal's view sees them.
    const state = createLivenessState();
    state.liveSurfaces.add("home");
    state.liveSurfaces.add("settings");
    const engine = new ExecutionEngine({ registry: reg, ledger: new InMemoryLedger() });

    const run = await engine.executeChain({
      intent: "note then save",
      surfaceId: "home",
      posture: "creative-tool",
      availability: reg.withLiveness(state),
      steps: [
        { actionId: first.id, params: { value: "a" } },
        { actionId: second.id, params: { value: "b" }, targetSurfaceId: "settings" },
      ],
    });
    const result = await run.done;

    // The cross-surface step's plan-time availability deferred to declared membership (B11), the
    // readiness wait resolved immediately from the view, and the boundary re-check honored the view
    // — so the whole chain ran off the per-request view. The shared instance never saw the surfaces.
    expect(result.status).toBe("succeeded");
    expect(reg.isSurfaceLive("home")).toBe(false);
    expect(reg.isSurfaceLive("settings")).toBe(false);
  });
});
