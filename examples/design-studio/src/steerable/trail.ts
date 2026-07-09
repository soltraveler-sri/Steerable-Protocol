import type { ActionStepRecord, CapabilityRegistry } from "@steerable/core";

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
