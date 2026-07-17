# Guides

This directory holds practical integration guidance for humans and coding agents, including retrofit instructions, feature-design guidance, policy templates, ecosystem adapters, and the coding-agent handoff prompt.

- [retrofit-existing-app.md](./retrofit-existing-app.md) — discovering a retrofit plan in an unfamiliar codebase: inventory, fit, risk classification, and the minimal-first sequence.
- [server-rendered-apps.md](./server-rendered-apps.md) — carrying a retrofit into a server-rendered app (Next.js App Router and peers): compile-once/scope-per-request registry, session-host lifetime, durable ledger, facts seeding, and where the chat turn runs.
- [designing-agent-responsive-features.md](./designing-agent-responsive-features.md) — greenfield feature shape for agent-steerable capabilities.
- [ecosystem-adapters.md](./ecosystem-adapters.md) — compiling registry declarations into a provider tool loop, tool-name profiles, and the JSON-Schema profile.
- [policy-templates.md](./policy-templates.md) — posture archetypes, overrides, grants, and tuning.
- [coding-agent-handoff.md](./coding-agent-handoff.md) — the handoff prompt for a coding agent executing an integration.

Guide work is governed by the north-star's coding-agent developer experience ([§8](../../Steerable-Protocol-NorthStar.md#8-developer-experience-humans-and-coding-agents)) and the guide list in [`ROADMAP.md#d1--repo-layout-repo`](../plan/ROADMAP.md#d1--repo-layout-repo).

Normative requirements belong in `docs/spec/`, not here. Guides should point to spec requirement IDs and roadmap guardrails rather than redefining them.
