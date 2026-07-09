# `@steerable/core`

The Stage-2 core package compiles SA-DECL declarations into a framework-agnostic registry and resolves SA-POL policy as a pure function. It deliberately has no runtime dependencies, DOM imports, or React imports.

## Decisions recorded for issue #61

- Declarations use a small structural schema adapter (`parse`, with optional JSON Schema) so integrators may use their existing validator without making one library part of the SDK contract.
- `externalExposure` is materialized to `none` during compilation for actions and read tools; bridge eligibility is never inferred from risk or prose.
- The `creative-tool` mapping is retained exactly from the reference runtime: clean safe reversible actions are instant, while quota work reaches a gated suffix.
- Policy accepts registry availability and all mutable context as explicit inputs; resolving never calls executors, changes registry state, reads time implicitly, or performs I/O.
