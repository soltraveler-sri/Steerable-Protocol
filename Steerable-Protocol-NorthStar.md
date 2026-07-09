# Steerable Apps — North Star

**Status:** v0.1 · Founding document · July 2026
**What this file is:** the master design document for this project. Everything in this repo should trace back to something here; anything that contradicts this document should either lose, or force a considered edit to this document.

---

## 1. What this is

This project makes software applications **steerable**: operable through natural language, by an agent the application itself owns and governs — so users can state intent ("make the accent forest green and rebuild it," "set this up like my last one but for a bakery") and have the app *do it*, instead of learning every control, menu, toggle, and workflow themselves.

Conceptually, "it" is three things, in priority order:

1. **A pattern and spec** — the *Steerable App* contract: how an application declares its real capabilities to an agent in a typed, policy-governed way, and how an agent's proposals are executed, shown, gated, and undone. The spec is the product; everything else implements it.
2. **An agent-readable integration kit** — guides, skills, prompts, checklists, and a conformance suite written so that a **coding agent** (Claude Code, Codex, Cursor, etc.) can be pointed at this repo plus any existing application, decide whether the pattern fits, and carry out the integration. Coding agents are a first-class developer audience, not an afterthought.
3. **A thin reference runtime** — the smallest durable SDK (capability registry, policy resolver, execution engine, ledger interfaces, framework bindings) that implements the spec, extracted only after it has proven itself in a real product.

It is deliberately **not** a framework in the maximalist sense. It does not want to be LangChain, the Vercel AI SDK, CopilotKit, AG-UI, MCP, or a UI kit. It is the missing layer that sits **between** those things and a real product: the layer where an app's capabilities, policies, and feedback loops live.

**Positioning in one line:**

> Make your app steerable by agents — without handing them the browser.

And the corollary:

> Expose your product's real capabilities through typed actions, policy, and trusted execution — not a chatbot veneer, and not DOM automation.

---

## 2. The reference experience

