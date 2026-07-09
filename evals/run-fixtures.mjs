import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  createValidator,
  findFixtureFiles,
  formatValidationErrors,
  loadFixture,
  suiteKinds,
  validateFixture,
} from "./lib/fixture-utils.mjs";

const evalsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(evalsDir, "..");
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const targetName = targetArg ? targetArg.slice("--target=".length) : "design-studio";
const ajv = createValidator(evalsDir);

const quarantines = loadQuarantines();
const adapter = await loadAdapter(targetName);
const fixtureFiles = findFixtureFiles(evalsDir, { includeSamples: false });
const summaries = new Map(
  suiteKinds.map((kind) => [
    kind,
    { total: 0, passed: 0, failed: 0, quarantined: 0 },
  ]),
);
let failures = 0;

for (const file of fixtureFiles) {
  const rel = path.relative(evalsDir, file);
  let fixture;

  try {
    fixture = loadFixture(file);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${rel}: YAML parse failed`);
    console.error(error instanceof Error ? error.message : String(error));
    continue;
  }

  const validation = validateFixture(ajv, fixture);

  if (!validation.ok) {
    failures += 1;
    console.error(`FAIL ${rel}: schema validation failed`);
    console.error(formatValidationErrors(validation.errors));
    continue;
  }

  if (fixture.sample?.isSample) {
    continue;
  }

  const quarantine = quarantines.get(fixture.id);
  const summary = summaries.get(fixture.kind);

  if (summary) {
    summary.total += 1;
  }

  try {
    assertTarget(adapter.target, fixture.target);
    const actual = await executeFixture(adapter, fixture);
    assertFixture(fixture, actual);

    if (quarantine) {
      failures += 1;
      summary.failed += 1;
      console.error(`FAIL ${fixture.kind}/${fixture.id}: quarantine is stale`);
      console.error(`  linked issue: ${quarantine.issueUrl}`);
      console.error("  fixture now passes; remove it from evals/quarantined-fixtures.json");
      continue;
    }

    summary.passed += 1;
    console.log(`PASS ${fixture.kind}/${fixture.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (quarantine) {
      summary.quarantined += 1;
      console.log(`QUARANTINED ${fixture.kind}/${fixture.id}`);
      console.log(`  ${message.replace(/\n/g, "\n  ")}`);
      console.log(`  linked issue: ${quarantine.issueUrl}`);
      continue;
    }

    failures += 1;
    summary.failed += 1;
    console.error(`FAIL ${fixture.kind}/${fixture.id}`);
    console.error(`  ${message.replace(/\n/g, "\n  ")}`);
  }
}

for (const [kind, summary] of summaries) {
  console.log(
    `${kind}: ${summary.passed}/${summary.total} passed` +
      (summary.quarantined ? `, ${summary.quarantined} quarantined` : ""),
  );
}

if (failures > 0) {
  console.error(`${failures} unquarantined fixture failure(s).`);
  process.exit(1);
}

console.log("All unquarantined fixtures passed.");

async function executeFixture(adapter, fixture) {
  if (fixture.kind === "intent-routing") {
    return adapter.route(fixture);
  }

  if (fixture.kind === "policy-decisions") {
    return adapter.resolve(fixture);
  }

  if (fixture.kind === "reversibility") {
    return adapter.undo(fixture);
  }

  if (fixture.kind === "cross-surface") {
    return adapter.execute(fixture);
  }

  throw new Error(`Unsupported fixture kind ${fixture.kind}`);
}

async function loadAdapter(target) {
  if (target !== "design-studio") {
    throw new Error(`Unsupported target "${target}". Only "design-studio" is wired.`);
  }

  const vitePath = path.join(
    repoRoot,
    "examples/design-studio/node_modules/vite/dist/node/index.js",
  );

  if (!fs.existsSync(vitePath)) {
    throw new Error(
      "Missing examples/design-studio dependencies. Run `npm --prefix examples/design-studio ci` before evals.",
    );
  }

  const { build } = await import(pathToFileURL(vitePath));
  const exampleDir = path.join(repoRoot, "examples/design-studio");
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "steerable-evals-"));
  const outfile = path.join(outdir, "design-studio-adapter.mjs");
  const entryPoint = path.join(
    repoRoot,
    "examples/design-studio/src/steerable/evalAdapter.ts",
  );

  try {
    await build({
      root: exampleDir,
      configFile: path.join(exampleDir, "vite.config.ts"),
      logLevel: "silent",
      ssr: {
        noExternal: true,
      },
      build: {
        ssr: entryPoint,
        outDir: outdir,
        emptyOutDir: true,
        target: "node22",
        rollupOptions: {
          output: {
            format: "esm",
            entryFileNames: "design-studio-adapter.mjs",
          },
        },
      },
    });

    if (!fs.existsSync(outfile)) {
      throw new Error(`Adapter bundle was not emitted at ${outfile}`);
    }

    const module = await import(pathToFileURL(outfile));
    const createAdapter = module.default ?? module.createDesignStudioEvalAdapter;

    return createAdapter();
  } finally {
    fs.rmSync(outdir, { recursive: true, force: true });
  }
}

