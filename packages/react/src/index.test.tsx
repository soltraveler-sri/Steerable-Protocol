/* @vitest-environment jsdom */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { defineAction, defineFacts, defineSurface, emptyParamsSchema, type RegistryDeclarations } from "@steerable/core";
import { StrictMode, useLayoutEffect, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { SteerableProvider, createSteerableRuntime, usePublishedFacts, useSteerable, useSteerableRuntime, useSteeringState, useSurfaceRegistration } from "./index.js";

const declarations: RegistryDeclarations = {
  actions: [
    defineAction({
      id: "editor.navigate_settings",
      title: "Navigate to settings",
      description: "Moves the fake router to settings.",
      params: emptyParamsSchema,
      reads: ["ui.route"],
      writes: ["ui.route"],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [],
      execute: () => undefined,
      undo: () => undefined,
      guidance: "Use to reach settings.",
      examples: [{ user: "open settings", params: {} }],
    }),
    defineAction({
      id: "settings.set_theme",
      title: "Set theme",
      description: "Updates the theme on settings.",
      params: emptyParamsSchema,
      reads: ["design.theme"],
      writes: ["design.theme"],
      risk: "safe",
      reversibility: { kind: "undoable" },
      effects: { external: false, cost: "none", sensitive: false },
      confirmation: "never",
      preconditions: [],
      execute: () => undefined,
      undo: () => undefined,
      guidance: "Use to set the theme.",
      examples: [{ user: "set the theme", params: {} }],
    }),
  ],
  facts: [
    defineFacts({
      id: "settings.current_facts",
      title: "Settings facts",
      description: "Bounded settings context.",
      surface: "settings",
      facts: [{ key: "design.theme", description: "Current theme.", schema: emptyParamsSchema }],
      publish: () => ({ "design.theme": "dark" }),
      update: "material_change",
    }),
  ],
  surfaces: [
    defineSurface({ id: "editor", title: "Editor", description: "Editor route.", capabilities: ["editor.navigate_settings"] }),
    defineSurface({ id: "settings", title: "Settings", description: "Settings route.", capabilities: ["settings.set_theme", "settings.current_facts"] }),
  ],
};

function Surface({ id }: { id: string }) {
  useSurfaceRegistration(id);
  return <output data-testid="surface">{id}</output>;
}

// Vitest runs without `globals`, so Testing Library never installs its own auto-cleanup.
// Without this, mounted trees leak into later tests and duplicate every testid query.
afterEach(cleanup);

describe("@steerable/react", () => {
  it("registers and deregisters a declared surface with its route lifecycle", () => {
    const runtime = createSteerableRuntime({ declarations });
    const view = render(<SteerableProvider runtime={runtime}><Surface id="editor" /></SteerableProvider>);
    expect(runtime.registry.isSurfaceLive("editor")).toBe(true);
    view.unmount();
    expect(runtime.registry.isSurfaceLive("editor")).toBe(false);
  });

  it("awaits a fake-router destination until the destination route registers", async () => {
    const runtime = createSteerableRuntime({ declarations });
    function FakeRouter() {
      const [route, setRoute] = useState("editor");
      useSurfaceRegistration(route);
      const { executeChain } = useSteerable();
      return <button onClick={() => {
        const navigate = runtime.registry.requireAction("editor.navigate_settings");
        navigate.execute = () => setRoute("settings");
        void executeChain({ intent: "open settings then set theme", surfaceId: "editor", posture: "creative-tool", steps: [
          { actionId: "editor.navigate_settings", params: {} },
          { actionId: "settings.set_theme", params: {}, targetSurfaceId: "settings", surfaceTimeoutMs: 100 },
        ] });
      }}>{route}</button>;
    }
    render(<SteerableProvider runtime={runtime}><FakeRouter /></SteerableProvider>);
    await act(async () => { screen.getByRole("button").click(); });
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("settings"));
    await waitFor(async () =>
      expect((await runtime.ledger.requireRecord("inv_1")).steps.map((step) => step.status)).toEqual(["succeeded", "succeeded"]),
    );
  });

  it("publishes facts and updates steering state from runtime execution without polling", async () => {
    const runtime = createSteerableRuntime({ declarations });
    function Consumer() {
      useSurfaceRegistration("editor");
      const { values } = usePublishedFacts("settings.current_facts");
      const state = useSteeringState();
      const { executeAction } = useSteerable();
      return <>
        <output data-testid="facts">{values?.["design.theme"] as string ?? "waiting"}</output>
        <output data-testid="records">{state.records.length}</output>
        <button onClick={() => void executeAction({ intent: "navigate", surfaceId: "editor", posture: "creative-tool", actionId: "editor.navigate_settings", params: {} })}>run</button>
      </>;
    }
    render(<SteerableProvider runtime={runtime}><Consumer /></SteerableProvider>);
    await screen.findByText("dark");
    await act(async () => { screen.getByRole("button", { name: "run" }).click(); });
    await waitFor(() => expect(screen.getByTestId("records").textContent).toBe("1"));
  });

  it("wires a product approval hook through pending steering state", async () => {
    let approve!: () => void;
    const runtime = createSteerableRuntime({
      declarations: {
        ...declarations,
        facts: [],
        actions: [defineAction({
          id: "editor.apply_change",
          title: "Apply change",
          description: "A deliberately gated change.",
          params: emptyParamsSchema,
          reads: ["design.theme"],
          writes: ["design.theme"],
          risk: "mutating",
          reversibility: { kind: "undoable" },
          effects: { external: false, cost: "none", sensitive: false },
          confirmation: "always",
          preconditions: [],
          execute: () => undefined,
          undo: () => undefined,
          guidance: "Use only after approval.",
          examples: [{ user: "apply the change", params: {} }],
        })],
        surfaces: [defineSurface({ id: "editor", title: "Editor", description: "Editor route.", capabilities: ["editor.apply_change"] })],
      },
      approvalHook: () => new Promise((resolve) => { approve = () => resolve({ status: "approved" }); }),
    });
    function Consumer() {
      useSurfaceRegistration("editor");
      const { pendingApproval } = useSteeringState();
      const { executeAction } = useSteerable();
      return <>
        <output data-testid="approval">{pendingApproval ? pendingApproval.heldSteps[0]?.actionId : "none"}</output>
        <button onClick={() => void executeAction({ intent: "apply", surfaceId: "editor", posture: "creative-tool", actionId: "editor.apply_change", params: {} })}>apply</button>
      </>;
    }
    render(<SteerableProvider runtime={runtime}><Consumer /></SteerableProvider>);
    await act(async () => { screen.getByRole("button", { name: "apply" }).click(); });
    await waitFor(() => expect(screen.getByTestId("approval").textContent).toBe("editor.apply_change"));
    await act(async () => { approve(); });
    await waitFor(() => expect(screen.getByTestId("approval").textContent).toBe("none"));
  });
});

