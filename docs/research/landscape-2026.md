# Landscape 2026: competitive and primitives grounding

**Status:** Sprint 1 research grounding  
**Verification date:** 2026-07-08  
**Canonical context:** `Steerable-Protocol-NorthStar.md` remains authoritative. This document grounds North Star sections 3, 12, 14.5, and 15; it does not define requirements or patch the North Star.

## Verification status

Web access was available for this pass. Claims marked source-verified cite a primary source fetched on 2026-07-08, or a repo document already present in this checkout. Claims marked attributed are reported in the founding research sweep dated 2026-07-07 and were not independently verified in this pass. No URL is cited below unless it was fetched successfully or already appears in repo documents.

Second pass note: a date-aware re-verification pass on 2026-07-08 re-searched the North Star post-cutoff anchors for MCP Apps release status, OSWorld-Verified, live-web/browser-agent benchmarks, PostHog MCP dashboard claims, and OSWorld-Human step overhead. This pass treats post-training-cutoff documents as real and distinguishes future-scheduled releases from unsupported claims.

Verification tally in this document: 62 source-verified claim tags; 3 attributed claim tags.

## Bottom line

The landscape validates the Steerable premise without replacing it. The verified primitives are strong: model/tool SDKs have strict tool schemas and approvals, AG-UI has streaming state and interrupts, MCP/MCP Apps has external tool and UI delivery, and computer-use agents can operate pixels. The missing layer is still the product-owned steering contract: one app-declared capability registry with risk metadata, policy resolution, trusted execution, ledger/undo, and cross-surface continuation inside the product.

## What counts as "the layer"

For this research doc, "the Steerable layer" means the boundary named in the North Star:

- an app-owned registry of typed actions, read tools, facts, and surfaces;
- policy metadata on each action, including risk, reversibility, effects, and confirmation posture;
- runtime validation where the model proposes and the app-owned executor disposes;
- execution semantics that can navigate, wait for destination capabilities, continue, observe, repair, and undo;
- one registry that can serve both the in-app agent and any external agent surface.

This is narrower than "AI UI" and broader than "model tool calling."

## The five common shapes

| Shape | What it has | What it misses relative to Steerable |
|---|---|---|
| Read-only product chatbot | Answers questions over docs, analytics, or current state. | It does not operate declared product capabilities. |
| Generic in-app copilot | Chat, streaming, tool calls, generative UI, sometimes shared state or human-in-the-loop approval. | It usually stops at tool plumbing mounted into UI components, not a normative app capability contract with risk, policy, ledger, undo, and cross-surface execution. |
| Browser/computer-use agent | Pixel or screenshot control over existing UIs. | It bypasses the product's own capability and policy model unless the app publishes one. |
| External MCP/tool server | Model-visible tools and resources outside the app's native UX. | It exposes capabilities to an external host but does not answer how the product's own in-app agent should operate the product on the app's terms. |
| Model SDK wrapper | Tool schemas, loops, streaming, approvals, tracing, and provider abstraction. | It is the execution substrate, not the app-specific declaration, policy, and trusted execution layer. |

These shapes are useful. The positioning error would be treating any one of them as the missing product-owned steering layer.

## Direction 1: in-app copilot and agent UI SDKs

### CopilotKit

Verdict: close on agentic UI and frontend tools; not verified as the risk-typed product capability contract.

- `[source-verified]` CopilotKit describes itself as "the frontend stack for agentic user experience" and says it supports production chat, generative UI, shared state, and human-in-the-loop workflows on AG-UI-compatible backends: https://docs.copilotkit.ai/
- `[source-verified]` CopilotKit announced a $27M Series A on 2026-05-05, led by Glilot Capital, NfX, and SignalFire: https://www.copilotkit.ai/blog/series-a
- `[source-verified]` The same announcement says AG-UI has been adopted by Google, Amazon, Microsoft, Oracle, LangChain, Mastra, Pydantic AI, Agno, AG2, LlamaIndex, and others: https://www.copilotkit.ai/blog/series-a
- `[source-verified]` CopilotKit frontend tools let an agent invoke client-side functions in the user's browser, including reading/modifying React state, browser APIs, UI updates, and third-party frontend libraries: https://docs.copilotkit.ai/frontend-tools
- `[source-verified]` CopilotKit shared state is bidirectional React app/agent state that can update UI in real time through AG-UI state tools and SSE delivery: https://docs.copilotkit.ai/shared-state
- Assessment: this is a strong implementation substrate and a serious adjacent player. The docs reviewed did not establish a single app-owned declaration that compiles to policy metadata, undo, ledger, eval fixtures, in-app tools, and external tools, nor did they establish cross-navigation execution as a runtime contract.

