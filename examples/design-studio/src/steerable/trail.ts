/**
 * Presentation helpers for rendering protocol ledger records as an activity trail.
 * The UI consumes these labels without reinterpreting execution or undo semantics.
 */

import type {
  ActionStepRecord,
  CapabilityRegistry,
  SteeringInvocationRecord,
} from "@steerable/core";

export function undoToastLabelForRecord(record: Pick<SteeringInvocationRecord, "steps">): string {
  return record.steps.some((step) => step.status === "failed")
    ? "Chain failed. Completed steps can be undone."
    : "Chain complete.";
}

export function trailTitleForStep(
  registry: CapabilityRegistry,
  step: Pick<ActionStepRecord, "actionId">,
): string {
  return registry.getAction(step.actionId)?.title ?? step.actionId;
}

export function trailDescriptionForStep(
  registry: CapabilityRegistry,
  step: Pick<ActionStepRecord, "actionId">,
): string {
  return registry.getAction(step.actionId)?.description ?? "";
}

export function canUndoStep(step: ActionStepRecord): boolean {
  return step.status === "succeeded" && "handleId" in step.undo && step.undo.status === "available";
}

export function canUndoAnyStep(steps: ActionStepRecord[]): boolean {
  return steps.some(canUndoStep);
}
