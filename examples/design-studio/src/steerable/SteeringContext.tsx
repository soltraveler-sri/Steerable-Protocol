import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import type { DesignSetters } from "../state/designStore";
import { useDesignStudio } from "../state/designStore";
import type { DesignState } from "../types";
import {
  ExecutionEngine,
  type ApprovalDecision,
  type ApprovalHook,
  type ApprovalRequest,
  type ChainExecutionRun,
} from "./execution";
import { InMemoryLedger, type SteeringInvocationRecord } from "./ledger";
import { ScriptedIntentRouter, type IntentRoute } from "./router";
import {
  createDesignStudioRegistry,
  createDesignStudioSnapshotAdapter,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
  type DesignStudioSurfaceId,
} from "./designStudioCapabilities";
import type { CapabilityRegistry, StateSnapshotAdapter, SurfaceId } from "./registry";
import { canUndoAnyStep, canUndoStep } from "./trail";
import { runUndoHandle, undoAll as undoAllRecord } from "./undo";

interface SteeringNotice {
  id: string;
  routeClass: IntentRoute["routeClass"];
  intent: string;
  message: string;
}

interface UndoToast {
  recordId: string;
  intent: string;
}

interface SteeringRuntime {
  registry: CapabilityRegistry;
  ledger: InMemoryLedger;
  snapshotStore: StateSnapshotAdapter;
  engine: ExecutionEngine;
  router: ScriptedIntentRouter;
}

interface SteeringContextValue {
  registry: CapabilityRegistry;
  currentSurfaceId: DesignStudioSurfaceId;
  records: SteeringInvocationRecord[];
  notices: SteeringNotice[];
  pendingApproval: ApprovalRequest | null;
  undoToast: UndoToast | null;
  isSubmitting: boolean;
  submitIntent: (intent: string) => Promise<void>;
  approvePending: () => void;
  declinePending: () => void;
  undoStep: (recordId: string, stepId: string) => Promise<void>;
  undoAll: (recordId: string) => Promise<void>;
  dismissUndoToast: () => void;
}

const SteeringContext = createContext<SteeringContextValue | null>(null);

