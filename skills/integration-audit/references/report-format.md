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
- `overall_verdict`

`partial_coverage` is `none` only when the target scope was covered honestly. Otherwise include included paths, excluded paths, and affected SA-CONF ranges.

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

