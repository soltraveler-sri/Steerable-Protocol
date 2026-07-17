#!/usr/bin/env node
// MUST-coverage gate for the Steerable Apps conformance checklist.
//
// Why this exists: section 5 of `docs/spec/conformance-checklist.md` used to
// assert MUST coverage as hand-maintained prose ranges (e.g. "SA-LED-070-077")
// while the section-4 checklist items cite individual requirement IDs. Nothing
// reconciled the two, so the range prose could claim "covers every MUST" while
// a specific behavioral MUST (this is exactly how SA-LED-077 slipped through)
// was cited by no item at all. A hand-typed range cannot detect its own gaps.
//
// This script replaces that self-certified claim with a computed one:
//   1. Extract every MUST-bearing requirement ID from docs/spec/*.md.
//   2. Extract every requirement ID cited by a section-4 checklist item.
//   3. Diff them. A MUST-bearing ID cited by no item is an orphan.
//   4. Orphans are only tolerated if they appear on the reviewed allowlist
//      below (spec-authoring conventions + explicitly-tracked behavioral gaps).
//      Any other orphan fails the gate. A new MUST added without a citing
//      item therefore turns CI red until an item cites it or the allowlist is
//      consciously amended.
//
// Usage:
//   node skills/integration-audit/scripts/check-coverage.mjs           # gate (CI)
//   node skills/integration-audit/scripts/check-coverage.mjs --matrix  # full ID -> item(s) traceability matrix
//   node skills/integration-audit/scripts/check-coverage.mjs --json    # machine-readable summary
//
// Exit code is 0 only when every MUST-bearing ID is either cited or allowlisted
// AND the allowlist has no stale entries.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..", "..");
const specDir = path.join(repoRoot, "docs/spec");
const checklistPath = path.join(specDir, "conformance-checklist.md");

// A requirement is DECLARED by a colon-terminated bold ID at the head of its
// line: `**SA-<DOC>-<NNN>:**`. This is the suite's own convention (SA-CORE-004)
// and is how every requirement in docs/spec/*.md is written. Citations and the
// framework/developer boundary tables use the non-colon form `**SA-...**`, which
// this pattern deliberately does not match.
const DECLARATION_RE = /\*\*(SA-[A-Z]+-\d{3}):\*\*/;

// A declaration is MUST-bearing when its own line carries the RFC 2119 keyword
// MUST (which also covers "MUST NOT"). SHOULD/MAY/definition-only requirements
// are out of scope for this gate. Word boundaries keep it from matching
// lowercase prose or substrings. This reproduces the section-5 authors' own
// methodology: e.g. SA-DECL-034 and SA-DECL-093 (non-conformant phrasing, no
// uppercase MUST) are excluded here exactly as they are excluded in section 5.
const MUST_RE = /\bMUST\b/;

const ID_TOKEN_RE = /SA-[A-Z]+-\d{3}/g;

