/**
 * Test-only adapters for controlled approvals and deterministic runtime assertions.
 * They keep protocol tests independent from React provider wiring.
 */

import type { ApprovalDecision, ApprovalHook, ApprovalRequest } from "@steerable/core";

export function createManualApprovalController(): {
  hook: ApprovalHook;
  waitForPendingRequest(): Promise<ApprovalRequest>;
  approve(reason?: string): void;
  decline(reason?: string): void;
} {
  let pending: { request: ApprovalRequest; resolve(decision: ApprovalDecision): void } | undefined;
  const waiters = new Set<(request: ApprovalRequest) => void>();

  return {
    hook: (request) =>
      new Promise<ApprovalDecision>((resolve) => {
        pending = { request, resolve };
        waiters.forEach((waiter) => waiter(request));
        request.signal?.addEventListener(
          "abort",
          () => {
            if (pending?.request.gateId === request.gateId) pending = undefined;
            resolve({ status: "declined", reason: "approval_canceled" });
          },
          { once: true },
        );
      }),
    waitForPendingRequest: () =>
      pending
        ? Promise.resolve(pending.request)
        : new Promise((resolve) => {
            const waiter = (request: ApprovalRequest) => {
              waiters.delete(waiter);
              resolve(request);
            };
            waiters.add(waiter);
          }),
    approve: (reason = "test_approved") => {
      const next = pending;
      pending = undefined;
      next?.resolve({ status: "approved", reason });
    },
    decline: (reason = "test_declined") => {
      const next = pending;
      pending = undefined;
      next?.resolve({ status: "declined", reason });
    },
  };
}