### AG-UI

Verdict: the strongest adjacent protocol primitive; interrupts and capabilities are close to approval semantics, but AG-UI is transport/state/interaction rather than the Steerable action contract.

- `[source-verified]` AG-UI defines itself as an open, lightweight, event-based protocol for connecting AI agents to user-facing applications: https://docs.ag-ui.com/introduction
- `[source-verified]` AG-UI's building blocks include streaming chat, shared state, frontend tool calls, backend tool rendering, interrupts, agent steering, tool output streaming, and custom events: https://docs.ag-ui.com/introduction
- `[source-verified]` AG-UI tools can be backend-defined or client-defined; client-defined tools are passed in `RunAgentInput.tools` and can control application-specific frontend behavior: https://docs.ag-ui.com/concepts/tools
- `[source-verified]` AG-UI interrupts let an agent pause for approval, structured input, or policy decisions and resume with correlated responses: https://docs.ag-ui.com/concepts/interrupts
- `[source-verified]` AG-UI supports tool-bound interrupts, approve-with-edits, and an audit trail spanning original tool args, resume payload, and tool result: https://docs.ag-ui.com/concepts/interrupts
- `[source-verified]` AG-UI capability flags include human-in-the-loop support, approvals, interventions, interrupts, and approve-with-edits: https://docs.ag-ui.com/concepts/capabilities
- Assessment: AG-UI is a likely adapter target. Its interrupt model can carry approvals, but the docs reviewed do not define Steerable's normative risk vocabulary, reversibility model, policy ladder, action registry, or cross-surface execution semantics.

### Vercel AI SDK

Verdict: strong model/tool runtime and policy primitive; use it where present, do not compete with it.

- `[source-verified]` AI SDK is Vercel's TypeScript toolkit for AI applications and agents across React, Next.js, Vue, Svelte, Node.js, and more: https://ai-sdk.dev/docs
- `[source-verified]` AI SDK Core tools define descriptions, input schemas, optional execute functions, and strict tool calling: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- `[source-verified]` Vercel announced AI SDK 7 on 2026-06-25: https://vercel.com/blog/ai-sdk-7
- `[source-verified]` AI SDK 7 supports agent-level `toolApproval`, including user approval, per-tool approval functions, catch-all approval functions, HMAC-signed approvals, replay hardening, and revalidation of tool inputs and policies: https://vercel.com/blog/ai-sdk-7
- `[source-verified]` AI SDK 7 adds `WorkflowAgent` for durable, resumable execution across process restarts, deploys, interruptions, and delayed approvals: https://vercel.com/blog/ai-sdk-7
- `[source-verified]` AI SDK 7 also adds support for MCP Apps, including model-visible versus app-only tools, app metadata preservation, sandboxed iframe UI rendering, and a JSON-RPC bridge: https://vercel.com/blog/ai-sdk-7
- Assessment: the `toolApproval` and workflow primitives are exactly the kind of ecosystem surface Steerable should compile down to. They still do not, by themselves, decide the app-owned declaration model, risk taxonomy, undo contract, surface registry, or agent-readable integration kit.

### assistant-ui

Verdict: high-quality chat UI primitives; intentionally below the app steering contract.

- `[source-verified]` assistant-ui describes itself as React primitives for AI chat interfaces and a frontend for AI agents: https://www.assistant-ui.com/
- `[source-verified]` Its docs emphasize production-grade AI chat experiences, prebuilt customizable chat, chat state management, streaming, and integrations with Vercel AI SDK or other backends: https://www.assistant-ui.com/docs
- Assessment: useful as a UI head over a Steerable engine, but not the capability declaration, policy, ledger, undo, or execution layer.

### Tambo

Verdict: strong generative/interactable React UI toolkit; adjacent to component rendering, not the Steerable policy/execution contract.

