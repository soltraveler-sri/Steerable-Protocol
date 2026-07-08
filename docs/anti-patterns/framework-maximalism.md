# Framework maximalism

**Status:** Informative anti-pattern note. This document does not define requirements; use the cited `SA-*` IDs as the authority.

**Related anti-patterns:** [chatbot veneer](./chatbot-veneer.md), [DOM-automation first](./dom-automation-first.md), [plan-everything](./plan-everything.md), [unsafe magic](./unsafe-magic.md), [duplicate tool layers](./duplicate-tool-layers.md), [framework maximalism](./framework-maximalism.md).

## What it is

Framework maximalism is trying to make Steerable the model SDK, agent framework, transport protocol, UI kit, workflow engine, hosting platform, and product runtime all at once. It expands the project until the actual differentiated layer becomes hard to see.

The failure is not using strong ecosystem primitives. The failure is rebuilding or owning layers that should remain adapter targets, then letting those concerns distort the app capability contract.

## Why it happens

The gravitational pull is completeness. Once a project has declarations, policy, execution, surfaces, ledgers, and external access in its vocabulary, it is tempting to ship a full stack so every demo looks integrated.

That path dilutes the Stage 1 product. The spec and agent-readable kit need sharp boundaries. If the repo tries to be everything, coding agents cannot tell what must be implemented in a target app, what is developer choice, and what is just local tooling.

## How to recognize it

Use these checks against an unfamiliar codebase:

- Search for premature package or platform surfaces: `rg -n "packages/|createSteerableApp|provider adapter|model provider|transport|workflow engine|chat UI|hosted|cloud|deploy|billing"`.
- Inspect dependencies and source directories. Flag custom model-provider abstractions, custom chat component libraries, custom transports, or workflow runtimes that are not needed to express declarations, policy, trusted execution, registry, or ledger concepts.
- Inspect docs. Flag pages that teach users to adopt a new app framework before they teach them to declare capabilities and policy.
- Inspect examples. Flag demos where the UI kit, provider wrapper, or transport layer gets more acceptance coverage than registry, policy, executor, undo, and audit behavior.
- Inspect generated APIs. Flag TypeScript runtime names treated as normative when the spec only needs conceptual shape and semantics.
- Inspect adapter code. Flag ecosystem integrations that redefine action facts instead of consuming the registry.
- Inspect roadmap scope. Flag new runtime extraction, MCP bridge implementation, or framework bindings appearing before Stage 1's spec and kit gate.

## What to do instead

Use these requirements as the replacement contract:

- Core: `SA-CORE-009`, `SA-CORE-058`, `SA-CORE-090`, `SA-CORE-091`, `SA-CORE-092`, `SA-CORE-093`, `SA-CORE-094`, `SA-CORE-095`, `SA-CORE-096`, `SA-CORE-097`, `SA-CORE-098`, `SA-CORE-099`, `SA-CORE-100`.
- Declarations: `SA-DECL-003`, `SA-DECL-004`, `SA-DECL-090`, `SA-DECL-093`, `SA-DECL-109`.
- Policy: `SA-POL-011`, `SA-POL-111`, `SA-POL-112`, `SA-POL-113`, `SA-POL-121`, `SA-POL-145`, `SA-POL-181`, `SA-POL-182`, `SA-POL-183`, `SA-POL-184`, `SA-POL-185`, `SA-POL-186`, `SA-POL-187`, `SA-POL-188`, `SA-POL-189`, `SA-POL-190`.

If those IDs do not cover the case, record a spec gap instead of adding a local rule here.

## Grounding

The landscape's ecosystem posture names provider SDKs, AI SDK approvals, AG-UI transport, MCP, chat UI, and generative UI as layers to use or adapt to, while keeping the app capability contract, autonomy policy, trusted execution, cross-surface continuation, ledger/undo, and agent-readable kit as the Steerable layer: [landscape-2026.md](../research/landscape-2026.md#ecosystem-posture).

The Vercel AI SDK, AG-UI, MCP Apps, assistant-ui, CopilotKit, and Tambo sections all support the same boundary: strong adjacent tools exist, but they do not replace the product-owned steering contract described by this repo's specs.

## Spec gaps surfaced

None.
