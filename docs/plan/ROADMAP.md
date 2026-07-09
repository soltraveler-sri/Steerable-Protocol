# Roadmap — Stage 1 plan for the Steerable repo

**Status:** founding plan (July 2026). Issues in the tracker reference the decisions and epics below by anchor.
**Canonical source:** [`Steerable-Protocol-NorthStar.md`](../../Steerable-Protocol-NorthStar.md) — this roadmap sequences it; it does not override it. Divergences and gap-fills are called out explicitly in [Decisions](#decisions), each with rationale.
**Companion:** [`GROUNDING.md`](./GROUNDING.md) — the mission, principles, and founding decisions this plan serves.

---

## What Stage 1 must produce (and its gate)

Per north-star §10, Stage 1 is **the spec and the kit — no productization**:

- the normative Steerable App spec (docs/spec/),
- the agent-readable integration kit (guides, skills, handoff prompt, policy templates, conformance checklist),
- a local proving ground: one small, honest example app every spec concept is exercised against,
- eval fixtures for intent-routing and policy decisions (fixture format now; full harness later),
- the *agent-responsive design* category essay.

**Stage-1 gate:** a coding agent, given only this repo's docs and an unfamiliar app, produces a credible integration plan — and a competent first integration — without a human explaining anything. Sprint 5 exercises this gate deliberately (dry-run against a third-party open-source app) before declaring Stage 1 done.

**Explicitly NOT in Stage 1** (north-star §9 "do not overbuild packages early", §10): `packages/*` extraction, MCP bridge implementation, AI-SDK/AG-UI adapters, hosted anything, runtime naming, additional example apps beyond the canonical one.

Note on Stage 0: the north-star's Stage 0 (pressure-testing inside Spec's assistant) happens in the Spec repository, separately and in parallel. Nothing in this repo may depend on access to Spec's private codebase; this repo's concepts are proven against the in-repo example app instead.

---

## Decisions

Each decision is classified per the meta-principle: **[normative]** = the standard decides (universal), **[dev-choice]** = left to integrating developers with a sane default, **[repo]** = an internal decision about how this repo is built (not part of the standard).

### D1 — Repo layout [repo]

Adopt north-star §9 verbatim, minus `packages/` (Stage 2+), plus `docs/plan/` (this directory — a gap-fill; the north-star doesn't name a home for planning artifacts):

```
/docs
  /plan            GROUNDING.md · ROADMAP.md              (added; internal planning)
  /spec            steerable-apps.md · capability-declarations.md ·
                   autonomy-policy.md · execution-and-surfaces.md ·
                   context-ladder.md · action-ledger.md · external-bridge.md ·
                   conformance-checklist.md               (added; see D4)
  /guides          retrofit-existing-app.md · designing-agent-responsive-features.md ·
                   policy-templates.md · coding-agent-handoff.md
  /anti-patterns   chatbot-veneer.md · dom-automation-first.md · plan-everything.md ·
                   unsafe-magic.md · duplicate-tool-layers.md · framework-maximalism.md
  /research        landscape-2026.md
/skills            retrofit/ · integration-audit/ · eval-authoring/   (SKILL.md format)
/examples          design-studio/                          (one canonical example; see D3)
/evals             intent-routing/ · policy-decisions/ · reversibility/ · cross-surface/
```

Every top-level directory gets a short README saying what belongs there and what doesn't, so agents landing anywhere in the tree can orient.

### D2 — Spec conventions and requirement IDs [normative, gap-fill]

The north-star names the spec documents but not their conventions. Decided here:

- **Normative language:** RFC-2119 keywords (MUST/SHOULD/MAY), with an explicit "normative vs. informative" marker per section.
- **Stable requirement IDs:** every normative requirement gets an ID (`SA-<DOC>-<NNN>`, e.g. `SA-DECL-012`), assigned once and never renumbered. Rationale: the conformance checklist, the audit skill, and eval fixtures must reference exact requirements — traceability is what turns "a coding agent did the retrofit" from a risk statement into a trust statement (north-star §14.4).
- **Every spec doc ends with its own "framework decides vs. developer decides" table** (§6.4 is the model). This makes the founding meta-principle structurally unavoidable for every author.
- **TypeScript as the spec's illustration language** (matching the north-star's `defineAction` example), with an explicit note that the contract is conceptual — shapes and semantics — not a TS API commitment. Naming of a future runtime API is deferred (§13).

