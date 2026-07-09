# Coverage Summary Template

Emit this summary after validation and runner execution. Keep it short enough to paste into an issue or PR.

```text
target:
  integrationId: <target>
  registry: <id>@<version>
  ref: <ref>

existingSuite:
  scannedFixtureCount: <number>
  duplicateCandidatesSkipped:
    - <candidate id or purpose>: <why it was skipped>

coverage:
  surfaces:
    <surface id>: <fixture ids>
  routeClasses:
    answer: <fixture ids or n/a>
    single action: <fixture ids or n/a>
    action chain: <fixture ids or n/a>
    workflow needing the loop: <fixture ids or n/a, with reason>
    clarification: <fixture ids or n/a>
    refusal/handoff: <fixture ids or n/a>
  policyMatrix:
    <posture>/<risk>: <fixture ids>
  reversibility:
    undoable inverse: <fixture ids>
    snapshot restore: <fixture ids>
    irreversible disclosure/refusal: <fixture ids>
    undo-all ordering: <fixture ids>
    partial undo: <fixture ids>
  crossSurface:
    success paths: <fixture ids>
    failure paths: <fixture ids>
  mandatoryNegatives:
    clarification: <fixture ids>
    refusal: <fixture ids>
    policy-denial: <fixture ids>
    undo-refusal: <fixture ids>

novelFixtures:
  added: <number>
  ids:
    - <id>: <cell pinned>

secondRun:
  result: <nothing-new | added-uncovered-cells>
  reason: <coverage already met or uncovered cells listed>
```

Use `n/a` only when the target does not ship the behavior, route class, posture, or mechanism.
