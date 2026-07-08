# Contributing

This repository is written for both humans and coding agents. Before changing anything, read the project sources in this order:

1. [`Steerable-Protocol-NorthStar.md`](./Steerable-Protocol-NorthStar.md)
2. [`docs/plan/ROADMAP.md`](./docs/plan/ROADMAP.md)
3. [`docs/plan/GROUNDING.md`](./docs/plan/GROUNDING.md)
4. The issue you are implementing or reviewing

If an issue conflicts with the north-star, the north-star wins. Flag the conflict in your output instead of silently choosing.

## Working An Issue

Start from the branch named by the issue or create a short-lived issue branch from the project base branch. Keep the diff scoped to the issue's In list, respect its Out list literally, and do not add adjacent infrastructure unless the issue asks for it.

For implementation work, make the smallest complete change that satisfies the acceptance criteria, then verify those criteria against the actual diff. Leave generated output, dependencies, and local scratch files out of git.

## Pull Requests

Use descriptive branch names, preferably `sprintN/issue-N-short-name` when the issue belongs to a sprint. Pull requests should link the issue, summarize the scoped change, list validation performed, and call out any deliberate deviation from the issue text.

Before opening a PR, sync with the GitHub remote, commit the intended files only, and make sure the working tree is clean. Do not include `Co-Authored-By` trailers unless the project owner asks for them.

## Project Rules

The standing guardrails live in [`docs/plan/ROADMAP.md#standing-guardrails-inherited-by-every-issue`](./docs/plan/ROADMAP.md#standing-guardrails-inherited-by-every-issue). Link to those rules rather than copying them into new docs.

Normative spec requirements use stable IDs described in [`docs/plan/ROADMAP.md#d2--spec-conventions-and-requirement-ids-normative-gap-fill`](./docs/plan/ROADMAP.md#d2--spec-conventions-and-requirement-ids-normative-gap-fill). New spec work should assign IDs once, avoid renumbering, and make checklist or eval references traceable to those IDs.