- `[source-verified]` Tambo describes itself as an open-source toolkit for adding agents to React apps, connecting existing components while handling streaming, state management, and MCP: https://tambo.co/
- `[source-verified]` Tambo docs say developers register components, and the agent chooses components and streams props based on user messages: https://docs.tambo.co/
- `[source-verified]` Tambo distinguishes generative components rendered once from interactable components that persist on the page and update by ID across conversations: https://docs.tambo.co/
- `[source-verified]` Tambo supports tools and MCP server connections through `TamboProvider`: https://docs.tambo.co/
- Assessment: Tambo is close to "agents render/use my UI components." Steerable is instead "agents operate my product capabilities through app-owned typed actions, policy, and execution."

## Direction 2: the inverted model, MCP and MCP Apps

Verdict: MCP Apps answers "how does my app show up inside ChatGPT/Claude-like hosts?" It does not answer "how does my app's own agent operate my app?"

- `[source-verified]` MCP is an open protocol for integrating LLM applications with external data sources and tools: https://modelcontextprotocol.io/specification/2025-06-18
- `[source-verified]` The MCP specification defines hosts, clients, and servers; servers expose resources, prompts, and tools; clients may expose sampling, roots, and elicitation: https://modelcontextprotocol.io/specification/2025-06-18
- `[source-verified]` MCP tool definitions include a name, optional title, description, input schema, optional output schema, and annotations, with clients expected to treat annotations as untrusted unless from trusted servers: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- `[source-verified]` MCP security guidance says hosts must obtain explicit user consent before invoking any tool and that MCP itself cannot enforce these principles at the protocol level: https://modelcontextprotocol.io/specification/2025-06-18
- `[source-verified]` MCP elicitation, introduced in the 2025-06-18 spec revision, lets servers request additional structured information from users through clients: https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation
- `[source-verified]` SEP-1865 for MCP Apps was merged into the `modelcontextprotocol/modelcontextprotocol` repository on 2026-01-28 and is marked Final in the proposal metadata: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865
- `[source-verified]` MCP Apps was announced on 2026-01-26 as live, the first official MCP extension, and ready for production, with client support in ChatGPT, Claude, Goose, and VS Code Insiders: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- `[source-verified]` The 2026-07-28 MCP release candidate was locked on 2026-05-21; the release candidate states that final publication is scheduled for 2026-07-28, extensions become first-class, and MCP Apps is included as one of two official extensions: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- `[source-verified]` The draft MCP specification fetched on 2026-07-08 lists MCP Apps under optional extensions, while the ext-apps source file still labels its local document Draft: https://modelcontextprotocol.io/specification/draft and https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx
- `[source-verified]` The MCP Apps proposal introduces UI resources with a `ui://` scheme, tool-UI linkage, bidirectional UI/host communication through MCP JSON-RPC, and iframe sandboxing: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx
- `[source-verified]` Public MCP Apps materials verify OpenAI, MCP-UI, and Anthropic involvement: the SEP says OpenAI Apps SDK and MCP-UI informed the design, while the MCP Apps launch post says the initiative partnered with OpenAI and MCP-UI and that Anthropic contributors helped steer the work: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865 and https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- `[source-verified]` OpenAI's Apps SDK docs describe Apps SDK as a way to build apps to extend ChatGPT and include MCP Apps in ChatGPT as a core concept: https://developers.openai.com/apps-sdk
- Assessment: MCP/MCP Apps should be the "door two" generation target for Steerable capabilities. The verified sources leave consent, policy, and UI behavior largely to hosts and do not define an in-product cross-surface steering runtime.

## Direction 3: computer-use and browser agents

Verdict: browser/computer-use agents are the forcing function. If products do not expose a typed steering surface, agents will operate them through pixels, screenshots, accessibility trees, or browser actions.

