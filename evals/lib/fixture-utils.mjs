/**
 * Shared fixture discovery, validation, loading, and matching for `run-fixtures.mjs`.
 * The runner accepts `--target=design-studio`, or external `--adapter` and `--fixtures` paths.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const suiteKinds = [
  "intent-routing",
  "policy-decisions",
  "reversibility",
  "cross-surface",
  "facts-context",
];

export const schemaFiles = [
  "common.schema.json",
  "intent-routing.schema.json",
  "policy-decisions.schema.json",
  "reversibility.schema.json",
  "cross-surface.schema.json",
  "facts-context.schema.json",
];

export const schemaByKind = new Map([
  ["intent-routing", "intent-routing.schema.json"],
  ["policy-decisions", "policy-decisions.schema.json"],
  ["reversibility", "reversibility.schema.json"],
  ["cross-surface", "cross-surface.schema.json"],
  ["facts-context", "facts-context.schema.json"],
]);

export function createValidator(evalsDir) {
  const Ajv = loadAjv();
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schemasDir = path.join(evalsDir, "schemas");

  for (const file of schemaFiles) {
    const schemaPath = path.join(schemasDir, file);
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    ajv.addSchema(schema, file);
  }

  return ajv;
}

function loadAjv() {
  try {
    const require = createRequire(import.meta.url);
    const module = require("ajv");

    return module.default ?? module;
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.code ?? error.name})` : "";

    throw new Error(
      `Missing evals dependency "ajv"${detail}. ` +
        "Run `npm ci --prefix evals` from the Steerable checkout before " +
        "validating or running fixtures.",
    );
  }
}

export function findYamlFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findYamlFiles(entryPath));
    } else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

export function findFixtureFiles(evalsDir, { includeSamples = true } = {}) {
  return suiteKinds
    .flatMap((kind) => findYamlFiles(path.join(evalsDir, kind)))
    .filter((file) => includeSamples || !file.split(path.sep).includes("samples"))
    .sort();
}

export function loadFixture(file) {
  return parseYamlSubset(fs.readFileSync(file, "utf8"));
}

export function validateFixture(ajv, fixture) {
  const schemaId = schemaByKind.get(fixture?.kind);

  if (!schemaId) {
    return {
      ok: false,
      errors: [{ instancePath: "/", message: `unknown kind ${JSON.stringify(fixture?.kind)}` }],
    };
  }

  const validate = ajv.getSchema(schemaId);

  if (!validate(fixture)) {
    return {
      ok: false,
      errors: validate.errors ?? [],
    };
  }

  return { ok: true, errors: [] };
}

function parseScalar(rawValue) {
  const value = rawValue.trim();

  if (value === "{}") return {};
  if (value === "[]") return [];
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) return Number(value);

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function splitKeyValue(text, lineNumber) {
  const index = text.indexOf(":");

  if (index === -1) {
    throw new Error(`Line ${lineNumber}: expected "key: value"`);
  }

  const key = text.slice(0, index).trim();

  if (!key) {
    throw new Error(`Line ${lineNumber}: missing key`);
  }

  return [key, text.slice(index + 1).trim()];
}

function preprocessYaml(text) {
  return text
    .split(/\r?\n/)
    .map((raw, index) => ({
      lineNumber: index + 1,
      indent: raw.match(/^ */)[0].length,
      text: raw.trim(),
    }))
    .filter((line) => line.text && !line.text.startsWith("#"));
}

export function parseYamlSubset(text) {
  const lines = preprocessYaml(text);

  function parseBlock(index, indent) {
    if (index >= lines.length || lines[index].indent < indent) {
      return [undefined, index];
    }

    if (lines[index].indent !== indent) {
      throw new Error(
        `Line ${lines[index].lineNumber}: expected indent ${indent}, found ${lines[index].indent}`,
      );
    }

    if (lines[index].text.startsWith("- ")) {
      return parseSequence(index, indent);
    }

    return parseMapping(index, indent);
  }

  function assignMappingEntry(target, textValue, index, childIndent) {
    const [key, rawValue] = splitKeyValue(textValue, lines[index].lineNumber);

    if (rawValue) {
      target[key] = parseScalar(rawValue);
      return index + 1;
    }

    const [nested, nextIndex] = parseBlock(index + 1, childIndent);
    target[key] = nested ?? {};
    return nextIndex;
  }

  function parseMapping(index, indent) {
    const object = {};

    while (index < lines.length) {
      const line = lines[index];

      if (line.indent < indent) break;
      if (line.indent !== indent || line.text.startsWith("- ")) break;

      index = assignMappingEntry(object, line.text, index, indent + 2);
    }

    return [object, index];
  }

  function parseSequence(index, indent) {
    const array = [];

    while (index < lines.length) {
      const line = lines[index];

      if (line.indent < indent) break;
      if (line.indent !== indent || !line.text.startsWith("- ")) break;

      const itemText = line.text.slice(2).trim();

      if (!itemText) {
        const [nested, nextIndex] = parseBlock(index + 1, indent + 2);
        array.push(nested);
        index = nextIndex;
        continue;
      }

      if (!isQuotedScalar(itemText) && looksLikeInlineMapping(itemText)) {
        const object = {};
        index = assignMappingEntry(object, itemText, index, indent + 2);

        if (index < lines.length && lines[index].indent === indent + 2) {
          const [more, nextIndex] = parseMapping(index, indent + 2);
          Object.assign(object, more);
          index = nextIndex;
        }

        array.push(object);
        continue;
      }

      array.push(parseScalar(itemText));
      index += 1;
    }

    return [array, index];
  }

  if (lines.length === 0) {
    return {};
  }

  const [document, nextIndex] = parseBlock(0, lines[0].indent);

  if (nextIndex !== lines.length) {
    throw new Error(`Line ${lines[nextIndex].lineNumber}: unexpected content`);
  }

  return document;
}

function isQuotedScalar(value) {
  return (
    (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
  );
}

function looksLikeInlineMapping(value) {
  const index = value.indexOf(":");

  return index !== -1 && (index === value.length - 1 || value[index + 1] === " ");
}

export function formatValidationErrors(errors) {
  return errors
    .map((error) => {
      const location = error.instancePath || "/";
      return `  ${location} ${error.message}`;
    })
    .join("\n");
}
