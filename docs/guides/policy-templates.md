# Policy Templates

**Status:** Informative guide. `SA-POL` owns policy semantics and preset mappings. This guide applies those IDs to common product archetypes, override decisions, sticky grants, user autonomy settings, and tuning loops.

Use this after actions, facts, read tools, and surfaces have a declaration-shaped draft. If the task is to discover those things in an existing app, use the future [retrofit-existing-app.md](./retrofit-existing-app.md) guide instead.

## Authority Map

- Presets and effect floors: `SA-POL-140` through `SA-POL-172`.
- Policy inputs, outputs, overrides, and user autonomy: `SA-POL-100` through `SA-POL-114`.
- Scoped grants and runtime signals: `SA-POL-120` through `SA-POL-133`.
- Clean safe reversible floor guardrail: `SA-POL-073`, `SA-POL-146`.
- Ledger recordability: `SA-POL-108`, `SA-POL-109`, `SA-LED-050` through `SA-LED-055`.
- Framework/developer split: north-star [§6.4](../../Steerable-Protocol-NorthStar.md#64-what-the-framework-decides-vs-what-the-developer-decides), `SA-POL-180` through `SA-POL-190`.
- Anti-pattern stance: [plan-everything](../anti-patterns/plan-everything.md) and [unsafe-magic](../anti-patterns/unsafe-magic.md).

## Archetype Roster

The spec fixes three presets (`SA-POL-140`). This guide uses those three plus one earned variant:

| Archetype | Starting preset | Why it earns space |
|---|---|---|
| Creative production tool | `creative-tool` | Users expect direct manipulation speed, visible undo, and gates around quota, export, publish, reset, or destructive work. |
| Business workflow app | `business-app` | Users expect reliable state, team-visible activity, and grouped review for durable business operations. |
| Sensitive-domain workbench | `sensitive-domain` | The domain makes recording, sensitive-data boundaries, and per-step review central, while still allowing honest safe reversible actions. |
| Read-mostly dashboard or analytics app | `business-app` variant | The main difference is not a new preset; it is that facts and read tools are primary, with a small action set for saved views, shares, exports, and alerts. |

No additional archetypes are included. A thin roster keeps guidance actionable and avoids turning presets into a padded taxonomy.

## Creative Production Tool

Start with `creative-tool` when the product behaves like a canvas, editor, design lab, low-stakes builder, or local sandbox. The app should feel fast because safe reversible changes land immediately with visible undo, while policy boundaries appear around effects that deserve them. Design Studio's default posture demonstrates this with `palette.set_color`, `template.apply_template`, `project.export_project`, and `project.reset_project`.

Good override patterns:

- Per-action: raise `project.reset_project` to `Step-gated` in a production editor if reset has support cost or user trust cost beyond the local demo. This is stricter than the preset and does not change the declaration.
- Per-role: keep creator-owned `project.export_project` at the preset result, but make guest or viewer-initiated export less autonomous when the quota belongs to another account.
- Per-surface: keep in-app canvas edits fast, but lower autonomy for the same non-destructive export/share action when it is invoked from an external bridge, kiosk mode, or shared review surface.

Sticky grant pattern: after a user approves a repeated non-destructive, non-`confirmation: always` suffix, offer a session-scoped grant with action ID, surface, expiration, and parameter bounds under `SA-POL-126` through `SA-POL-130`. Do not create grants for actions blocked by `SA-POL-131` or `SA-POL-132`; Design Studio's `project.reset_project` is the example to exclude.

User autonomy setting: expose a personal "ask me more often" control that lowers autonomy from the creative default for the current user or session (`SA-POL-110`). Treat any ability to raise autonomy above the developer default as an explicit product policy choice (`SA-POL-111`).

## Business Workflow App

Start with `business-app` when the product changes durable account, project, workflow, CRM, ticketing, document, or operational state. The experience should still avoid ceremony for honest safe reversible work; the difference is that durable changes, external effects, and quota or money get reviewed earlier.

Good override patterns:

- Per-action: set a stricter minimum for a specific high-impact durable action such as `workspace.archive_project`, while leaving local reversible layout, filter, and drafting actions at the preset result.
- Per-role: use role policy so operators can propose `invoice.send_reminder`, managers review it as a grouped plan, and interns or external collaborators reach hand-off for the same action. The declaration remains one source of truth; role changes are policy inputs.
- Per-surface: on an admin surface, route account-level changes through plan preview; on a personal draft surface, keep reversible draft edits optimistic.

Sticky grant pattern: use grants for repeated low-impact side effects inside a narrow work session, such as "allow reminder emails for this selected customer list for the next hour," when the action is non-destructive and not marked for inherent confirmation. Keep grant use visible in the rationale and activity trail (`SA-POL-108`, `SA-LED-050` through `SA-LED-055`).

User autonomy setting: give users a way to lower autonomy for their own account, role, or device, such as "ask before external changes" or "preview every durable update." Do not implement that setting by changing declarations; it is an input to policy resolution under `SA-POL-105`.

## Sensitive-Domain Workbench

Start with `sensitive-domain` when the app operates in healthcare, finance, legal, safety, identity, access, compliance, or another domain where recordability and user-regret cost dominate. This preset is not a blanket "gate everything" template. Honest safe reversible actions still exist: local tab changes, view filters, sort order, draft-only formatting, and reversible panel state can remain ungated by default under the preset authority.

Good override patterns:

- Per-action: make `record.release_summary` or `payment.initiate_transfer` less autonomous than the preset if domain policy requires human review, while leaving `view.set_filter` or `draft.toggle_panel` at the safe reversible result.
- Per-role: let licensed reviewers proceed to the preset's review mode, but refuse or hand off the same sensitive external action for unlicensed roles.
- Per-surface: in a training sandbox, allow reversible local practice actions at the preset result; in the production case surface, lower autonomy for actions that expose sensitive data or commit durable state.

Sticky grant pattern: prefer short-lived, case-scoped grants for non-destructive actions with parameter predicates. In many sensitive-domain flows, the right sticky pattern is no sticky grant at all for external, sensitive, money, or irreversible work. When a grant exists, make revocation and recordability visible.

User autonomy setting: users may lower autonomy, but raising autonomy above the developer default is usually not offered. If the product does offer it for narrow local actions, keep it separate from domain approvals and make the scope explicit.

## Read-Mostly Dashboard Variant

Use this as a `business-app` variant for analytics, observability, BI, reporting, or monitoring products where most useful steering is answer generation, filtering, drill-down, saved views, subscriptions, exports, or alerts.

Design emphasis differs from a write-heavy business app:

- Put most product context into facts and read tools first (`SA-DECL-060` through `SA-DECL-078`, `SA-CTX-020` through `SA-CTX-047`).
- Keep local view changes and reversible filters low-friction.
- Treat saved views, scheduled alerts, external shares, exports, and billing-impacting queries as the smaller action set that policy resolves.
- Avoid inventing a new preset unless future product evidence shows `business-app` cannot express the needed posture with overrides.

Sticky grant pattern: grant repeated read-adjacent side effects only when the scope is narrow, such as "allow refreshing this dashboard and exporting CSV for this session." Prefer read tools over action grants when the user is only asking questions.

## Same Registry, Three Products

This contrast artifact applies the preset mappings and floors in `SA-POL-140` through `SA-POL-172` to one identical action set drawn from Design Studio. The declarations do not change; only selected posture and policy inputs change.

| Action | Declaration summary | `creative-tool` | `business-app` | `sensitive-domain` |
|---|---|---|---|---|
| `palette.set_color` | Safe, undoable, local, no cost, not sensitive, no inherent confirmation. | Instant execution. | Optimistic chain. | Optimistic chain. |
| `template.apply_template` | Safe, snapshot, local, no cost, not sensitive, no inherent confirmation. | Instant execution. | Optimistic chain. | Optimistic chain. |
| `share.copy_link` | Side effect, irreversible, external clipboard effect, no cost, not sensitive, no inherent confirmation. | Instant execution. | Plan preview. | Step-gated. |
| `project.export_project` | Mutating quota spend, irreversible, not sensitive, policy confirmation. | Gated suffix. | Plan preview. | Step-gated. |
| `project.reset_project` | Destructive local overwrite, snapshot recovery, inherent confirmation. | Gated suffix. | Plan preview. | Step-gated. |

The first two rows are the guardrail in action: even the sensitive-domain posture does not turn clean safe reversible work into approval ceremony by default. The later rows show why the same registry can feel like three products without forking declarations.

## Override Examples

Use overrides to adapt posture to product evidence, not to patch action meaning. A sketch should identify scope, minimum mode, reason code, and the `SA-POL` authority it relies on.

| Override type | Sketch | Why it is appropriate |
|---|---|---|
| Per-action | `project.reset_project` gets minimum `Step-gated` in a team workspace. | The specific action has higher regret cost than the creative demo; `SA-POL-112` and `SA-POL-145` allow action-scoped overrides. |
| Per-role | `project.export_project` is `Plan preview` for guests and preset-default for owners. | The quota owner and actor role differ; role is an explicit policy input under `SA-POL-105`. |
| Per-surface | `share.copy_link` is more restrictive from an external bridge surface than from in-app Settings. | Surface and caller context change exposure expectations; surface-scoped overrides are allowed by `SA-POL-112` and `SA-POL-145`. |

Less restrictive overrides require a stronger justification than stricter overrides. Check them against effect floors, confirmation, user autonomy lowering, sticky-grant prohibitions, registry availability, and trusted execution authority before using them (`SA-POL-114`, `SA-POL-171`, `SA-POL-172`).

## Sticky Grant Patterns

A sticky grant is useful only when repeated approval is the problem and the product can name a safe scope. Design it as policy input, not hidden memory.

| Pattern | Use when | Avoid when |
|---|---|---|
| Action grant | One non-destructive action is repeatedly approved with the same intent. | The action is destructive, inherently confirmed, unavailable on the surface, or parameter scope matters. |
| Surface grant | A surface is a bounded workspace, such as one project, case, dashboard, or canvas. | The same action on another surface has materially different risk. |
| Role grant | The actor's role is the real distinction. | Role is being used as a shortcut for missing domain checks. |
| Parameter-predicate grant | A value range, object ID, amount, recipient set, or quota cap is the trust boundary. | The parameter cannot be checked by the registry or policy engine. |
| Session grant | The user wants a faster burst of work now. | The product cannot explain expiration or revocation. |

Grant UX should show the remembered scope, expiration, and revocation path. Tuning repeated gates should prefer a scoped grant or a narrow override over global loosening.

## Expose The User's Autonomy Setting

Keep three concepts separate in the product:

| Concept | Owner | Example |
|---|---|---|
| Posture preset | Developer policy default. | Design Studio's Settings toggle switches between `creative-tool` and `business-app` through `policy.set_posture`. |
| Developer override | Product policy. | Exports stricter for guests; reset stricter in team workspaces. |
| User autonomy setting | User-controlled lowering, and optionally developer-approved raising. | "Ask before external changes" for this user or device. |

The user setting should be phrased around outcomes the user understands: local reversible changes, external effects, durable updates, sensitive data, money, and destructive operations. Do not expose raw preset grids as the primary interface. Do expose enough state for a user or support engineer to understand why an action was instant, held, previewed, step-gated, or refused, using the ledger rationale IDs required by `SA-POL-108` and `SA-LED-050` through `SA-LED-055`.

## Tuning Loop

Tune from evidence, not anxiety. Run this loop from ledger records, support reports, and observed user behavior:

1. Group steering records by action ID, surface, role, selected preset, final mode, approval outcome, undo outcome, refusal reason, and reason codes.
2. Mark "spam-approval" candidates: repeated approvals of the same non-destructive scope, few declines, few undo attempts, and no surprise reports. Consider a scoped grant, narrower gate copy, or a less restrictive override if `SA-POL` permits it.
3. Mark "surprise-regret" candidates: immediate undo, partial undo, support contact, declined suffix after an unexpected prefix, or user reports that an external/durable/sensitive outcome happened too freely. Consider stricter override, better facts/read tools, clearer action boundaries, or stronger recovery.
4. Before adding ceremony, check whether the action is too broad, the rollback mechanism is weak, or the fact/read-tool context is insufficient. Fixing those often preserves speed without weakening trust.
5. Re-run the contrast artifact for the affected action set and update tests/fixtures so policy behavior is visible to agents and humans.

Do not tune by globally gating all safe reversible work. That is the plan-everything anti-pattern, even when introduced as a temporary safety measure.

## Framework / Developer Boundary Audit

This guide was checked against the north-star [§6.4](../../Steerable-Protocol-NorthStar.md#64-what-the-framework-decides-vs-what-the-developer-decides) and `SA-POL-180` through `SA-POL-190`.

Audit changes made while drafting:

- Reworded archetype sections to say "start with" a preset rather than "use" a fixed mode, preserving developer override authority.
- Kept the read-mostly dashboard as a `business-app` variant instead of adding a fourth preset.
- Removed a draft sensitive-domain sentence that implied all actions should preview first; the final text explicitly preserves honest safe reversible actions.
- Reframed sticky grants as scoped policy inputs and cited grant prohibitions instead of implying grants can bypass all floors.
- Moved risk-classification walkthrough content out of this guide and left it to `SA-POL` plus the future [retrofit-existing-app.md](./retrofit-existing-app.md) discovery guide.
