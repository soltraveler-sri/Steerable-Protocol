import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  InMemoryLedger,
  compileSchema,
  createMemorySnapshotStore,
  createUndoHandleForAction,
  defineAction,
  defineSurface,
  makeExecutableHandle,
  runUndoHandle,
  type ActionDeclaration,
  type ActionExecutionContext,
  type StateSnapshot,
  type UndoHandleRecord,
} from "./index.js";

/**
 * A4 + N7 regression coverage for "undo handles as data, not closures".
 *
 * The decisive A4 test round-trips an undo handle through `JSON.parse(JSON.stringify(...))` — the
 * exact transformation a durable ledger performs when it persists and reads back a handle — which
 * strips the captured `execute` closure, leaving only serializable data. On the pre-fix code that
 * lost closure degraded every undo to `unavailable`; the fix rehydrates the executable behavior from
 * the handle's `payload` plus the runtime registry/snapshot store, so the round-tripped handle still
 * reverses its step. Implements SA-LED-070–077 and SA-LED-144.
 */

const valueSchema = compileSchema<Record<string, unknown>>({
  type: "object",
  properties: { value: { type: "string" } },
  additionalProperties: false,
});

function action(
  id: string,
  overrides: Partial<ActionDeclaration<Record<string, unknown>, string>> = {},
): ActionDeclaration<Record<string, unknown>, string> {
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
    execute: () => "ok",
    undo: () => undefined,
    guidance: "Use for test work.",
    examples: [{ user: "do the thing", params: {} }],
    ...overrides,
  });
}

function registry(
  actions: ActionDeclaration<Record<string, unknown>, string>[],
): CapabilityRegistry {
  const compiled = new CapabilityRegistry({
    actions,
    readTools: [],
    facts: [],
    surfaces: [
      defineSurface({
        id: "editor",
        title: "Editor",
        description: "Editor route.",
        capabilities: actions.map((entry) => entry.id),
      }),
    ],
  });
  compiled.registerSurface("editor");
  return compiled;
}

