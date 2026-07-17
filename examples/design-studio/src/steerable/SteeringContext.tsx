/**
 * React provider wiring for the reference integration.
 * It adapts app state, routing, approvals, execution records, and undo into one UI-facing context.
 */

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
import { useLocation, useNavigate } from "react-router-dom";
import type { DesignSetters } from "../state/designStore";
import { useDesignStudio } from "../state/designStore";
import type { DesignState } from "../types";
import {
  DEFAULT_SURFACE_READINESS_TIMEOUT_MS,
  runUndoHandle,
  undoAll as undoAllRecord,
  type ApprovalDecision,
  type ApprovalHook,
  type ApprovalRequest,
  type ChainExecutionRun,
  type CapabilityRegistry,
  type PosturePreset,
  type StateSnapshotAdapter,
  type SteeringInvocationRecord,
  type SurfaceId,
} from "@steerable/core";
import {
  SteerableProvider as SteerableRuntimeProvider,
  createSteerableRuntime,
  type SteerableRuntime,
} from "@steerable/react";
import { ScriptedIntentRouter, type IntentRoute } from "./router";
import {
  createDesignStudioDeclarations,
  createDesignStudioSnapshotAdapter,
  designStudioSurfaceIds,
  type DesignStudioCapabilityHost,
  type DesignStudioSurfaceId,
} from "./designStudioCapabilities";
import { canUndoAnyStep, canUndoStep, undoToastLabelForRecord } from "./trail";

interface SteeringNotice {
  id: string;
  routeClass: IntentRoute["routeClass"];
  intent: string;
  message: string;
}

interface UndoToast {
  recordId: string;
  intent: string;
  label: string;
}

