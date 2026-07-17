import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  ExecutionEngine,
  InMemoryLedger,
  RecordedValueCloneError,
  compileSchema,
  createStrictObjectSchema,
  defineAction,
  defineSurface,
  type ActionDeclaration,
  type ActionLedger,
  type PreExecutionHook,
} from "./index.js";

/** Shorthand for the params type these fixtures declare, kept honest by the casts below. */
type Params = ActionDeclaration<Record<string, unknown>, string>["params"];

/**
 * The default parameter contract for these fixtures: one optional string.
 *
 * Built with `compileSchema` so the parser and the model-facing schema are one source
 * (SA-DECL-093, SA-DECL-095). `value` is optional because several chains below dispatch steps with
 * no parameters at all.
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

function registry(actions: ActionDeclaration<Record<string, unknown>, string>[]) {
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

/**
 * Wraps the session ledger so every method settles asynchronously, standing in for the
 * "server durable storage" backend class SA-LED-144 requires the framework to allow.
 */
function durableLedger(
  options: { rejectOn?: (operation: string, args: unknown[]) => boolean } = {},
) {
  const inner = new InMemoryLedger();
  const calls: string[] = [];
  const wrap =
    (operation: string) =>
    async (...args: unknown[]) => {
      calls.push(operation);
      await Promise.resolve();
      if (options.rejectOn?.(operation, args))
        throw new Error(`durable write "${operation}" rejected`);
      return (inner[operation as keyof InMemoryLedger] as (...rest: unknown[]) => unknown).apply(
        inner,
        args,
      );
    };
  const ledger: ActionLedger = {
    createInvocation: wrap("createInvocation"),
    appendPolicyDecision: wrap("appendPolicyDecision"),
    setApproval: wrap("setApproval"),
    updateStep: wrap("updateStep"),
    attachUndoHandle: wrap("attachUndoHandle"),
    updateUndoHandle: wrap("updateUndoHandle"),
    expireUndoHandle: wrap("expireUndoHandle"),
    supersedeUndoHandle: wrap("supersedeUndoHandle"),
    findAvailableUndoHandles: wrap("findAvailableUndoHandles"),
    appendDisclosure: wrap("appendDisclosure"),
    appendUndoAttempt: wrap("appendUndoAttempt"),
    updateUndoAttempt: wrap("updateUndoAttempt"),
    requireRecord: wrap("requireRecord"),
    getRecords: wrap("getRecords"),
    subscribe: (listener: () => void) => inner.subscribe(listener),
  } as unknown as ActionLedger;
  return { ledger, inner, calls };
}

describe("SA-LED-141 pre-execution durability barrier", () => {
  it("runs a chain to success against a fully asynchronous durable ledger", async () => {
    const set = action("palette.set_color");
    const { ledger, inner } = durableLedger();
    const engine = new ExecutionEngine({ registry: registry([set]), ledger });

    const run = await engine.executeChain({
      intent: "set color",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: set.id, params: { value: "after" } }],
    });
    const result = await run.done;

    expect(result.status).toBe("succeeded");
    expect(inner.getRecords()).toHaveLength(1);
    expect(result.record.steps[0].status).toBe("succeeded");
  });

  it("does not execute the action when a required pre-execution ledger write rejects", async () => {
    let executed = false;
    const set = action("palette.set_color", {
      execute: () => {
        executed = true;
        return "ok";
      },
    });
    // The step's "running" marker is a write policy requires before this execution is authorized.
    const { ledger } = durableLedger({
      rejectOn: (operation, args) =>
        operation === "updateStep" &&
        (args[2] as { status?: string } | undefined)?.status === "running",
    });
    const engine = new ExecutionEngine({ registry: registry([set]), ledger });

    const run = await engine.executeChain({
      intent: "set color",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: set.id, params: { value: "after" } }],
    });
    const result = await run.done;

    expect(executed).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("ledger_write_failed");
    expect(result.failure?.message).toContain("was not authorized");
  });

  it("rejects executeChain legibly when the invocation record itself cannot be written", async () => {
    let executed = false;
    const set = action("palette.set_color", {
      execute: () => {
        executed = true;
        return "ok";
      },
    });
    const { ledger } = durableLedger({ rejectOn: (operation) => operation === "createInvocation" });
    const engine = new ExecutionEngine({ registry: registry([set]), ledger });

    await expect(
      engine.executeChain({
        intent: "set color",
        surfaceId: "editor",
        posture: "creative-tool",
        steps: [{ actionId: set.id, params: { value: "after" } }],
      }),
    ).rejects.toThrow(/createInvocation.*failed.*not authorized/s);
    expect(executed).toBe(false);
  });
});

