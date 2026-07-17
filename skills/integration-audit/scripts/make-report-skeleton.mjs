#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(skillRoot, "..", "..");

const args = parseArgs(process.argv.slice(2));
const checklistPath = path.resolve(
  args.checklist ?? path.join(repoRoot, "docs/spec/conformance-checklist.md"),
);
const target = args.target ?? "<target-path>";
const output = args.output ? path.resolve(args.output) : undefined;

if (!fs.existsSync(checklistPath)) {
  fail(`Checklist not found: ${checklistPath}`);
}

const checklist = fs.readFileSync(checklistPath, "utf8");
const rows = parseChecklistRows(checklist);

if (rows.length !== 95) {
  fail(`Expected 95 SA-CONF rows from section 4, found ${rows.length}.`);
}

const report = renderReport({ target, checklistPath, rows });

if (output) {
  fs.writeFileSync(output, report);
} else {
  process.stdout.write(report);
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (item === "--checklist") {
      parsed.checklist = requireValue(argv, index, item);
      index += 1;
    } else if (item === "--target") {
      parsed.target = requireValue(argv, index, item);
      index += 1;
    } else if (item === "--output") {
      parsed.output = requireValue(argv, index, item);
      index += 1;
    } else if (item === "--help" || item === "-h") {
      process.stdout.write(helpText());
      process.exit(0);
    } else {
      fail(`Unknown argument: ${item}`);
    }
  }

  return parsed;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    fail(`Missing value for ${flag}`);
  }

  return value;
}

function parseChecklistRows(markdown) {
  const rows = [];
  let inSection = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## 4. Checklist Items")) {
      inSection = true;
      continue;
    }

    if (inSection && line.startsWith("## 5.")) {
      break;
    }

    if (!inSection || !line.startsWith("| **SA-CONF-")) {
      continue;
    }

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const id = cells[0]?.replace(/\*\*/g, "");
    const applies = cells[1];
    const severity = cells[2];
    const requirementIds = cells[4];

    if (!/^SA-CONF-\d{3}$/.test(id)) {
      fail(`Could not parse checklist row ID from line: ${line}`);
    }

    rows.push({ id, applies, severity, requirementIds });
  }

  // Section 4 is the checklist itself, so every row parsed from it is a checklist
  // item. SA-CONF-090 through SA-CONF-098 are framework/developer boundary
  // requirements in section 9 and are never reached by this parser.
  return rows;
}

function renderReport({ target, checklistPath, rows }) {
  const generatedAt = new Date().toISOString();
  const table = rows
    .map(
      (row) =>
        `| \`${row.id}\` | ${row.applies} | ${row.severity} | ${row.requirementIds} | TODO | TODO |`,
    )
    .join("\n");

  return `# Steerable Integration Audit Report

## Header

- target: ${target}
- audit_date: ${generatedAt}
- auditor: TODO
- claimed_conformance: TODO
- checklist_source: ${path.relative(process.cwd(), checklistPath)}
- anti_pattern_sources: docs/anti-patterns/*.md How to recognize it sections
- scope: TODO
- partial_coverage: TODO
- commands_run: TODO
- live_pass: TODO
- overall_verdict: TODO

## Integration Map

- registry: TODO
- declarations: TODO
- policy: TODO
- executors: TODO
- facts/read tools: TODO
- surfaces/liveness: TODO
- router/model bridge: TODO
- ledger: TODO
- undo/snapshot: TODO
- generated artifacts: TODO
- external bridge: TODO

## Live Pass Record

Run references/live-pass.md against the running target. No conformance claim without it.

- build_sha: TODO
- drive_channel: TODO
- datastore_identity: TODO
- datastore_authorization: TODO
- surface_inventory: TODO

| Check | Result | Channel | Artifact | Justification / Blocker |
| --- | --- | --- | --- | --- |
| \`LP-1\` every declared surface loads clean | TODO | TODO | TODO | TODO |
| \`LP-2\` action executes against a real datastore, undo reverses it | TODO | TODO | TODO | TODO |
| \`LP-3\` cross-surface continuation across a real navigation | TODO | TODO | TODO | TODO |
| \`LP-4\` published facts differ after a real UI change | TODO | TODO | TODO | TODO |
| \`LP-5\` first live model-routed request succeeds | TODO | TODO | TODO | TODO |

Artifact is what was observed, not an assertion that the code is correct.

## Findings

Use the fields in references/report-format.md. Sort by severity, then SA-CONF ID.

## Item Results

| Item | Applies | Severity | Requirement IDs | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
${table}

## Summary Counts

- Pass: TODO
- Fail: TODO
- Flag: TODO
- Not applicable: TODO
- Pending spec clarification: TODO
- Inconclusive: TODO
`;
}

function helpText() {
  return `Usage:
  node skills/integration-audit/scripts/make-report-skeleton.mjs --target <path> [--output <file>]

Options:
  --checklist <file>  Override docs/spec/conformance-checklist.md
  --target <path>     Target being audited
  --output <file>     Write report skeleton instead of stdout
`;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

