# Reversibility Evals

This directory holds fixtures that check undoable, snapshot-based, and irreversible action behavior against executed state.

These fixtures are governed by the north-star's reversibility principle and policy vocabulary ([§4](../../Steerable-Protocol-NorthStar.md#4-design-principles), [§6](../../Steerable-Protocol-NorthStar.md#6-autonomy-and-policy)) and the roadmap's eval approach ([D6](../../docs/plan/ROADMAP.md#d6--eval-approach-repo-now-format-normative-later)).

Do not store ad hoc state dumps or generated replay logs here. Keep fixtures small enough for future agents to inspect and update.

Schema: [`../schemas/reversibility.schema.json`](../schemas/reversibility.schema.json). Samples live in [`samples/`](samples/). The top-level [`../README.md`](../README.md) is the normative authoring guide.
