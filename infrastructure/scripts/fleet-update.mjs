#!/usr/bin/env node
// Fleet single-repo update pipeline (A-617).
//
// The recurring push-update path a driver (A-713) calls once per consumer repo
// to roll it onto the current shared skill bundles. Parameterised by ONE repo's
// install profile (a JSON contract A-715's private manifest supplies) — this
// script holds NO repo list, so private repo names never surface in this public
// repo's CI. It is NOT the onboarding wipe: bespoke-prototype removal stays the
// separate, human-run `fleet-wipe.mjs` path.
//
// Per profile it runs, against the target consumer repo:
//   1. wipe the vendored bundle dirs for the install set (A-741) — so the
//      `skills add --copy` that follows writes FRESH SKILL.md files. Some skills.sh
//      CLI versions do an additive copy that doesn't overwrite an existing bundle,
//      leaving the OLD version on disk; initialise then re-records that stale
//      version and verify is behind forever. Wiping first makes the roll
//      deterministic regardless of the CLI's copy semantics.
//   2. skills add <github-url> --skill … --agent … --copy  (vendor the bundles)
//   3. restore the per-skill config.json that --copy clobbers (A-706 — the real
//      fix never shipped; agent-skills gitignores its own config.json (A-615), so
//      a --copy re-vendor deletes or overwrites the consumer's tracked configs),
//      by `git checkout HEAD -- <config.json>` — else every no-detector key
//      regresses on the next reconcile.
//   4. initialise.mjs --write            (reconcile config + refresh skills.lock)
//   5. check-updates.mjs verify          (assert the repo is now up to date —
//      updatesAvailable === false; the idempotency primitive). Scoped to the
//      install set (--skills) so the repo-internal scaffold-new-skill (A-729),
//      present in every source checkout but in no consumer, isn't a perpetual
//      `added` update that wedges the verify (A-741).
//
// Preview by default (matches fleet-wipe.mjs / vendor-sync.mjs); --apply mutates.
// A preview skips the install + restore (skills.sh has no dry-run) and runs
// initialise/check-updates read-only. `run-self-tests.mjs` only scans
// skills/<name>/scripts, so --self-test here is a dev affordance; CI gates the
// pure core via the vitest companion (infrastructure/tests/fleet-update.test.ts).
//
//   node infrastructure/scripts/fleet-update.mjs --profile ./acme.json           # preview (default)
//   node infrastructure/scripts/fleet-update.mjs --profile ./acme.json --apply    # run the pipeline
//   echo '{"repo":"…"}' | node infrastructure/scripts/fleet-update.mjs --apply    # profile on stdin
//   node infrastructure/scripts/fleet-update.mjs --self-test                       # offline self-check
//
// Exit codes: 0 success; 1 real failure (a pipeline step or the self-test
//   failed); 2 usage error (bad args / profile / paths).

import { findMissingMattBundles } from "../../skills/rheged-skills-setup/scripts/install-from-catalogue.mjs";
import {
  buildSkillsAddArgsForSource,
  findMissingRhegedSourceSkills,
  mattSkillNames,
  parseCatalogue,
  resolveInstallSkills,
  resolveInstallSources,
  resolveRhegedSkills,
  resolveWipeTargetsWithLegacy,
  rhegedSkillNames,
  rhegedSourceUrl,
} from "../../skills/rheged-skills-setup/scripts/lib/catalogue.mjs";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

const CATALOGUE_PATH = join(import.meta.dirname, "..", "skill-catalogue.json");

/**
 * @returns {ReturnType<typeof parseCatalogue>}
 */
export function loadFleetCatalogue() {
  return parseCatalogue(readFileSync(CATALOGUE_PATH, "utf8"));
}

const FLEET_CATALOGUE = loadFleetCatalogue();

// Rheged install URL — skills.lock provenance (A-718). Matt packs use a second source.
export const SOURCE_URL = rhegedSourceUrl(FLEET_CATALOGUE);

// Rheged ship set from the estate catalogue (for --print-skills / check-updates scope).
export const CANONICAL_SKILLS = rhegedSkillNames(FLEET_CATALOGUE);

// The local agent-skills checkout this script lives in — used ONLY as the
// `check-updates --source` (a local checkout to read target versions from); the
// install itself comes from SOURCE_URL. Overridable via --source.
const SOURCE_DEFAULT = join(import.meta.dirname, "..", "..");

const REPO_TYPES = ["single", "mono", "no-changelog"];

// Standard locations `skills add` vendors bundles into (mirrors fleet-wipe.mjs).
// A consumer with multiple --agent targets gets several of these mirrors, each
// with its own config.json to reconcile.
const CONSUMER_SKILL_DIRS = [
  ".claude/skills",
  ".agents/skills",
  ".cursor/skills",
];