// --------------------------------------------------------------------------
// Known-uncovered allowlist.
//
// Every entry is a MUST-bearing ID that is intentionally cited by no section-4
// checklist item. Two categories:
//
//   "convention" — a spec-authoring requirement about the specification
//     documents themselves (RFC 2119 usage, ID grammar, section marking, the
//     mandatory closing table). These are satisfied by how the spec suite is
//     written, not by auditing a target implementation, so no runtime checklist
//     item verifies them. Section 5 has always excused this class.
//
//   "gap" — a genuine behavioral MUST that no current checklist item verifies.
//     These are honest holes: the failure this whole gate exists to prevent is a
//     "0 uncovered" claim that hides one of these. Each is tracked so the number
//     stays visible and reviewed. Closing a gap = add a citing item (and remove
//     the entry); the gate fails if a gap entry becomes cited but is left here.
//
// To add a MUST-bearing requirement: either cite it from a checklist item, or
// add it here with a category, a one-line reason, and a tracking note.
const ALLOWLIST = [
  // --- spec-authoring conventions (about the documents, not an implementation) ---
  {
    id: "SA-CORE-001",
    category: "convention",
    reason:
      "RFC 2119 keyword interpretation for the spec suite; a document-authoring convention, not an implementation behavior.",
    note: "Verified by the suite's own use of the keywords.",
  },
  {
    id: "SA-CORE-002",
    category: "convention",
    reason: "Lowercase must/should/may are non-normative; a prose-authoring convention.",
    note: "Verified by spec editing, not by auditing a target.",
  },
  {
    id: "SA-CORE-003",
    category: "convention",
    reason: "Every section must be marked Normative/Informative; a document-structure convention.",
    note: "Verified by the spec headings themselves.",
  },
  {
    id: "SA-CORE-004",
    category: "convention",
    reason: "Requirements must carry a stable SA-<DOC>-<NNN> ID; the ID scheme this gate parses.",
    note: "Verified by the spec's ID scheme; this gate's DECLARATION_RE depends on it.",
  },
  {
    id: "SA-CORE-005",
    category: "convention",
    reason: "The <DOC> component must be an assigned document code; an ID-grammar convention.",
    note: "Verified by the document-code taxonomy in SA-CORE-070.",
  },
  {
    id: "SA-CORE-006",
    category: "convention",
    reason: "The <NNN> component must be a unique three-digit number; an ID-grammar convention.",
    note: "Verified by the spec's ID numbering.",
  },
  {
    id: "SA-CORE-007",
    category: "convention",
    reason: "IDs must not be renumbered or reused once published; an ID-stability convention.",
    note: "Verified by spec change control / git history.",
  },
  {
    id: "SA-CORE-008",
    category: "convention",
    reason: "Conformance is judged against normative requirements; a claim-authoring convention.",
    note: "Verified by the conformance model itself.",
  },
  {
    id: "SA-CORE-010",
    category: "convention",
    reason:
      "Every spec doc must end with a framework/developer table; a document-structure convention.",
    note: "Verified by the closing table present in each spec doc.",
  },
  {
    id: "SA-CORE-070",
    category: "convention",
    reason: "The document-code taxonomy in Table 1 is stable; a suite-structure convention.",
    note: "Verified by Table 1 in steerable-apps.md.",
  },
  {
    id: "SA-CORE-071",
    category: "convention",
    reason: "Document codes organize around contract areas, not filenames; a taxonomy convention.",
    note: "Verified by the Table 1 taxonomy.",
  },
  {
    id: "SA-CONF-090",
    category: "convention",
    reason:
      "This checklist must preserve the framework/developer boundary in its own closing table; a document-structure convention for this document.",
    note: "Verified by section 9 of this checklist; it is the closing table.",
  },

  // --- genuine behavioral gaps: no current checklist item verifies these ---
  {
    id: "SA-DECL-020",
    category: "gap",
    reason:
      "State-key granularity/namespace hygiene (no private implementation paths as the normative namespace) is verified by no item.",
    note: "Track: needs a state-key-namespace item, or fold into SA-CONF-014.",
  },
  {
    id: "SA-DECL-021",
    category: "gap",
    reason:
      "No item checks that a declaration avoids duplicating the same fact across fields that can then disagree.",
    note: "Track: needs a declaration-internal-consistency item.",
  },
  {
    id: "SA-DECL-052",
    category: "gap",
    reason:
      "The optional `observe` field's post-execution-observation contract is verified by no item.",
    note: "Track: candidate for SA-CONF-014/059 extension.",
  },
  {
    id: "SA-DECL-053",
    category: "gap",
    reason: "That omitting `observe` must not change the executor contract is verified by no item.",
    note: "Track: pairs with SA-DECL-052.",
  },
  {
    id: "SA-DECL-087",
    category: "gap",
    reason:
      "The negative boundary (surface declarations must not define the cross-surface algorithm/timeout/repair/UI) is verified by no item; SA-CONF-020 checks the positive surface contract only.",
    note: "Track: candidate for SA-CONF-020 or SA-CONF-089.",
  },
  {
    id: "SA-LED-010",
    category: "gap",
    reason:
      "That the ledger must not become a second source of truth for action meaning/schema/policy/undo semantics is verified by no item; SA-CONF-025/026 check downstream artifacts and duplicate tool layers, not the ledger.",
    note: "Track: candidate for SA-CONF-069 extension.",
  },
  {
    id: "SA-LED-062",
    category: "gap",
    reason:
      "That extended ledger fields must not contradict minimal or registry-derived facts is verified by no item.",
    note: "Track: pairs with SA-LED-061 (now cited by SA-CONF-070).",
  },
  {
    id: "SA-LED-063",
    category: "gap",
    reason:
      "That ledger-derived saved workflows/replays must reference stable declaration IDs rather than copy action semantics is verified by no item.",
    note: "Track: candidate for SA-CONF-081.",
  },
  {
    id: "SA-LED-076",
    category: "gap",
    reason:
      "The minimum record shape of an undo attempt (target handle(s), start/settled status, result, error, partial-undo disclosure) is verified by no item; SA-CONF-077 checks undo-all per-handle results, not the single-undo record contract.",
    note: "Track: candidate for SA-CONF-073 or SA-CONF-077.",
  },
  {
    id: "SA-LED-077",
    category: "gap",
    reason:
      "Superseded-undo-handle recording (no stale successful undo promise) is verified by no item. This is the load-bearing orphan the coverage audit was blind to; it is also violated at HEAD.",
    note: "Track: behavior fix in a separate workstream; needs a dedicated conformance item once the runtime supports it.",
  },
  {
    id: "SA-POL-113",
    category: "gap",
    reason:
      "That a developer preset-mapping override must be policy configuration rather than a mutation of the action declaration is verified by no item.",
    note: "Track: candidate for SA-CONF-035 or SA-CONF-089.",
  },
];

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

