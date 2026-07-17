# Integration Audit Procedure

This reference expands the `SKILL.md` workflow. It does not replace `docs/spec/conformance-checklist.md`; always use the checklist rows as the audit authority.

## Scope Guard

Stop before item execution when there is no integration attempt. A qualifying attempt usually has at least one registry or declaration seam plus a policy/execution/ledger seam. A plain chatbot, docs-only claim, or isolated prompt file is not enough.

The stop report includes:

- `scope_guard: no_integration_present`
- `target`
- `evidence_checked`
- `why_audit_cannot_continue`
- `route_to: skills/retrofit/ and docs/guides/retrofit-existing-app.md`

For large targets, do not silently sample. If exhaustive evidence is not feasible in the current task, declare:

- included paths
- excluded paths
- search commands or tooling limits
- checklist sections affected
- result impact, usually `Inconclusive` for items whose evidence could live outside the covered paths

## Locate Procedure

Use the future guide at `docs/guides/retrofit-existing-app.md` when present. If it is absent, use this minimal procedure:

1. Find the registry surface. Search for registry constructors, capability IDs, declaration helpers, and conformance claims.
2. Walk from registry to declarations. Enumerate action, read-tool, facts, and surface declarations.
3. Walk from declarations to policy. Find the resolver called before steering execution and the posture/default configuration it consumes.
4. Walk from policy to executors. Trace each model/router/action-chain path into app-owned execution code and then into product setters, endpoints, stores, or side effects.
5. Walk from declarations to context. Find facts publishers, read tools, surfaces, and any lower-rung DOM/vision/browser automation paths.
6. Walk from execution to ledger and undo. Find policy records, action-step records, result/error records, undo handles, snapshot capture/restore, and redaction/export paths.
7. Walk outward to generated artifacts and bridge code. Search prompts, fixtures, docs, external tools, MCP/OpenAPI/function schemas, and eval traces for duplicated action facts.

Record each seam in the integration map with file and line evidence. If a seam cannot be found, record the searches attempted.

## Live Pass

Run `references/live-pass.md` after the locate procedure and before checklist execution. It defines the minimum set of runtime observations — every declared surface loading clean, one action executing against a real datastore and undoing, one cross-surface continuation across a real navigation, published facts differentially compared to rendered state, and the first live model-routed request — plus the artifacts each must produce and how to map them onto a target that is not a web app.

The live pass is not optional and is not satisfied by static reading, tests, evals, or a build. A target that cannot be driven yields `Inconclusive`, which is the correct result and caps the conformance verdict; it does not license a static pass.

## Checklist Execution

Parse or manually enumerate SA-CONF-001 through SA-CONF-089 from `docs/spec/conformance-checklist.md`.

For each row:

- Copy the item ID, applies value, severity, and requirement IDs into the report.
- Read the row's assertion and `How to look` text from the checklist.
- Execute the row against the target.
- Store the result token and evidence. Evidence is observed runtime behavior, static code, tests, command output, or an explicit condition for not-applicable items. For rows whose assertion is about behavior, static code and tests are supporting evidence, not sufficient evidence: cite the live pass artifact.
- For rows in the `references/live-pass.md` item-binding table, do not record `Pass` from static evidence while the mapped live-pass check is not `Pass`.
- If evidence is unavailable, use `Inconclusive`; do not infer a pass.
- If the item is one of the checklist's pending-clarification rows, keep the pending status unless the official spec has changed.

## Anti-Pattern Sweep

After item execution, read the six anti-pattern `How to recognize it` sections and run their recognition checks. Use the mapping in `docs/spec/conformance-checklist.md` section 7 to connect sweep evidence to SA-CONF items.

Sweep findings supplement the checklist; they do not create new conformance rules. If a sweep reveals a problem not covered by existing IDs, label it as a possible spec gap instead of inventing a local rule.

## Clean vs. Seeded Validation Pattern

For a known-good example:

1. Run the full procedure on the clean target and compare the report to the checklist appendix or project audit artifact when one exists.
2. Copy only the target source into a temp directory for seeding.
3. Plant one safety-direction violation and one ceremony-direction violation in the temp copy.
4. Run the same locate, checklist, and anti-pattern procedure against the temp copy.
5. Confirm both planted violations are found with MUST-level seriousness when they violate MUST items, with exact evidence and concrete fix direction.

Do not seed the real worktree unless the user explicitly asks.