// Preview unless --apply, mirroring fleet-wipe.mjs. Flip this one constant to make
// the pipeline execute by default.
const APPLY_BY_DEFAULT = false;

const USAGE = `fleet-update — roll one consumer repo onto the current shared skill bundles

Usage:
  node fleet-update.mjs --profile <file>           Preview the pipeline (mutates nothing)
  node fleet-update.mjs --profile <file> --apply   Run wipe → install → restore → reconcile → verify
  node fleet-update.mjs --apply                    Read the profile from stdin JSON
  node fleet-update.mjs --profile <file> --print-skills  Print the resolved install set (CSV) and exit
  node fleet-update.mjs --self-test                Run the offline self-check
  node fleet-update.mjs --help                     Show this message (alias: -h)

Options:
  --profile <file>   Install-profile JSON (see docs/fleet-deployment.md). Omit to read stdin.
  --source <path>    agent-skills checkout check-updates verifies against
                     (default: this script's repo). The install itself always
                     vendors from the GitHub URL, never this path.
  --ref <ref>        Target ref recorded in skills.lock and diffed by verify (default: main).
  --apply            Actually mutate the target repo (default: preview only).
  --dry-run          Explicit preview (the default).
  --print-skills     Emit the resolved install set (comma-separated) and exit — the
                     scope that the fan-out pre-flight passes to check-updates --skills.`;

/**
 * Parse and validate one install profile. Accepts a JSON string or an
 * already-parsed object; throws an Error (message ready for a `fleet-update:`
 * prefix) on any violation. Applies defaults so the rest of the pipeline can
 * treat every field as present.
 * @param {string | object} json
 * @returns {{ repo: string, skills: string[] | undefined, agents: string[], repoType: string, facts: object }}
 */
export function parseProfile(json) {
  let profile = json;
  if (typeof json === "string") {
    try {
      profile = JSON.parse(json);
    } catch (error) {
      throw new Error(`could not parse profile JSON: ${error.message}`);
    }
  }

  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("profile must be a JSON object");
  }

  if (typeof profile.repo !== "string" || !profile.repo.trim()) {
    throw new Error(
      "profile 'repo' is required and must be a non-empty string",
    );
  }

  if (profile.skills !== undefined && !isStringArray(profile.skills)) {
    throw new Error("profile 'skills' must be an array of strings");
  }

  if (profile.agents !== undefined && !isStringArray(profile.agents)) {
    throw new Error("profile 'agents' must be an array of strings");
  }

  if (
    profile.repoType !== undefined &&
    !REPO_TYPES.includes(profile.repoType)
  ) {
    throw new Error(
      `profile 'repoType' must be one of ${REPO_TYPES.join(", ")}`,
    );
  }

  if (
    profile.facts !== undefined &&
    (typeof profile.facts !== "object" ||
      profile.facts === null ||
      Array.isArray(profile.facts))
  ) {
    throw new Error("profile 'facts' must be an object");
  }

  const facts = profile.facts ?? {};
  if (facts.issueKeys !== undefined && !isStringArray(facts.issueKeys)) {
    throw new Error("profile 'facts.issueKeys' must be an array of strings");
  }

  return {
    agents: profile.agents ?? ["claude-code"],
    facts,
    repo: profile.repo.trim(),
    repoType: profile.repoType ?? "single",
    skills: profile.skills,
  };
}

/**
 * The effective skill list for the install. An explicit `skills` list wins;
 * otherwise the install defaults to `CANONICAL_SKILLS` (a `no-changelog` repo
 * gets that set minus `changelog`). It never returns `null`: a bare install with
 * no `--skill` flags would vendor the whole published set, pulling in the
 * repo-internal `scaffold-new-skill` (A-729), so the omitted-list case resolves
 * to the explicit canonical set instead.
 * @param {{ skills: string[] | undefined, repoType: string }} profile
 * @returns {string[]}
 */
export function resolveSkills(profile) {
  return resolveRhegedSkills(profile, FLEET_CATALOGUE);
}

/**
 * Full estate install set (Rheged + Matt) for wipe / post-install verify.
 * @param {{ skills: string[] | undefined, repoType: string }} profile
 * @returns {string[]}
 */
export function resolveFullInstallSkills(profile) {
  return resolveInstallSkills(profile, FLEET_CATALOGUE);
}