describe("SA-LED-141 pre-execution hook", () => {
  it("gates the action when the hook rejects, and records the refused step", async () => {
    let executed = false;
    const set = action("palette.set_color", {
      execute: () => {
        executed = true;
        return "ok";
      },
    });
    const ledger = new InMemoryLedger();
    const preExecutionHook: PreExecutionHook = async () => {
      throw new Error("ledger flush failed");
    };
    const engine = new ExecutionEngine({ registry: registry([set]), ledger, preExecutionHook });

    const run = await engine.executeChain({
      intent: "set color",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: set.id, params: { value: "after" } }],
    });
    const result = await run.done;

    expect(executed).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.failure?.code).toBe("pre_execution_barrier_failed");
    expect(result.record.steps[0].status).toBe("failed");
    expect(result.record.steps[0].executionResult).toMatchObject({
      ok: false,
      errorCode: "pre_execution_barrier_failed",
      errorSummary: "ledger flush failed",
    });
  });

  it("receives the step scope and permits execution when it resolves", async () => {
    const seen: unknown[] = [];
    const set = action("palette.set_color");
    const engine = new ExecutionEngine({
      registry: registry([set]),
      ledger: new InMemoryLedger(),
      preExecutionHook: (request) => {
        seen.push({
          stepId: request.stepId,
          actionId: request.actionId,
          params: request.params,
          surfaceId: request.surfaceId,
          writes: request.writes,
        });
      },
    });

    const run = await engine.executeChain({
      intent: "set color",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: set.id, params: { value: "after" } }],
    });

    expect((await run.done).status).toBe("succeeded");
    expect(seen).toEqual([
      {
        stepId: "step_1",
        actionId: "palette.set_color",
        params: { value: "after" },
        surfaceId: "editor",
        writes: ["design.value"],
      },
    ]);
  });

  it("gates every step of a chain, so a later refusal leaves earlier steps recorded", async () => {
    const ran: string[] = [];
    const first = action("palette.set_color", {
      execute: () => {
        ran.push("first");
        return "ok";
      },
    });
    const second = action("palette.set_shade", {
      execute: () => {
        ran.push("second");
        return "ok";
      },
    });
    const engine = new ExecutionEngine({
      registry: registry([first, second]),
      ledger: new InMemoryLedger(),
      preExecutionHook: ({ actionId }) => {
        if (actionId === "palette.set_shade") throw new Error("barrier down");
      },
    });

    const run = await engine.executeChain({
      intent: "set both",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        { actionId: first.id, params: {} },
        { actionId: second.id, params: {} },
      ],
    });
    const result = await run.done;

    expect(ran).toEqual(["first"]);
    expect(result.status).toBe("failed");
    expect(result.record.steps.map((step) => step.status)).toEqual(["succeeded", "failed"]);
  });
});

describe("SA-CONF-068 uncompilable chains report scope instead of throwing", () => {
  it("records a hallucinated action ID as a refused chain without throwing", async () => {
    const set = action("palette.set_color");
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({ registry: registry([set]), ledger });

    const run = await engine.executeChain({
      intent: "make it pop",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: "palette.hallucinated", params: { value: "x" } }],
    });
    const result = await run.done;

    expect(result.status).toBe("refused");
    expect(result.failure?.code).toBe("unknown_action");
    expect(ledger.getRecords()).toHaveLength(1);
    expect(result.record.intent.text).toBe("make it pop");
    expect(result.record.steps[0]).toMatchObject({
      actionId: "palette.hallucinated",
      params: { value: "x" },
      status: "failed",
      executionResult: { ok: false, errorCode: "unknown_action" },
    });
  });

  it("records an invalid parameter payload as a refused chain without throwing", async () => {
    const strict = action("palette.set_color", {
      // A hand-written parser, because this test asserts on that parser's own error text.
      params: createStrictObjectSchema<{ value: string }>(
        ["value"],
        (input) => {
          if (typeof input.value !== "string") throw new Error("value must be a string");
          return { value: input.value };
        },
        { type: "object", properties: { value: { type: "string" } }, additionalProperties: false },
      ) as unknown as Params,
    });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({ registry: registry([strict]), ledger });

    const run = await engine.executeChain({
      intent: "set the color",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: strict.id, params: { value: 42 } }],
    });
    const result = await run.done;

    expect(result.status).toBe("refused");
    expect(result.failure?.code).toBe("invalid_params");
    expect(ledger.getRecords()).toHaveLength(1);
    expect(result.record.steps[0]).toMatchObject({
      params: { value: 42 },
      status: "failed",
      executionResult: { ok: false, errorCode: "invalid_params" },
    });
    expect(result.record.steps[0].executionResult?.errorSummary).toContain(
      "value must be a string",
    );
  });

  it("reports skipped scope for the rest of the chain and runs nothing", async () => {
    let executed = false;
    const set = action("palette.set_color", {
      execute: () => {
        executed = true;
        return "ok";
      },
    });
    const engine = new ExecutionEngine({ registry: registry([set]), ledger: new InMemoryLedger() });

    const run = await engine.executeChain({
      intent: "set then hallucinate",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        { actionId: set.id, params: {} },
        { actionId: "palette.hallucinated", params: {} },
      ],
    });
    const result = await run.done;

    expect(executed).toBe(false);
    expect(result.record.steps.map((step) => step.status)).toEqual(["skipped", "failed"]);
    expect(result.record.steps[0].executionResult?.errorCode).toBe("step_skipped");
  });

  it("gives executeAction and executeChain the same failure protocol for the same bad input", async () => {
    const set = action("palette.set_color");
    const engine = new ExecutionEngine({ registry: registry([set]), ledger: new InMemoryLedger() });

    const direct = await engine.executeAction({
      intent: "make it pop",
      surfaceId: "editor",
      posture: "creative-tool",
      actionId: "palette.hallucinated",
      params: {},
    });
    const chained = await (
      await engine.executeChain({
        intent: "make it pop",
        surfaceId: "editor",
        posture: "creative-tool",
        steps: [{ actionId: "palette.hallucinated", params: {} }],
      })
    ).done;

    expect(direct.status).toBe("refused");
    expect(direct.failure?.code).toBe("unknown_action");
    expect(chained.status).toBe(direct.status);
    expect(chained.failure?.code).toBe(direct.failure?.code);
  });
});