// Collect MUST-bearing requirement IDs across the spec suite.
function collectMustIds() {
  const must = new Map(); // id -> { file, line }
  const files = fs
    .readdirSync(specDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  for (const file of files) {
    const text = fs.readFileSync(path.join(specDir, file), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(DECLARATION_RE);
      if (!match) continue;
      if (!MUST_RE.test(line)) continue;
      const id = match[1];
      if (!must.has(id)) must.set(id, { file, line });
    }
  }
  return must;
}

// Collect, for every requirement ID, the section-4 checklist items that cite it
// in their Requirement IDs column. Parsing mirrors make-report-skeleton.mjs so
// the two tools agree on what a checklist row is.
function collectCitations() {
  if (!fs.existsSync(checklistPath)) {
    fail(`Checklist not found: ${checklistPath}`);
  }
  const citedBy = new Map(); // requirement ID -> Set(SA-CONF ids)
  let inSection = false;
  let rowCount = 0;

  for (const line of fs.readFileSync(checklistPath, "utf8").split(/\r?\n/)) {
    if (line.startsWith("## 4. Checklist Items")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## 5.")) break;
    if (!inSection || !line.startsWith("| **SA-CONF-")) continue;

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const itemId = cells[0]?.replace(/\*\*/g, "");
    const requirementIds = cells[4] ?? "";
    if (!/^SA-CONF-\d{3}$/.test(itemId)) {
      fail(`Could not parse checklist row ID from line: ${line}`);
    }
    rowCount += 1;

    for (const token of requirementIds.matchAll(ID_TOKEN_RE)) {
      const id = token[0];
      if (!citedBy.has(id)) citedBy.set(id, new Set());
      citedBy.get(id).add(itemId);
    }
  }

  return { citedBy, rowCount };
}

function main() {
  const mode = process.argv.includes("--matrix")
    ? "matrix"
    : process.argv.includes("--json")
      ? "json"
      : "gate";

  const mustIds = collectMustIds();
  const { citedBy, rowCount } = collectCitations();

  const allowById = new Map(ALLOWLIST.map((entry) => [entry.id, entry]));

  const orphans = [];
  for (const id of mustIds.keys()) {
    if (!citedBy.has(id)) orphans.push(id);
  }
  orphans.sort();

  const allowedOrphans = orphans.filter((id) => allowById.has(id));
  const unexpectedOrphans = orphans.filter((id) => !allowById.has(id));

  // Allowlist hygiene: an entry that is now cited (no longer an orphan) is stale
  // and must be removed; an entry that names a non-MUST-bearing ID is a typo.
  const staleAllowlist = ALLOWLIST.filter(
    (entry) => mustIds.has(entry.id) && citedBy.has(entry.id),
  ).map((entry) => entry.id);
  const unknownAllowlist = ALLOWLIST.filter((entry) => !mustIds.has(entry.id)).map(
    (entry) => entry.id,
  );

  if (mode === "matrix") {
    process.stdout.write(renderMatrix({ mustIds, citedBy, allowById }));
    return;
  }
  if (mode === "json") {
    process.stdout.write(
      JSON.stringify(
        {
          mustBearing: mustIds.size,
          checklistRows: rowCount,
          cited: mustIds.size - orphans.length,
          orphans: orphans.length,
          allowlisted: allowedOrphans.length,
          conventions: allowedOrphans.filter((id) => allowById.get(id).category === "convention")
            .length,
          gaps: allowedOrphans.filter((id) => allowById.get(id).category === "gap").length,
          unexpectedOrphans,
          staleAllowlist,
          unknownAllowlist,
        },
        null,
        2,
      ) + "\n",
    );
  }

  const conventions = allowedOrphans.filter((id) => allowById.get(id).category === "convention");
  const gaps = allowedOrphans.filter((id) => allowById.get(id).category === "gap");

  const lines = [];
  lines.push("Steerable Apps MUST-coverage gate");
  lines.push(`  spec dir:            ${path.relative(repoRoot, specDir)}`);
  lines.push(`  MUST-bearing IDs:    ${mustIds.size}`);
  lines.push(`  section-4 rows:      ${rowCount}`);
  lines.push(`  cited by an item:    ${mustIds.size - orphans.length}`);
  lines.push(`  uncited (orphans):   ${orphans.length}`);
  lines.push(
    `    allowlisted:       ${allowedOrphans.length} (${conventions.length} conventions + ${gaps.length} tracked behavioral gaps)`,
  );
  lines.push(`    unexpected:        ${unexpectedOrphans.length}`);

  if (gaps.length) {
    lines.push("");
    lines.push("Tracked behavioral gaps (allowlisted, visible on purpose):");
    for (const id of gaps) {
      lines.push(`  - ${id}: ${allowById.get(id).reason}`);
    }
  }

  let ok = true;
  if (unexpectedOrphans.length) {
    ok = false;
    lines.push("");
    lines.push("FAIL: MUST-bearing requirements cited by no checklist item and not allowlisted:");
    for (const id of unexpectedOrphans) {
      lines.push(`  - ${id} (${mustIds.get(id).file})`);
    }
    lines.push("");
    lines.push("Fix: cite each ID from a section-4 checklist item whose procedure genuinely");
    lines.push("verifies it, or add it to the allowlist in this script with a reason.");
  }
  if (staleAllowlist.length) {
    ok = false;
    lines.push("");
    lines.push("FAIL: allowlist entries that are now cited by a checklist item (remove them):");
    for (const id of staleAllowlist) lines.push(`  - ${id}`);
  }
  if (unknownAllowlist.length) {
    ok = false;
    lines.push("");
    lines.push("FAIL: allowlist entries that are not MUST-bearing IDs (typo or stale):");
    for (const id of unknownAllowlist) lines.push(`  - ${id}`);
  }

  lines.push("");
  lines.push(ok ? "OK: every MUST-bearing requirement is cited or allowlisted." : "GATE FAILED.");
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(ok ? 0 : 1);
}

function renderMatrix({ mustIds, citedBy, allowById }) {
  const out = [];
  out.push("# MUST-coverage traceability matrix (generated)");
  out.push("");
  out.push(`Generated by skills/integration-audit/scripts/check-coverage.mjs`);
  out.push(`MUST-bearing IDs: ${mustIds.size}`);
  out.push("");
  out.push("| Requirement ID | Spec | Citing checklist item(s) |");
  out.push("|---|---|---|");
  for (const id of [...mustIds.keys()].sort()) {
    const items = citedBy.get(id);
    let cite;
    if (items && items.size) {
      cite = [...items].sort().join(", ");
    } else if (allowById.has(id)) {
      const entry = allowById.get(id);
      cite = `UNCITED — allowlisted (${entry.category})`;
    } else {
      cite = "UNCITED — NOT ALLOWLISTED";
    }
    out.push(`| ${id} | ${mustIds.get(id).file} | ${cite} |`);
  }
  return out.join("\n") + "\n";
}

main();
