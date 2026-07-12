import { FormEvent, useState } from "react";
import { useSteering } from "../steerable/SteeringContext";
import type {
  ApprovalRequest,
  DeclarationPolicyMetadata,
  SteeringInvocationRecord,
  StepStatus,
} from "@steerable/core";
import { canUndoStep, trailDescriptionForStep, trailTitleForStep } from "../steerable/trail";

const statusLabels: Record<StepStatus, string> = {
  proposed: "Pending",
  held: "Held",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
  skipped: "Skipped",
  undone: "Undone",
  canceled: "Canceled",
};

export function SteeringPanel() {
  const {
    registry,
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
    dismissUndoToast,
  } = useSteering();
  const [intent, setIntent] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextIntent = intent.trim();

    if (!nextIntent) {
      return;
    }

    setIntent("");
    await submitIntent(nextIntent);
  };

  return (
    <aside className="steering-panel" aria-label="Steering surface">
      <form className="intent-form" onSubmit={onSubmit}>
        <label>
          <span>Intent</span>
          <input
            type="text"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            placeholder="make the accent forest green"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="primary" disabled={isSubmitting || !intent.trim()}>
          Send
        </button>
      </form>

      {pendingApproval ? (
        pendingApproval.mode === "Plan preview" ? (
          <PlanPreviewCard
            request={pendingApproval}
            onApply={approvePending}
            onDecline={declinePending}
          />
        ) : (
          <ApprovalCard
            request={pendingApproval}
            onApply={approvePending}
            onDecline={declinePending}
          />
        )
      ) : null}

      {undoToast ? (
        <section className="undo-toast" aria-label="Undo all available">
          <span>{undoToast.label}</span>
          <div>
            <button type="button" onClick={() => undoAll(undoToast.recordId)}>
              Undo all
            </button>
            <button type="button" onClick={dismissUndoToast} aria-label="Dismiss undo all">
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {notices.length > 0 ? (
        <section className="route-notices" aria-label="Router responses">
          {notices.map((notice) => (
            <article
              key={notice.id}
              className={`route-notice ${classNameForRoute(notice.routeClass)}`}
            >
              <span>{notice.routeClass}</span>
              <p>{notice.message}</p>
            </article>
          ))}
        </section>
      ) : null}

      <section className="activity-trail" aria-label="Activity trail">
        <div className="trail-header">
          <p className="eyebrow">Activity</p>
          <span>
            {records.length} entr{records.length === 1 ? "y" : "ies"}
          </span>
        </div>
        {records.length === 0 ? (
          <p className="empty-trail">No activity yet.</p>
        ) : (
          records.map((record) => (
            <TrailRecord
              key={record.recordId}
              record={record}
              registry={registry}
              onUndoStep={undoStep}
              onUndoAll={undoAll}
            />
          ))
        )}
      </section>
    </aside>
  );
}

function classNameForRoute(routeClass: string): string {
  return routeClass.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function TrailRecord({
  record,
  registry,
  onUndoStep,
  onUndoAll,
}: {
  record: SteeringInvocationRecord;
  registry: ReturnType<typeof useSteering>["registry"];
  onUndoStep: (recordId: string, stepId: string) => Promise<void>;
  onUndoAll: (recordId: string) => Promise<void>;
}) {
  const latestPolicy = record.policyDecisions.at(-1);
  const canUndoAll = record.steps.some(canUndoStep);

  return (
    <article className="trail-record">
      <div className="trail-record-head">
        <strong>{record.intent.text}</strong>
        {latestPolicy ? <span>{latestPolicy.finalMode}</span> : null}
      </div>
      <ol>
        {record.steps.map((step) => (
          <li key={step.stepId} className={`trail-step ${step.status}`}>
            <div>
              <span className="status-dot" aria-hidden="true" />
              <div>
                <strong>{trailTitleForStep(registry, step)}</strong>
                <span>{trailDescriptionForStep(registry, step)}</span>
              </div>
            </div>
            <div className="trail-step-actions">
              <span>{statusLabels[step.status]}</span>
              {canUndoStep(step) ? (
                <button type="button" onClick={() => onUndoStep(record.recordId, step.stepId)}>
                  Undo
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {record.disclosures.length > 0 ? (
        <ul className="trail-disclosures" aria-label="Execution disclosures">
          {record.disclosures.map((disclosure) => (
            <li key={disclosure.disclosureId}>{disclosure.message}</li>
          ))}
        </ul>
      ) : null}
      {record.steps.length > 1 && canUndoAll ? (
        <button type="button" className="trail-undo-all" onClick={() => onUndoAll(record.recordId)}>
          Undo all
        </button>
      ) : null}
    </article>
  );
}

function ApprovalCard({
  request,
  onApply,
  onDecline,
}: {
  request: ApprovalRequest;
  onApply: () => void;
  onDecline: () => void;
}) {
  return (
    <section className="approval-card" aria-label="Pending approval">
      <div>
        <p className="eyebrow">Approval</p>
        <h2>{request.mode}</h2>
      </div>
      <ul>
        {request.heldSteps.map((step) => (
          <li key={step.stepId}>
            <strong>{step.title}</strong>
            <span>{step.description}</span>
          </li>
        ))}
      </ul>
      <p className="status-line">{request.undoImplications}</p>
      <div className="approval-actions">
        <button type="button" className="primary" onClick={onApply}>
          Apply
        </button>
        <button type="button" onClick={onDecline}>
          Decline
        </button>
      </div>
    </section>
  );
}

function PlanPreviewCard({
  request,
  onApply,
  onDecline,
}: {
  request: ApprovalRequest;
  onApply: () => void;
  onDecline: () => void;
}) {
  return (
    <section className="approval-card plan-preview-card" aria-label="Plan preview">
      <div>
        <p className="eyebrow">Plan preview</p>
        <h2>{request.heldSteps.length} steps</h2>
      </div>
      <ol>
        {request.heldSteps.map((step) => (
          <li key={step.stepId}>
            <div>
              <strong>{step.title}</strong>
              <span>{step.description}</span>
            </div>
            <RiskBadges metadata={metadataForStep(request.materialEffects, step.actionId)} />
          </li>
        ))}
      </ol>
      <p className="status-line">{request.undoImplications}</p>
      <div className="approval-actions">
        <button type="button" className="primary" onClick={onApply}>
          Apply
        </button>
        <button type="button" onClick={onDecline}>
          Decline
        </button>
      </div>
    </section>
  );
}

function RiskBadges({ metadata }: { metadata?: DeclarationPolicyMetadata }) {
  if (!metadata) {
    return null;
  }

  const badges = [
    metadata.risk,
    metadata.reversibility,
    metadata.effects.cost !== "none" ? `cost:${metadata.effects.cost}` : undefined,
    metadata.effects.external ? "external" : undefined,
    metadata.effects.sensitive ? "sensitive" : undefined,
    metadata.confirmation === "always" ? "confirm" : undefined,
  ].filter((badge): badge is string => Boolean(badge));

  return (
    <div className="risk-badges" aria-label="Declaration badges">
      {badges.map((badge) => (
        <span key={badge}>{badge}</span>
      ))}
    </div>
  );
}

function metadataForStep(
  metadata: DeclarationPolicyMetadata[],
  actionId: string,
): DeclarationPolicyMetadata | undefined {
  return metadata.find((item) => item.actionId === actionId);
}
