# Unsafe magic

**Status:** Informative anti-pattern note. This document does not define requirements; use the cited `SA-*` IDs as the authority.

**Related anti-patterns:** [chatbot veneer](./chatbot-veneer.md), [DOM-automation first](./dom-automation-first.md), [plan-everything](./plan-everything.md), [unsafe magic](./unsafe-magic.md), [duplicate tool layers](./duplicate-tool-layers.md), [framework maximalism](./framework-maximalism.md).

## What it is

Unsafe magic is mutation that feels fast because it skips the steering contract. The model calls product functions directly, writes state through loosely typed tools, patches records from natural-language strings, or executes chains without registry validation, policy resolution, recordable rationale, or an executable recovery path.

This is the recklessness half of the paired failure with [plan-everything](./plan-everything.md). It gets the speed instinct right and the authority boundary wrong. A fast app is not steerable when the model can surprise the user and the runtime cannot explain, gate, record, or undo what happened.

## Why it happens

The gravitational pull is demo quality. Direct tool calls feel magical in a video: the user asks, the product changes, and no approval surface interrupts the moment.

The trust cost arrives on the first wrong mutation. If the app cannot show which declared action ran, why policy allowed it, what changed, and how recovery works where recovery is claimed, users learn that the magic is not under product control.

## How to recognize it

Use these checks against an unfamiliar codebase:

- Search for direct model-to-mutation paths: `rg -n "toolCall|function_call|executeTool|eval\\(|new Function|setState\\(|dispatch\\(|mutate\\(|fetch\\(|POST|DELETE|PATCH"`.
- Trace every product-changing path from model output to state write. Flag any path that does not pass through registry lookup, declaration validation, policy resolution, and a trusted app-owned executor.
- Inspect action declarations. Flag missing or loosely typed `params`, missing `risk`, missing `reversibility`, missing `effects`, missing `confirmation`, or flattened string inputs for distinct fields.
- Inspect reversible claims. Flag `reversibility.kind: "undoable"` without an `undo` handler, `snapshot` without a real snapshot path, or recovery that depends on the model generating a repair later.
- Inspect policy code. Flag hidden mutable reads, network calls, randomness, user mutation, action execution, or ledger writes inside the policy resolver.
- Inspect ledgers, activity trails, and tests. Flag mutations whose policy decision, rationale, action ID, params, result, error, observation, or undo handle cannot be inspected after execution.
- Inspect scoped grants. Flag grants that authorize destructive actions, bypass `confirmation: "always"`, or ignore current-surface availability.

## What to do instead

Use these requirements as the replacement contract:

- Core: `SA-CORE-032`, `SA-CORE-033`, `SA-CORE-051`, `SA-CORE-052`, `SA-CORE-093`, `SA-CORE-094`, `SA-CORE-095`, `SA-CORE-096`.
- Declarations: `SA-DECL-016`, `SA-DECL-017`, `SA-DECL-018`, `SA-DECL-031`, `SA-DECL-032`, `SA-DECL-033`, `SA-DECL-035`, `SA-DECL-038`, `SA-DECL-039`, `SA-DECL-040`, `SA-DECL-044`, `SA-DECL-046`, `SA-DECL-049`, `SA-DECL-050`, `SA-DECL-051`, `SA-DECL-096`, `SA-DECL-100`, `SA-DECL-101`, `SA-DECL-102`, `SA-DECL-103`.
- Policy: `SA-POL-040`, `SA-POL-041`, `SA-POL-042`, `SA-POL-043`, `SA-POL-044`, `SA-POL-045`, `SA-POL-047`, `SA-POL-048`, `SA-POL-100`, `SA-POL-101`, `SA-POL-102`, `SA-POL-103`, `SA-POL-104`, `SA-POL-105`, `SA-POL-106`, `SA-POL-107`, `SA-POL-108`, `SA-POL-109`, `SA-POL-126`, `SA-POL-131`, `SA-POL-132`, `SA-POL-133`, `SA-POL-190`.

If those IDs do not cover the case, record a spec gap instead of adding a local rule here.

## Grounding

The landscape treats provider tool calling, AI SDK tools, AG-UI tools, and MCP tools as strong primitives, while repeatedly separating those primitives from the app-owned declaration, policy, trusted execution, ledger, undo, and cross-surface contract: [landscape-2026.md](../research/landscape-2026.md#ecosystem-posture).

The computer-use section is the negative control: agents can act through screenshots and UI actions, but the strategic claim is that typed app-owned action surfaces are more policy-aware than pixel operation: [landscape-2026.md](../research/landscape-2026.md#direction-3-computer-use-and-browser-agents).

## Spec gaps surfaced

Detailed ledger schema requirements are assigned to a later `SA-LED` document by `SA-CORE-070`; this document cites the current ledger vocabulary and policy-recordability IDs only.