### D3 — The example app: `examples/design-studio` [repo]

**What:** a deliberately small brand-kit / landing-page-mockup editor — a fictional cousin of Spec, honest about being a demo. Chosen over dashboard/admin archetypes because it is the north-star's canonical example (§9), it naturally justifies the *creative-tool* posture (instant execution, undo everywhere) that the founding decision protects, and it still exercises gates via quota-spending and destructive actions.

**Stack:** Vite + React + TypeScript + client-side routing (react-router). Not Next.js — no server needed for Stage 1, and staying framework-light keeps the example honest about what the pattern requires vs. what a metaframework provides. (The portability question, north-star §14.1, is answered in Stage 2, not here.)

**Must exercise every spec concept** (this is its acceptance bar as a proving ground):

- ≥ 12 actions spanning **all four risk levels**: `safe` (palette/typography/layout setters), `side_effect` (copy share link), `mutating` (a mock "export/publish" that spends a fake daily quota), `destructive` (reset project);
- reversibility of all three kinds: `undoable`, `snapshot`, `irreversible`;
- ≥ 3 read tools and per-surface facts;
- ≥ 3 surfaces (Editor, Templates gallery, Settings) with a real **cross-surface chain** (navigate → await capability registration → continue);
- working undo (per-action + *undo all* for optimistic chains) and an activity trail;
- **at least two autonomy postures** switchable at runtime (default `creative-tool`; a `cautious` toggle demonstrating that the same registry under a different policy yields a different experience — posture is policy, not code).

**The inline proto-runtime:** the example contains its own small `steerable/` module (registry, policy resolver, execution engine, ledger, undo). This is deliberately **inline and disposable — not a package, not importable, not published**. The spec is canonical; the proto-runtime is an existence proof and the raw material Stage 2 extraction will study. Copying it into another app is explicitly unsupported.

**Mock-first model policy [repo, cost discipline]:** the example's intent router runs on a deterministic scripted router (pattern-matching over fixture-style utterances) by default, so the app and all evals run with **zero API calls** in dev and CI. A live-provider adapter may be added behind an env var, but nothing in Stage 1 acceptance criteria may require live model calls.

### D4 — Spec document breakdown and dependency order [repo]

Seven spec docs per §9, plus `conformance-checklist.md` (gap-fill: the north-star requires conformance tests (§8) but gives the checklist no file; it is normative, so it lives in `/docs/spec`, and the audit skill wraps it).

Write order (each blocks the next unless noted):

1. **steerable-apps.md** — the umbrella: terms, document map, conformance language (D2), the §6.4 table, what Steerable is/is not. Blocks everything.
2. **capability-declarations.md** — the core contract: `defineAction` / `defineReadTool` / `defineFacts` / `defineSurface`, registry model, "one declaration compiles into everything." Blocks all remaining specs.
3. **autonomy-policy.md** — risk/reversibility/effects vocabulary, autonomy ladder, policy engine, posture presets.
4. **context-ladder.md** (needs 2) and **execution-and-surfaces.md** (needs 3) — parallel.
5. **action-ledger.md** (needs 3; records policy decisions and undo handles).
6. **external-bridge.md** (needs 2+3) — written at **design level** in Stage 1: normative enough that declarations carry all door-two metadata from day one (§10 Stage 3: "generation work, not redesign"), with implementation explicitly deferred.
7. **conformance-checklist.md** — last; needs every spec doc plus the example app to sanity-check that every checklist item is checkable against a real integration.

Guides cite specs; skills distill guides + checklist; the retrofit skill is the capstone and comes last.

### D5 — Skill/kit format [normative for the kit]

