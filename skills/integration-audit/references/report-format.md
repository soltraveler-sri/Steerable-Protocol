# Findings Report Format

Use one report per audited target. Markdown is preferred because humans and fixing agents can read it directly; JSON may be added if a gate needs machine parsing.

## Header

Required fields:

- `target`
- `audit_date`
- `auditor`
- `claimed_conformance`
- `checklist_source`
- `anti_pattern_sources`
- `scope`
- `partial_coverage`
- `commands_run`
- `live_pass`
- `overall_verdict`

`partial_coverage` is `none` only when the target scope was covered honestly. Otherwise include included paths, excluded paths, and affected SA-CONF ranges.

`live_pass` is `complete`, `partial`, or `not run`. It is `complete` only when `LP-1` through `LP-5` are each `Pass` or a justified `Not applicable`. `overall_verdict` cannot report a passing conformance claim unless `live_pass` is `complete`.

## Integration Map

List discovered seams with evidence:

- registry
- declarations
- policy
- executors
- facts/read tools
- surfaces/liveness
- router/model bridge
- ledger
- undo/snapshot
- generated artifacts
- external bridge, if any

Each seam entry uses `path:line` evidence or `not found after <searches>`.

## Live Pass Record

Place this before the item table. See `references/live-pass.md` for the checks and the evidence standard.

Preflight fields:

- `build_sha`: the commit the running target was built from; must equal HEAD of the audited scope
- `drive_channel`: how the target was driven
- `datastore_identity`: the real store `LP-2` wrote to, and how it is known not to be a double
- `datastore_authorization`: non-production, or the human's explicit authorization
- `surface_inventory`: every surface ID from the registry's surface declarations

One row per check:

| Check | Result | Channel | Artifact | Justification / Blocker |
| --- | --- | --- | --- | --- |
| `LP-1` | | | | |
| `LP-2` | | | | |
| `LP-3` | | | | |
| `LP-4` | | | | |
| `LP-5` | | | | |

- `Result` uses the checklist result vocabulary: `Pass`, `Fail`, `Not applicable`, `Inconclusive`.
- `Artifact` is what was observed — verbatim error-stream output, the three datastore reads, the two fact snapshots, the provider response identifier and routed output. An assertion that the code is correct is not an artifact; a check with no artifact is `Inconclusive`.
- `Justification / Blocker` is required for `Not applicable` (the structural absence, cited from a declaration) and for `Inconclusive` (`blocker`, `attempted`, `unblock`, `verdict_effect`).

Every `Fail` and every `Inconclusive` also gets a full finding below, with `severity: blocker` or `severity: claim-blocking-inconclusive`.

## Severity Scale

- `blocker`: applicable SA-CONF MUST item is `Fail`; blocks the relevant conformance claim.
- `flag`: applicable SA-CONF SHOULD item is `Flag`.
- `claim-blocking-inconclusive`: evidence required for a conformance claim is unavailable.
- `pending-spec`: official pending clarification from the checklist, not locally resolved.

Safety-direction and ceremony-direction MUST failures both use `blocker`.

## Finding Fields

Every finding uses these fields:

- `id`: stable report-local ID such as `F-001`
- `severity`
- `certainty`: `confirmed` or `uncertain`
- `result`: checklist result token
- `SA-CONF`: one or more checklist item IDs
- `requirement_ids`: copied from the checklist row
- `anti_pattern_refs`: file/section paths when applicable
- `title`
- `evidence`: file/line/behavior; include command output or runtime observation when useful
- `impact`: why the finding matters for the claimed scope
- `fix_direction`: concrete next edit path and intended behavior
- `verification`: how a fixing agent should prove the fix
- `coverage_note`: optional, required for partial or uncertain findings

## Item Result Table

Include every SA-CONF-001 through SA-CONF-089 item:

| Item | Applies | Severity | Requirement IDs | Result | Evidence |
| --- | --- | --- | --- | --- | --- |

Evidence may be concise, but it must be sufficient to reproduce or inspect the result. Do not paste checklist assertions into this table.

## Summary Counts

Report counts for:

- `Pass`
- `Fail`
- `Flag`
- `Not applicable`
- `Pending spec clarification`
- `Inconclusive`

Also include total findings by severity.

## Fix-Ready Standard

A finding is fix-ready only when a second agent can identify:

- where to edit
- what behavior to preserve or change
- which SA-CONF item will be rechecked
- which command or probe should demonstrate the fix

If those are not known, keep the finding but set `certainty: uncertain` or result `Inconclusive`.

