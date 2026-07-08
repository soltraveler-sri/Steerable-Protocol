# Chatbot veneer

**Status:** Informative anti-pattern note. This document does not define requirements; use the cited `SA-*` IDs as the authority.

**Related anti-patterns:** [chatbot veneer](./chatbot-veneer.md), [DOM-automation first](./dom-automation-first.md), [plan-everything](./plan-everything.md), [unsafe magic](./unsafe-magic.md), [duplicate tool layers](./duplicate-tool-layers.md), [framework maximalism](./framework-maximalism.md).

## What it is

A chatbot veneer is a panel that can talk about the product but cannot operate it. It answers support questions, explains menus, summarizes docs, or narrates current state, while every real product change still depends on the user finding the right control by hand.

It often looks like progress because it ships quickly and feels familiar. The failure is that the app never becomes steerable: the agent has no declared product actions, no registry-scoped surface, no trusted executor path, and no policy-resolved way to turn intent into visible results.

## Why it happens

The gravitational pull is shipping pressure. A chat panel plus retrieval is easier to add than wrapping product capabilities, publishing curated state, and wiring policy. It also looks safer because it avoids mutation entirely.

That safety is limited. A veneer teaches users to ask for outcomes, then refuses to produce them. It moves the burden back to the user and leaves the product exposed to the next workaround: DOM automation or a separate external tool layer.

## How to recognize it

Use these checks against an unfamiliar codebase:

- Search for chat and retrieval entry points: `rg -n "chat|assistant|copilot|streamText|generateText|vector|embedding|retrieval|RAG"`.
- Search for steering declarations: `rg -n "defineAction|defineReadTool|defineFacts|defineSurface|registry|policyEngine|resolvePolicy|executeAction"`.
- Flag the shape when chat/retrieval paths exist but there are no declared actions with typed `params`, `reads`, `writes`, policy metadata, and trusted executors.
- Inspect assistant prompts and UI copy for phrases such as "I can guide you", "click the", "go to settings", or "you can change this by" in response to product-changing intents.
- Run or inspect tests for user intents that should mutate product state. If assertions stop at assistant text and never assert state changes, activity trail entries, policy decisions, or undo handles, the integration is likely a veneer.
- Check whether the assistant can cross surfaces by capability availability rather than by instructions to the user. If it cannot operate outside the current chat context, keep looking for missing surface declarations.

## What to do instead

Use these requirements as the replacement contract:

- Core: `SA-CORE-021`, `SA-CORE-022`, `SA-CORE-023`, `SA-CORE-024`, `SA-CORE-025`, `SA-CORE-026`, `SA-CORE-027`, `SA-CORE-050`, `SA-CORE-053`, `SA-CORE-057`, `SA-CORE-097`, `SA-CORE-100`.
- Declarations: `SA-DECL-001`, `SA-DECL-002`, `SA-DECL-030`, `SA-DECL-031`, `SA-DECL-060`, `SA-DECL-070`, `SA-DECL-080`, `SA-DECL-090`, `SA-DECL-093`.
- Policy: `SA-POL-082`, `SA-POL-083`, `SA-POL-097`.

If those IDs do not cover the case, record a spec gap instead of adding a local rule here.

## Grounding

The landscape names "read-only product chatbot" as one of the five common shapes and describes the gap as not operating declared product capabilities: [landscape-2026.md](../research/landscape-2026.md#the-five-common-shapes).

The same research treats assistant-ui and similar chat UI primitives as useful heads over an engine, not the capability declaration, policy, ledger, undo, or execution layer: [landscape-2026.md](../research/landscape-2026.md#assistant-ui).

## Spec gaps surfaced

None.
