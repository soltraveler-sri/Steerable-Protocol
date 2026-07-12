# Documentation

Steerable's documentation is both the public protocol and an executable integration kit for developers and coding agents. Start with the [north-star](../Steerable-Protocol-NorthStar.md), then use the collection that matches your task.

| Collection | What it contains |
|---|---|
| [Specification](./spec/README.md) | The normative protocol: declarations, policy, context, execution and surfaces, ledger, external bridge, and the [conformance checklist](./spec/conformance-checklist.md). |
| [Guides](./guides/README.md) | Greenfield design, existing-app retrofit, coding-agent handoff, policy templates, and [ecosystem adapters](./guides/ecosystem-adapters.md). |
| [Anti-patterns](./anti-patterns/README.md) | Six focused failure modes, from chatbot veneers and duplicate tools to universal planning and unsafe magic. |
| [Research](./research/README.md) | Dated, sourced landscape research and category grounding. |
| [Plan record](./plan/README.md) | The founding plan plus dated Stage-1 and Stage-2 gate evidence; these files are intentionally historical. |

Normative requirements live in `spec/`. Guides and examples explain implementation choices without redefining those requirements. The current runtime packages live under [`packages/`](../packages/), and the package-backed proving ground lives under [`examples/design-studio/`](../examples/design-studio/).
