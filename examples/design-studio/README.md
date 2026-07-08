# Design Studio Example

Design Studio is the Stage-1 example shell for Steerable: a small Vite, React,
TypeScript, and React Router app for editing a fictional brand kit and landing
page mockup. It is intentionally hand-operable first. Sprint 3 can make this app
steerable by wrapping the ordinary setters already present here.

## What This Is

- A client-only brand-kit and landing-page mockup editor.
- Three routed surfaces: Editor, Templates, and Settings.
- A plain React reducer store with discrete, semantically named setters.
- A token-driven landing preview that updates immediately when palette,
  typography, layout, section, template, or project metadata changes.
- A persistent in-app steering panel with deterministic intent routing,
  activity trail, inline approval gates, and undo.
- Route-accurate surface registration: only the current route surface is live,
  so cross-surface chains navigate, await destination capabilities, then continue.
- A Settings posture toggle that switches the same registry between the default
  `creative-tool` policy and a cautious UI backed by the SA-POL `business-app`
  preset.
- A plan-preview card with one Apply for policy outcomes that resolve to
  `Plan preview`.
- A fake export quota of 3 mock exports per page load.

## What This Is Not

- No model calls, live provider, or backend.
- No persistence beyond the in-memory session state.
- Not a product-grade design tool.

## Run

```bash
npm ci
npm run dev
npx vitest run
npm run build
```

## Steering Demo Script

The steering panel uses a deterministic scripted router. Patterns are data:
each pattern names a declaration ID, a target surface, and a generic extractor
such as `paletteColor`, `sectionMove`, or `template`. Classification loops over
that data, validates action params against the live registry, and returns the
SA-EXEC route class. The router sits behind `IntentRouterProvider`; a model
provider can implement that same interface later, but this example ships only
`ScriptedIntentRouter` and makes zero model calls.

| Start surface | Utterance | Route class | Capability route |
| --- | --- | --- | --- |
| Editor | `make the accent #FF6600` | `single action` | `palette.set_color { token: "accent", hex: "#FF6600" }` |
| Editor | `set accent to #FF6600` | `single action` | `palette.set_color { token: "accent", hex: "#FF6600" }` |
| Editor | `make the accent forest green` | `single action` | `palette.set_color { token: "accent", hex: "#228B22" }` |
| Editor | `switch to citrus` | `single action` | `palette.apply_preset { presetId: "citrus" }` |
| Editor | `switch the palette to citrus` | `single action` | `palette.apply_preset { presetId: "citrus" }` |
| Editor | `use the modern font pairing` | `single action` | `typography.set_pairing { pairing: "modern" }` |
| Editor | `hide pricing` | `single action` | `section.set_visibility { sectionId: "pricing", visible: false }` |
| Editor | `move social proof up` | `single action` | `section.move_section { sectionId: "social-proof", direction: "up" }` |
| Templates | `apply the SaaS launch template` | `single action` | `template.apply_template { templateId: "saas-launch" }` |
| Templates | `apply the SaaS launch template and make the accent forest green` | `action chain` | `template.apply_template`, `surface.navigate_surface { surfaceId: "editor" }`, await Editor registration, then `palette.set_color { token: "accent", hex: "#228B22" }` |
| Settings | `copy the share link` | `single action` | `share.copy_link {}` |
| Editor | `export this mock page` | `single action` | `project.export_project {}`; policy pauses at one inline Apply gate under `creative-tool` |
| Settings | `reset the project` | `single action` | `project.reset_project {}`; confirmation is always required |
| Editor | `switch to citrus and hide pricing` | `action chain` | `palette.apply_preset`, then `section.set_visibility` |
| Settings | `switch posture to cautious` | `single action` | `policy.set_posture { posture: "business-app" }` |
| Settings | `switch posture to creative tool` | `single action` | `policy.set_posture { posture: "creative-tool" }` |
| Editor | `what templates are available?` | `answer` | `template.list_available` |
| Editor | `make it pop` | `clarification` | Missing target and parameter |
| Editor | `send this page to Mailchimp` | `refusal/handoff` | Outside declared capabilities |

