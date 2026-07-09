# Facts-Context Evals

This directory holds fixtures for context-ladder Rung 1 curated facts and Rung 2 typed read tools. They exercise a live surface's registry declarations directly: fact values come from the declaration publisher and read-tool results come from the declared typed query after normal availability, precondition, and parameter validation.

Use this kind to pin bounded, app-owned context and read-tool output without inventing an utterance or routing through action policy/execution. Keep answer classification and user-facing answer text in [`../intent-routing/`](../intent-routing/).

`expected.facts[*].values` and `expected.readTools[*].result` reuse the existing `allowExtra`/`fields` matcher envelope; this kind introduces no matcher vocabulary. The adapter `context(fixture)` method is required only for suites that contain this kind, so external adapters that run the original four kinds remain compatible.

Schema: [`../schemas/facts-context.schema.json`](../schemas/facts-context.schema.json). Samples live in [`samples/`](samples/). The top-level [`../README.md`](../README.md) is the normative authoring guide.
