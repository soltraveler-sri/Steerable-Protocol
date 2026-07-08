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
- A fake export quota of 3 mock exports per page load.

## What This Is Not

- No steering runtime.
- No declarations, action registry, model calls, chat panel, intent router, or
  backend.
- No persistence beyond the in-memory session state.
- Not a product-grade design tool.

## Run

```bash
npm ci
npm run dev
npm run build
```

## App Surfaces

- `Editor`: palette tokens, typography, hero layout, section order,
  section visibility, section copy, and live preview.
- `Templates`: three starting directions that apply complete design state and
  can return the user to the Editor.
- `Settings`: project metadata, share link copy, mock export quota, and reset.

## Setter Inventory

These are ordinary app setters and operations today. The risk and reversibility
columns are anticipated Sprint-3 annotations only; there are no declarations in
this shell.

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
| `resetProject` | Settings | Design and metadata back to starter state | `destructive` | `snapshot` | Future runtime can snapshot the project before reset. |

Coverage: 13 operations total; risk classes: `safe` 10, `side_effect` 1,
`mutating` 1, `destructive` 1; reversibility kinds: `undoable` 8,
`snapshot` 3, `irreversible` 2.