The pattern matcher is intentionally honest: adding a supported utterance means
adding pattern data or aliases, not relying on language understanding. Safe
reversible actions run instantly under the default `creative-tool` posture.
Quota export and reset are held by policy through the runtime `ApprovalHook`;
the UI renders one inline Apply for the held suffix, never a modal per step.

The issue prompt's "mono template" wording maps to real registry items here as
`template.apply_template { templateId: "saas-launch" }` plus
`palette.set_color { token: "accent", hex: "#228B22" }`. `mono` is a palette
preset, not a template.

## Cross-Surface Walkthrough

1. Open Templates.
2. Submit `apply the SaaS launch template and make the accent forest green`.
3. The trail records `template.apply_template` as done.
4. The chain executes `surface.navigate_surface { surfaceId: "editor" }`.
5. Only after Editor registers live does the engine continue with
   `palette.set_color`.

Observed success trace:

| Step | Trail result |
| --- | --- |
| `template.apply_template` | Done; snapshot undo available |
| `surface.navigate_surface` | Done; undo returns to Templates |
| await Editor | Disclosure: awaiting `editor` before `palette.set_color` |
| `palette.set_color` | Done; accent becomes `#228B22` |

Timeout demo scaffolding is dev-only. Start from:

```text
/templates?steerableDelaySurface=editor&steerableSurfaceDelayMs=5500
```

Then run the same utterance. The navigation preserves the query string, Editor
registration is delayed beyond the 5000 ms default readiness bound, and the
chain fails at the `palette.set_color` boundary. The template and navigation
prefix remain visible and undoable; Undo all restores the starter template and
returns to Templates.

## Posture Contrast

Settings has a `Steering posture` toggle. It submits the same declared
`policy.set_posture` action as the typed commands above. The user-facing
`Cautious` choice is the SA-POL `business-app` preset.

| Utterance | Creative mode and path | Cautious mode and path |
| --- | --- | --- |
| `make the accent forest green` | `Instant execution`: `safe` + `undoable` maps to instant under `creative-tool`. | `Optimistic chain`: `safe` + `undoable` maps to optimistic under `business-app`; no approval card. |
| `copy the share link` | `Instant execution`: `side_effect` + `irreversible` maps to instant under `creative-tool`. | `Plan preview`: `side_effect` + `irreversible` maps to plan preview under `business-app`. |
| `apply the SaaS launch template and export this mock page` | `Gated suffix`: template and navigation run first; `project.export_project` is held because `mutating` + `irreversible` and `cost: quota` floor to `Gated suffix`. | `Plan preview`: one plan card covers template, navigation, and export before anything executes because the export maps/floors to `Plan preview`. |

## App Surfaces

- `Editor`: palette tokens, typography, hero layout, section order,
  section visibility, section copy, and live preview.
- `Templates`: three starting directions that apply complete design state and
  can return the user to the Editor.
- `Settings`: project metadata, share link copy, mock export quota, and reset.

## Setter Inventory

These are ordinary app setters and operations wrapped by the Sprint-3
declarations. The risk and reversibility columns mirror the declaration
metadata.

| Setter / operation | Surface | Mutates | Risk | Reversibility | Notes |
| --- | --- | --- | --- | --- | --- |
| `navigateToSurface` | All | Current route | `safe` | `undoable` | Local in-app route change used by cross-surface chains. |
| `setPaletteToken` | Editor | One palette token | `safe` | `undoable` | Local preview state only. |
| `applyPalettePreset` | Editor | Full palette | `safe` | `snapshot` | Restores from a pre-change palette snapshot later. |
| `setFontPairing` | Editor | Typography pairing | `safe` | `undoable` | Simple inverse to previous pairing. |
| `setTypeScale` | Editor | Typography scale | `safe` | `undoable` | Simple inverse to previous scale. |
| `setHeroLayout` | Editor | Hero layout | `safe` | `undoable` | Simple inverse to previous layout. |
| `toggleSectionVisibility` | Editor | One section visibility flag | `safe` | `undoable` | Toggle is directly reversible. |
| `moveSection` | Editor | Section order | `safe` | `undoable` | Inverse move restores prior order. |
| `updateSectionText` | Editor | Section eyebrow, title, or body | `safe` | `undoable` | Previous field value is enough to undo. |
| `applyTemplate` | Templates | Palette, typography, layout, sections, and meta patch | `safe` | `snapshot` | Multi-field local change needs a snapshot. |
| `setPosture` | Settings | Runtime policy posture | `safe` | `undoable` | Switches `creative-tool` and `business-app` policy presets locally. |
| `updateProjectMeta` | Settings | Name, audience, goal, tone, or share slug | `safe` | `undoable` | Previous field value is enough to undo. |
| `copyShareLink` | Settings | Clipboard and share status message | `side_effect` | `irreversible` | Clipboard write affects the browser environment. |
| `exportProject` | Editor, Settings | Fake daily export quota and export status | `mutating` | `irreversible` | Quota spend is intentionally not undone. |
| `resetProject` | Settings | Design and metadata back to starter state | `destructive` | `snapshot` | Runtime snapshot can restore the local session. |

