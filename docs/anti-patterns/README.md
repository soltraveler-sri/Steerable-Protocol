# Anti-Patterns

This directory holds focused writeups for failure modes the project wants future integrations to recognize and avoid.

Anti-pattern work is governed by the north-star's anti-pattern list ([§11](../../Steerable-Protocol-NorthStar.md#11-anti-patterns-each-gets-a-doc-each-is-a-real-failure-mode-observed-in-the-wild)) and the Stage-1 sequencing in [`ROADMAP.md#sprint-2--full-spec--example-shell`](../plan/ROADMAP.md#sprint-2--full-spec--example-shell).

This is not a place for broad opinion essays or new rules. Each document should tie back to a named failure mode and cite the spec or roadmap section it protects.

## Template note

The seven failure-mode documents use one shared template: status, related anti-patterns, what it is, why it happens, how to recognize it, what to do instead, grounding, and spec gaps surfaced. `plan-everything.md` and `unsafe-magic.md` are intentionally deeper than the others because they form the paired guardrail against ceremony and recklessness.

The first six documents come from the north-star's anti-pattern list. `prompt-as-mechanism.md` was added from issue #83's downstream field report; it is a real failure mode observed in the wild on the same terms, and it is mapped through `docs/spec/conformance-checklist.md` section 7 like the rest.