- `[source-verified]` OpenAI's computer-use guide describes a Responses API computer tool that can click, type, scroll, and inspect screenshots: https://developers.openai.com/api/docs/guides/tools-computer-use
- `[source-verified]` Anthropic's computer use tool gives Claude screenshot, mouse, and keyboard control over a desktop environment: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- `[source-verified]` Anthropic documents computer use as beta, with unique risks heightened when interacting with the internet, and calls out prompt-injection risk mitigations: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- `[source-verified]` Google's Gemini API Computer Use docs say the tool supports browser, mobile, and desktop control agents that use screenshots and UI actions such as mouse clicks and keyboard inputs: https://ai.google.dev/gemini-api/docs/computer-use
- `[source-verified]` Google's Computer Use docs describe built-in policy categories, overrides, and opt-in screenshot scanning for hidden adversarial instructions: https://ai.google.dev/gemini-api/docs/computer-use
- `[source-verified]` The original OSWorld paper introduced 369 real computer tasks and reported humans completing more than 72.36% while the best evaluated model achieved 12.24% success: https://arxiv.org/abs/2404.07972
- `[source-verified]` OSWorld-Verified exists as a 2025-07-28 OSWorld upgrade with verified benchmark results; the fetched leaderboard workbook currently tops out at 83.6% for Pointer Agent with Opus 4.7, with the top foundation E2E GUI-style result at 80.4 plus/minus 2.2% for Holo3-35B-A3B: http://osworld-v1.xlang.ai/ and http://osworld-v1.xlang.ai/static/data/osworld_verified_results.xlsx
- `[source-verified]` OSWorld-Human v1 reported that the best evaluated agents take 1.4-2.7x more steps than necessary, while the current v2 abstract, revised 2026-05-18, reports 2.7-4.3x: https://arxiv.org/abs/2506.16042v1 and https://arxiv.org/abs/2506.16042
- `[source-verified]` OSWorld 2.0 introduces 108 long-horizon workflows, says human users take a median of about 1.6 hours, and reports an average of 318 tool calls with Claude Opus 4.7 using maximum thinking: https://arxiv.org/abs/2606.29537
- `[source-verified]` OSWorld 2.0 reports Claude Opus 4.8 at 20.6% binary completion and 54.8% partial score at 500 steps, with GPT-5.5 plateauing near 13%: https://arxiv.org/abs/2606.29537
- `[source-verified]` Online-Mind2Web introduced a live-online web benchmark of 300 realistic tasks across 136 websites; its human-evaluation leaderboard contains the older OpenAI Operator 61.3% row and a 2026-06-28 Navigator n1.5 97.3% row, while the o4-mini auto-eval verified leaderboard lists Navigator n1.5 at 87.9% and Webwright at 86.7%: https://arxiv.org/abs/2504.01382, https://huggingface.co/spaces/osunlp/Online_Mind2Web_Leaderboard/raw/main/human_Mind2Web-Online%20-%20Leaderboard_data.csv, and https://huggingface.co/spaces/osunlp/Online_Mind2Web_Leaderboard/raw/main/auto_o4-mini_Mind2Web-Online%20-%20Leaderboard_data.csv
- `[source-verified]` A June 2026 WebChallenger paper reports 56.3% WebArena, 48.7% VisualWebArena, 51.0% Online-Mind2Web, and 70.9% WorkArena, which reinforces that "best live-web" depends on benchmark and evaluation protocol: https://arxiv.org/abs/2606.10423
- Assessment: current official computer-use products and benchmarks support the strategic claim while refining the exact benchmark framing. GUI agents can act, but they remain slower, riskier, and less policy-aware than an app-declared action surface can be.

## Shipped in-app agents and the registry lesson

This pass did not attempt exhaustive product reviews of Notion, Linear, Intercom, PostHog, Amplitude, Salesforce, Cursor, or Replit. The relevant grounding is the pattern: shipped agents increasingly combine app context with tools, but the reusable primitive is the capability registry rather than the chat surface.

- `[source-verified]` PostHog publishes a Model Context Protocol page saying PostHog MCP lets a coding agent query real product data in plain English: https://posthog.com/mcp
- `[source-verified]` PostHog's MCP docs describe a free hosted endpoint through which agents can read and write across PostHog products, including analytics queries, feature flag and experiment management, SQL, CDP, support triage, and multi-step recipes; the use-case docs include creating a launch dashboard through MCP: https://posthog.com/docs/model-context-protocol and https://posthog.com/docs/model-context-protocol/use-cases
- `[attributed]` The founding research reported that roughly 34% of PostHog agent-created dashboards arrived through PostHog's MCP server rather than the in-app agent on 2026-07-07. I did not find a fetched PostHog primary source for this exact percentage during this pass, including in fetched PostHog blog, changelog, docs, llms.txt, and MCP pages.
- Assessment: the exact percentage is attributed, but the architectural implication is still useful: in-app steering and external MCP access should be two doors into one registry, not separate drifting tool layers.

## Agent Skills as an integration primitive

