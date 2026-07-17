# DOM-automation first

**Status:** Informative anti-pattern note. This document does not define requirements; use the cited `SA-*` IDs as the authority.

**Related anti-patterns:** [chatbot veneer](./chatbot-veneer.md), [DOM-automation first](./dom-automation-first.md), [plan-everything](./plan-everything.md), [unsafe magic](./unsafe-magic.md), [duplicate tool layers](./duplicate-tool-layers.md), [framework maximalism](./framework-maximalism.md), [prompt-as-mechanism](./prompt-as-mechanism.md).

## What it is

DOM-automation first means the agent operates the app by clicking, typing, reading selectors, consuming screenshots, or driving browser automation as the primary product interface. The app has not declared what it can do, so the agent steers through the same brittle outer shell a human would use.

This is different from using DOM or vision as a last-resort context source. The failure mode is making pixels, selectors, and page scripts the foundation instead of publishing typed capabilities, surface-scoped availability, policy metadata, and trusted executors.

## Why it happens

The gravitational pull is universality. Browser automation appears to work on any app without integration work. It also helps demos because the agent can visibly move through the product.

The cost arrives later: selectors change, navigation breaks live tool availability, prompt injection rides in page text, execution is slow, and product policy sits outside the path that actually mutates state. The app has surrendered steering to its shell.

## How to recognize it

Use these checks against an unfamiliar codebase:

- Search for browser-control primitives in production agent paths: `rg -n "playwright|puppeteer|selenium|webdriver|computer.use|screenshot|page\\.click|locator\\(|querySelector|document\\.body|innerText|ariaSnapshot"`.
- Trace whether those paths are used for normal product mutations rather than tests, QA tooling, or fallback diagnostics.
- Search for declared capability primitives: `rg -n "defineAction|defineSurface|preconditions|surface:|execute\\s*:"`.
- Flag the shape when user intents are translated to selector steps instead of action IDs with strict params and trusted executors.
- Inspect prompts for instructions such as "click the button", "find the menu", "read the page", or "use the browser" as the default way to operate product features.
- Inspect navigation flows. If capabilities are registered by mounted UI components only and disappear on route changes without a registry-level surface model, the integration is close to this failure even when it uses frontend tools instead of literal clicks.
- Check whether page text can influence execution instructions directly. If untrusted DOM content enters the control prompt without registry validation and policy resolution, treat it as a high-risk signal.

## What to do instead

Use these requirements as the replacement contract:

- Core: `SA-CORE-036`, `SA-CORE-050`, `SA-CORE-051`, `SA-CORE-052`, `SA-CORE-057`.
- Declarations: `SA-DECL-030`, `SA-DECL-031`, `SA-DECL-032`, `SA-DECL-033`, `SA-DECL-046`, `SA-DECL-070`, `SA-DECL-077`, `SA-DECL-078`, `SA-DECL-080`, `SA-DECL-083`, `SA-DECL-084`, `SA-DECL-085`, `SA-DECL-086`.
- Policy: `SA-POL-100`, `SA-POL-101`, `SA-POL-105`, `SA-POL-106`.

If those IDs do not cover the case, record a spec gap instead of adding a local rule here.

## Grounding

The landscape describes computer-use and browser agents as the forcing function: if products do not expose typed steering surfaces, agents operate through pixels, screenshots, accessibility trees, or browser actions: [landscape-2026.md](../research/landscape-2026.md#direction-3-computer-use-and-browser-agents).

The same document treats CopilotKit-style frontend tools as a serious adjacent substrate while noting that the reviewed docs did not establish cross-navigation execution as a runtime contract: [landscape-2026.md](../research/landscape-2026.md#copilotkit).

## Spec gaps surfaced

Detailed context-ladder and execution semantics are assigned to later specs in `SA-CORE-070`; this document uses only the current core, declaration, and policy IDs.
