# Anti-Pattern Sweep Routing

Run this after the SA-CONF checklist pass. Do not copy recognition text into the report; cite the source file and section.

Read each `How to recognize it` section:

- `docs/anti-patterns/chatbot-veneer.md#how-to-recognize-it`
- `docs/anti-patterns/dom-automation-first.md#how-to-recognize-it`
- `docs/anti-patterns/duplicate-tool-layers.md#how-to-recognize-it`
- `docs/anti-patterns/framework-maximalism.md#how-to-recognize-it`
- `docs/anti-patterns/plan-everything.md#how-to-recognize-it`
- `docs/anti-patterns/prompt-as-mechanism.md#how-to-recognize-it`
- `docs/anti-patterns/unsafe-magic.md#how-to-recognize-it`

Use `docs/spec/conformance-checklist.md` section 7 to map sweep evidence back to SA-CONF items.

Report confirmed sweep hits as ordinary findings:

- Cite the anti-pattern file and section.
- Cite mapped SA-CONF item IDs.
- Include target evidence as `path:line` or observed behavior.
- Use the SA-CONF severity. A ceremony hit mapped to a MUST item is a blocker.

If the sweep finds a suspicious shape without enough evidence for a checklist result, report it as `certainty: uncertain` and explain what evidence is missing.