Verdict: Agent Skills validates the decision to treat coding agents as a first-class integration audience.

- `[source-verified]` Agent Skills describes itself as a standardized way to give AI agents new capabilities and expertise: https://agentskills.io/home.md
- `[source-verified]` Agent Skills lists multiple clients or implementors, including Gemini CLI, Cursor, Goose, GitHub Copilot, VS Code, Claude Code, Claude, and others: https://agentskills.io/home.md
- `[source-verified]` The Agent Skills specification defines a skill as a directory containing at minimum `SKILL.md`, with optional scripts, references, assets, and additional files: https://agentskills.io/specification.md
- `[source-verified]` The Agent Skills `SKILL.md` format requires YAML frontmatter plus Markdown content, with required `name` and `description` fields: https://agentskills.io/specification.md
- Assessment: this supports the repo's plan to ship retrofit, audit, and eval-authoring skills as executable integration material rather than prose-only docs.

## North Star section 15 anchors

| Anchor | Status | Notes |
|---|---|---|
| MCP Apps entered MCP core | Verified as scheduled / staleness softened | `[source-verified]` MCP Apps was announced as live and the first official MCP extension on 2026-01-26; the 2026-07-28 release candidate was locked on 2026-05-21 and says final publication is scheduled for 2026-07-28 with MCP Apps included as an official extension. Frame the North Star as future-scheduled as of this document date, not unverified or already completed: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/ and https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ |
| CopilotKit $27M Series A on 2026-05-05 | Verified | `[source-verified]` CopilotKit blog verifies the amount, date, and lead investors: https://www.copilotkit.ai/blog/series-a |
| AI SDK 7 `toolApproval` in June 2026 | Verified with updated date precision | `[source-verified]` Vercel blog verifies AI SDK 7 was published 2026-06-25 and includes tool approvals: https://vercel.com/blog/ai-sdk-7 |
| OSWorld-Verified about 85% versus live-web about 61% | Verified in part / current-best updated | `[source-verified]` The OSWorld-Verified leaderboard top is 83.6%, close to the North Star's about-85 claim. Online-Mind2Web confirms the older 61.3% Operator row, but current leaderboard rows exceed it: 97.3% human-eval for Navigator n1.5 and 87.9%/86.7% in o4-mini auto-eval verified rows. The 61% number should be framed as an older benchmark point, not current best: http://osworld-v1.xlang.ai/static/data/osworld_verified_results.xlsx, https://huggingface.co/spaces/osunlp/Online_Mind2Web_Leaderboard/raw/main/human_Mind2Web-Online%20-%20Leaderboard_data.csv, and https://huggingface.co/spaces/osunlp/Online_Mind2Web_Leaderboard/raw/main/auto_o4-mini_Mind2Web-Online%20-%20Leaderboard_data.csv |
| PostHog about 34% via MCP | Attributed, not verified | `[attributed]` PostHog MCP itself is source-verified, including dashboard-creation use cases, but the 34% metric was not found in fetched PostHog blog, changelog, docs, llms.txt, or MCP pages: https://posthog.com/mcp, https://posthog.com/docs/model-context-protocol, and https://posthog.com/docs/model-context-protocol/use-cases |
| Agent Skills as cross-vendor open standard | Verified in substance | `[source-verified]` Agent Skills has a public spec and lists multiple clients/implementors. I did not rely on secondary coverage for adoption claims: https://agentskills.io/specification.md |

## Ecosystem posture

| Layer | Use | Steerable role |
|---|---|---|
| Model calls and tool loops | OpenAI, Anthropic, Google, Vercel AI SDK, and provider-native strict schemas. | Consume. Do not rebuild provider tooling. |
| Tool execution plumbing | Vercel AI SDK `toolApproval`, workflow durability, timeouts, and sandbox abstractions where a team already uses them. | Adapter target for policy decisions. |
| Agent-to-UI transport | AG-UI events, state, interrupts, capabilities, and tool streams. | Adapter target and possible spec contribution surface. |
| External agent access | MCP tools, MCP elicitation, and MCP Apps UI resources. | Generate door two from the same registry after the action model is proven. |
| Chat UI | assistant-ui, CopilotKit UI primitives, AI SDK UI, or app-native surfaces. | Replaceable head over the same steering engine. |
| Generative/interactable UI | CopilotKit generative UI, Tambo components, MCP Apps, A2UI-like declarative UI. | Complementary output surface, not the action contract. |
| App capability contract, autonomy policy, trusted execution, cross-surface continuation, ledger/undo, agent-readable integration kit | No fetched source verified this entire bundle in one product or standard. | Own this layer. |