Skills use the cross-vendor **Agent Skills standard** (`SKILL.md` + supporting files per skill directory), so they load in Claude Code, Codex, Cursor, and other agent harnesses without translation. Three skills in Stage 1: `retrofit` (the capstone — inventory a target codebase, propose and execute a minimal first integration), `integration-audit` (check an integration against the conformance checklist, citing requirement IDs), `eval-authoring` (write fixtures for a new integration). The **coding-agent handoff prompt** ships as a guide (`docs/guides/coding-agent-handoff.md`) — it's the paste-able one-paragraph front door, not itself a skill.

### D6 — Eval approach [repo now; format normative later]

**Fixture format now; harness later** (per the founding brief). Fixtures are YAML files with a documented JSON Schema, organized per north-star §9: `intent-routing/` (utterance + surface + facts → expected route class and action(s)+params), `policy-decisions/` (proposed action/chain + posture + context → expected ladder mode), `reversibility/` (action + executed state → expected undo behavior), `cross-surface/` (chain spanning surfaces → expected navigate/await/continue sequence).

Stage 1 ships the format spec, fixtures authored against the example app's registry, and a **thin deterministic runner** (Node script; runs the scripted router and the real policy engine from the example against fixtures; zero API calls; runs in CI). A live-model eval harness — the thing that answers "how small can the routing model be" (§14.2) — is deferred to Stage 2.

### D7 — What is explicitly deferred [repo]

`packages/{core,react,next,mcp}`; MCP bridge & tab-bridge implementation; AI-SDK/AG-UI adapters; hosted anything; runtime/product naming (§13); `examples/dashboard` and `examples/admin-lite`; live-model eval harness; CI beyond lint + example build + fixture runner. Each is deferred, not rejected — Stage 2/3 concerns, gated on Stage 1's outcome.

---

## Epics and sprints

Five epics (tracker labels in parentheses): **Spec** (`epic:spec`) · **Example** (`epic:example`) · **Kit** (`epic:kit` — guides, skills, conformance) · **Evals** (`epic:evals`) · **Meta** (`epic:meta` — scaffolding, research, essay, gate reviews).

Five sprints, each a GitHub milestone with a coherent theme and a natural stopping point. Dependencies are stated per issue ("blocked by #N"); anything not blocked within a sprint can run in parallel.

### Sprint 1 — The spine
*The repo becomes legible: scaffolding, the umbrella spec, the two core spec docs, the research grounding.* Every later agent lands in a repo whose structure and core contract already exist.
Contents: scaffolding + directory READMEs + CONTRIBUTING; `steerable-apps.md`; `capability-declarations.md`; `autonomy-policy.md`; `landscape-2026.md`.
**Stopping point:** the core contract (declarations + policy) is written and internally consistent.

### Sprint 2 — Full spec + example shell
*The remaining spec docs, the anti-pattern docs, and the example app's non-steerable shell.*
Contents: `context-ladder.md`; `execution-and-surfaces.md`; `action-ledger.md`; `external-bridge.md` (design level); six anti-pattern docs; `examples/design-studio` app shell (surfaces, domain state, UI — no steering yet).
**Stopping point:** the spec is complete end to end; a small real app exists to prove it against.

### Sprint 3 — The proving ground
*The example app becomes steerable; the spec survives contact with running code.*
Contents: inline proto-runtime; the example's capability declarations; the steering surface (intent input, scripted router, activity trail, undo); cross-surface execution + the two-posture demo; eval fixture format spec.
**Stopping point:** every spec concept is exercised in the running example; spec bugs found here are fixed in the spec docs (round-trip is mandatory, not optional).

### Sprint 4 — The kit
*Everything a coding agent needs to retrofit someone else's app.*
Contents: eval fixtures + thin runner; conformance checklist; retrofit + handoff guides; design + policy-template guides; integration-audit skill; eval-authoring skill.
**Stopping point:** the kit is complete except the capstone skill.

### Sprint 5 — Capstone and gate
*The retrofit skill, its live dry-run, the category essay, and the Stage-1 gate review.*
Contents: retrofit skill (distills everything); dry-run of the skill against an unrelated open-source app (the gate exercise); *agent-responsive design* essay; Stage-1 gate review + north-star v0.2 edits.
**Stopping point / gate:** the north-star §10 Stage-1 gate, exercised for real. Pass → open Stage 2 planning. No external signal → the work still fully serves Spec as documentation (the explicitly acceptable floor).

