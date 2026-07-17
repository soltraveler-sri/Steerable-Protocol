---
name: integration-audit
description: Audit an existing or claimed Steerable integration against the canonical SA-CONF conformance checklist, drive the running target through the required live pass, run the anti-pattern recognition sweep, and produce a structured severity-ranked findings report. Use when a user asks to verify, review, gate, or audit a Steerable integration in an unfamiliar codebase, or to check whether a conformance claim holds.
---

# Integration Audit

Use this skill to audit an attempted Steerable integration. It is report-only: do not retrofit or auto-fix unless the user separately asks for fixes. Report-only governs the target's source. It does not make this a static audit: the audit drives the running target under `references/live-pass.md`, and no conformance claim may be reported without that live pass.

## Canonical Inputs

Load these before auditing:

1. The user's work order and requested target/scope.
2. `docs/spec/conformance-checklist.md` from the Steerable repo. This is the only source of SA-CONF audit truth.
3. The `How to recognize it` sections in `docs/anti-patterns/*.md`.
4. `docs/guides/retrofit-existing-app.md` when present. If missing, cite the path as future locate guidance and use the minimal locate procedure below.

Do not restate or extend checklist rules. Execute every applicable SA-CONF item from the checklist and cite item IDs plus requirement IDs from the checklist row. Anti-pattern sweep findings cite the anti-pattern file and section, plus the mapped SA-CONF item(s).

## Workflow

1. Define the audit target.
   - Record target path, claimed conformance level if any, product area, and exclusions the user gave.
   - If no Steerable integration attempt is present, stop. Report `scope_guard: no_integration_present` and route the user to `skills/retrofit/` and `docs/guides/retrofit-existing-app.md`.
   - If the codebase is too large to sweep honestly, continue only with an explicit partial-coverage declaration before item results. Name included paths, excluded paths, search limits, and the confidence impact.

2. Locate the integration.
   - Prefer `docs/guides/retrofit-existing-app.md` for inventory tactics when it exists.
   - Minimal locate procedure: find the registry first, then walk outward to declarations, policy resolution, executors, facts/read tools, surfaces, router/model bridge, ledger/undo, generated artifacts, and any external bridge.
   - Build an integration map with file paths and line references for each seam. Missing seams are evidence, not assumptions.

3. Generate the item skeleton.
   - Optional helper from the Steerable repo root:

     ```bash
     node skills/integration-audit/scripts/make-report-skeleton.mjs --target <target-path> > /tmp/steerable-audit.md
     ```

   - The skeleton must contain SA-CONF-001 through SA-CONF-089. Fill every item with one checklist result token from the canonical result vocabulary.

4. Run the live pass.
   - Read `references/live-pass.md` and execute `LP-1` through `LP-5` against the running target before item execution, so their artifacts are available as item evidence.
   - Drive the target through the channel its nature calls for. The five observations are fixed; the probe is not.
   - Record every check as `Pass`, `Fail`, `Not applicable` with a structural justification, or `Inconclusive` with a blocker. Each result carries an artifact that is a record of the run, not a claim about the code.
   - A conformance claim requires a completed live pass. If the target cannot be driven, that is `Inconclusive`, which the checklist's result vocabulary already says "does not count as pass for a conformance claim". Report it plainly; an honest `Inconclusive` is a correct outcome and a green test suite, eval run, or build is not a substitute for any of these checks.

5. Execute the checklist.
   - For each SA-CONF row, use the checklist row's `How to look` instructions from `docs/spec/conformance-checklist.md`.
   - Record `Pass`, `Fail`, `Flag`, `Not applicable`, `Pending spec clarification`, or `Inconclusive`.
   - A MUST item failure is a blocker for the relevant claimed conformance level. A SHOULD item failure is a flag. Pending and inconclusive items never count as a pass for a conformance claim.
   - For items in the `references/live-pass.md` item-binding table, static evidence alone cannot produce `Pass` while the mapped `LP` check is not `Pass`; record `Inconclusive`.
   - Ceremony failures and unsafe-magic failures are both real findings when their SA-CONF item is violated. Do not down-rank over-gating because it looks cautious.

6. Run the anti-pattern sweep.
   - Read `references/anti-pattern-sweep.md`.
   - For each listed anti-pattern document, execute its `How to recognize it` section against the target.
   - Convert confirmed evidence into findings using the report format. If the sweep produces only a suspicion, report it as uncertain rather than dropping it or asserting it.

7. Write the findings report.
   - Use `references/report-format.md`.
   - Include the live pass record before the item table, and an item-result table for every SA-CONF-001 through SA-CONF-089 item.
   - Severity-rank findings before the full item table.
   - Every finding must include evidence as file/line/behavior and a fix direction concrete enough that a second agent can act without re-auditing from scratch.

8. Verify the report.
   - Confirm all 95 checklist items have a result.
   - Confirm `LP-1` through `LP-5` each have a result, and that every `Pass` carries an artifact recording what was observed rather than an assertion that the code is correct.
   - Confirm every `Not applicable` live-pass check names the structural absence that justifies it, and every `Inconclusive` one names its blocker, what was attempted, and what would unblock it.
   - Confirm no conformance claim is reported as passing while any live-pass check is `Fail` or `Inconclusive`.
   - Confirm every finding cites at least one SA-CONF item or an anti-pattern section plus mapped SA-CONF item.
   - Confirm uncertain findings are labeled `certainty: uncertain`.
   - Confirm partial coverage is either `none` or explicitly declared with exclusions.
   - Confirm no checklist or anti-pattern rule text was copied into the report beyond IDs, short labels, paths, and evidence.

## Supporting References

- Live pass gate: `references/live-pass.md`
- Procedure details: `references/procedure.md`
- Report contract: `references/report-format.md`
- Anti-pattern sweep routing: `references/anti-pattern-sweep.md`

