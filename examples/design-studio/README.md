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
- A fake export quota of 3 mock exports per page load.

## What This Is Not

- No model calls, live provider, or backend.
- No cross-surface chain demo, posture toggle, or plan-preview card yet.
- No persistence beyond the in-memory session state.
- Not a product-grade design tool.

## Run

```bash
npm ci
npm run dev
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

| Utterance | Route class | Capability route |
| --- | --- | --- |
| `make the accent #FF6600` | `single action` | `palette.set_color { token: "accent", hex: "#FF6600" }` |
| `set accent to #FF6600` | `single action` | `palette.set_color { token: "accent", hex: "#FF6600" }` |
| `make the accent forest green` | `single action` | `palette.set_color { token: "accent", hex: "#228B22" }` |
| `switch to citrus` | `single action` | `palette.apply_preset { presetId: "citrus" }` |
| `switch the palette to citrus` | `single action` | `palette.apply_preset { presetId: "citrus" }` |
| `use the modern font pairing` | `single action` | `typography.set_pairing { pairing: "modern" }` |
| `hide pricing` | `single action` | `section.set_visibility { sectionId: "pricing", visible: false }` |
| `move social proof up` | `single action` | `section.move_section { sectionId: "social-proof", direction: "up" }` |
| `apply the SaaS launch template` | `single action` | `template.apply_template { templateId: "saas-launch" }` |
| `copy the share link` | `single action` | `share.copy_link {}` |
| `export this mock page` | `single action` | `project.export_project {}`; policy pauses at one inline Apply gate |
| `reset the project` | `single action` | `project.reset_project {}`; confirmation is always required |
| `switch to citrus and hide pricing` | `action chain` | `palette.apply_preset`, then `section.set_visibility` |
| `what templates are available?` | `answer` | `template.list_available` |
| `make it pop` | `clarification` | Missing target and parameter |
| `send this page to Mailchimp` | `refusal/handoff` | Outside declared capabilities |

The pattern matcher is intentionally honest: adding a supported utterance means
adding pattern data or aliases, not relying on language understanding. Safe
reversible actions run instantly under the default `creative-tool` posture.
Quota export and reset are held by policy through the runtime `ApprovalHook`;
the UI renders one inline Apply for the held suffix, never a modal per step.

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
| `setPaletteToken` | Editor | One palette token | `safe` | `undoable` | Local preview state only. |
| `applyPalettePreset` | Editor | Full palette | `safe` | `snapshot` | Restores from a pre-change palette snapshot later. |
| `setFontPairing` | Editor | Typography pairing | `safe` | `undoable` | Simple inverse to previous pairing. |
| `setTypeScale` | Editor | Typography scale | `safe` | `undoable` | Simple inverse to previous scale. |
| `setHeroLayout` | Editor | Hero layout | `safe` | `undoable` | Simple inverse to previous layout. |
| `toggleSectionVisibility` | Editor | One section visibility flag | `safe` | `undoable` | Toggle is directly reversible. |
| `moveSection` | Editor | Section order | `safe` | `undoable` | Inverse move restores prior order. |
| `updateSectionText` | Editor | Section eyebrow, title, or body | `safe` | `undoable` | Previous field value is enough to undo. |
| `applyTemplate` | Templates | Palette, typography, layout, sections, and meta patch | `safe` | `snapshot` | Multi-field local change needs a snapshot. |
| `updateProjectMeta` | Settings | Name, audience, goal, tone, or share slug | `safe` | `undoable` | Previous field value is enough to undo. |
| `copyShareLink` | Settings | Clipboard and share status message | `side_effect` | `irreversible` | Clipboard write affects the browser environment. |
| `exportProject` | Editor, Settings | Fake daily export quota and export status | `mutating` | `irreversible` | Quota spend is intentionally not undone. |
| `resetProject` | Settings | Design and metadata back to starter state | `destructive` | `snapshot` | Runtime snapshot can restore the local session. |

Coverage: 13 operations total; risk classes: `safe` 10, `side_effect` 1,
`mutating` 1, `destructive` 1; reversibility kinds: `undoable` 8,
`snapshot` 3, `irreversible` 2.

The declaration runtime also adds a non-UI `restoreState` setter so snapshot
undo can restore captured composite state through trusted app code. It is not a
user-facing operation or an action.

## Capability Registry Coverage Matrix

The source of truth for action semantics is
`src/steerable/designStudioCapabilities.ts`; this matrix only maps spec
coverage to declaration IDs.

| Spec concept | Exercised by |
| --- | --- |
| Actions, 13 total | `palette.set_color`, `palette.apply_preset`, `typography.set_pairing`, `typography.set_scale`, `layout.set_hero`, `section.set_visibility`, `section.move_section`, `section.update_copy`, `template.apply_template`, `project.update_meta`, `share.copy_link`, `project.export_project`, `project.reset_project` |
| `safe` risk | Palette, typography, layout, section, template, and metadata declarations |
| `side_effect` risk | `share.copy_link` |
| `mutating` risk plus `effects.cost: quota` | `project.export_project` |
| `destructive` risk plus explicit confirmation | `project.reset_project` |
| `undoable` reversibility | Single-token, typography, layout, section, and metadata setters with declared inverse handlers |
| `snapshot` reversibility | `palette.apply_preset`, `template.apply_template`, `project.reset_project` |
| `irreversible` reversibility | `share.copy_link`, `project.export_project` |
| Read tools, 3 total | `design.get_current_design`, `template.list_available`, `quota.get_status` |
| Facts | `editor.current_facts` has 12 facts, `templates.current_facts` has 11, `settings.current_facts` has 12 |
| Surfaces, 3 total | `editor` (`/`), `templates` (`/templates`), `settings` (`/settings`) |
| North-star §5 example | `palette.set_color` uses strict `{ token, hex }` params and the real palette setter |
| Door-two default | Actions and read tools omit `externalExposure`; the registry materializes `none` |

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