export function SteeringProvider({ children }: { children: ReactNode }) {
  const { state, setters } = useDesignStudio();
  const location = useLocation();
  const stateRef = useRef(state);
  const settersRef = useRef(setters);
  const currentSurfaceId = surfaceIdForPath(location.pathname);
  const currentSurfaceIdRef = useRef<DesignStudioSurfaceId>(currentSurfaceId);
  const approvalResolveRef = useRef<((decision: ApprovalDecision) => void) | null>(null);
  const runsRef = useRef(new Map<string, ChainExecutionRun>());
  const hostRef = useRef<DesignStudioCapabilityHost | null>(null);
  const runtimeRef = useRef<SteeringRuntime | null>(null);
  const [records, setRecords] = useState<SteeringInvocationRecord[]>([]);
  const [notices, setNotices] = useState<SteeringNotice[]>([]);
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  stateRef.current = state;
  settersRef.current = setters;
  currentSurfaceIdRef.current = currentSurfaceId;

  const approvalHook = useCallback<ApprovalHook>((request) => {
    return new Promise((resolve) => {
      approvalResolveRef.current = resolve;
      setPendingApproval(request);

      request.signal?.addEventListener(
        "abort",
        () => {
          if (approvalResolveRef.current === resolve) {
            approvalResolveRef.current = null;
            setPendingApproval(null);
          }

          resolve({ status: "declined", reason: "approval_canceled" });
        },
        { once: true },
      );
    });
  }, []);

  if (!hostRef.current) {
    hostRef.current = {
      getState: () => stateRef.current,
      setters: createSetterProxy(settersRef),
      getOrigin: () =>
        typeof window === "undefined" ? "https://design-studio.local" : window.location.origin,
    };
  }

  if (!runtimeRef.current) {
    const registry = createDesignStudioRegistry(hostRef.current);

    Object.values(designStudioSurfaceIds).forEach((surfaceId) => {
      registry.registerSurface(surfaceId);
    });

    const ledger = new InMemoryLedger();
    const snapshotStore = createDesignStudioSnapshotAdapter(hostRef.current);
    const engine = new ExecutionEngine({
      registry,
      ledger,
      snapshotStore,
      approvalHook,
    });

    runtimeRef.current = {
      registry,
      ledger,
      snapshotStore,
      engine,
      router: new ScriptedIntentRouter(),
    };
  }

  const runtime = runtimeRef.current;

  if (!runtime) {
    throw new Error("Steering runtime failed to initialize.");
  }
  const refreshRecords = useCallback(() => {
    setRecords([...runtime.ledger.getRecords()].reverse());
  }, [runtime]);

  useEffect(() => runtime.ledger.subscribe(refreshRecords), [runtime, refreshRecords]);

  const submitIntent = useCallback(
    async (intent: string) => {
      const trimmed = intent.trim();

      if (!trimmed) {
        return;
      }

      setIsSubmitting(true);

      try {
        const route = await runtime.router.classify({
          intent: trimmed,
          sourceSurfaceId: currentSurfaceIdRef.current,
          registry: runtime.registry,
          state: stateRef.current,
        });

        if (route.routeClass !== "single action" && route.routeClass !== "action chain") {
          const message = "message" in route ? route.message : "No action was routed.";

          setNotices((current) => [
            {
              id: `notice_${Date.now()}`,
              routeClass: route.routeClass,
              intent: trimmed,
              message,
            },
            ...current,
          ].slice(0, 4));
          return;
        }

        const run = runtime.engine.executeChain({
          intent: trimmed,
          surfaceId: currentSurfaceIdRef.current,
          posture: "creative-tool",
          steps: route.steps.map((step) => ({
            actionId: step.actionId,
            params: step.params,
            targetSurfaceId: step.targetSurfaceId,
          })),
        });

        runsRef.current.set(run.recordId, run);
        setUndoToast(null);
        refreshRecords();

        void run.done.then((result) => {
          refreshRecords();

          if (
            result.record.steps.length > 1 &&
            canUndoAnyStep(result.record.steps)
          ) {
            setUndoToast({
              recordId: result.recordId,
              intent: trimmed,
            });
          }
        });
      } catch (error) {
        setNotices((current) => [
          {
            id: `notice_${Date.now()}`,
            routeClass: "refusal/handoff" as const,
            intent: trimmed,
            message: error instanceof Error ? error.message : String(error),
          },
          ...current,
        ].slice(0, 4));
      } finally {
        setIsSubmitting(false);
      }
    },
    [refreshRecords, runtime],
  );

  const decidePending = useCallback((decision: ApprovalDecision) => {
    const resolve = approvalResolveRef.current;

    approvalResolveRef.current = null;
    setPendingApproval(null);
    resolve?.(decision);
  }, []);

  const approvePending = useCallback(() => {
    decidePending({ status: "approved", reason: "inline_apply" });
  }, [decidePending]);

  const declinePending = useCallback(() => {
    decidePending({ status: "declined", reason: "inline_decline" });
  }, [decidePending]);

  const undoStep = useCallback(
    async (recordId: string, stepId: string) => {
      const record = runtime.ledger.requireRecord(recordId);
      const step = record.steps.find((item) => item.stepId === stepId);

      if (!step || !canUndoStep(step) || !("handleId" in step.undo)) {
        return;
      }

      await runUndoHandle(
        runtime.ledger,
        step.undo,
        actionContext(
          runtime.registry,
          runtime.snapshotStore,
          record.surfaceRef ?? currentSurfaceIdRef.current,
        ),
      );
      refreshRecords();
    },
    [refreshRecords, runtime],
  );

  const undoAll = useCallback(
    async (recordId: string) => {
      const run = runsRef.current.get(recordId);

      if (run) {
        await run.undoAll();
      } else {
        const record = runtime.ledger.requireRecord(recordId);

        await undoAllRecord(
          runtime.ledger,
          recordId,
          actionContext(
            runtime.registry,
            runtime.snapshotStore,
            record.surfaceRef ?? currentSurfaceIdRef.current,
          ),
          { allowPartial: true },
        );
      }

      setUndoToast(null);
      refreshRecords();
    },
    [refreshRecords, runtime],
  );

  const value = useMemo<SteeringContextValue>(
    () => ({
      registry: runtime.registry,
      currentSurfaceId,
      records,
      notices,
      pendingApproval,
      undoToast,
      isSubmitting,
      submitIntent,
      approvePending,
      declinePending,
      undoStep,
      undoAll,
      dismissUndoToast: () => setUndoToast(null),
    }),
    [
      approvePending,
      currentSurfaceId,
      declinePending,
      isSubmitting,
      notices,
      pendingApproval,
      records,
      runtime.registry,
      submitIntent,
      undoAll,
      undoStep,
      undoToast,
    ],
  );

  return <SteeringContext.Provider value={value}>{children}</SteeringContext.Provider>;
}

export function useSteering() {
  const context = useContext(SteeringContext);

  if (!context) {
    throw new Error("useSteering must be used inside SteeringProvider.");
  }

  return context;
}

function createSetterProxy(
  settersRef: MutableRefObject<DesignSetters>,
): DesignSetters {
  return {
    setPaletteToken: (token, value) => settersRef.current.setPaletteToken(token, value),
    applyPalettePreset: (presetId) => settersRef.current.applyPalettePreset(presetId),
    setFontPairing: (value) => settersRef.current.setFontPairing(value),
    setTypeScale: (value) => settersRef.current.setTypeScale(value),
    setHeroLayout: (value) => settersRef.current.setHeroLayout(value),
    toggleSectionVisibility: (sectionId) =>
      settersRef.current.toggleSectionVisibility(sectionId),
    moveSection: (sectionId, direction) =>
      settersRef.current.moveSection(sectionId, direction),
    updateSectionText: (sectionId, field, value) =>
      settersRef.current.updateSectionText(sectionId, field, value),
    applyTemplate: (templateId) => settersRef.current.applyTemplate(templateId),
    updateProjectMeta: (field, value) =>
      settersRef.current.updateProjectMeta(field, value),
    copyShareLink: () => settersRef.current.copyShareLink(),
    exportProject: () => settersRef.current.exportProject(),
    resetProject: () => settersRef.current.resetProject(),
    restoreState: (nextState: DesignState) => settersRef.current.restoreState(nextState),
  };
}

function actionContext(
  registry: CapabilityRegistry,
  snapshotStore: StateSnapshotAdapter,
  surfaceId: SurfaceId,
) {
  return {
    registry,
    surfaceId,
    snapshotStore,
    now: () => new Date(),
  };
}

function surfaceIdForPath(pathname: string): DesignStudioSurfaceId {
  if (pathname.startsWith("/templates")) {
    return designStudioSurfaceIds.templates;
  }

  if (pathname.startsWith("/settings")) {
    return designStudioSurfaceIds.settings;
  }

  return designStudioSurfaceIds.editor;
}
