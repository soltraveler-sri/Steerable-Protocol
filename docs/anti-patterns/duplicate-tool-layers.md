# Duplicate tool layers

**Status:** Informative anti-pattern note. This document does not define requirements; use the cited `SA-*` IDs as the authority.

**Related anti-patterns:** [chatbot veneer](./chatbot-veneer.md), [DOM-automation first](./dom-automation-first.md), [plan-everything](./plan-everything.md), [unsafe magic](./unsafe-magic.md), [duplicate tool layers](./duplicate-tool-layers.md), [framework maximalism](./framework-maximalism.md), [prompt-as-mechanism](./prompt-as-mechanism.md).

## What it is

Duplicate tool layers happen when the in-app assistant, external MCP server, prompt tools, docs, fixtures, and policy tables each define product capabilities separately. They may start equivalent, but they drift because each layer has its own schema, descriptions, permissions, and executor path.

The failure is not exposing an external agent surface. Door two is part of the vision. The failure is making door two a second source of truth instead of generating it from the same registry that drives in-app steering.

## Why it happens

The gravitational pull is organizational. Frontend teams wire in-app tools, platform teams own MCP, docs teams maintain capability tables, and eval teams write fixtures. Each team optimizes locally.

The cost is trust drift. A user can get a different action shape, parameter set, approval posture, or execution behavior depending on which door they enter. Once that happens, policy review and audit output become guesses about which layer actually ran.

## How to recognize it

Use these checks against an unfamiliar codebase:

- Search for multiple tool-definition homes: `rg -n "mcp|ModelContextProtocol|server\\.tool|tool\\(|tools\\s*=|defineTool|functionDeclarations|openapi|schema|fixtures|prompt"`.
- Compare in-app tool schemas to external tool schemas. Flag same product capability with different parameter names, optionality, descriptions, risk labels, or executor behavior.
- Search for hand-written external tools that do not import or consume the app registry: `rg -n "mcp.*(tool|schema)|external.*tool|toolRegistry|capabilityRegistry|registry"`.
- Inspect policy. Flag external tools whose approval, grants, or role checks are implemented separately from in-app policy resolution.
- Inspect docs and eval fixtures. Flag capability tables or fixture schemas maintained separately from declarations instead of generated or derived from registry data.
- Inspect action IDs. Flag aliases such as `setColor`, `palette.set_color`, and `mcp_palette_color` that point to the same product action without a stable declaration ID.
- Run a deletion thought experiment: remove one action declaration. If the in-app tool disappears but an MCP or prompt tool remains callable, the layers are duplicated.

## What to do instead

Use these requirements as the replacement contract:

- Core: `SA-CORE-034`, `SA-CORE-035`, `SA-CORE-050`, `SA-CORE-051`, `SA-CORE-056`, `SA-CORE-057`, `SA-CORE-098`.
- Declarations: `SA-DECL-002`, `SA-DECL-010`, `SA-DECL-011`, `SA-DECL-012`, `SA-DECL-090`, `SA-DECL-091`, `SA-DECL-092`, `SA-DECL-093`, `SA-DECL-094`, `SA-DECL-095`, `SA-DECL-100`, `SA-DECL-101`, `SA-DECL-102`, `SA-DECL-103`, `SA-DECL-104`, `SA-DECL-105`, `SA-DECL-106`, `SA-DECL-107`, `SA-DECL-108`, `SA-DECL-109`.
- Policy: `SA-POL-100`, `SA-POL-105`, `SA-POL-106`, `SA-POL-114`.

If those IDs do not cover the case, record a spec gap instead of adding a local rule here.

## Grounding

The landscape's PostHog note is architectural rather than numeric here: in-app steering and MCP access should be two doors into one registry, not separate drifting tool layers: [landscape-2026.md](../research/landscape-2026.md#shipped-in-app-agents-and-the-registry-lesson).

The MCP Apps section supports the door-two target while also noting that host consent and policy behavior are not the same as an in-product policy engine: [landscape-2026.md](../research/landscape-2026.md#direction-2-the-inverted-model-mcp-and-mcp-apps).

## Spec gaps surfaced

Detailed external-bridge requirements are assigned to a later `SA-BRIDGE` document by `SA-CORE-070`; this document uses the current registry and door-two derivation IDs.