describe("SA-EXEC-010 recorded values survive storage", () => {
  it("stores a BigInt parameter and still records the intent", async () => {
    const remove = action("db.delete_row", {
      reversibility: { kind: "irreversible" },
      // The genuine `createStrictObjectSchema` case: a coercion the profile cannot express. The
      // model sends a JSON integer; the app widens it to a BigInt before it reaches the ledger.
      params: createStrictObjectSchema<{ id: bigint }>(
        ["id"],
        (input) => ({ id: input.id as bigint }),
        { type: "object", properties: { id: { type: "integer" } }, additionalProperties: false },
      ) as unknown as Params,
    });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({ registry: registry([remove]), ledger });

    const run = await engine.executeChain({
      intent: "delete row 10",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [{ actionId: remove.id, params: { id: 10n } }],
    });
    const result = await run.done;

    expect(result.status).toBe("succeeded");
    expect(ledger.getRecords()).toHaveLength(1);
    expect((result.record.steps[0].params as { id: bigint }).id).toBe(10n);
  });

  it("stores Date, Map, Set, and undefined without corrupting them", async () => {
    // Another hand-written parser: the wire carries an ISO string, an object, and an array, which
    // the app hydrates into Date, Map, and Set. None of the three runtime types is expressible in
    // the profile, so the coercion has to live in the parser rather than in the schema.
    const set = action("palette.set_color", {
      params: createStrictObjectSchema<Record<string, unknown>>(
        ["when", "tags", "seen", "missing"],
        (input) => input,
        {
          type: "object",
          properties: {
            when: { type: "string", format: "date-time" },
            tags: {
              type: "object",
              properties: { a: { type: "integer" } },
              additionalProperties: false,
            },
            seen: { type: "array", items: { type: "string" } },
            missing: { type: "null" },
          },
          additionalProperties: false,
        },
      ) as unknown as Params,
    });
    const ledger = new InMemoryLedger();
    const engine = new ExecutionEngine({ registry: registry([set]), ledger });
    const when = new Date("2026-07-17T00:00:00.000Z");

    const run = await engine.executeChain({
      intent: "set color",
      surfaceId: "editor",
      posture: "creative-tool",
      steps: [
        {
          actionId: set.id,
          params: {
            when,
            tags: new Map([["a", 1]]),
            seen: new Set(["x"]),
            missing: undefined,
          },
        },
      ],
    });
    await run.done;

    const params = ledger.getRecords()[0].steps[0].params as {
      when: Date;
      tags: Map<string, number>;
      seen: Set<string>;
      missing: undefined;
    };
    expect(params.when).toBeInstanceOf(Date);
    expect(params.when.toISOString()).toBe("2026-07-17T00:00:00.000Z");
    expect(params.tags).toBeInstanceOf(Map);
    expect(params.tags.get("a")).toBe(1);
    expect(params.seen).toBeInstanceOf(Set);
    expect(params.seen.has("x")).toBe(true);
    expect("missing" in params).toBe(true);
  });

  it("fails loudly and legibly rather than storing a corrupted non-cloneable value", () => {
    const ledger = new InMemoryLedger();

    expect(() =>
      ledger.createInvocation({
        intent: { text: "run the callback" },
        steps: [
          {
            stepId: "step_1",
            actionId: "palette.set_color",
            params: { callback: () => undefined },
            writes: [],
          },
        ],
      }),
    ).toThrow(RecordedValueCloneError);

    try {
      ledger.createInvocation({
        intent: { text: "run the callback" },
        steps: [
          {
            stepId: "step_1",
            actionId: "palette.set_color",
            params: { callback: () => undefined },
            writes: [],
          },
        ],
      });
      throw new Error("expected the clone to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(RecordedValueCloneError);
      expect((error as RecordedValueCloneError).code).toBe("recorded_value_not_cloneable");
      expect((error as Error).message).toContain("not structured-cloneable");
    }
  });
});
