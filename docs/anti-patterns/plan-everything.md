# Plan-everything

**Status:** Informative anti-pattern note. This document does not define requirements; use the cited `SA-*` IDs as the authority.

**Related anti-patterns:** [chatbot veneer](./chatbot-veneer.md), [DOM-automation first](./dom-automation-first.md), [plan-everything](./plan-everything.md), [unsafe magic](./unsafe-magic.md), [duplicate tool layers](./duplicate-tool-layers.md), [framework maximalism](./framework-maximalism.md).

## What it is

Plan-everything turns every user intent into a pre-execution plan, approval card, confirmation modal, or review queue before the app changes anything. A color tweak, a panel open, a local layout adjustment, and a quota-spending generation all enter the same ceremony.

This is the safety-theater half of the paired failure with [unsafe magic](./unsafe-magic.md). It mistakes friction for control. The right version is a policy engine resolving the autonomy mode for the proposed invocation, chain, workflow, surface, user, and app context, then letting safe reversible work move at product speed while gates appear at policy boundaries.

## Why it happens

The gravitational pull is real safety instinct. Teams know model output is fallible, so they add one review surface before all action. That feels consistent and easy to explain.

The cost is product death by latency. The reference loop depends on users reacting to outcomes, not approving internal steps. A framework that makes a trivially reversible action wait for a plan has already lost the core experience, even if every modal is well designed.

## How to recognize it

Use these checks against an unfamiliar codebase:

- Search for workflow flags in declarations or action metadata: `rg -n "requiresPlan|requirePlan|approvalFlow|approvalMode|requiresApproval|alwaysConfirm|confirmation\\s*:\\s*['\\\"]always|humanInLoop|hitl"`.
- Inspect action declarations. Flag any pattern where local, reversible UI actions are uniformly assigned `confirmation: "always"` or an equivalent global approval flag.
- Inspect policy code. Flag catch-all branches where every proposed action or every chain resolves to `Plan preview`, `Step-gated`, or a product-specific approval state before checking action metadata.
- Inspect tests and fixtures. Flag tests that expect a plan or confirmation for actions whose declaration metadata is the clean safe reversible cell named by `SA-POL-073`.
- Inspect UX flows. Flag sequences where a user asks for a simple local change, sees a proposed plan, clicks Apply, then sees the change, with no policy distinction from quota, money, sensitive, or destructive actions.
- Inspect prompts. Flag instructions that tell the model to always produce a plan before action regardless of the registry or policy result.
- Inspect runtime-signal handling. Flag hidden global confidence gates that demote every safe reversible action.

## What to do instead

Use these requirements as the replacement contract:

- Core: `SA-CORE-053`, `SA-CORE-054`, `SA-CORE-055`, `SA-CORE-100`.
- Declarations: `SA-DECL-005`, `SA-DECL-006`, `SA-DECL-015`, `SA-DECL-101`.
- Policy: `SA-POL-001`, `SA-POL-002`, `SA-POL-009`, `SA-POL-011`, `SA-POL-069`, `SA-POL-070`, `SA-POL-071`, `SA-POL-073`, `SA-POL-080`, `SA-POL-081`, `SA-POL-084`, `SA-POL-086`, `SA-POL-088`, `SA-POL-090`, `SA-POL-091`, `SA-POL-096`, `SA-POL-097`, `SA-POL-100`, `SA-POL-102`, `SA-POL-105`, `SA-POL-106`, `SA-POL-107`, `SA-POL-108`, `SA-POL-112`, `SA-POL-113`, `SA-POL-114`, `SA-POL-125`, `SA-POL-145`, `SA-POL-146`.

If those IDs do not cover the case, record a spec gap instead of adding a local rule here.

## Grounding

The landscape treats AI SDK `toolApproval`, AG-UI interrupts, and CopilotKit human-in-the-loop primitives as useful substrate, not as the product-owned policy contract itself: [landscape-2026.md](../research/landscape-2026.md#direction-1-in-app-copilot-and-agent-ui-sdks).

The AI SDK and AG-UI sections are especially relevant: approvals and interrupts exist in the ecosystem, but the Steerable layer decides when those primitives are used from declared metadata and policy rather than from a universal approval habit: [landscape-2026.md](../research/landscape-2026.md#vercel-ai-sdk), [landscape-2026.md](../research/landscape-2026.md#ag-ui).

## Spec gaps surfaced

None.
