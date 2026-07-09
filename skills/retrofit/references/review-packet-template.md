# Retrofit Review Packet Template

Use this before code changes. It packages the `docs/guides/coding-agent-handoff.md` return contract and the inventory procedure from `docs/guides/retrofit-existing-app.md`.

## 1. Fit Verdict

- `verdict`: `fits`, `partial fit`, or `does not fit`
- `scope`: whole app or named surface/module
- `existing_integration_state`: `absent`, `partial`, or `complete`
- `evidence`: paths and short notes for state, trusted executors, context, surfaces, policy/undo, validation seams
- `blocked_items`: `SA-CONF-*` IDs using checklist result vocabulary
- `anti_pattern_risks`: anti-pattern file/section plus evidence when observed
- `no_go_reason`: only for `does not fit`; include prerequisite product work and stop

## 2. Inventory

Use tables with path evidence in every row.

### Candidate Actions

| Candidate ID | User outcome | Existing executor | Params/schema source | Reads/writes/effects | Surface/preconditions | Risk metadata | Recovery | Checklist anchors |
|---|---|---|---|---|---|---|---|---|

### Context

Facts by surface:

| Surface | Fact keys | Why useful | Update trigger | Schema hint | Privacy/bounds note | Evidence | Checklist anchors |
|---|---|---|---|---|---|---|---|

Read tools:

| Read tool | Params | Read owner | Output bounds | Preconditions | Evidence | Checklist anchors |
|---|---|---|---|---|---|---|

### Surfaces

| Surface ID | Route/view/mode evidence | Live actions/read/facts | Registration/liveness evidence | Cross-surface needs | Unavailable-state behavior | Checklist anchors |
|---|---|---|---|---|---|---|

### Existing Tool Layers

| Layer | Evidence | Consumes registry today? | Drift risk | Convergence path | Checklist anchors |
|---|---|---|---|---|---|

## 3. Minimal First Integration Plan

| Phase | Proposed scope | Files likely touched | SA-CONF self-check | Validation | Human stop point |
|---|---|---|---|---|---|
| Facts/read tools | One surface, bounded facts, parameterized reads. |  | `SA-CONF-016` through `SA-CONF-020`, `SA-CONF-044` through `SA-CONF-047`, `SA-CONF-051` |  | Approve surface and context exposure. |
| Safe reversible actions | One to three actions using existing executors. |  | `SA-CONF-006` through `SA-CONF-015`, `SA-CONF-023`, `SA-CONF-028`, `SA-CONF-029`, `SA-CONF-031`, `SA-CONF-034`, `SA-CONF-038`, `SA-CONF-057` through `SA-CONF-059`, `SA-CONF-067`, `SA-CONF-069` through `SA-CONF-075`, `SA-CONF-081` |  | Approve action boundaries and undo claims. |
| One gated action | One side-effect, mutating, destructive, costly, sensitive, or confirmation-bearing action. |  | `SA-CONF-027` through `SA-CONF-043`, `SA-CONF-057`, `SA-CONF-062` or `SA-CONF-064` or `SA-CONF-065`, `SA-CONF-067` through `SA-CONF-078`, `SA-CONF-081` |  | Approve risk classification and policy boundary. |
| Posture selection | Starting preset and scoped overrides. |  | `SA-POL-140` through `SA-POL-172`, `SA-CONF-034` through `SA-CONF-041`, `SA-CONF-087` |  | Approve preset and override rationale. |

Explicitly defer non-minimal work: door two, provider adapters, generic SDK extraction, lower-rung DOM/vision context, full workflow loops, broad durable storage, and additional risk-class coverage beyond the approved slice.

## 4. Open Questions

Keep these decision-oriented:

- Scope boundary.
- Ambiguous risk/effects/confirmation/recovery.
- Context privacy or boundedness.
- Posture preset, override, grant, role, or user-autonomy choice.
- Validation command or local-runtime blocker.

## 5. Stop Statement

End the packet with exactly:

```text
I have not changed code. I am stopping here for your review before implementation.
```
