import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createValidator,
  findFixtureFiles,
  formatValidationErrors,
  loadFixture,
  validateFixture,
} from "./lib/fixture-utils.mjs";

const evalsDir = path.dirname(fileURLToPath(import.meta.url));
const ajv = createValidator(evalsDir);
const fixtureFiles = findFixtureFiles(evalsDir, { includeSamples: true });
let failed = 0;

for (const file of fixtureFiles) {
  const rel = path.relative(evalsDir, file);
  let fixture;

  try {
    fixture = loadFixture(file);
  } catch (error) {
    failed += 1;
    console.error(`${rel}: YAML parse failed`);
    console.error(error instanceof Error ? error.message : String(error));
    continue;
  }

  const result = validateFixture(ajv, fixture);

  if (!result.ok) {
    failed += 1;
    console.error(`${rel}: schema validation failed`);
    console.error(formatValidationErrors(result.errors));
  } else {
    console.log(`${rel}: ok`);
  }
}

if (fixtureFiles.length === 0) {
  console.error("No fixture files found.");
  process.exit(1);
}

if (failed > 0) {
  console.error(`${failed} fixture file(s) failed validation.`);
  process.exit(1);
}

console.log(`${fixtureFiles.length} fixture file(s) validated.`);
