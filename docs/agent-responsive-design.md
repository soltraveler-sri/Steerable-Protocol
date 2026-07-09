# Agent-Responsive Design

Responsive design began with a simple concession: people were no longer arriving at software through one kind of screen.

The web did not need a prettier fixed-width canvas. It needed a discipline for adapting to a new class of devices. Layout, navigation, density, and interaction all had to respond to the conditions of use.

Software is at the same point again, but the new class is not a device. It is a user.

Agents are beginning to act on humans' behalf. They read screens, operate browsers, call tools, compare options, fill forms, ask follow-up questions, and carry intent across products. Some are embedded inside apps. Some arrive from outside: a browser agent, an IDE agent, a chat assistant, a workflow runner. Either way, the question for product teams is no longer whether an agent will touch the product. The question is whether the product gives that agent a good way to touch it.

Agent-responsive design is the discipline of making an application legible and operable to agents on the application's own terms.

It does not mean replacing the interface with chat. It does not mean letting a model click around the DOM like a distracted intern. It means the product declares what it can actually do, which actions are safe, which actions are expensive or destructive, what context is available, how execution is shown, and how mistakes are undone.

The app remains in charge. The agent becomes useful.

## The failure everyone recognizes

Most "AI in the app" work still lands in one of a few unsatisfying shapes.

There is the assistant that can explain the product but cannot operate it. You ask it to update the dashboard, change the template, or prepare the campaign. It replies with instructions. The answer is accurate, polite, and useless: "Open settings, then click..." The burden has moved from search to obedience.

There is the copilot bolted beside the product. It has a chat box, streaming text, maybe a few tools. But it feels like a second application looking in through the window. It can help with the current component, then loses the thread when the user navigates. The product has an AI feature; the product has not become steerable.

There is the browser agent driving the interface from the outside. It sees pixels, clicks buttons, waits for pages, guesses what changed, and tries again. When it works, it feels uncanny. When it fails, it fails like a person with no product memory and too much patience. It is slow because the app made the agent behave like a human. It is fragile because the app never told the agent what its real controls mean.

There is the external tool surface that lives somewhere else. The MCP server can create, query, or update things, but the in-app assistant has its own separate tools and policy. Over time the names drift, the permissions drift, the behavior drifts, and nobody knows which door represents the product's truth.

And there is the raw model SDK wrapper: schemas, function calls, streaming, approvals, traces. Important plumbing. Not the product contract. Tool calling tells a model how to request an operation. It does not tell a product which operations should exist, when they may run, what should be visible, or how trust is recovered after a mistake.

These are not foolish attempts. They are natural first drafts. They all fail at the same boundary: the product has not declared itself as something an agent can safely operate.

## The forcing function

Browser and computer-use agents are not the enemy. They are the forcing function.

OpenAI, Anthropic, and Google now ship agents that can inspect screens and use computers or browsers. Benchmarks keep improving: OSWorld-Verified currently tops out at 83.6% on its verified leaderboard. At the same time, real web and desktop work remains expensive in motion. Current research still shows agents taking multiples of the necessary steps on computer tasks, and long-horizon workflows can run to hundreds of tool calls.

That is the shape of the pressure. Agents can already operate software through the outer shell. They will keep getting better at it. If your app publishes nothing else, agents will steer it anyway: through pixels, screenshots, accessibility trees, selectors, and page text.

That is not a security strategy. It is an abdication of product design.

The better answer is not to block agents and hope the browser goes away. The better answer is to publish a typed, gated action surface so agents can steer the app well. Let the app say: here are the actions that exist; here is the state you may read; here is what this action changes; here is whether it is reversible; here is when approval is required; here is the trusted executor that actually performs the change.

Responsive design did not defeat mobile browsers. It made websites stop pretending every visitor had a desktop monitor. Agent-responsive design does the same for agents: it accepts the new mode of use, then shapes it into a product-quality experience.

## What it feels like when it works