/**
 * The install-set skills that do NOT exist in the source, given a `<skill> →
 * boolean` existence probe. The apply guard refuses to touch a consumer when this
 * is non-empty: the wipe removes `<mirror>/<skill>` for every install-set skill
 * BEFORE re-vendoring, so a name absent upstream would delete the consumer's own
 * bundle with no way to restore it (A-757 — a repo-local skill wrongly listed in
 * the fleet manifest). Pure — the caller injects the probe, so the guard is
 * unit-testable without a filesystem.
 * @param {string[]} skills               the resolved install set
 * @param {(skill: string) => boolean} sourceHasSkill
 * @returns {string[]}
 */
export function findMissingSourceSkills(skills, sourceHasSkill) {
  return skills.filter((skill) => !sourceHasSkill(skill));
}

/**
 * Build the `npx` argv (excluding the leading "skills") for the --copy install:
 * `add <SOURCE_URL> [--skill X]… [--agent Y]… --copy`. The install source is the
 * canonical GitHub URL, NOT the local checkout: skills.sh writes the source it was
 * given into the consumer's `skills-lock.json`, so a local path would commit an
 * absolute machine path + `sourceType: local` into every consumer (A-718). A URL
 * install resolves the default branch — right for the recurring roll-onto-latest
 * fan-out. `resolveSkills` always yields an explicit list (the canonical set when
 * the profile omits `skills`), so the install always names its `--skill`s and
 * never pulls the whole published set (A-729). Pure — constructs argv, spawns
 * nothing.
 * @param {{ skills: string[] | undefined, agents: string[], repoType: string }} profile
 * @returns {string[]}
 */
export function buildSkillsAddArgs(profile) {
  const agents = profile.agents ?? ["claude-code"];
  return buildSkillsAddArgsForSource(
    SOURCE_URL,
    resolveSkills(profile),
    agents,
  );
}

/**
 * Per-source `skills add` argv for the estate catalogue (A-1904).
 * @param {{ skills: string[] | undefined, agents: string[], repoType: string }} profile
 * @returns {string[][]}
 */
export function buildCatalogueInstallArgvs(profile) {
  const agents = profile.agents ?? ["claude-code"];
  return resolveInstallSources(FLEET_CATALOGUE, {
    isAgentSkillsSourceRepo: false,
    profile,
  }).map((source) =>
    buildSkillsAddArgsForSource(source.url, source.skills, agents),
  );
}

/**
 * The vendored bundle dirs a re-vendor should remove before `skills add --copy`,
 * as `<mirror>/<skill>` relative paths (one per install skill × mirror). Removing
 * them first forces `--copy` to write fresh SKILL.md files even when the CLI's copy
 * is additive and would otherwise leave the OLD version on disk (A-741). Only the
 * install set is targeted, so consumer-extra bundles outside the profile are left
 * untouched. Pure — joins paths, touches no filesystem; the caller skips absent
 * dirs and restores the config.json a wipe also removes (A-706, step 3).
 * @param {string[]} mirrors  relative skills-dir mirrors (CONSUMER_SKILL_DIRS)
 * @param {string[]} skills   the resolved install set
 * @returns {string[]}
 */
export function resolveWipeTargets(mirrors, skills) {
  return resolveWipeTargetsWithLegacy(mirrors, skills);
}

/**
 * The child environment for `skills add` — the base env plus `CLAUDECODE=1`, which
 * forces skills.sh's non-interactive install path (A-745). Without an agent env,
 * `skills add` shows an interactive "Installation scope" prompt and, with no TTY to
 * answer it, vendors NOTHING — so an unattended roll (CI/cron) silently produces
 * empty bundles. It "worked" by hand only because Claude Code sets CLAUDECODE.
 * (`!process.stdin.isTTY` alone does NOT skip the scope prompt — only agent
 * detection does.) Pure — returns a new object, mutates nothing.
 * @param {Record<string, string | undefined>} [baseEnvironment]
 * @returns {Record<string, string | undefined>}
 */
export function skillsAddEnvironment(baseEnvironment = process.env) {
  return { ...baseEnvironment, CLAUDECODE: "1" };
}

/**
 * Assemble the stdin payload for initialise.mjs: the script-supplied lock
 * provenance (lockSource/lockRef) plus the non-derivable Linear facts from the
 * profile. Absent facts are omitted so the detector's no-fact path is preserved.
 * @param {{ facts: object }} profile
 * @param {{ ref: string }} opts
 * @returns {{ facts: object }}
 */
export function buildInitialiseFacts(profile, { ref }) {
  const facts = { lockRef: ref, lockSource: SOURCE_URL };
  const { followUpProject, issueKeys, linearTeamName, linearWorkspaceSlug } =
    profile.facts;
  if (typeof linearTeamName === "string") {
    facts.linearTeamName = linearTeamName;
  }

  if (typeof linearWorkspaceSlug === "string") {
    facts.linearWorkspaceSlug = linearWorkspaceSlug;
  }

  if (typeof followUpProject === "string") {
    facts.followUpProject = followUpProject;
  }

  if (Array.isArray(issueKeys)) {
    facts.issueKeys = issueKeys;
  }

  return { facts };
}

