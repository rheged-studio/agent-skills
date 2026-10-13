#!/usr/bin/env node
// Materialise this repo's own (dogfood) skill configs (R-615).
//
// agent-skills dogfoods its own skills, so it needs a real `config.json` for each
// — but those configs must NOT travel to consumers via `skills add --copy`, which
// vendors every tracked file under `skills/<name>/` (there is no skills.sh ignore
// mechanism — ADR-0001 Decision 4). The fix: `skills/*/config.json` is gitignored,
// so the only config a consumer receives is the neutral `config.example.json`. The
// real values live in the TRACKED `infrastructure/dogfood-config/<name>.json` tree
// (outside the vendored bundle), and this script copies them into the gitignored
// `skills/<name>/config.json` so this repo's own skills, tests, and CI gates work.
//
// Run once after clone (also wired into CI + the `pre*` npm hooks of the scripts
// that read a config). Idempotent.
//
//   node infrastructure/scripts/bootstrap-config.mjs            # materialise (default)
//   node infrastructure/scripts/bootstrap-config.mjs --check    # verify in sync (CI guard)
//   node infrastructure/scripts/bootstrap-config.mjs --self-test
//   node infrastructure/scripts/bootstrap-config.mjs --help     # alias: -h
//
// Exit codes: 0 success; 1 --check drift; 2 usage / IO error.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const USAGE = `bootstrap-config — materialise this repo's own skill config.json files from the tracked dogfood-config source

Usage:
  node bootstrap-config.mjs              Copy each dogfood-config/<name>.json -> skills/<name>/config.json
  node bootstrap-config.mjs --check      Verify every target exists and matches its source (no writes)
  node bootstrap-config.mjs --self-test  Run the offline self-check
  node bootstrap-config.mjs --help       Show this message (alias: -h)`;

/**
 * The repo root, resolved from this module's location
 * (<root>/infrastructure/scripts/bootstrap-config.mjs), not cwd.
 * @returns {string}
 */
function defaultRepoRoot() {
  return dirname(dirname(import.meta.dirname)); // scripts -> infrastructure -> root
}

/**
 * Map each `infrastructure/dogfood-config/<name>.json` to its
 * `skills/<name>/config.json` target. Pure — touches nothing.
 * @param {string} repoRoot
 * @returns {{ name: string, source: string, target: string }[]}
 */
export function planBootstrap(repoRoot) {
  const dogfoodDirectory = join(repoRoot, "infrastructure", "dogfood-config");
  if (!existsSync(dogfoodDirectory)) {
    return [];
  }

  return readdirSync(dogfoodDirectory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const name = file.slice(0, -".json".length);
      return {
        name,
        source: join(dogfoodDirectory, file),
        target: join(repoRoot, "skills", name, "config.json"),
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Materialise every planned config. Skill dir must exist (a dogfood entry with no
 * matching bundle is a misconfiguration, not a silent skip).
 * @param {string} repoRoot
 * @returns {string[]} the written target paths
 */
export function materialise(repoRoot) {
  const written = [];
  for (const { name, source, target } of planBootstrap(repoRoot)) {
    const skillDirectory = dirname(target);
    if (!existsSync(skillDirectory)) {
      throw new Error(
        `dogfood-config/${name}.json has no matching skills/${name}/ bundle`,
      );
    }

    copyFileSync(source, target);
    written.push(target);
  }

  return written;
}

/**
 * Report targets that are missing or whose contents differ from their source.
 * @param {string} repoRoot
 * @returns {{ name: string, reason: "missing" | "drift" }[]}
 */
export function checkDrift(repoRoot) {
  const problems = [];
  for (const { name, source, target } of planBootstrap(repoRoot)) {
    if (!existsSync(target)) {
      problems.push({ name, reason: "missing" });
      continue;
    }

    if (readFileSync(source, "utf8") !== readFileSync(target, "utf8")) {
      problems.push({ name, reason: "drift" });
    }
  }

  return problems;
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

  const repoRoot = defaultRepoRoot();

  if (argv.includes("--check")) {
    const problems = checkDrift(repoRoot);
    if (problems.length === 0) {
      console.log(
        "bootstrap-config: every skills/<name>/config.json is in sync.",
      );
      return;
    }

    console.error(
      "bootstrap-config: config out of sync — run `pnpm bootstrap:config`:",
    );
    for (const { name, reason } of problems) {
      console.error(
        `  ${reason === "missing" ? "missing" : "drifted"}  skills/${name}/config.json`,
      );
    }

    process.exit(1);
  }

  const unknown = argv.find((argument) => argument.startsWith("--"));
  if (unknown) {
    console.error(`bootstrap-config: unknown argument "${unknown}"\n`);
    console.error(USAGE);
    process.exit(2);
  }

  try {
    const written = materialise(repoRoot);
    console.log(
      `bootstrap-config: materialised ${written.length} config.json file${written.length === 1 ? "" : "s"}.`,
    );
  } catch (error) {
    console.error(`bootstrap-config: ${error.message}`);
    process.exit(2);
  }
}

// ---- self-test ----------------------------------------------------------

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), "bootstrap-config-"));
  const cases = [];
  try {
    mkdirSync(join(root, "infrastructure/dogfood-config"), { recursive: true });
    mkdirSync(join(root, "skills/send-it"), { recursive: true });
    writeFileSync(
      join(root, "infrastructure/dogfood-config/send-it.json"),
      '{\n  "baseBranch": "main"\n}\n',
    );

    // Plan maps source -> target by directory name.
    const plan = planBootstrap(root);
    cases.push({
      name: "plans send-it dogfood -> skills/send-it/config.json",
      ok:
        plan.length === 1 &&
        plan[0].name === "send-it" &&
        plan[0].target.endsWith(join("skills", "send-it", "config.json")),
    });

    // Before materialise: target missing -> reported.
    cases.push({
      name: "check reports a missing target",
      ok: checkDrift(root).some(
        (problem) => problem.name === "send-it" && problem.reason === "missing",
      ),
    });

    // Materialise writes the target byte-for-byte.
    materialise(root);
    cases.push({
      name: "materialise writes config.json",
      ok: existsSync(join(root, "skills/send-it/config.json")),
    });
    cases.push({
      name: "materialised content equals the source",
      ok:
        readFileSync(join(root, "skills/send-it/config.json"), "utf8") ===
        readFileSync(
          join(root, "infrastructure/dogfood-config/send-it.json"),
          "utf8",
        ),
    });
    cases.push({
      name: "check is clean after materialise",
      ok: checkDrift(root).length === 0,
    });

    // A hand-edit to the generated file is detected as drift.
    writeFileSync(
      join(root, "skills/send-it/config.json"),
      '{\n  "baseBranch": "dev"\n}\n',
    );
    cases.push({
      name: "check reports drift after a hand-edit",
      ok: checkDrift(root).some(
        (problem) => problem.name === "send-it" && problem.reason === "drift",
      ),
    });

    // A dogfood entry with no bundle is an error, not a silent skip.
    writeFileSync(
      join(root, "infrastructure/dogfood-config/ghost.json"),
      "{}\n",
    );
    let threw = false;
    try {
      materialise(root);
    } catch {
      threw = true;
    }

    cases.push({
      name: "materialise throws on a bundle-less dogfood entry",
      ok: threw,
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
// paths so symlinks (macOS /var->/private/var) don't cause a false negative.
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
