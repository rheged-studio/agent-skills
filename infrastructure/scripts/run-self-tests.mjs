#!/usr/bin/env node
// Fleet self-test runner (A-533).
//
// Several skill bundles ship an in-script `--self-test` mode — a built-in,
// offline smoke test (`node <script> --self-test`) that asserts the script's
// pure transforms with no network / `gh` / git access. The root vitest suite
// covers the *exported* helpers, but the `--self-test` dispatch path itself
// (and any assertion only wired into it) is never exercised by `pnpm test`.
//
// This runner discovers every skill script under `skills/<name>/scripts/` — and
// every repo tooling script under `infrastructure/scripts/` (A-2454) — that
// declares the literal `--self-test`, runs each with `node <script>
// --self-test`, and exits non-zero if any fail — so the self-tests are CI-gated
// alongside the unit tests. Zero-dependency: Node built-ins only.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const skillsDirectory = join(repoRoot, "skills");
const infrastructureScriptsDirectory = join(
  repoRoot,
  "infrastructure",
  "scripts",
);

/**
 * Recursively collect `*.mjs` files under a directory.
 * @param {string} directory
 * @returns {string[]}
 */
function collectMjs(directory) {
  /** @type {string[]} */
  const found = [];
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectMjs(full));
    } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
      found.push(full);
    }
  }

  return found;
}

/**
 * Every script declaring `--self-test`: the skill scripts under
 * `skills/<name>/scripts/` plus the tooling under `infrastructure/scripts/`.
 * This runner is excluded — it carries the literal too, so it would recurse.
 * @returns {string[]}
 */
function discoverSelfTestScripts() {
  const candidates = collectMjs(infrastructureScriptsDirectory).filter(
    (file) => file !== import.meta.filename,
  );

  /** @type {import("node:fs").Dirent[]} */
  let skills = [];
  try {
    skills = readdirSync(skillsDirectory, { withFileTypes: true });
  } catch {
    // No skills/ directory — only the infrastructure scripts are candidates.
  }

  for (const skill of skills) {
    if (!skill.isDirectory()) {
      continue;
    }

    const scriptsDirectory = join(skillsDirectory, skill.name, "scripts");
    try {
      statSync(scriptsDirectory);
    } catch {
      continue;
    }

    candidates.push(...collectMjs(scriptsDirectory));
  }

  return candidates
    .filter((file) => readFileSync(file, "utf8").includes("--self-test"))
    .toSorted();
}

function main() {
  const scripts = discoverSelfTestScripts();
  if (scripts.length === 0) {
    console.error("No scripts declaring --self-test were found.");
    process.exit(1);
  }

  /** @type {{ ok: boolean; rel: string }[]} */
  const results = [];
  for (const script of scripts) {
    const rel = relative(repoRoot, script);
    const run = spawnSync(process.execPath, [script, "--self-test"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ok = run.status === 0;
    results.push({ ok, rel });
    console.log(`${ok ? "PASS" : "FAIL"}  ${rel}`);
    if (!ok) {
      // Surface the failing script's own output so CI logs are actionable.
      if (run.stdout?.trim()) {
        console.log(run.stdout.trimEnd());
      }

      if (run.stderr?.trim()) {
        console.error(run.stderr.trimEnd());
      }

      if (run.status === null) {
        console.error(`  (script terminated by signal ${run.signal})`);
      }
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} self-tests passed.`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