## What would change our mind

The project's center of gravity should shift if one of these concrete signals appears:

1. A major adjacent framework ships a first-class, risk-typed action declaration contract with risk, reversibility, effects, confirmation posture, executor, undo/snapshot, prompt guidance, docs, eval fixtures, and optional external MCP generation in one source of truth.
2. AG-UI or another protocol standardizes app-owned action risk taxonomy and plan/approval objects deeply enough that Steerable's policy vocabulary becomes an implementation detail rather than a category-defining contract.
3. MCP Apps or OpenAI Apps SDK evolves from host-rendered app widgets into a standard for operating a user's live in-product session under the product's own policy engine, with cross-surface continuation and ledger semantics.
4. AI SDK, CopilotKit, Tambo, or a similar incumbent ships navigation-aware execution where an agent can navigate, await destination capability registration, continue, observe, repair, and undo as a documented runtime guarantee.
5. A credible shipped product exposes one registry that drives in-app steering, external MCP tools, policy, undo, evals, and documentation, and that pattern starts being copied as the default integration shape.

If any of these happens, Steerable should narrow toward the spec/skill/category layer, conformance, and integration kit rather than competing as another runtime.

## North Star staleness and PR-note items

These are research findings to flag in the PR description. They are not patched in `Steerable-Protocol-NorthStar.md`.

1. `[source-verified]` North Star section 15 says MCP Apps entered MCP core on 2026-07-28. That date is after this document's 2026-07-08 verification date, so it should be framed as scheduled rather than completed as of verification time; the underlying schedule is verified by the 2026-05-21 release candidate, which says final publication is scheduled for 2026-07-28 and includes MCP Apps as an official extension: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
2. `[source-verified]` North Star section 3/15 cites OSWorld-Verified about 85% versus live-web about 61%. The OSWorld-Verified half stands in substance: the fetched leaderboard workbook tops out at 83.6%. The live-web number is source-verified as an older Online-Mind2Web Operator row at 61.3%, but it no longer describes current best because the same leaderboard now includes higher 2026 rows: http://osworld-v1.xlang.ai/static/data/osworld_verified_results.xlsx, https://huggingface.co/spaces/osunlp/Online_Mind2Web_Leaderboard/raw/main/human_Mind2Web-Online%20-%20Leaderboard_data.csv, and https://huggingface.co/spaces/osunlp/Online_Mind2Web_Leaderboard/raw/main/auto_o4-mini_Mind2Web-Online%20-%20Leaderboard_data.csv
3. `[source-verified]` North Star section 3 says computer-use agents take 1.4-2.7x the necessary steps. That range matches OSWorld-Human v1; the current v2 abstract reports 2.7-4.3x. Treat this as an older measurement superseded by v2, not as an unsupported claim: https://arxiv.org/abs/2506.16042v1 and https://arxiv.org/abs/2506.16042
4. `[attributed]` North Star section 3/15 says roughly 34% of PostHog agent-created dashboards came through MCP. PostHog MCP itself is verified, but the percentage remains attributed to founding research.
5. `[source-verified]` North Star section 3 describes MCP Apps as co-authored by OpenAI, Anthropic, and MCP-UI creators. The exact co-author phrasing is stronger than the fetched proposal metadata, but public MCP Apps materials verify substantive involvement: OpenAI Apps SDK and MCP-UI informed the design, and the MCP Apps launch post credits OpenAI/MCP-UI partnership plus Anthropic contributors helping steer the initiative: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865 and https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/

## Open risks

- The landscape moves weekly; this doc should be rechecked before the Stage 1 gate review.
- The "absence" conclusions are based on the primary docs fetched for this issue, not source-code audits of every competitor.
- Some current docs are themselves fast-moving marketing/docs surfaces; where exact benchmark or adoption numbers matter, prefer immutable papers, release notes, or repository history.
- The strongest adjacent threat is not a chatbot UI. It is an incumbent combining AG-UI-style interrupts, AI SDK-style approvals, MCP Apps, and a risk-typed registry before Steerable's spec and skills become legible.
