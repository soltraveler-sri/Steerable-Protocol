import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const evalsDir = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.join(evalsDir, "schemas");

const schemaFiles = [
  "common.schema.json",
  "intent-routing.schema.json",
  "policy-decisions.schema.json",
  "reversibility.schema.json",
  "cross-surface.schema.json",
];

const ajv = new Ajv({ allErrors: true, strict: false });

for (const file of schemaFiles) {
  const schemaPath = path.join(schemasDir, file);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  ajv.addSchema(schema, file);
}

const schemaByKind = new Map([
  ["intent-routing", "intent-routing.schema.json"],
  ["policy-decisions", "policy-decisions.schema.json"],
  ["reversibility", "reversibility.schema.json"],
  ["cross-surface", "cross-surface.schema.json"],
]);

function findYamlFiles(dir) {
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

function parseScalar(rawValue) {
  const value = rawValue.trim();
  if (value === "{}") return {};
  if (value === "[]") return [];
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) return Number(value);

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
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

function parseYamlSubset(text) {
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

      if (itemText.includes(":")) {
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

const fixtureFiles = [
  "intent-routing",
  "policy-decisions",
  "reversibility",
  "cross-surface",
].flatMap((kind) => findYamlFiles(path.join(evalsDir, kind, "samples")));

let failed = 0;

for (const file of fixtureFiles) {
  const rel = path.relative(evalsDir, file);
  let fixture;

  try {
    fixture = parseYamlSubset(fs.readFileSync(file, "utf8"));
  } catch (error) {
    failed += 1;
    console.error(`${rel}: YAML parse failed`);
    console.error(error.message);
    continue;
  }

  const schemaId = schemaByKind.get(fixture?.kind);
  if (!schemaId) {
    failed += 1;
    console.error(`${rel}: unknown kind ${JSON.stringify(fixture?.kind)}`);
    continue;
  }

  const validate = ajv.getSchema(schemaId);
  if (!validate(fixture)) {
    failed += 1;
    console.error(`${rel}: schema validation failed`);
    for (const error of validate.errors ?? []) {
      const location = error.instancePath || "/";
      console.error(`  ${location} ${error.message}`);
    }
  } else {
    console.log(`${rel}: ok`);
  }
}

if (fixtureFiles.length === 0) {
  console.error("No sample fixtures found.");
  process.exit(1);
}

if (failed > 0) {
  console.error(`${failed} fixture file(s) failed validation.`);
  process.exit(1);
}

console.log(`${fixtureFiles.length} fixture file(s) validated.`);