/**
 * From `git diff HEAD --name-only` stdout (run with --diff-filter=DM), the
 * tracked config.json paths a --copy re-vendor clobbered — deleted OR overwritten
 * with the example default — across every mirror (.claude/skills, .agents/skills,
 * …). Empty ⇒ nothing to restore (a first-ever install has no tracked config to
 * lose). Pure — parses text, touches no filesystem.
 * @param {string} gitDiffOutput
 * @returns {string[]}
 */
export function detectClobberedConfigs(gitDiffOutput) {
  return gitDiffOutput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /config\.json$/.test(line))
    .toSorted();
}

/**
 * Interpret a parsed check-updates report into the verify verdict. `ok` is true
 * only when the report explicitly reports no available updates; a report missing
 * `updatesAvailable` is treated as NOT ok (verify can't confirm success).
 * @param {object} report
 * @returns {{ ok: boolean, bumps: object[], reason?: string }}
 */
export function interpretCheckUpdates(report) {
  if (!report || typeof report.updatesAvailable !== "boolean") {
    return { bumps: [], ok: false, reason: "malformed check-updates report" };
  }

  return { bumps: report.updates ?? [], ok: report.updatesAvailable === false };
}

function isStringArray(value) {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

// ---- CLI / IO ------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    apply: APPLY_BY_DEFAULT,
    printSkills: false,
    profile: undefined,
    ref: undefined,
    source: undefined,
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
    } else if (argument === "--dry-run") {
      options.apply = false;
    } else if (argument === "--print-skills") {
      options.printSkills = true;
    } else if (argument === "--profile") {
      options.profile = takeValue(argv, ++index, "--profile");
    } else if (argument === "--source") {
      options.source = takeValue(argv, ++index, "--source");
    } else if (argument === "--ref") {
      options.ref = takeValue(argv, ++index, "--ref");
    } else {
      fail(`unknown argument "${argument}"`, 2);
    }
  }

  return options;
}

function takeValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    fail(`${flag} requires a value`, 2);
  }

  return value;
}

function fail(message, code) {
  console.error(`fleet-update: ${message}`);
  process.exit(code);
}

/**
 * Read the profile: the --profile file if given, else stdin JSON (when piped).
 * @param {string | undefined} profilePath
 * @returns {string}
 */
function readProfileSource(profilePath) {
  if (profilePath) {
    if (!existsSync(profilePath)) {
      fail(`profile not found: ${profilePath}`, 2);
    }

    return readFileSync(profilePath, "utf8");
  }

  if (process.stdin.isTTY) {
    fail("no profile — pass --profile <file> or pipe profile JSON on stdin", 2);
  }

  const stdin = readFileSync(0, "utf8");
  if (!stdin.trim()) {
    fail("empty profile on stdin", 2);
  }

  return stdin;
}

/**
 * Run a subprocess and return the raw result (status/stdout/stderr) without
 * exiting — callers decide whether a non-zero status is fatal.
 */
