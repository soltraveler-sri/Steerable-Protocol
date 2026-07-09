/* @vitest-environment jsdom */
import { act, render, screen, waitFor } from "@testing-library/react";
import { defineAction, defineFacts, defineSurface, emptyParamsSchema, type RegistryDeclarations } from "@steerable/core";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SteerableProvider, createSteerableRuntime, usePublishedFacts, useSteerable, useSteeringState, useSurfaceRegistration } from "./index.js";

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
        ] }).done;
      }}>{route}</button>;
    }
    render(<SteerableProvider runtime={runtime}><FakeRouter /></SteerableProvider>);
    await act(async () => { screen.getByRole("button").click(); });
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("settings"));
    await waitFor(() => expect(runtime.ledger.requireRecord("inv_1").steps.map((step) => step.status)).toEqual(["succeeded", "succeeded"]));
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
        <button onClick={() => void executeAction({ intent: "navigate", surfaceId: "editor", posture: "creative-tool", actionId: "editor.navigate_settings", params: {} }).done}>run</button>
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
        <button onClick={() => void executeAction({ intent: "apply", surfaceId: "editor", posture: "creative-tool", actionId: "editor.apply_change", params: {} }).done}>apply</button>
      </>;
    }
    render(<SteerableProvider runtime={runtime}><Consumer /></SteerableProvider>);
    await act(async () => { screen.getByRole("button", { name: "apply" }).click(); });
    await waitFor(() => expect(screen.getByTestId("approval").textContent).toBe("editor.apply_change"));
    await act(async () => { approve(); });
    await waitFor(() => expect(screen.getByTestId("approval").textContent).toBe("none"));
  });
});