function loadQuarantines() {
  const file = path.join(evalsDir, "quarantined-fixtures.json");

  if (!fs.existsSync(file)) {
    return new Map();
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const entries = Array.isArray(parsed.fixtures) ? parsed.fixtures : [];

  return new Map(entries.map((entry) => [entry.id, entry]));
}

function assertTarget(actual, expected) {
  assertEqual("target.integrationId", expected.integrationId, actual.integrationId);
  assertEqual("target.registry.id", expected.registry.id, actual.registry.id);
  assertEqual("target.registry.version", expected.registry.version, actual.registry.version);
  assertEqual("target.registry.ref", expected.registry.ref, actual.registry.ref);
}

function assertFixture(fixture, actual) {
  if (fixture.kind === "intent-routing") {
    assertIntentFixture(fixture.expected, actual);
  } else if (fixture.kind === "policy-decisions") {
    assertPolicyFixture(fixture.expected, actual);
  } else if (fixture.kind === "reversibility") {
    assertReversibilityFixture(fixture.expected, actual);
  } else if (fixture.kind === "cross-surface") {
    assertCrossSurfaceFixture(fixture.expected, actual);
  }
}

function assertIntentFixture(expected, actual) {
  assertEqual("expected.routeClass", expected.routeClass, actual.routeClass);
  assertEqual("expected.negativeCase", expected.negativeCase, actual.negativeCase);

  if (expected.actions) {
    assertEqual("expected.actions.length", expected.actions.length, actual.actions?.length ?? 0);

    expected.actions.forEach((expectedAction, index) => {
      const actualAction = actual.actions[index];
      assertEqual(`actions[${index}].actionId`, expectedAction.actionId, actualAction?.actionId);

      if (expectedAction.surfaceId) {
        assertEqual(
          `actions[${index}].surfaceId`,
          expectedAction.surfaceId,
          actualAction?.surfaceId,
        );
      }

      if (expectedAction.params) {
        assertParams(`actions[${index}].params`, expectedAction.params, actualAction?.params ?? {});
      }
    });
  }

  if (expected.readTools) {
    assertDeepEqual("expected.readTools", expected.readTools, actual.readTools ?? []);
  }

  if (expected.answer?.messageContains) {
    assertContainsAll("answer.message", actual.answer?.message ?? "", expected.answer.messageContains);
  }

  if (expected.clarification) {
    const missing = actual.clarification?.missing ?? [];

    expected.clarification.missing.forEach((item) => {
      if (!missing.includes(item.field)) {
        throw new Error(diff(`clarification missing ${item.field}`, item.field, missing));
      }
    });
  }

  if (expected.refusal) {
    assertDisclosure("refusal", expected.refusal, actual.refusal);
  }
}

function assertPolicyFixture(expected, actual) {
  assertEqual("expected.negativeCase", expected.negativeCase, actual.negativeCase);

  if (expected.chainMode) {
    assertEqual("expected.chainMode", expected.chainMode, actual.chainMode);
  }

  expected.steps.forEach((expectedStep) => {
    const actualStep = actual.steps.find((step) => step.stepId === expectedStep.stepId);

    if (!actualStep) {
      throw new Error(`Missing policy step ${expectedStep.stepId}`);
    }

    assertEqual(`${expectedStep.stepId}.actionId`, expectedStep.actionId, actualStep.actionId);
    assertEqual(
      `${expectedStep.stepId}.resolvedMode`,
      expectedStep.resolvedMode,
      actualStep.resolvedMode,
    );

    if (expectedStep.reasonCodes) {
      assertArrayIncludesAll(
        `${expectedStep.stepId}.reasonCodes`,
        actualStep.reasonCodes,
        expectedStep.reasonCodes,
      );
    }
  });

  if (expected.boundaries) {
    for (const key of Object.keys(expected.boundaries)) {
      assertEqual(`boundaries.${key}`, expected.boundaries[key], actual.boundaries?.[key]);
    }
  }

  if (expected.denial) {
    assertDisclosure("denial", expected.denial, actual.denial);
  }

  if (expected.rationaleMustInclude) {
    assertContainsAll("rationale", actual.rationaleText ?? "", expected.rationaleMustInclude);
  }
}

function assertReversibilityFixture(expected, actual) {
  assertEqual("expected.negativeCase", expected.negativeCase, actual.negativeCase);
  assertEqual("expected.undoOutcome", expected.undoOutcome, actual.undoOutcome);

  if (expected.order) {
    assertDeepEqual("expected.order", expected.order, actual.order ?? []);
  }

  expected.stepResults.forEach((expectedStep) => {
    const actualStep = actual.stepResults.find((step) => step.stepId === expectedStep.stepId);

    if (!actualStep) {
      throw new Error(`Missing undo step result ${expectedStep.stepId}`);
    }

    assertEqual(`${expectedStep.stepId}.result`, expectedStep.result, actualStep.result);

    if (expectedStep.disclosure) {
      assertDisclosure(`${expectedStep.stepId}.disclosure`, expectedStep.disclosure, actualStep.disclosure);
    }
  });

  if (expected.disclosure) {
    assertDisclosure("disclosure", expected.disclosure, actual.disclosure);
  }
}

function assertCrossSurfaceFixture(expected, actual) {
  assertEqual("expected.negativeCase", expected.negativeCase, actual.negativeCase);
  assertDeepEqual("expected.sequence", expected.sequence, actual.sequence);

  if (expected.failure) {
    assertDisclosure("failure", expected.failure, actual.failure);
  }

  if (expected.preservedUndoStepIds) {
    assertDeepEqual(
      "expected.preservedUndoStepIds",
      expected.preservedUndoStepIds,
      actual.preservedUndoStepIds ?? [],
    );

    if (actual.prefixUndo && actual.prefixUndo.status !== "succeeded") {
      throw new Error(diff("prefixUndo.status", "succeeded", actual.prefixUndo.status));
    }
  }

  if (expected.notExecutedStepIds) {
    assertDeepEqual(
      "expected.notExecutedStepIds",
      expected.notExecutedStepIds,
      actual.notExecutedStepIds ?? [],
    );
  }
}

function assertDisclosure(label, expected, actual) {
  if (!actual) {
    throw new Error(`${label}: missing actual disclosure`);
  }

  assertEqual(`${label}.reasonCode`, expected.reasonCode, actual.reasonCode);
  assertContainsAll(`${label}.message`, actual.message ?? "", expected.messageContains);
}

function assertParams(label, expected, actual) {
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected.fields);

  for (const key of expectedKeys) {
    if (!matchValue(expected.fields[key], actual[key])) {
      throw new Error(diff(`${label}.${key}`, expected.fields[key], actual[key]));
    }
  }

  if (!expected.allowExtra) {
    const extra = actualKeys.filter((key) => !expectedKeys.includes(key));

    if (extra.length > 0) {
      throw new Error(diff(`${label}.extraKeys`, [], extra));
    }
  }
}