// ---------------------------------------------------------------------------
// Server-rendered / prop-driven lifecycle regressions (issue #83 §6, §7).
// ---------------------------------------------------------------------------

/** A producer that throws unless a client-side store has already been seeded. */
const propDrivenDeclarations: RegistryDeclarations = {
  actions: declarations.actions,
  facts: [
    defineFacts({
      id: "settings.current_facts",
      title: "Settings facts",
      description: "Bounded settings context.",
      surface: "settings",
      facts: [{ key: "design.theme", description: "Current theme.", schema: emptyParamsSchema }],
      publish: () => {
        throw new Error("facts snapshot not seeded");
      },
      update: "material_change",
    }),
  ],
  surfaces: declarations.surfaces,
};

// The suite runs on Node; `@steerable/core` and this binding take no Node
// dependency, so the root has no `@types/node`. Declaring the surface actually
// used keeps `tsconfig.tests.json` honest without pulling in a type package.
declare const process: {
  on(event: "unhandledRejection", listener: (reason: unknown) => void): void;
  off(event: "unhandledRejection", listener: (reason: unknown) => void): void;
};

function captureUnhandledRejections(): { drain: () => Promise<unknown[]> } {
  const seen: unknown[] = [];
  const onUnhandled = (reason: unknown) => seen.push(reason);
  process.on("unhandledRejection", onUnhandled);
  return {
    drain: async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      process.off("unhandledRejection", onUnhandled);
      return seen;
    },
  };
}