The reference experience for this project is [Spec](https://design-spec.xyz), a website mockup builder. Spec is not proof that the whole category is solved. It is proof that the experience has a center of gravity.

In Spec, a user can type a short intent: "build a wireframe for an organic coffee shop," "use these two brand colors," "compare three directions." The assistant turns that intent into app-owned actions: set the brief, change palette values, switch templates, navigate to a lab view, trigger a build.

The important part is not that there is a chat box. The important part is the loop.

Intent becomes actions. Actions become a visible result. The loop closes in roughly two to five seconds. The user reacts to the outcome instead of approving the machinery. If the result is a little wrong, the next instruction is cheap: "make it calmer," "try a darker accent," "go back to the second one."

Spec gates the actions whose nature demands it. Spending a daily build quota or destroying work is different from changing a color, opening a panel, or applying a reversible layout choice. The product does not ask permission for every harmless step just because a model suggested it. That kind of universal approval habit feels responsible, but in most apps it is safety theater. It kills the product while pretending to protect it.

The reason instant action can be safe is not optimism. It is mechanism. The app knows which actions are reversible. It can show what ran. It can undo the change. It can stop at the first costly or destructive boundary. Speed and safety are not enemies when policy is specific.

Speed is the soul. Safety is policy, not ceremony.

## The answer is a product contract

An agent-responsive app starts by declaring capabilities.

Not vague "tools." Not prompt-only instructions. Capabilities: the real actions the product already knows how to perform. Set this field. Apply this theme. Move this item. Create this report. Navigate to this surface. Start this generation. Send this message.

Each capability carries the facts an agent and runtime need to use it responsibly: its inputs, the state it reads, the state it writes, its risk, its reversibility, its cost, its sensitivity, and the conditions under which it is available.

The model proposes. The runtime disposes.

That line matters. A model can infer that the user wants the accent color changed and propose the action with parameters. It should not get direct authority to mutate product state. The app-owned runtime validates the proposal against declared capabilities and policy, then calls trusted product code. The mutation path belongs to the application.

This shifts safety out of vibes and into design.

For many actions in many products, the right answer is instant execution with undo. If the user says "make the accent forest green," the app should do it, show that it did it, and make reversal obvious. Asking the user to approve a plan for a reversible color change is not prudence. It is latency wearing a badge.

For actions that spend money, consume scarce quota, expose sensitive data, publish externally, or destroy work, the runtime should slow down. But the gate appears because of the action's nature, the user's role, the current surface, and the app's policy. Not because "AI took an action" is treated as one universal risk bucket.

Reversibility is the hinge. If undo is real, autonomy can rise. If undo is impossible, policy should become stricter. An agent-responsive product does not merely label something reversible. It provides a way back: an undo handler, a captured snapshot, a compensating action, or a visible handoff when none of those is honest.

The visible experience should be boring in the best way. A short activity trail. A clear pause at policy boundaries. One apply action for a gated plan, not a modal interrogation for every internal step. A result the user can inspect. A recovery path they can trust.

## Two doors

There are two natural doors into the same product.

Door one is the app's own assistant: chat panel, command palette, inline intent bar, voice surface, or whatever interface fits the product. The user stays inside the product. The agent operates declared capabilities under the product's policy.

Door two is the outside agent: Claude, ChatGPT, an IDE agent, a browser agent, or a workflow tool that would rather call a typed capability than scrape a screen. MCP and MCP Apps make this direction increasingly real, with MCP Apps scheduled as an official MCP extension in the 2026-07-28 MCP release.

The mistake is building those doors separately.

If the in-app assistant has one action schema and the external agent server has another, the product now has two truths. They will diverge. Policy will be reviewed in one place and bypassed in another. Users will learn that the same request behaves differently depending on where it entered.

Agent-responsive design points to one registry serving both doors. The same declared capability can power the in-app experience and, when the product chooses, an external agent surface. External callers should not get a lower bar than the product's own assistant. They should get the same policy, the same trusted execution path, and the same reversibility story.

The future is not every product hiding inside someone else's chat window. It is not every product bolting on its own isolated bot either. It is products publishing the right operating surface for agents, then deciding which doors may use it.

## What to do now

The category is bigger than any one spec. Agent-responsive design is the claim that products need to adapt to agents as a real class of users. Even if you never adopt Steerable, you can use the question tomorrow:

If an agent tried to operate your product on behalf of a user, would it find a product-owned action surface, or would it be forced back to pixels and prose?

Steerable is one attempt to make that discipline concrete: declared capabilities, risk-aware policy, trusted execution, reversibility, and two doors into one registry.

It is early. There are no installable packages yet. The current work is a design/spec stage, with a working reference experience, normative docs, guides, skills, examples, and evaluation material. That is intentional. The contract has to be sharp before the runtime deserves a package name.

If this framing lands, do three things.

Read the [Steerable spec](https://github.com/soltraveler-sri/Steerable-Protocol/blob/main/docs/spec/steerable-apps.md). Run or inspect the [example](https://github.com/soltraveler-sri/Steerable-Protocol/tree/main/examples). Then point your coding agent at the [Steerable repo](https://github.com/soltraveler-sri/Steerable-Protocol) and your own app, and ask it a concrete question: "What would it take to make this product agent-responsive?"

You do not have to believe in anyone's framework to believe in the category.

Agents are becoming users of software. Product teams should stop giving them only a screen.
