# Intent Routing Evals

This directory holds fixtures for utterance, surface, and fact inputs that should resolve to an expected route class, action, chain, clarification, refusal, or answer.

These fixtures are governed by the intent-router architecture in the north-star ([§7](../../Steerable-Protocol-NorthStar.md#7-architecture)) and the fixture approach in [`ROADMAP.md#d6--eval-approach-repo-now-format-normative-later`](../../docs/plan/ROADMAP.md#d6--eval-approach-repo-now-format-normative-later).

Do not put model transcripts, live-provider traces, or runner output here. Fixtures should stay deterministic and source-controlled.

Schema: [`../schemas/intent-routing.schema.json`](../schemas/intent-routing.schema.json). Samples live in [`samples/`](samples/). The top-level [`../README.md`](../README.md) is the normative authoring guide.