describe("facts publication under prop-driven state (D-08)", () => {
  it("surfaces a failing producer through onError instead of an unhandled rejection", async () => {
    const rejections = captureUnhandledRejections();
    const runtime = createSteerableRuntime({ declarations: propDrivenDeclarations });
    const errors: unknown[] = [];
    function Consumer() {
      const { error } = usePublishedFacts("settings.current_facts", {
        onError: (value) => errors.push(value),
      });
      return <output data-testid="error">{error ? String(error) : "none"}</output>;
    }
    render(
      <SteerableProvider runtime={runtime}>
        <Consumer />
      </SteerableProvider>,
    );
    await waitFor(() => expect(errors).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe("Error: facts snapshot not seeded"),
    );
    expect(await rejections.drain()).toEqual([]);
  });

  it("publishes seeded facts synchronously, before any effect or await", () => {
    const runtime = createSteerableRuntime({ declarations: propDrivenDeclarations });
    let visibleDuringChildRender: Record<string, unknown> | undefined;
    function Page({ theme }: { theme: string }) {
      usePublishedFacts("settings.current_facts", { seed: { "design.theme": theme } });
      // The runtime must already hold the facts while this render is still running,
      // which is what a steering turn dispatched before paint would read.
      visibleDuringChildRender = runtime.facts.get("settings.current_facts");
      return null;
    }
    render(
      <SteerableProvider runtime={runtime}>
        <Page theme="light" />
      </SteerableProvider>,
    );
    expect(visibleDuringChildRender).toEqual({ "design.theme": "light" });
    expect(runtime.facts.get("settings.current_facts")).toEqual({ "design.theme": "light" });
  });

  it("exposes seeded facts as values without pulling the declared producer", () => {
    const runtime = createSteerableRuntime({ declarations: propDrivenDeclarations });
    function Page({ theme }: { theme: string }) {
      const { values } = usePublishedFacts("settings.current_facts", {
        seed: { "design.theme": theme },
      });
      return <output data-testid="facts">{(values?.["design.theme"] as string) ?? "waiting"}</output>;
    }
    render(
      <SteerableProvider runtime={runtime}>
        <Page theme="light" />
      </SteerableProvider>,
    );
    expect(screen.getByTestId("facts").textContent).toBe("light");
  });
});