function spawnCapture(command, args, cwd, input, environment) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: environment,
    input,
  });
  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`, 1);
  }

  return result;
}

/**
 * Run a subprocess, streaming nothing; surface stdout/stderr and exit 1 on a
 * non-zero status. Returns the captured stdout for the caller to parse. `env`
 * (when given) REPLACES the child environment, so callers pass a merged copy.
 */
function run(command, args, cwd, input, environment) {
  const result = spawnCapture(command, args, cwd, input, environment);
  if (result.status !== 0) {
    if (result.stdout?.trim()) {
      console.error(result.stdout.trimEnd());
    }

    if (result.stderr?.trim()) {
      console.error(result.stderr.trimEnd());
    }

    fail(`${command} ${args[0]} exited ${result.status}`, 1);
  }

  return result.stdout ?? "";
}

function runSkillsAdd(consumer, args) {
  console.log(`fleet-update: skills ${args.join(" ")}`);
  run("npx", ["skills", ...args], consumer, undefined, skillsAddEnvironment());
}

/**
 * Remove the vendored bundle dirs for the install set so the `skills add --copy`
 * that follows writes fresh files (A-741). Skips dirs that don't exist yet (a
 * first-ever install), and leaves consumer-extra bundles alone. The config.json a
 * wipe removes is restored right after the re-copy by restoreClobberedConfigs.
 */
function wipeLegacyCommandShims(consumer) {
  const shim = join(consumer, ".claude", "commands", "initialise-skills.md");
  if (existsSync(shim)) {
    rmSync(shim, { force: true });
    console.log(
      "fleet-update: removed legacy .claude/commands/initialise-skills.md",
    );
  }
}

function wipeVendoredBundles(consumer, skills) {
  const removed = [];
  wipeLegacyCommandShims(consumer);
  for (const relativePath of resolveWipeTargets(CONSUMER_SKILL_DIRS, skills)) {
    const absolute = join(consumer, relativePath);
    if (existsSync(absolute)) {
      rmSync(absolute, { force: true, recursive: true });
      removed.push(relativePath);
    }
  }

  if (removed.length === 0) {
    console.log(
      "fleet-update: no vendored bundles to wipe (first-ever install).",
    );
    return;
  }

  console.log(
    `fleet-update: wiped ${removed.length} vendored bundle dir(s) before re-copy (A-741):`,
  );
  for (const relativePath of removed.toSorted()) {
    console.log(`  ${relativePath}`);
  }
}

function restoreClobberedConfigs(consumer) {
  // --diff-filter=DM catches both --copy behaviours: an older CLI DELETES the
  // consumer's config.json; the current CLI OVERWRITES it (M) with the neutral
  // example. Either way `git checkout HEAD -- <path>` restores the tracked
  // content so the reconcile that follows merges onto the consumer's real values.
  const diff = run(
    "git",
    ["diff", "HEAD", "--name-only", "--diff-filter=DM"],
    consumer,
  );
  const clobbered = detectClobberedConfigs(diff);
  if (clobbered.length === 0) {
    console.log(
      "fleet-update: no config.json clobbered by --copy (nothing to restore).",
    );
    return;
  }

  run("git", ["checkout", "HEAD", "--", ...clobbered], consumer);
  console.log(
    `fleet-update: restored ${clobbered.length} config.json from HEAD (A-706):`,
  );
  for (const path of clobbered) {
    console.log(`  ${path}`);
  }
}

/**
 * The vendored skill-bundle dirs present in the consumer (one per --agent
 * mirror). A dir counts only when it holds at least one real bundle (a subdir
 * with a SKILL.md), so an empty leftover directory isn't treated as an install.
 * @param {string} consumer
 * @returns {string[]} absolute skills-dir paths
 */
function findConsumerSkillsDirectories(consumer) {
  const directories = [];
  for (const relativePath of CONSUMER_SKILL_DIRS) {
    const absolute = join(consumer, relativePath);
    if (!existsSync(absolute)) {
      continue;
    }

    let entries;
    try {
      entries = readdirSync(absolute, { withFileTypes: true });
    } catch {
      // Unreadable mirror (e.g. a permissions error) → treat as no bundles and
      // move on; the reconcile that skips it will surface as a verify failure.
      continue;
    }

    const hasBundle = entries.some(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(absolute, entry.name, "SKILL.md")),
    );
    if (hasBundle) {
      directories.push(absolute);
    }
  }

  return directories;
}

// Run initialise against one vendored skills-dir. We pass --skills-dir
// explicitly because this pipeline runs the SOURCE checkout's initialise.mjs,
// whose default skills-dir resolves relative to the script (the source's own
// skills/), not the consumer being updated.
function runInitialise(source, consumer, facts, apply, skillsDirectory) {
  const script = join(
    source,
    "skills/rheged-skills-setup/scripts/initialise.mjs",
  );
  run(
    process.execPath,
    [
      script,
      apply ? "--write" : "--dry-run",
      "--json",
      "--repo-root",
      consumer,
      "--skills-dir",
      skillsDirectory,
    ],
    consumer,
    JSON.stringify(facts),
  );
  console.log(
    `fleet-update: reconciled ${relative(consumer, skillsDirectory)} (initialise ${apply ? "--write" : "--dry-run"}).`,
  );
}

/**
 * Verify with check-updates. In apply mode (`assert`) a repo still behind — or a
 * missing/unparseable report — is a hard failure (exit 1). In preview mode the
 * verify is informational: a fresh repo has no lock yet, so a non-zero
 * check-updates (or pending bumps) is reported, never fatal.
 */
function runVerify(source, consumer, ref, { assert }, skills) {
  const script = join(
    source,
    "skills/rheged-skills-setup/scripts/check-updates.mjs",
  );
  const lock = join(consumer, ".claude", "skills.lock");
  // Scope the diff to the install set so the repo-internal scaffold-new-skill isn't
  // a perpetual `added` update that fails verify on an otherwise up-to-date repo
  // (A-741). `skills` is always the resolved list (never empty) from the caller.
  const skillsScope =
    skills && skills.length > 0 ? ["--skills", skills.join(",")] : [];
  const result = spawnCapture(
    process.execPath,
    [
      script,
      "--source",
      source,
      ...(ref ? ["--ref", ref] : []),
      "--lock",
      lock,
      ...skillsScope,
      "--json",
    ],
    consumer,
  );
  if (result.status !== 0) {
    const detail =
      result.stderr?.trim() || `check-updates exited ${result.status}`;
    if (assert) {
      console.error(`fleet-update: verify failed — ${detail}`);
      process.exit(1);
    }

    console.log(`fleet-update: verify skipped — ${detail}`);
    return;
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    if (assert) {
      fail(`could not parse check-updates report: ${error.message}`, 1);
    }

    console.log(
      "fleet-update: verify skipped — unparseable check-updates report.",
    );
    return;
  }

  const verdict = interpretCheckUpdates(report);
  if (verdict.ok) {
    console.log(
      "fleet-update: verify OK — repo is up to date (updatesAvailable=false).",
    );
    return;
  }

  const summary = verdict.reason ?? `${verdict.bumps.length} skill(s) behind`;
  const bumpLines = verdict.bumps.map(
    (bump) => `  ${bump.name}  ${bump.from} → ${bump.to}  (${bump.bump})`,
  );
  if (assert) {
    console.error(`fleet-update: verify failed — ${summary}`);
    for (const line of bumpLines) {
      console.error(line);
    }

    process.exit(1);
  }

  console.log(`fleet-update: would update — ${summary}`);
  for (const line of bumpLines) {
    console.log(line);
  }
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

  let profile;
  try {
    profile = parseProfile(readProfileSource(options.profile));
  } catch (error) {
    fail(error.message, 2);
  }

  // Emit the resolved install set (comma-separated) and exit — the fan-out
  // pre-flight (fanout-skills.yml) reads it to scope its check-updates probe to the
  // same skills the roll installs, so the repo-internal scaffold-new-skill doesn't
  // read as a perpetual update (A-741). Needs only the profile, not a checkout.
  if (options.printSkills) {
    console.log(resolveSkills(profile).join(","));
    return;
  }

  const source = resolve(options.source ?? SOURCE_DEFAULT);
  if (!existsSync(join(source, "skills"))) {
    fail(`--source is not an agent-skills checkout (no skills/): ${source}`, 2);
  }

  const consumer = resolve(profile.repo);
  if (!existsSync(consumer) || !statSync(consumer).isDirectory()) {
    fail(`profile 'repo' must be an existing directory: ${consumer}`, 2);
  }

  // The one ref used consistently: recorded as skills.lock `lockRef` and diffed
  // by verify. Defaults to "main" (the fleet convention) when --ref is omitted;
  // the orchestrator pins it to the tag/SHA the source checkout is at.
  const ref = options.ref ?? "main";

  console.log(
    `fleet-update: ${options.apply ? "applying" : "previewing"} update for ${consumer}`,
  );

  const facts = buildInitialiseFacts(profile, { ref });
  const rhegedSkills = resolveSkills(profile);
  const installSkills = resolveFullInstallSkills(profile);

  // Fail-safe (A-757): every Rheged install-set skill must exist in the source before we
  // touch the consumer. Matt packs are probed after install, not against this checkout.
  const missingFromSource = findMissingRhegedSourceSkills(
    FLEET_CATALOGUE,
    (skill) => existsSync(join(source, "skills", skill, "SKILL.md")),
  ).filter((skill) => rhegedSkills.includes(skill));
  if (missingFromSource.length > 0) {
    fail(
      `install set names skill(s) absent from --source (${source}): ${missingFromSource.join(", ")}. ` +
        "Refusing to touch the consumer — a profile skill missing upstream would be wiped and could not be " +
        "re-vendored (A-757). Remove it from the fleet manifest, or add it to agent-skills.",
      2,
    );
  }

  if (options.apply) {
    // Wipe the install set's vendored dirs BEFORE the --copy so fresh SKILL.md
    // files land even if the CLI's copy is additive (A-741); the restore that
    // follows brings back the config.json the wipe removed (A-706).
    wipeVendoredBundles(consumer, installSkills);
    for (const addArgs of buildCatalogueInstallArgvs(profile)) {
      runSkillsAdd(consumer, addArgs);
    }

    restoreClobberedConfigs(consumer);
    const installedDirectories = findConsumerSkillsDirectories(consumer);
    if (installedDirectories.length === 0) {
      fail("no vendored skill bundles found after install", 1);
    }

    for (const directory of installedDirectories) {
      runInitialise(source, consumer, facts, true, directory);
    }

    const missingMatt = findMissingMattBundles(
      consumer,
      mattSkillNames(FLEET_CATALOGUE),
    );
    if (missingMatt.length > 0) {
      fail(
        `Matt pack install incomplete — missing bundles: ${missingMatt.join(", ")}`,
        1,
      );
    }

    runVerify(source, consumer, ref, { assert: true }, rhegedSkills);
    console.log("fleet-update: done.");
    return;
  }

  // Preview: skills.sh has no dry-run and the wipe/restore mutate, so all three are
  // described only; initialise/check-updates are read-only and run for real
  // against whatever bundles the consumer already has.
  const addPlans = buildCatalogueInstallArgvs(profile);
  console.log(
    `fleet-update: would wipe ${installSkills.length} bundle dir(s) per mirror (incl. legacy initialise-skills), then run ${addPlans.length} install(s):`,
  );
  for (const addArgs of addPlans) {
    console.log(`  skills ${addArgs.join(" ")}`);
  }

  console.log(
    "fleet-update: would restore any config.json --copy clobbers (A-706).",
  );
  const installed = findConsumerSkillsDirectories(consumer);
  if (installed.length === 0) {
    console.log(
      "fleet-update: no bundles vendored yet — would reconcile after install.",
    );
  } else {
    for (const directory of installed) {
      runInitialise(source, consumer, facts, false, directory);
    }
  }

  runVerify(source, consumer, ref, { assert: false }, rhegedSkills);
  console.log(
    "fleet-update: preview complete (re-run with --apply to execute).",
  );
}

// ---- self-test -----------------------------------------------------------

/**
 * @returns {{ name: string, ok: boolean }[]}
 */
function buildInitialiseFactsSelfTestCases() {
  const built = buildInitialiseFacts(
    {
      facts: {
        followUpProject: "Follow-up issues",
        issueKeys: ["A"],
        linearTeamName: "Acme",
      },
    },
    { ref: "v1.2.3" },
  );
  return [
    {
      name: "buildInitialiseFacts sets lockSource/lockRef and forwards facts",
      ok:
        built.facts.lockSource === SOURCE_URL &&
        built.facts.lockRef === "v1.2.3" &&
        built.facts.linearTeamName === "Acme" &&
        built.facts.followUpProject === "Follow-up issues" &&
        built.facts.issueKeys[0] === "A",
    },
    {
      name: "buildInitialiseFacts omits absent Linear facts",
      ok: !("linearWorkspaceSlug" in built.facts),
    },
  ];
}

function selfTest() {
  // Pure-function checks only — no filesystem, so no temp dir to build or clean.
  const cases = [];
  {
    // parseProfile: defaults + validation.
    const minimal = parseProfile({ repo: "/tmp/x" });
    cases.push({
      name: "parseProfile applies defaults (agents/repoType/facts)",
      ok:
        minimal.agents.length === 1 &&
        minimal.agents[0] === "claude-code" &&
        minimal.repoType === "single" &&
        typeof minimal.facts === "object" &&
        minimal.skills === undefined,
    });
    cases.push({
      name: "parseProfile rejects a profile with no repo",
      ok: throws(() => parseProfile({})),
    });
    cases.push({
      name: "parseProfile rejects non-array skills",
      ok: throws(() => parseProfile({ repo: "/tmp/x", skills: "send-it" })),
    });
    cases.push({
      name: "parseProfile rejects a bad repoType",
      ok: throws(() => parseProfile({ repo: "/tmp/x", repoType: "weird" })),
    });
    cases.push({
      name: "parseProfile parses a JSON string",
      ok: parseProfile('{"repo":"/tmp/x"}').repo === "/tmp/x",
    });

    // resolveSkills.
    const unlisted = resolveSkills({ repoType: "single", skills: undefined });
    cases.push({
      name: "resolveSkills defaults to the canonical set (no scaffold-new-skill) for an unlisted single repo",
      ok:
        Array.isArray(unlisted) &&
        unlisted.includes("send-it") &&
        unlisted.includes("triage-pr") &&
        !unlisted.includes("scaffold-new-skill") &&
        unlisted.length === CANONICAL_SKILLS.length,
    });
    const noChangelog = resolveSkills({
      repoType: "no-changelog",
      skills: undefined,
    });
    cases.push({
      name: "resolveSkills drops changelog for an unlisted no-changelog repo",
      ok:
        Array.isArray(noChangelog) &&
        !noChangelog.includes("changelog") &&
        noChangelog.includes("send-it"),
    });

    // buildSkillsAddArgs.
    const allArgs = buildSkillsAddArgs({
      agents: ["claude-code", "cursor"],
      repoType: "single",
      skills: undefined,
    });
    cases.push({
      name: "buildSkillsAddArgs installs from the URL with the canonical --skill set (no scaffold-new-skill), fans out agents, ends --copy",
      ok:
        allArgs[0] === "add" &&
        allArgs[1] === SOURCE_URL &&
        allArgs.filter((a) => a === "--skill").length ===
          CANONICAL_SKILLS.length &&
        !allArgs.includes("scaffold-new-skill") &&
        allArgs.filter((a) => a === "--agent").length === 2 &&
        allArgs.at(-1) === "--copy",
    });
    const subsetArgs = buildSkillsAddArgs({
      agents: ["claude-code"],
      repoType: "single",
      skills: ["send-it", "commit"],
    });
    cases.push({
      name: "buildSkillsAddArgs emits explicit --skill pairs for a subset",
      ok:
        subsetArgs.includes("--skill") &&
        subsetArgs[subsetArgs.indexOf("--skill") + 1] === "send-it",
    });

    // resolveWipeTargets.
    const wipeTargets = resolveWipeTargets(
      [".claude/skills", ".agents/skills"],
      ["send-it", "commit"],
    );
    cases.push({
      name: "resolveWipeTargets covers every mirror × install skill",
      ok:
        wipeTargets.length === 6 &&
        wipeTargets.includes(".claude/skills/send-it") &&
        wipeTargets.includes(".agents/skills/commit") &&
        wipeTargets.includes(".claude/skills/initialise-skills"),
    });
    cases.push({
      name: "resolveWipeTargets targets only the install set (no consumer-extra bundles)",
      ok: resolveWipeTargets([".claude/skills"], ["send-it"]).every(
        (path) => !path.includes("scaffold-new-skill"),
      ),
    });
    cases.push({
      name: "resolveWipeTargets still wipes legacy bundles when install set is empty",
      ok:
        resolveWipeTargets([".claude/skills", ".agents/skills"], []).length ===
          2 &&
        resolveWipeTargets([".claude/skills"], []).includes(
          ".claude/skills/initialise-skills",
        ),
    });

    // findMissingSourceSkills (A-757) — the apply guard's pure core.
    const present = new Set(["commit", "release-status", "send-it"]);
    cases.push({
      name: "findMissingSourceSkills flags a name absent from source",
      ok:
        findMissingSourceSkills(
          ["send-it", "initialise-package-repo"],
          (skill) => present.has(skill),
        ).join(",") === "initialise-package-repo",
    });
    cases.push({
      name: "findMissingSourceSkills passes an all-present install set",
      ok:
        findMissingSourceSkills(["send-it", "commit"], (skill) =>
          present.has(skill),
        ).length === 0,
    });
    cases.push({
      name: "findMissingSourceSkills reports every missing name",
      ok:
        findMissingSourceSkills(["pnpm", "vitest", "send-it"], (skill) =>
          present.has(skill),
        ).length === 2,
    });

    cases.push(...buildInitialiseFactsSelfTestCases());

    // detectClobberedConfigs.
    const clobbered = detectClobberedConfigs(
      [
        ".claude/skills/send-it/config.json",
        ".agents/skills/send-it/config.json",
        "README.md",
        "",
      ].join("\n"),
    );
    cases.push({
      name: "detectClobberedConfigs keeps both mirrors and drops non-config paths",
      ok:
        clobbered.length === 2 &&
        clobbered.includes(".claude/skills/send-it/config.json") &&
        clobbered.includes(".agents/skills/send-it/config.json"),
    });
    cases.push({
      name: "detectClobberedConfigs returns [] for empty input (first-ever install)",
      ok: detectClobberedConfigs("").length === 0,
    });

    // interpretCheckUpdates.
    cases.push({
      name: "interpretCheckUpdates ok when updatesAvailable is false",
      ok:
        interpretCheckUpdates({ updates: [], updatesAvailable: false }).ok ===
        true,
    });
    const behind = interpretCheckUpdates({
      updates: [{ bump: "minor", from: "0.1.0", name: "send-it", to: "0.2.0" }],
      updatesAvailable: true,
    });
    cases.push({
      name: "interpretCheckUpdates not ok + bumps when updates available",
      ok: behind.ok === false && behind.bumps.length === 1,
    });
    cases.push({
      name: "interpretCheckUpdates not ok + reason for a malformed report",
      ok:
        interpretCheckUpdates({}).ok === false &&
        Boolean(interpretCheckUpdates({}).reason),
    });
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

function throws(function_) {
  try {
    function_();
    return false;
  } catch {
    return true;
  }
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
