# Eval Authoring Skill

This directory contains the eval-authoring Agent Skill: guidance for writing fixtures that exercise intent routing, policy decisions, reversibility, and cross-surface behavior.

Skill work here is governed by the north-star's eval and coding-agent expectations ([§8](../../Steerable-Protocol-NorthStar.md#8-developer-experience-humans-and-coding-agents), [§14](../../Steerable-Protocol-NorthStar.md#14-open-questions-the-honest-ones)) and [`ROADMAP.md#d5--skillkit-format-normative-for-the-kit`](../../docs/plan/ROADMAP.md#d5--skillkit-format-normative-for-the-kit).

Use `SKILL.md` as the executable skill entrypoint. Supporting files in this directory define the coverage summary shape and duplicate-avoidance checklist; real fixture files and runner logic still belong under `evals/`.

The fixture suite is deterministic and makes zero model or product calls, which is why a green run is not a conformance verdict. The live gate is `skills/integration-audit/references/live-pass.md`; `SKILL.md#live-smoke-tier` covers this skill's bounded part of it.