describe("ownership-aware publisher cleanup (D-10)", () => {
  /** A pull-mode facts source whose producer reads a test-controlled store. */
  function pullDeclarations(read: () => string): RegistryDeclarations {
    return {
      actions: declarations.actions,
      surfaces: declarations.surfaces,
      facts: [
        defineFacts({
          id: "settings.current_facts",
          title: "Settings facts",
          description: "Bounded settings context.",
          surface: "settings",
          facts: [
            { key: "design.theme", description: "Current theme.", schema: emptyParamsSchema },
          ],
          publish: () => ({ "design.theme": read() }),
          update: "material_change",
        }),
      ],
    };
  }

  function PullPage() {
    usePublishedFacts("settings.current_facts");
    return null;
  }

  function SeededPage({ theme }: { theme: string }) {
    usePublishedFacts("settings.current_facts", { seed: { "design.theme": theme } });
    return <output>{theme}</output>;
  }

  it("does not let an outgoing publisher retract the incoming publisher's snapshot", async () => {
    let theme = "dark";
    const runtime = createSteerableRuntime({ declarations: pullDeclarations(() => theme) });
    // Overlapping lifetimes: a transition mounts the destination before the origin unmounts,
    // so the outgoing cleanup runs after the incoming publisher already owns these facts.
    const outgoing = render(
      <SteerableProvider runtime={runtime}>
        <PullPage />
      </SteerableProvider>,
    );
    await waitFor(() =>
      expect(runtime.facts.get("settings.current_facts")).toEqual({ "design.theme": "dark" }),
    );
    theme = "light";
    const incoming = render(
      <SteerableProvider runtime={runtime}>
        <PullPage />
      </SteerableProvider>,
    );
    await waitFor(() =>
      expect(runtime.facts.get("settings.current_facts")).toEqual({ "design.theme": "light" }),
    );

    outgoing.unmount();

    // Nothing republishes for a pull-mode publisher, so an unconditional clear here would
    // strand the live surface with no facts at all for the rest of the session.
    expect(runtime.facts.get("settings.current_facts")).toEqual({ "design.theme": "light" });
    incoming.unmount();
    // The owner's own teardown still retracts the snapshot.
    expect(runtime.facts.get("settings.current_facts")).toBeUndefined();
  });

  it("never tears the snapshot to empty while a live publisher owns it", () => {
    const runtime = createSteerableRuntime({ declarations: propDrivenDeclarations });
    const outgoing = render(
      <SteerableProvider runtime={runtime}>
        <SeededPage theme="dark" />
      </SteerableProvider>,
    );
    const incoming = render(
      <SteerableProvider runtime={runtime}>
        <SeededPage theme="light" />
      </SteerableProvider>,
    );
    const observed: (Record<string, unknown> | undefined)[] = [];
    const unsubscribe = runtime.facts.subscribe(() =>
      observed.push(runtime.facts.get("settings.current_facts")),
    );
    outgoing.unmount();
    unsubscribe();
    // A seeded publisher re-seeds on re-render, so an unconditional clear would self-heal --
    // but only after publishing an empty snapshot that a steering turn could read.
    expect(observed.filter((entry) => entry === undefined)).toEqual([]);
    incoming.unmount();
  });

  it("preserves the destination snapshot across a route replacement", () => {
    const runtime = createSteerableRuntime({ declarations: propDrivenDeclarations });
    function Router() {
      const [theme, setTheme] = useState("dark");
      return (
        <>
          <button onClick={() => setTheme("light")}>navigate</button>
          <SeededPage key={theme} theme={theme} />
        </>
      );
    }
    render(
      <SteerableProvider runtime={runtime}>
        <Router />
      </SteerableProvider>,
    );
    expect(runtime.facts.get("settings.current_facts")).toEqual({ "design.theme": "dark" });
    act(() => {
      screen.getByRole("button", { name: "navigate" }).click();
    });
    expect(runtime.facts.get("settings.current_facts")).toEqual({ "design.theme": "light" });
  });

  it("keeps the snapshot published through a StrictMode double-invoke", () => {
    const runtime = createSteerableRuntime({ declarations: propDrivenDeclarations });
    render(
      <StrictMode>
        <SteerableProvider runtime={runtime}>
          <SeededPage theme="dark" />
        </SteerableProvider>
      </StrictMode>,
    );
    // StrictMode runs mount -> cleanup -> mount. The cleanup owns the snapshot and clears it,
    // so the remount must re-publish rather than leave the surface contextless.
    expect(runtime.facts.get("settings.current_facts")).toEqual({ "design.theme": "dark" });
  });
});

describe("surface registration timing and mount counting", () => {
  it("registers the surface before paint, not after it", () => {
    const runtime = createSteerableRuntime({ declarations });
    let liveAtLayout: boolean | null = null;
    function Parent() {
      // Child layout effects commit before this one; a first turn dispatched from here or
      // from the user's first interaction must not race registration.
      useLayoutEffect(() => {
        liveAtLayout = runtime.registry.isSurfaceLive("editor");
      }, []);
      return <Surface id="editor" />;
    }
    render(
      <SteerableProvider runtime={runtime}>
        <Parent />
      </SteerableProvider>,
    );
    expect(liveAtLayout).toBe(true);
  });

  it("renders on the server without warning that useLayoutEffect does nothing", () => {
    const runtime = createSteerableRuntime({ declarations });
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args[0]);
    try {
      const html = renderToString(
        <SteerableProvider runtime={runtime}>
          <Surface id="editor" />
        </SteerableProvider>,
      );
      expect(html).toContain("editor");
    } finally {
      console.error = original;
    }
    expect(errors.filter((entry) => String(entry).includes("useLayoutEffect"))).toEqual([]);
    // Surface liveness is per-client mutable state; a server render must not publish it.
    expect(runtime.registry.isSurfaceLive("editor")).toBe(false);
  });

  it("keeps a surface live until its last mount unmounts (B8)", () => {
    const runtime = createSteerableRuntime({ declarations });
    function Host() {
      const [both, setBoth] = useState(true);
      return (
        <>
          <Surface id="editor" />
          {both ? <Surface id="editor" /> : null}
          <button onClick={() => setBoth(false)}>drop</button>
        </>
      );
    }
    render(
      <SteerableProvider runtime={runtime}>
        <Host />
      </SteerableProvider>,
    );
    expect(runtime.registry.isSurfaceLive("editor")).toBe(true);
    act(() => {
      screen.getByRole("button", { name: "drop" }).click();
    });
    expect(runtime.registry.isSurfaceLive("editor")).toBe(true);
  });
});