---

## Standing guardrails (inherited by every issue)

1. **No ceremony by default.** No deliverable — spec text, guide, example flow, fixture — may add approval steps, planning latency, or confirmation to `safe`+reversible actions as a default. Posture is a policy outcome (north-star §6, founding decision 1).
2. **One declaration, one source of truth.** If a fact about an action lives anywhere other than its declaration, that's a bug (§5).
3. **The model proposes; the runtime disposes** (§4.3).
4. **Written for agent execution.** Every guide/skill/checklist must be executable by a coding agent against an unfamiliar codebase; acceptance criteria must be observable (§4.8).
5. **Exercised against the example.** Spec claims that can be exercised in `examples/design-studio` must be; divergence between spec and example is a release blocker in whichever direction the north-star says is wrong.
6. **No premature packaging.** Nothing under `packages/`; the example's proto-runtime stays inline and unpublishable (§9, §11.6).
7. **Zero-cost validation by default.** Dev, CI, and eval runs make no model API calls; live-model anything is opt-in and out of Stage-1 scope (repo cost discipline).

---

# Stage-2 addendum (added 2026-07-09, after the Stage-1 gate PASSED — see docs/plan/stage1-gate-review.md)

Stage 1 closed with all 26 issues merged and the gate exercised for real (#24: PASS on re-run). Stage 2 per north-star §10: extract the smallest durable runtime, positioned as the policy-and-plan layer that rides on native tool calling / AI SDK / AG-UI — never a rival chat kit. Decisions:

### D8 — Package scope: core + react now; next deferred [repo, explicit divergence]
`packages/core` (framework-agnostic TS: registry, policy, execution, ledger interfaces, undo — the proto-runtime's proven seams `SurfaceReadiness`, `StateSnapshotAdapter`, `ApprovalHook` become core interfaces) and `packages/react` (provider, hooks, surface-registration binding). **`packages/next` is deferred** — divergence from §9's listing, with rationale: the repo has no Next.js consumer to prove a binding against, and building one means a second example app (overbuild risk, §11.6). The react binding must keep the router-integration seam thin enough that a next binding is later work, not redesign. `packages/mcp` remains Stage 3.

### D9 — The extraction proof is the example migration [normative for Stage 2]
`examples/design-studio` migrates from its inline proto-runtime to `packages/core` + `packages/react`, deleting the inline runtime. The Stage-2 gate: behavior identical — all 47 eval fixtures green through the canonical runner, the external-adapter path intact, the demo script unchanged. If migration forces API contortions, the packages are wrong, not the example.

### D10 — Ecosystem compile-down [normative for Stage 2]
Per §10/§12: policy compiles down to ecosystem primitives — a small adapter surface demonstrating Steerable policy resolution driving Vercel AI SDK `toolApproval`-style predicates and `canUseTool`-style callbacks. Mock-provider unit tests only (zero API calls); the claim proven is "adoption costs nothing for teams already inside those stacks."

### D11 — Tooling minimalism [repo]
npm workspaces; TypeScript project builds; vitest. **No npm publishing**, no changesets, no hosted anything — publishing is an owner decision after the Stage-2 gate. CI extends the existing workflow (build + tests + evals across workspaces).

### D12 — Stage-1 residue precedes extraction [repo]
Issues #41 (four spec-doc clarifications + unblocking the four pending SA-CONF items) and #55 (eval papercuts + a first-class facts/read-tools fixture kind) land before or alongside the first extraction PR — spec hygiene before code builds on it.

### Sprints
**Sprint 6 — Residue + core extraction start:** #41 fixes · #55 fixes · workspaces scaffolding + core registry/policy extraction.
**Sprint 7 — SDK completion:** core execution/ledger/undo · react bindings · design-studio migration (the D9 proof) · ecosystem adapters (D10) · Stage-2 gate review + front-door updates.