interface SteeringContextValue {
  registry: CapabilityRegistry;
  currentSurfaceId: DesignStudioSurfaceId;
  records: SteeringInvocationRecord[];
  notices: SteeringNotice[];
  pendingApproval: ApprovalRequest | null;
  posture: PosturePreset;
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
  const navigate = useNavigate();
  const stateRef = useRef(state);
  const settersRef = useRef(setters);
  const navigateRef = useRef(navigate);
  const currentSurfaceId = surfaceIdForPath(location.pathname);
  const currentSurfaceIdRef = useRef<DesignStudioSurfaceId>(currentSurfaceId);
  const [posture, setPosture] = useState<PosturePreset>("creative-tool");
  const postureRef = useRef<PosturePreset>(posture);
  const approvalResolveRef = useRef<((decision: ApprovalDecision) => void) | null>(null);
  const runsRef = useRef(new Map<string, ChainExecutionRun>());
  const hostRef = useRef<DesignStudioCapabilityHost | null>(null);
  const runtimeRef = useRef<SteerableRuntime | null>(null);
  const snapshotStoreRef = useRef<StateSnapshotAdapter | null>(null);
  const routerRef = useRef<ScriptedIntentRouter | null>(null);
  const [records, setRecords] = useState<SteeringInvocationRecord[]>([]);
  const [notices, setNotices] = useState<SteeringNotice[]>([]);
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  stateRef.current = state;
  settersRef.current = setters;
  navigateRef.current = navigate;
  currentSurfaceIdRef.current = currentSurfaceId;
  postureRef.current = posture;

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
      getPosture: () => postureRef.current,
      setPosture,
      navigateToSurface: (surfaceId) => {
        const search = typeof window === "undefined" ? "" : window.location.search;

        navigateRef.current(`${surfacePathForId(surfaceId)}${search}`);
      },
      setters: createSetterProxy(settersRef),
      getOrigin: () =>
        typeof window === "undefined" ? "https://design-studio.local" : window.location.origin,
    };
  }

  if (!runtimeRef.current) {
    const snapshotStore = createDesignStudioSnapshotAdapter(hostRef.current);
    runtimeRef.current = createSteerableRuntime({
      declarations: createDesignStudioDeclarations(hostRef.current),
      snapshotAdapter: snapshotStore,
      approvalHook,
    });
    snapshotStoreRef.current = snapshotStore;
    routerRef.current = new ScriptedIntentRouter();
  }

  const runtime = runtimeRef.current;

  const snapshotStore = snapshotStoreRef.current;
  const router = routerRef.current;

  if (!runtime || !snapshotStore || !router) {
    throw new Error("Steering runtime failed to initialize.");
  }
  const refreshRecords = useCallback(() => {
    setRecords([...runtime.getSnapshot().records]);
  }, [runtime]);

  useEffect(() => runtime.subscribe(refreshRecords), [runtime, refreshRecords]);

  useEffect(() => {
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const delayMs = surfaceRegistrationDelayMs(currentSurfaceId, location.search);
    const register = () => {
      if (!disposed) {
        runtime.registry.registerSurface(currentSurfaceId);
      }
    };

    if (delayMs > 0) {
      timeout = setTimeout(register, delayMs);
    } else {
      register();
    }

    return () => {
      disposed = true;

      if (timeout) {
        clearTimeout(timeout);
      }

      runtime.registry.deregisterSurface(currentSurfaceId);
    };
  }, [currentSurfaceId, location.search, runtime.registry]);

  const submitIntent = useCallback(
    async (intent: string) => {
      const trimmed = intent.trim();

      if (!trimmed) {
        return;
      }

      setIsSubmitting(true);

      try {
        const route = await router.classify({
          intent: trimmed,
          sourceSurfaceId: currentSurfaceIdRef.current,
          registry: runtime.registry,
          state: stateRef.current,
        });

        if (route.routeClass !== "single action" && route.routeClass !== "action chain") {
          const message = "message" in route ? route.message : "No action was routed.";

          setNotices((current) =>
            [
              {
                id: `notice_${Date.now()}`,
                routeClass: route.routeClass,
                intent: trimmed,
                message,
              },
              ...current,
            ].slice(0, 4),
          );
          return;
        }

        // Awaiting `executeChain` is what makes the run handle trustworthy: the runtime only
        // resolves it once the invocation record has been written and the write has reported
        // success. A durable ledger that rejects the write rejects here instead, so we never show
        // the user a `recordId` for a record that does not exist. The chain's *execution* is still
        // in flight after this await — settlement is `run.done`, below.
        const run = await runtime.executeChain({
          intent: trimmed,
          surfaceId: currentSurfaceIdRef.current,
          posture: postureRef.current,
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

          if (result.record.steps.length > 1 && canUndoAnyStep(result.record.steps)) {
            setUndoToast({
              recordId: result.recordId,
              intent: trimmed,
              label: undoToastLabelForRecord(result.record),
            });
          }
        });
      } catch (error) {
        setNotices((current) =>
          [
            {
              id: `notice_${Date.now()}`,
              routeClass: "refusal/handoff" as const,
              intent: trimmed,
              message: error instanceof Error ? error.message : String(error),
            },
            ...current,
          ].slice(0, 4),
        );
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
      // Ledger reads are awaited because `ActionLedger` is a storage seam: the in-memory backend
      // answers synchronously, a durable one over the network does not. Awaiting reads the same
      // way for both is what lets an app swap backends without rewriting this component.
      const record = await runtime.ledger.requireRecord(recordId);
      const step = record.steps.find((item) => item.stepId === stepId);

      if (!step || !canUndoStep(step) || !("handleId" in step.undo)) {
        return;
      }

      await runUndoHandle(
        runtime.ledger,
        step.undo,
        actionContext(
          runtime.registry,
          snapshotStore,
          record.surfaceRef ?? currentSurfaceIdRef.current,
        ),
      );
      refreshRecords();
    },
    [refreshRecords, runtime, snapshotStore],
  );

  const undoAll = useCallback(
    async (recordId: string) => {
      const run = runsRef.current.get(recordId);

      if (run) {
        await run.undoAll();
      } else {
        const record = await runtime.ledger.requireRecord(recordId);

        await undoAllRecord(
          runtime.ledger,
          recordId,
          actionContext(
            runtime.registry,
            snapshotStore,
            record.surfaceRef ?? currentSurfaceIdRef.current,
          ),
          { allowPartial: true },
        );
      }

      setUndoToast(null);
      refreshRecords();
    },
    [refreshRecords, runtime, snapshotStore],
  );

  const value = useMemo<SteeringContextValue>(
    () => ({
      registry: runtime.registry,
      currentSurfaceId,
      records,
      notices,
      pendingApproval,
      posture,
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
      posture,
      records,
      runtime.registry,
      submitIntent,
      undoAll,
      undoStep,
      undoToast,
    ],
  );

  return (
    <SteerableRuntimeProvider runtime={runtime}>
      <SteeringContext.Provider value={value}>{children}</SteeringContext.Provider>
    </SteerableRuntimeProvider>
  );
}

export function useSteering() {
  const context = useContext(SteeringContext);

  if (!context) {
    throw new Error("useSteering must be used inside SteeringProvider.");
  }

  return context;
}

function createSetterProxy(settersRef: MutableRefObject<DesignSetters>): DesignSetters {
  return {
    setPaletteToken: (token, value) => settersRef.current.setPaletteToken(token, value),
    applyPalettePreset: (presetId) => settersRef.current.applyPalettePreset(presetId),
    setFontPairing: (value) => settersRef.current.setFontPairing(value),
    setTypeScale: (value) => settersRef.current.setTypeScale(value),
    setHeroLayout: (value) => settersRef.current.setHeroLayout(value),
    toggleSectionVisibility: (sectionId) => settersRef.current.toggleSectionVisibility(sectionId),
    moveSection: (sectionId, direction) => settersRef.current.moveSection(sectionId, direction),
    updateSectionText: (sectionId, field, value) =>
      settersRef.current.updateSectionText(sectionId, field, value),
    applyTemplate: (templateId) => settersRef.current.applyTemplate(templateId),
    updateProjectMeta: (field, value) => settersRef.current.updateProjectMeta(field, value),
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

function surfacePathForId(surfaceId: DesignStudioSurfaceId): string {
  if (surfaceId === designStudioSurfaceIds.templates) {
    return "/templates";
  }

  if (surfaceId === designStudioSurfaceIds.settings) {
    return "/settings";
  }

  return "/";
}

function surfaceRegistrationDelayMs(surfaceId: DesignStudioSurfaceId, search: string): number {
  if (!import.meta.env.DEV) {
    return 0;
  }

  const params = new URLSearchParams(search);

  if (params.get("steerableDelaySurface") !== surfaceId) {
    return 0;
  }

  const explicitDelay = Number(params.get("steerableSurfaceDelayMs"));

  if (Number.isFinite(explicitDelay) && explicitDelay >= 0) {
    return explicitDelay;
  }

  return DEFAULT_SURFACE_READINESS_TIMEOUT_MS + 500;
}