describe("panel-lifetime assertion (R2.1)", () => {
  function useConsoleErrors(): { entries: string[]; restore: () => void } {
    const entries: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => entries.push(String(args[0]));
    return { entries, restore: () => (console.error = original) };
  }
  const panelErrors = (entries: string[]) =>
    entries.filter((entry) => entry.includes("steering session was destroyed"));

  it("fires when a provider inside the router is remounted by a surface change", () => {
    const spy = useConsoleErrors();
    try {
      function Page({ id }: { id: string }) {
        // The defect: the provider (and the panel) live below the router, so each route
        // builds its own runtime and the session cannot survive navigation.
        const runtime = useSteerableRuntime({ declarations });
        return (
          <SteerableProvider runtime={runtime}>
            <Surface id={id} />
          </SteerableProvider>
        );
      }
      function App() {
        const [route, setRoute] = useState("editor");
        return (
          <>
            <button onClick={() => setRoute("settings")}>navigate</button>
            <Page key={route} id={route} />
          </>
        );
      }
      render(<App />);
      expect(panelErrors(spy.entries)).toHaveLength(0);
      act(() => {
        screen.getByRole("button", { name: "navigate" }).click();
      });
      expect(panelErrors(spy.entries)).toHaveLength(1);
      expect(panelErrors(spy.entries)[0]).toContain("hoist SteerableProvider");
    } finally {
      spy.restore();
    }
  });

  it("stays silent when the provider is hoisted above the router", () => {
    const spy = useConsoleErrors();
    try {
      const runtime = createSteerableRuntime({ declarations });
      function App() {
        const [route, setRoute] = useState("editor");
        return (
          <SteerableProvider runtime={runtime}>
            <button onClick={() => setRoute("settings")}>navigate</button>
            <Surface key={route} id={route} />
          </SteerableProvider>
        );
      }
      render(<App />);
      act(() => {
        screen.getByRole("button", { name: "navigate" }).click();
      });
      expect(panelErrors(spy.entries)).toEqual([]);
    } finally {
      spy.restore();
    }
  });

  it("stays silent under a StrictMode double-mount", () => {
    const spy = useConsoleErrors();
    try {
      function App() {
        const runtime = useSteerableRuntime({ declarations });
        return (
          <SteerableProvider runtime={runtime}>
            <Surface id="editor" />
          </SteerableProvider>
        );
      }
      render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
      expect(panelErrors(spy.entries)).toEqual([]);
    } finally {
      spy.restore();
    }
  });

  it("stays silent on a legitimate remount that is not a surface change", () => {
    const spy = useConsoleErrors();
    try {
      function App() {
        const runtime = useSteerableRuntime({ declarations });
        return (
          <SteerableProvider runtime={runtime}>
            <Surface id="editor" />
          </SteerableProvider>
        );
      }
      function Host() {
        const [generation, setGeneration] = useState(0);
        return (
          <>
            <button onClick={() => setGeneration((value) => value + 1)}>reset</button>
            <App key={generation} />
          </>
        );
      }
      render(<Host />);
      act(() => {
        screen.getByRole("button", { name: "reset" }).click();
      });
      expect(panelErrors(spy.entries)).toEqual([]);
    } finally {
      spy.restore();
    }
  });

  it("stays silent on a full teardown with no remount", () => {
    const spy = useConsoleErrors();
    try {
      const runtime = createSteerableRuntime({ declarations });
      const view = render(
        <SteerableProvider runtime={runtime}>
          <Surface id="editor" />
        </SteerableProvider>,
      );
      view.unmount();
      expect(panelErrors(spy.entries)).toEqual([]);
    } finally {
      spy.restore();
    }
  });
});