function matchValue(matcher, actual) {
  if (matcher.kind === "exact") {
    return deepEqual(matcher.value, actual);
  }

  if (matcher.kind === "oneOf") {
    return matcher.values.some((value) => deepEqual(value, actual));
  }

  if (matcher.kind === "caseInsensitive") {
    return typeof actual === "string" && actual.toLowerCase() === matcher.value.toLowerCase();
  }

  if (matcher.kind === "numericTolerance") {
    return (
      typeof actual === "number" &&
      Math.abs(actual - matcher.value) <= matcher.tolerance
    );
  }

  if (matcher.kind === "arrayUnordered") {
    return (
      Array.isArray(actual) &&
      sortedJson(actual).join("\n") === sortedJson(matcher.values).join("\n")
    );
  }

  return false;
}

function assertEqual(label, expected, actual) {
  if (expected !== actual) {
    throw new Error(diff(label, expected, actual));
  }
}

function assertDeepEqual(label, expected, actual) {
  if (!deepEqual(expected, actual)) {
    throw new Error(diff(label, expected, actual));
  }
}

function assertArrayIncludesAll(label, actual, expectedValues) {
  for (const expected of expectedValues) {
    if (!actual.includes(expected)) {
      throw new Error(diff(label, expectedValues, actual));
    }
  }
}

function assertContainsAll(label, actual, fragments) {
  for (const fragment of fragments) {
    if (!actual.includes(fragment)) {
      throw new Error(diff(label, `contains ${fragment}`, actual));
    }
  }
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sortedJson(value) {
  return value.map((item) => JSON.stringify(item)).sort();
}

function diff(label, expected, actual) {
  return `${label}\nexpected: ${JSON.stringify(expected, null, 2)}\nactual: ${JSON.stringify(actual, null, 2)}`;
}