This project exists because of a working prototype: the in-app assistant in **[Spec](https://design-spec.xyz)**, a website mockup builder. Spec is the **prototype of the UX** — the proof of what this should feel like — even though this project is *not* an extraction of Spec's codebase, and Spec's current architecture is explicitly not the final product boundary.

What the Spec assistant demonstrates, and what this project must preserve:

- The user types short, natural messages — *"build a wireframe for an organic coffee shop,"* *"use brand colors #0F766E and #B45309,"* *"compare 3 directions in the lab."*
- The assistant maps intent to **typed actions the app itself declared** — set the brief, apply a palette, switch template, navigate to another page, trigger a build — and executes them, **including across page navigations** (navigate, wait for the destination page's capabilities to come online, continue).
- The whole loop — interpret intent, take several actions, show the result — closes in roughly **2–5 seconds**. The user reacts to *outcomes*, not to questions. Follow-up feedback is another short message. Mistakes are cheap because most actions are trivially reversible.
- Actions that genuinely spend something (a daily build quota) or destroy something are gated behind an explicit confirmation, presented as part of a visible plan with **one Apply** — never a modal interrogation per step.
- The model **proposes; the runtime disposes.** Every proposed action is checked against a registry of declared capabilities and a risk policy before anything runs. The model is never trusted with execution authority.

Two hard-won lessons from Spec that shape everything below:

1. **Speed is the soul.** The magic is the tight intent→action→result loop. Any design that inserts planning ceremony, approval theater, or multi-second "thinking" into trivially reversible actions kills the product. Where Spec gates (quota-spending builds), it gates because *that action's nature demands it* — not because agents-taking-actions is inherently scary.
2. **The bridge work is irreducible but automatable.** Exposing an app's features as typed actions — wrapping existing setters, publishing curated state, writing per-action guidance — is real, app-specific work that no library can eliminate. But it is exactly the kind of systematic, pattern-following work coding agents are good at. That is why the integration kit targets them directly.

---

## 3. Thesis: the missing layer

Most "AI in the app" implementations are one of five things:

1. read-only Q&A chatbots (the overwhelming majority — tightly scoped, low usefulness),
2. generic copilots bolted on beside the product,
3. browser/computer-use agents driving the UI from outside,
4. external MCP/tool servers detached from the product's own UX,
5. thin wrappers over a model SDK.

The missing shape is a **product-owned steering runtime**: the app itself declares what it can do, what each action means, when it is safe, what context the agent may see, what can be undone, what requires approval, and how execution should be shown to the user.

The category framing is **agent-responsive design**: the way responsive design let apps adapt to a new class of *devices*, agent-responsive design lets apps adapt to a new class of *users* — agents acting on humans' behalf. An agent-responsive app is legible and operable to agents **on the app's own terms**, without surrendering control to fragile DOM automation and without dumbing itself down to a Q&A bot.

### Why now (verified landscape, July 2026)

The space is being attacked from three directions at once. Each validates the idea; none occupies this layer:

- **In-app copilot SDKs** (CopilotKit — $27M Series A May 2026; AG-UI protocol with Microsoft/Google/AWS adoption; Vercel AI SDK 7 with `toolApproval` + policy packages; assistant-ui; Tambo). All are turn-by-turn tool calls scoped to mounted components. **None** has a risk-typed action contract, a plan object, or execution that survives page navigation — CopilotKit deregisters tools on component unmount *by design*, and navigating mid-approval is a documented silent-failure bug there.
- **The inverted model** — MCP Apps (launched as an official MCP extension, with public OpenAI/MCP-UI/Anthropic involvement and a 2026-07-28 core-spec release scheduled from a May 2026 locked RC): your features as MCP tools, your UI as sandboxed widgets *inside their chat*. This answers "how does my app show up in ChatGPT/Claude," and is silent on "how does an agent show up in my app." One tool → one widget → one turn; no cross-view state, no plans, consent left to host discretion.
- **The substitute** — computer-use/browser agents (OpenAI, Anthropic, Google all ship one, embedded in browsers). Benchmark scores are steep (~84% on OSWorld-Verified), but live-web results remain benchmark-dependent (the older Operator row was ~61%, with newer rows higher), tasks take 2.7–4.3× the necessary steps in OSWorld-Human v2 and minutes of wall clock, per-task costs reach dollars, and prompt injection remains structurally unsolved. **Browser agents are not the threat; they are the forcing function.** If an app publishes nothing, agents will steer it anyway — via pixels, slowly, unreliably, and without the app's policy engine. Publishing a typed, gated action surface is how an app gets steered *well*.

One attributed datapoint worth internalizing: PostHog — the closest shipped cousin to this pattern (frontend context injection + typed in-app tools) — was reported in the founding research sweep as seeing ~34% of agent-created dashboards arrive through their **MCP server**, not their in-app agent. The in-app runtime and the external agent surface are **two doors into the same capability registry**, not rival products. This project treats them that way from day one (§8.8).

---

## 4. Design principles

These are the non-negotiables. Everything else is policy or preference.

1. **Speed is the soul; safety is a policy, not a ceremony.** The reference UX closes intent→action→result in 2–5 seconds. The framework must never impose planning, approval, or "thinking" latency on actions whose nature doesn't demand it. Safety posture is a **sliding scale resolved per action, per app, per user by the policy engine** — a design-mockup tool and a healthcare admin panel should feel completely different on top of the same runtime, because their *policies* differ, not their runtime.
2. **The declaration is the framework.** The central primitive is not chat, not the model loop, not the UI — it is the **declared capability**. One declaration compiles into everything else (§6).
3. **The model proposes; the runtime disposes.** Model output is always an untrusted proposal, validated against the registry and policy before execution. Trusted, app-owned executors are the only path to mutation.
4. **Chat is one surface, not the product.** The same intent→capability engine can sit behind a chat panel, a command palette, an inline intent bar, a voice surface, or an external agent bridge. Chat panels are a commodity; this layer is not.
5. **Reversibility is a mechanism, not metadata.** "This is reversible" must be executable (an `undo` handler or a state snapshot), because cheap reversal is what makes high autonomy safe. Confirm-friction converts into rollback-confidence.
6. **Curated context beats raw context.** Apps expose bounded, typed, privacy-cheap state — facts, then read tools, then annotated-DOM snapshots — before anyone reaches for screenshots. DOM/vision is the escape hatch, never the foundation.
7. **Two doors, one registry.** In-app steering and external agent access (MCP or equivalent) are generated from the same declarations. Duplicate tool layers drift; drift kills trust.
8. **Built for coding agents as integrators.** Every spec, guide, and checklist in this repo is written to be *executed* by a coding agent against an unfamiliar codebase, not just read by a human. If a document can't survive that test, it isn't done.
9. **Ride the ecosystem; own the layer.** Use native tool calling, provider SDKs, MCP, and (where useful) AG-UI/AI-SDK adapters. The differentiated layer is the contract: declarations, policy, trusted execution, ledger, and the integration kit.

---

## 5. The core abstraction: capability declarations

A developer (or a coding agent acting for one) defines each app capability **once**:

```ts
defineAction({
  id: "palette.set_color",
  title: "Set one palette color",
  description: "Set a single palette token to a hex value. Switches palette to 'custom'.",

  // Contract
  params: z.object({
    token: z.enum(["background", "surface", "text", "accent", /* … */]),
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  reads:  ["design.palette"],          // state this action needs
  writes: ["design.palette"],          // state this action mutates

  // Policy metadata (drives the policy engine, §7)
  risk: "safe",                        // safe | side_effect | mutating | destructive
  reversibility: { kind: "undoable" }, // undoable | snapshot | irreversible
  effects: { external: false, cost: "none", sensitive: false },
  confirmation: "never",               // never | policy | always
  preconditions: ["surface:design-studio"],

  // Execution (trusted, app-owned)
  execute: async ({ token, hex }, ctx) => { /* call the app's real setter */ },
  undo:    async (snapshot, ctx)     => { /* restore */ },   // or omit + snapshot: auto
  observe: async (ctx)               => ctx.read("design.palette"),  // optional post-check

  // Model & human-facing knowledge
  guidance: "Use when the user names ONE color. For full brand palettes prefer palette.set_custom.",
  examples: [{ user: "make the accent #FF6600", params: { token: "accent", hex: "#FF6600" } }],
})
```

From this single declaration, the runtime derives:

- the **model tool schema** (typed, strict — one tool per action, no flattened string params),
- the **policy entry** (risk, reversibility, effects, confirmation),
- the **executor registration** (and its availability on the current surface),
- the **undo handle** (explicit or via automatic snapshot),
- the **UX copy** for activity trails, plan cards, and approval sheets,
- the **prompt guidance** and few-shot examples,
- the **docs page** and the **eval fixtures**,
- and optionally the **external MCP tool** (door two).

If a fact about an action lives anywhere other than its declaration, that is a bug in the framework. (The Spec prototype described each action in four places — enum, spec table, prompt text, docs — and that duplication was its single biggest maintenance tax. Never again.)

Alongside actions, three sibling declarations complete the registry:

- **`defineReadTool()`** — typed, side-effect-free queries (`get_current_design`, `list_saved_items`) so an agent can *look before it leaps* without any risk machinery.
- **`defineFacts()`** — a surface's curated, bounded key-value context (current route, selection, relevant domain state; ~a dozen entries, not a DOM dump), published reactively as the user works.
- **`defineSurface()`** — a named UI region/route that scopes which capabilities are live, and (for multi-page apps) participates in cross-surface execution: the runtime can navigate, **wait for the destination surface's capabilities to register, then continue** — the mechanism no existing framework ships.

---

## 6. Autonomy and policy

> **This section encodes a founding decision.** The framework does **not** hard-code a "plan first, approve, then execute" workflow — or any single workflow. Execution mode is **resolved per action invocation by the policy engine**, from the action's declared metadata plus the integrating developer's configuration. Plan preview is one available mode among several; for most actions in most apps, the right mode is *instant execution with undo*. A framework default that added seconds of ceremony to trivially reversible actions would betray the reference experience this project exists to distribute.

### 6.1 The risk vocabulary (framework-defined)

Every action declares:

- **risk:** `safe` (pure UI/local state) · `side_effect` (clipboard, URL, notifications) · `mutating` (spends quota/money, remote writes) · `destructive` (data loss, hard to recover)
- **reversibility:** `undoable` (has an inverse) · `snapshot` (runtime captures and can restore state) · `irreversible`
- **effects:** external calls? monetary cost? sensitive data exposure?

This vocabulary is normative — it is what makes policies portable, evals comparable, and conformance meaningful.

### 6.2 The autonomy ladder (framework-defined modes; developer-chosen mapping)

From most to least autonomous:

| # | Mode | What happens | Typical fit |
|---|------|--------------|-------------|
| 1 | **Read-only** | Agent inspects declared context and answers; no mutation | Docs/analytics surfaces; untrusted sessions |
| 2 | **Instant execution** | Single action or short chain executes immediately; activity trail + undo | `safe`/reversible actions — the reference UX default |
| 3 | **Optimistic chain** | A reversible action chain executes live as it streams, with a visible trail and one-tap *Undo all* | Creative tools, dashboards, configuration flows |
| 4 | **Gated suffix** | Reversible prefix executes instantly; the plan pauses before the first `mutating`/`destructive`/`always-confirm` step | Mixed flows ending in a build/send/purchase |
| 5 | **Plan preview** | Full plan rendered as an artifact; one Apply covers it (including its gated steps); execution then proceeds with observation and repair | Complex multi-surface workflows; high-stakes domains |
| 6 | **Step-gated** | Explicit confirmation per sensitive step | Regulated/financial/destructive operations |
| 7 | **Refuse / hand off** | The runtime declines and routes to the human path | Actions the app chooses never to automate |

### 6.3 The policy engine

A pure, auditable function resolves each proposed action (or plan) to a mode, from:

- the action's declared risk / reversibility / effects / confirmation,
- the developer's app-level policy (posture presets and overrides),
- the current surface and preconditions,
- user role, session trust, and the user's own autonomy setting (users may always *lower* autonomy; whether they can raise it is a developer choice),
- sticky, scoped grants ("always allow palette changes this session" — never sticky for `destructive`),
- and runtime signals (e.g., low model confidence can demote an invocation one rung).

**Framework-supplied defaults:** a small set of **posture presets** — e.g. `creative-tool` (ladder rungs 2–4 dominant), `business-app` (3–5), `sensitive-domain` (5–6 with ledger required) — so integrations start sane in minutes. Presets are starting points; every mapping is developer-overridable per action, role, and surface.

### 6.4 What the framework decides vs. what the developer decides

| The framework decides (normative) | The developer decides (policy/preference) |
|---|---|
| The declaration shape and registry model | Default autonomy level and posture preset |
| The risk/reversibility/effects vocabulary | Which actions run instantly vs. gated |
| That a policy engine exists and runs on every invocation | How conservative that policy is, per role/surface |
| That mutation goes only through trusted app-owned executors | Whether plan preview is ever used, and where |
| The action ledger model and undo semantics | What counts as reversible in their domain |
| Read tools / write actions / navigation / external effects as distinct kinds | Which UX surface is primary (chat, palette, intent bar, background) |
| Chat = one surface; DOM/vision = fallback, never foundation | Acceptable latency budgets |
| The integration checklist and conformance tests | Whether to open door two (external agents) |

---

## 7. Architecture

Eight components. The first four are the heart; the rest make it a product.

1. **Capability Registry.** Actions, read tools, facts, surfaces, preconditions, policy metadata — the compiled output of all declarations, queryable at runtime ("what is live on this surface right now?").
2. **Context Layer.** A strict escalation ladder: curated facts → typed read tools → annotated-DOM snapshot (`data-ai-id`) → screenshot/vision as the last resort. Each rung is cheaper, more private, and more deterministic than the one below it; policy can forbid lower rungs entirely.
3. **Intent Router.** The speed path. A fast, small-model pass classifies each user message: answer · single action · action chain · workflow needing the loop · clarification · refusal/handoff. Single-action and short-chain intents dispatch **directly** — this is how the 2–5 second loop survives. Only genuinely stateful/uncertain workflows escalate to a full tool loop; only policy-flagged ones escalate to plan preview.
4. **Policy Engine.** §6.3. Pure function; every decision recorded in the ledger.
5. **Execution Engine.** Multiple paths, selected by router + policy — *the loop is a capability, not a mandate*:
   - **direct dispatch** (one action, instantly),
   - **chain execution** (ordered actions with per-step status, cross-surface waits, streaming/optimistic apply for the reversible prefix),
   - **tool loop** (read → act → observe → repair, for workflows where reality may differ from expectation),
   - **plan preview** (plan artifact → one Apply → loop-backed execution within the approved intent; deviations surface as plan amendments, not silent divergence).
   Cross-surface semantics are normative here: navigate, await capability registration at the destination (bounded), continue, and fail legibly.
6. **UX Surfaces.** Pluggable heads over the same engine: chat panel, command palette, inline intent bar, plan card, approval sheet, activity trail, undo toast, shortcut chips ("recipes" learned from repeated intents), and the external bridge. The reference implementation ships tasteful defaults; all replaceable.
7. **Action Ledger.** Every meaningful invocation records: user intent → resolved action(s) → params → policy decision → approval state → execution result → state diff/undo handle → errors and repairs. The ledger is what makes undo, replay, saved workflows, debugging, evals, analytics, and *trust* possible. Interfaces in core; storage pluggable; depth policy-controlled (a creative tool may keep a session trail; a sensitive domain may require durable audit).
8. **External Agent Bridge (door two).** Generated from the same registry: an MCP server exposing (policy-permitted) capabilities to outside agents — Claude, ChatGPT, IDE agents, browser agents that prefer typed tools over pixels. The hard, novel piece is the **tab bridge**: external tool calls arrive server-side but these capabilities execute in a specific user's live session — the bridge routes the call to the user's tab, executes under the *same* policy engine, and returns the result. External callers never get a lower bar than the in-app agent.

---

## 8. Developer experience: humans and coding agents

Two audiences, one kit:

**For human developers:** install the core, declare capabilities, pick a posture preset, mount a surface. The "hello world" must fit in one file and feel instant.

**For coding agents** — the audience this project treats as its distribution strategy. The repo ships, from day one:

- a **retrofit skill** (cross-vendor `SKILL.md` per the open Agent Skills standard): given this repo + a target codebase, the agent inventories candidate actions (existing setters, command handlers, mutations), hidden domain state, risky operations, existing undo/history mechanisms, and UI surfaces — then proposes and executes a minimal first integration;
- an **integration audit skill**: checks an existing integration against the conformance checklist;
- the **coding-agent handoff prompt**: the one-paragraph instruction a developer pastes — *"Read this framework, inspect my app, decide whether it fits, propose an integration plan, and stop for my review before writing code."*;
- **conformance tests**: does every action have exactly one declaration? does every `mutating`+ action have a gate or an undo? does the prompt/tool surface derive from the registry? do the eval fixtures pass?
- **policy templates by app archetype**, **anti-pattern docs**, and **eval scenarios** (intent→routing, policy decisions, reversibility, cross-surface workflows).

The bar for Stage 1 (below): *a coding agent, given only this repo's docs and an unfamiliar app, produces a credible integration plan — and a competent first integration — without a human explaining anything.*

---

## 9. Repo shape

```
/docs
  /spec            steerable-apps.md · capability-declarations.md ·
                   autonomy-policy.md · execution-and-surfaces.md ·
                   context-ladder.md · action-ledger.md · external-bridge.md
  /guides          retrofit-existing-app.md · designing-agent-responsive-features.md ·
                   policy-templates.md · coding-agent-handoff.md
  /anti-patterns   chatbot-veneer.md · dom-automation-first.md ·
                   plan-everything.md · unsafe-magic.md ·
                   duplicate-tool-layers.md · framework-maximalism.md
  /research        landscape-2026.md   (the verified competitive/primitives grounding)

/skills            retrofit · integration-audit · eval-authoring   (SKILL.md format)

/packages          (Stage 2+, not before)
  /core            registry · policy · execution · ledger interfaces (framework-agnostic TS)
  /react           provider · hooks · surface bindings
  /next            route helpers · server/client boundaries
  /mcp             registry → MCP tool generator + tab bridge

/examples          /design-tool (canonical) · /dashboard · /admin-lite
/evals             intent-routing · policy-decisions · reversibility · cross-surface
```

Do not overbuild packages early. The spec, the skills, and one serious example are worth more than four half-finished packages.

---

## 10. Staged plan

Each stage pays for itself even if the next never happens; each gate is a real decision point, not a formality.

### Stage 0 — Pressure-test against the reference app

Rebuild the Spec assistant's engine *in place* on the new concepts — not to extract it, but to prove the API is inevitable: `defineAction`-style single declarations; typed per-action schemas (no flattened params); risk/reversibility/effects metadata; read tools; the intent router with **direct dispatch for the fast path**; optional plan preview *only where policy demands it*; ledger + working undo; eval cases for the common workflows.

**Gate:** the rebuilt assistant is measurably *faster* on simple intents, *more reliable* on multi-step ones, and easier to extend than the current implementation — on a small eval suite, not vibes. **If it cannot improve the reference app, do not package it.**

### Stage 1 — The spec and the kit (no productization)

Write the normative spec; publish the *agent-responsive design* essay that names the category; ship the retrofit skill, handoff prompt, policy templates, and conformance checklist — with Spec ([design-spec.xyz](https://design-spec.xyz)) documented as the reference experience.

**Gate:** a coding agent retrofits at least one unrelated app to a credible first integration using the docs alone. Secondary signal: external pull (the skill gets used, the essay travels, a standards conversation opens). No signal → this work still fully serves Spec as documentation, which is the explicitly acceptable floor.

### Stage 2 — Minimal SDK

Extract the smallest durable runtime (core + react + next), positioned as **the policy-and-plan layer that rides on** native tool calling / AI SDK / AG-UI — never as a rival chat kit. Policy compiles down to ecosystem primitives (`toolApproval` predicates, `canUseTool` callbacks) so adoption costs nothing for teams already inside those stacks. No hosted infrastructure. No workflow-platform ambitions.

### Stage 3 — Door two

Generate the MCP surface + tab bridge from the registry. Deliberately last: external exposure only matters once the action model is proven — but the declarations carry all required metadata from day one so this stage is generation work, not redesign.

---

## 11. Anti-patterns (each gets a doc; each is a real failure mode observed in the wild)

1. **Chatbot veneer** — a panel that answers questions about the product but cannot operate it.
2. **DOM-automation first** — the agent clicks around like a human because the app never declared its capabilities; slow, fragile, injection-prone.
3. **Plan-everything** — every minor action becomes an approval ceremony; the 2-second loop dies of safety theater. *(The founding decision in §6 exists to make this anti-pattern impossible to commit accidentally.)*
4. **Unsafe magic** — mutation without policy, ledger, or undo; trust dies on the first surprise.
5. **Duplicate tool layers** — in-app actions and external MCP tools defined separately, drifting apart.
6. **Framework maximalism** — trying to be the model SDK, the agent framework, the transport protocol, and the UI kit at once.

---

## 12. Ecosystem posture

Use what is strong; own what is missing.

| Layer | Use | This project's role |
|---|---|---|
| Model calls & tool loops | OpenAI / Anthropic native tool calling (strict schemas, streaming, caching) | Consume — never re-implement |
| Tool execution plumbing | Vercel AI SDK where teams already use it | Adapter: policy → `toolApproval` |
| Agent↔UI transport | AG-UI events/interrupts where present | Adapter, potential spec contribution |
| External agent access | MCP (tools, elicitation, Apps) | Generate from the registry (door two) |
| Observability | Provider tracing/eval tooling | Feed the ledger into it |
| **App capability contract, autonomy policy, trusted execution, cross-surface runtime, ledger/undo, agent-readable integration** | **— nothing occupies this —** | **This project** |

---

## 13. Naming

Working category name: **Steerable Apps** (spec: *the Steerable App spec*; the adjective does real work — "is your app steerable?"). Category essay: **agent-responsive design**. Runtime/product naming is deliberately deferred; candidate short names (e.g. *Conn* — the officer who "has the conn" directs the ship's steering, which is precisely the authority-and-policy story) can be settled when Stage 2 makes it matter. Avoid overfitting the name early.

---

## 14. Open questions (the honest ones)

1. **The portability question (the big one).** Can the cross-surface runtime — the most distinctive engineering — be abstracted cleanly beyond Next.js/React, or does it stay a per-framework binding over a framework-agnostic core? Stage 0/1 must answer this. A narrowed claim ("the steering layer for React apps") is still an unoccupied position.
2. **Intent-router economics.** How small can the routing model be before misrouting erodes trust? Where is the escalation threshold from direct dispatch to loop?
3. **Undo at the edges.** Snapshots are nearly free for UI state; what is the honest story for server mutations (compensating actions? soft-delete windows?) without over-promising reversibility?
4. **Agent-executed integrations' quality variance.** How sharp do the conformance tests need to be before "a coding agent did the retrofit" is a trust statement rather than a risk statement? Stage 1 adds a strong but narrow first datapoint: a conformance-checklist-anchored dry-run with a frozen rubric produced a credible unaided retrofit and caught a real kit defect before re-run.
5. **Absorption risk.** CopilotKit ships weekly on $27M; AG-UI's interrupt/capability flags are circling approval semantics; if an incumbent ships risk taxonomy + plan objects first, this project's center of gravity shifts to the spec/skill/category layer — which is why those front-load in the staging.

---

## 15. Provenance

This document synthesizes: (a) the working Spec assistant ([design-spec.xyz](https://design-spec.xyz)) — the UX prototype and Stage-0 proving ground; (b) a six-memo research sweep verified against primary sources on 2026-07-07 covering the Anthropic and OpenAI agentic stacks, CopilotKit/AG-UI (source-level), the chat/generative-UI SDK field, computer-use agents, shipped in-app agents (Notion, Linear, Intercom, PostHog, Amplitude, Salesforce, Cursor, Replit), and the design-theory context (intent-based outcome specification, the anti-chat critiques, malleable software, Agent Experience); and (c) two founding decisions by the project owner: **execution posture is policy, not a hard-coded plan-first workflow** (§6), and **coding agents are a first-class integration audience** (§8).

*Key anchors: MCP Apps launched as an official extension and is scheduled for the 2026-07-28 core-spec release (RC locked May 2026); CopilotKit $27M Series A 2026-05-05; AI SDK 7 `toolApproval` June 2026; OSWorld-Verified top row ~84%, with the older Operator live-web row ~61% and newer rows higher; OSWorld-Human v2 reports 2.7–4.3× step overhead; PostHog ~34% of agent-created artifacts via MCP remains attributed rather than primary-source verified; Agent Skills (SKILL.md) as a cross-vendor open standard.*
