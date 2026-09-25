#!/usr/bin/env node
// Fleet-deployment wipe helper (A-464).
//
// Step 1 of the fleet runbook (docs/fleet-deployment.md): clear a target repo's
// bespoke command shims before installing the shared skills via skills.sh, so
// there's a clean slate and no duplicate/competing definitions.
//
// Safe by design: it only ever DELETES the canonical command shims it knows
// about (`.claude/commands/<skill>.md`) — the clear bespoke duplicates every
// adoption issue calls out. Vendored skill bundles under `.claude/skills/` etc.
// are only LISTED as candidates for manual review, never removed, because a
// `skills add --copy` install lives in those same dirs and auto-deleting them
// would wipe a legitimate install.
//
//   node infrastructure/scripts/fleet-wipe.mjs --repo <path>            # preview (default)
//   node infrastructure/scripts/fleet-wipe.mjs --repo <path> --apply    # remove the shims
//   node infrastructure/scripts/fleet-wipe.mjs --self-test              # offline self-check
//
// Exit codes: 0 success; 2 usage error.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The shared skill set (mirrors docs/fleet-deployment.md). A command shim named
// after one of these is a bespoke duplicate the shared skill replaces.
const CANONICAL_SKILLS = [
  "send-it",
  "commit",
  "preflight",
  "changelog",
  "linear-sync",
  "cleanup-repo",
  "rheged-skills-setup",
  "initialise-skills",
  "triage-pr",
  "release-status",
];

// Where bespoke command shims live (removed on --apply).
const COMMAND_DIRS = [".claude/commands"];

// Where vendored / prototype skill bundles live (listed for review only).
const SKILL_DIRS = [".claude/skills", ".agents/skills", ".cursor/skills"];

const USAGE = `fleet-wipe — clear a target repo's bespoke skill/command shims before a skills.sh install

Usage:
  node fleet-wipe.mjs --repo <path>           Preview removals (deletes nothing)
  node fleet-wipe.mjs --repo <path> --apply   Remove the canonical command shims
  node fleet-wipe.mjs --self-test             Run the offline self-check
  node fleet-wipe.mjs --help                  Show this message (alias: -h)`;

/**
 * Inspect a target repo and split what the wipe touches into the shims it will
 * remove (canonical `<commandDir>/<skill>.md`) and the skill-dir candidates it
 * only flags for manual review. Pure read — deletes nothing.
 * @param {string} repoRoot
 * @returns {{ shims: string[], candidates: string[] }}
 */
export function detectWipe(repoRoot) {
  const shims = [];
  for (const directory of COMMAND_DIRS) {
    for (const skill of CANONICAL_SKILLS) {
      const rel = join(directory, `${skill}.md`);
      if (existsSync(join(repoRoot, rel))) {
        shims.push(rel);
      }
    }
  }

  const candidates = [];
  for (const directory of SKILL_DIRS) {
    const absolute = join(repoRoot, directory);
    if (!existsSync(absolute)) {
      continue;
    }

    let entries;
    try {
      entries = readdirSync(absolute, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && CANONICAL_SKILLS.includes(entry.name)) {
        candidates.push(join(directory, entry.name));
      }
    }
  }

  return { candidates: candidates.toSorted(), shims: shims.toSorted() };
}

function parseArgs(argv) {
  const options = { apply: false, repo: undefined };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
    } else if (argument === "--repo") {
      options.repo = argv[++index];
      if (!options.repo || options.repo.startsWith("--")) {
        console.error("fleet-wipe: --repo requires a path");
        process.exit(2);
      }
    } else {
      console.error(`fleet-wipe: unknown argument "${argument}"`);
      process.exit(2);
    }
  }

  return options;
}

function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return;
  }

  if (argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const options = parseArgs(argv);
  if (!options.repo) {
    console.error("fleet-wipe: --repo <path> is required\n");
    console.error(USAGE);
    process.exit(2);
  }

  if (!existsSync(options.repo)) {
    console.error(`fleet-wipe: target repo not found: ${options.repo}`);
    process.exit(2);
  }

  // existsSync is true for a regular file too; a non-directory --repo would
  // otherwise fall through and report a clean repo instead of a usage error.
  if (!statSync(options.repo).isDirectory()) {
    console.error(`fleet-wipe: --repo must be a directory: ${options.repo}`);
    process.exit(2);
  }

  const { candidates, shims } = detectWipe(options.repo);

  if (shims.length === 0) {
    console.log(
      "fleet-wipe: no canonical command shims found — nothing to remove.",
    );
  } else if (options.apply) {
    for (const shim of shims) {
      unlinkSync(join(options.repo, shim));
      console.log(`fleet-wipe: removed ${shim}`);
    }
  } else {
    console.log("fleet-wipe: would remove (re-run with --apply):");
    for (const shim of shims) {
      console.log(`  ${shim}`);
    }
  }

  if (candidates.length > 0) {
    console.log(
      "\nfleet-wipe: other candidates for manual review (NOT removed — a vendored",
    );
    console.log(
      "skills.sh install lives here too; delete only bespoke prototypes):",
    );
    for (const candidate of candidates) {
      console.log(`  ${candidate}`);
    }
  }
}

// ---- self-test ----------------------------------------------------------

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), "fleet-wipe-"));
  const cases = [];
  try {
    mkdirSync(join(root, ".claude/commands"), { recursive: true });
    writeFileSync(join(root, ".claude/commands/send-it.md"), "# bespoke\n");
    writeFileSync(join(root, ".claude/commands/notes.md"), "# not a skill\n");
    mkdirSync(join(root, ".agents/skills/preflight"), { recursive: true });
    mkdirSync(join(root, ".agents/skills/local-thing"), { recursive: true });

    const detected = detectWipe(root);
    cases.push({
      name: "detects the canonical send-it command shim",
      ok: detected.shims.includes(".claude/commands/send-it.md"),
    });
    cases.push({
      name: "ignores a non-canonical command file",
      ok: !detected.shims.includes(".claude/commands/notes.md"),
    });
    cases.push({
      name: "lists a canonical skill dir as a review candidate",
      ok: detected.candidates.includes(".agents/skills/preflight"),
    });
    cases.push({
      name: "ignores a non-canonical skill dir",
      ok: !detected.candidates.some((candidate) =>
        candidate.endsWith("local-thing"),
      ),
    });

    // --apply removes only the shim, never the skill-dir candidate.
    main(["--repo", root, "--apply"]);
    cases.push({
      name: "--apply removes the shim",
      ok: !existsSync(join(root, ".claude/commands/send-it.md")),
    });
    cases.push({
      name: "--apply preserves the skill-dir candidate",
      ok: existsSync(join(root, ".agents/skills/preflight")),
    });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }

  let failed = 0;
  for (const { name, ok } of cases) {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
    if (!ok) {
      failed += 1;
    }
  }

  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

// Only run when invoked directly as a CLI, not when imported. Compare realpath'd
// paths so symlinks (macOS /var→/private/var) don't cause a false negative.
function isCliEntry() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(import.meta.filename) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  main(process.argv.slice(2));
}