Coverage: 15 operations total; risk classes: `safe` 12, `side_effect` 1,
`mutating` 1, `destructive` 1; reversibility kinds: `undoable` 10,
`snapshot` 3, `irreversible` 2.

The declaration runtime also adds a non-UI `restoreState` setter so snapshot
undo can restore captured composite state through trusted app code. It is not a
user-facing operation or an action.

## Capability Registry Coverage Matrix

The source of truth for action semantics is
`src/steerable/designStudioCapabilities.ts`; this matrix only maps spec
coverage to declaration IDs.

| ROADMAP §D3 concept | Status | Exercised by |
| --- | --- | --- |
| ≥ 12 actions | Exercised | 15 actions: `surface.navigate_surface`, `palette.set_color`, `palette.apply_preset`, `typography.set_pairing`, `typography.set_scale`, `layout.set_hero`, `section.set_visibility`, `section.move_section`, `section.update_copy`, `template.apply_template`, `project.update_meta`, `policy.set_posture`, `share.copy_link`, `project.export_project`, `project.reset_project` |
| All four risk levels | Exercised | `safe` 12, `side_effect` via `share.copy_link`, `mutating` via `project.export_project`, `destructive` via `project.reset_project` |
| All three reversibility kinds | Exercised | `undoable` 10, `snapshot` via `palette.apply_preset`, `template.apply_template`, `project.reset_project`, `irreversible` via `share.copy_link`, `project.export_project` |
| ≥ 3 read tools | Exercised | `design.get_current_design`, `template.list_available`, `quota.get_status` |
| Per-surface facts | Exercised | `editor.current_facts` has 12 facts, `templates.current_facts` has 11, `settings.current_facts` has 12; each publishes current `policy.posture` |
| ≥ 3 surfaces | Exercised | `editor` (`/`), `templates` (`/templates`), `settings` (`/settings`) |
| Cross-surface chain | Exercised | Templates utterance `apply the SaaS launch template and make the accent forest green` runs `template.apply_template` → `surface.navigate_surface` → await Editor → `palette.set_color` |
| Working per-action undo | Exercised | Trail Undo buttons use declared inverse or runtime snapshot handles |
| Working undo all for optimistic chains | Exercised | Multi-step chains expose Undo all; timeout failure preserves prefix undo |
| Activity trail | Exercised | Trail shows proposed/running/held/succeeded/failed/skipped/undone plus disclosures for held suffix and cross-surface waits/failures |
| At least two runtime-switchable postures | Exercised | Settings `Steering posture` toggle invokes `policy.set_posture`; `creative-tool` and cautious `business-app` resolve the same registry differently |
| North-star §5 example | Exercised | `palette.set_color` uses strict `{ token, hex }` params and the real palette setter |
| Door-two default | Exercised | Actions and read tools omit `externalExposure`; the registry materializes `none` |

### State-Key Taxonomy

State keys are developer-owned, stable, dot-separated identifiers rather than
React paths: `ui.*` for route context, `design.*` for palette, typography,
layout, sections, and template state, `project.*` for metadata, share status,
and export quota, and `browser.*` for local browser side effects.

### Redaction Policy

No current Design Studio declaration accepts sensitive parameters. If a future
declaration sets `effects.sensitive: true`, ledger and eval exports redact that
action's entire params payload instead of attempting field-level partial
redaction.