function contextFor(
  compiled: CapabilityRegistry,
  overrides: Partial<ActionExecutionContext> = {},
): ActionExecutionContext {
  return {
    registry: compiled,
    surfaceId: "editor",
    now: () => new Date("2026-07-17T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Seeds a ledger with one succeeded step, attaches an undo handle built for the real record, then
 * returns the handle as a durable store would hand it back: JSON-serialized, closure stripped.
 */
function seedDurableHandle(
  ledger: InMemoryLedger,
  compiled: CapabilityRegistry,
  actionId: string,
  input: { params: unknown; result?: unknown; snapshot?: StateSnapshot },
): { recordId: string; durableHandle: UndoHandleRecord } {
  const record = ledger.createInvocation({
    intent: { text: "reverse me" },
    steps: [{ stepId: "step_1", actionId, params: input.params, writes: ["design.value"] }],
  });
  ledger.updateStep(record.recordId, "step_1", { status: "succeeded" });
  const handle = createUndoHandleForAction(compiled.requireAction(actionId), {
    recordId: record.recordId,
    stepId: "step_1",
    ...input,
  });
  if ("noUndoReason" in handle) throw new Error(`expected an executable handle for ${actionId}`);
  ledger.attachUndoHandle(record.recordId, "step_1", handle);
  const persisted = JSON.parse(JSON.stringify(ledger.requireRecord(record.recordId)));
  return { recordId: record.recordId, durableHandle: persisted.steps[0].undo as UndoHandleRecord };
}

describe("A4 — undo handles survive a durable JSON round-trip", () => {
  it("reverses a declared_inverse step after the executable closure is stripped", async () => {
    let state = "before";
    const setColor = action("palette.set_color", {
      execute: ({ value }) => {
        const previous = state;
        state = String(value);
        return previous;
      },
      undo: ({ result }) => {
        state = String(result);
      },
    });
    const compiled = registry([setColor]);
    const ledger = new InMemoryLedger();
    state = "after"; // the step already executed; the inverse must restore "before"
    const { recordId, durableHandle } = seedDurableHandle(ledger, compiled, setColor.id, {
      params: { value: "after" },
      result: "before",
    });

    expect("execute" in durableHandle).toBe(false); // plain data — no closure survived
    expect(durableHandle.mechanism).toBe("declared_inverse");

    const result = await runUndoHandle(ledger, durableHandle, contextFor(compiled));
    expect(result.status).toBe("succeeded");
    expect(state).toBe("before");
    expect(ledger.requireRecord(recordId).steps[0].status).toBe("undone");
  });

  it("reverses a runtime_snapshot step after the executable closure is stripped", async () => {
    const store = createMemorySnapshotStore({ "design.value": "before" });
    const snapshotAction = action("template.set_value", {
      reversibility: { kind: "snapshot" },
      undo: undefined,
      execute: ({ value }) => {
        store.write("design.value", value);
        return String(value);
      },
    });
    const compiled = registry([snapshotAction]);
    const ledger = new InMemoryLedger();
    const snapshot = (await store.adapter.capture(["design.value"])) as StateSnapshot;
    store.write("design.value", "after");
    const { durableHandle } = seedDurableHandle(ledger, compiled, snapshotAction.id, {
      params: { value: "after" },
      snapshot,
    });

    expect("execute" in durableHandle).toBe(false);
    expect(durableHandle.mechanism).toBe("runtime_snapshot");
    expect(store.read("design.value")).toBe("after");

    const result = await runUndoHandle(
      ledger,
      durableHandle,
      contextFor(compiled, { snapshotStore: store.adapter }),
    );
    expect(result.status).toBe("succeeded");
    expect(store.read("design.value")).toBe("before");
  });

  it("returns an honest no-undo result for an irreversible action rather than a false handle", () => {
    const irreversible = action("project.export_file", {
      risk: "mutating",
      reversibility: { kind: "irreversible" },
      undo: undefined,
    });
    const compiled = registry([irreversible]);
    const handle = createUndoHandleForAction(compiled.requireAction(irreversible.id), {
      recordId: "seed",
      stepId: "step_1",
      params: { value: "out" },
    });
    expect(handle).toEqual({ noUndoReason: "honest_irreversible" });
  });

  it("degrades to unavailable — never a false success — when the registry lost the inverse binding", async () => {
    let state = "before";
    const setColor = action("palette.set_color", {
      execute: () => "before",
      undo: ({ result }) => {
        state = String(result);
      },
    });
    const compiled = registry([setColor]);
    const ledger = new InMemoryLedger();
    const { recordId, durableHandle } = seedDurableHandle(ledger, compiled, setColor.id, {
      params: { value: "after" },
      result: "before",
    });

    // A durable runtime whose registry no longer binds this action cannot rehydrate the inverse.
    const strangerRegistry = registry([action("unrelated.do_nothing")]);
    const result = await runUndoHandle(ledger, durableHandle, contextFor(strangerRegistry));
    expect(result.status).toBe("unavailable");
    expect(state).toBe("before"); // never ran, never lied about success
    expect(ledger.requireRecord(recordId).steps[0].status).toBe("succeeded");
  });

  it("records a failure — never a false success — when a snapshot restore has no snapshot store", async () => {
    const store = createMemorySnapshotStore({ "design.value": "before" });
    const snapshotAction = action("template.set_value", {
      reversibility: { kind: "snapshot" },
      undo: undefined,
    });
    const compiled = registry([snapshotAction]);
    const ledger = new InMemoryLedger();
    const snapshot = (await store.adapter.capture(["design.value"])) as StateSnapshot;
    const { recordId, durableHandle } = seedDurableHandle(ledger, compiled, snapshotAction.id, {
      params: { value: "after" },
      snapshot,
    });

    // No snapshotStore on the context: the rehydrated behavior fails loudly instead of no-op success.
    const result = await runUndoHandle(ledger, durableHandle, contextFor(compiled));
    expect(result.status).toBe("failed");
    expect(result.errorSummary).toContain("StateSnapshotAdapter");
    expect(ledger.requireRecord(recordId).steps[0].status).toBe("succeeded");
  });

  it("makeExecutableHandle reconstructs behavior directly from serializable data", async () => {
    let state = "before";
    const setColor = action("palette.set_color", {
      execute: () => "before",
      undo: ({ result }) => {
        state = String(result);
      },
    });
    const compiled = registry([setColor]);
    const dataOnlyHandle: UndoHandleRecord = {
      handleId: "undo_handle_x",
      recordId: "seed",
      stepId: "step_1",
      actionId: setColor.id,
      reversibilityKind: "undoable",
      mechanism: "declared_inverse",
      status: "available",
      eligibilityScope: "step",
      restoration: "full",
      stateKeys: ["design.value"],
      payload: { params: { value: "after" }, result: "before" },
    };
    const executable = makeExecutableHandle(dataOnlyHandle, {
      registry: compiled,
      snapshotStore: undefined,
    });
    if ("nonExecutableReason" in executable) throw new Error("expected an executable handle");
    await executable.execute(contextFor(compiled));
    expect(state).toBe("before");
  });
});

describe("N7 — synthetic IDs are collision-free across processes and instances", () => {
  const uuid = () => crypto.randomUUID();

  it("mints undo-handle IDs from a UUID, not a resettable process-local counter", () => {
    const compiled = registry([action("palette.set_color")]);
    const handle = createUndoHandleForAction(compiled.requireAction("palette.set_color"), {
      recordId: "seed",
      stepId: "step_1",
      params: { value: "after" },
      result: "before",
    });
    if ("noUndoReason" in handle) throw new Error("expected an executable handle");
    // A module-global `++handleSequence` produced `undo_handle_1`, `undo_handle_2`, ... which a cold
    // restart re-mints from 1. A UUID suffix cannot collide across processes or instances.
    expect(handle.handleId).toMatch(
      /^undo_handle_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("honors an idFactory so two ledger instances (or a cold restart) never re-mint the same record ID", () => {
    // Two independent instances stand in for two processes / a cold-restarted lambda sharing a store.
    const first = new InMemoryLedger(undefined, undefined, uuid);
    const second = new InMemoryLedger(undefined, undefined, uuid);
    const input = {
      intent: { text: "steer" },
      steps: [
        { stepId: "step_1", actionId: "palette.set_color", params: {}, writes: ["design.value"] },
      ],
    };
    const a = first.createInvocation(input);
    const b = second.createInvocation(input);
    expect(a.recordId).not.toBe(b.recordId);
    expect(a.recordId).toMatch(/^inv_[0-9a-f-]{36}$/);
  });

  it("keeps readable per-instance sequential IDs by default without collisions inside one instance", () => {
    const ledger = new InMemoryLedger();
    const input = {
      intent: { text: "steer" },
      steps: [
        { stepId: "step_1", actionId: "palette.set_color", params: {}, writes: ["design.value"] },
      ],
    };
    const first = ledger.createInvocation(input);
    const second = ledger.createInvocation(input);
    expect(first.recordId).toBe("inv_1");
    expect(second.recordId).toBe("inv_2");
  });
});
