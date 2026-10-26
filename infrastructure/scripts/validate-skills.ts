#!/usr/bin/env -S npx tsx
// Validates the per-skill bundle metadata under `skills/<name>/` (R-364).
//
// Skills are NOT npm-published and NOT Changesets-managed (ADR-0002): each
// carries its own version OUT OF BAND, as a non-npm label. This guard makes
// that contract enforceable instead of merely documented, so the metadata
// can't silently drift across skills. For every `skills/<name>/`:
//
//   - package.json exists, with:
//       name    === `@rheged-studio/skill-<name>` (the `skill-` prefix +
//                   directory name — ADR-0001 Decision 1)
//       private === true (accidental-publish guard — these never go to npm)
//       version  is a semver string
//   - SKILL.md exists, with:
//       name             === the directory name (Agent Skills spec)
//       metadata.version === package.json version (the sanctioned mirror —
//                            ADR-0001 Decision 2; the two must agree)
//
// `skills-ref validate` (the skill-manifests CI job) already checks SKILL.md
// against the spec; this guard adds the ACME-specific package.json + version
// parity rules it doesn't cover.
//
// It also checks the shared `## Untrusted input` SKILL.md convention (R-2870,
// docs/skill-conventions.md): a SKILL.md that names a known ingestion command
// must carry that section. That check is warn-only for now (see
// UNTRUSTED_INPUT_SEVERITY).
//
// The pure `validateSkill(...)` returns an array of error strings (empty means
// valid), so it's trivially unit-testable; main() walks the directory.

import matter from "gray-matter";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const SKILLS_DIR = "skills";
export const SKILL_SCOPE = "@rheged-studio";
// This repo's real (dogfood) configs live here, not in skills/<name>/config.json
// (gitignored since R-615). The key-parity guard validates these tracked files.
export const DOGFOOD_CONFIG_DIR = join("infrastructure", "dogfood-config");

const SEMVER_RE =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * Validate one skill bundle. `pkgRaw` / `skillRaw` are null when the file is
 * absent. Returns an array of human-readable error strings.
 */
export function validateSkill(
  directory: string,
  pkgRaw: null | string,
  skillRaw: null | string,
): string[] {
  const errors: string[] = [];
  function fail(message: string): void {
    errors.push(`${directory}: ${message}`);
  }

  if (skillRaw === null) {
    fail("missing SKILL.md");
  }

  if (pkgRaw === null) {
    fail("missing package.json");
    return errors;
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
  } catch (error) {
    fail(`package.json is not valid JSON: ${(error as Error).message}`);
    return errors;
  }

  const expectedName = `${SKILL_SCOPE}/skill-${directory}`;
  if (pkg.name !== expectedName) {
    fail(
      `package.json name must be "${expectedName}" (got ${JSON.stringify(pkg.name)})`,
    );
  }

  if (pkg.private !== true) {
    fail('package.json must set "private": true (skills are never published)');
  }

  const pkgVersion = pkg.version;
  if (typeof pkgVersion !== "string" || !SEMVER_RE.test(pkgVersion)) {
    fail(
      `package.json version must be a semver string (got ${JSON.stringify(pkgVersion)})`,
    );
  }

  if (skillRaw === null) {
    return errors;
  }

  let fm: Record<string, unknown>;
  try {
    fm = (matter(skillRaw).data ?? {}) as Record<string, unknown>;
  } catch (error) {
    fail(`SKILL.md frontmatter unparseable: ${(error as Error).message}`);
    return errors;
  }

  if (fm.name !== directory) {
    fail(
      `SKILL.md name must equal the directory name "${directory}" (got ${JSON.stringify(fm.name)})`,
    );
  }

  const metadata = (fm.metadata ?? {}) as Record<string, unknown>;
  const skillVersion = metadata.version;
  if (skillVersion === undefined) {
    fail(
      "SKILL.md metadata.version is missing (mirror the package.json version)",
    );
  } else if (
    typeof pkgVersion === "string" &&
    String(skillVersion) !== pkgVersion
  ) {
    fail(
      `SKILL.md metadata.version (${JSON.stringify(skillVersion)}) must equal package.json version (${JSON.stringify(pkgVersion)})`,
    );
  }

  return errors;
}

/**
 * Commands and tools that pull outsider-authored text (PR bodies, review threads,
 * CI logs, commit messages, Linear issue fields) into the agent's context. A
 * SKILL.md that names any of these must carry the `## Untrusted input` section
 * (R-2870 — see docs/skill-conventions.md). Add new ingestion commands here.
 */
export const UNTRUSTED_INPUT_INGESTION_COMMANDS: readonly string[] = [
  "gh pr view",
  "gh pr list",
  "gh run view --log",
  "git log",
  "git diff",
  "mcp__linear-server__get_issue",
];

/**
 * How main() treats a missing `## Untrusted input` section. It is `"warn"` while
 * the per-skill rollout (the sub-issues of R-2869) lands in any order; flip it to
 * `"error"` once every flagged skill carries the section, and the same findings
 * will fail the build (R-2880).
 */
export type UntrustedInputSeverity = "error" | "warn";
export const UNTRUSTED_INPUT_SEVERITY: UntrustedInputSeverity = "warn";

const UNTRUSTED_INPUT_HEADING_RE = /^##[ \t]+Untrusted input[ \t]*$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Whether a SKILL.md has a real `## Untrusted input` heading — one outside any
 * fenced code block, so a quoted template example doesn't count as the section.
 */
export function hasUntrustedInputHeading(skillRaw: string): boolean {
  let fence: null | string = null;
  for (const line of skillRaw.split(/\r?\n/)) {
    const marker = FENCE_RE.exec(line)?.[1];
    if (fence === null) {
      if (marker !== undefined) {
        fence = marker;
      } else if (UNTRUSTED_INPUT_HEADING_RE.test(line)) {
        return true;
      }
    } else if (
      marker !== undefined &&
      marker[0] === fence[0] &&
      marker.length >= fence.length &&
      line.trim() === marker
    ) {
      // A closing fence uses the same character, at least as long, alone on
      // its line (CommonMark).
      fence = null;
    }
  }

  return false;
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
}

/**
 * The ingestion commands a SKILL.md names, in
 * `UNTRUSTED_INPUT_INGESTION_COMMANDS` order.
 */
export function ingestionCommandsIn(skillRaw: string): string[] {
  return UNTRUSTED_INPUT_INGESTION_COMMANDS.filter((command) =>
    ingestionPattern(command).test(skillRaw),
  );
}

/**
 * The regex for one ingestion command. The leading edge rejects a longer word
 * (`legit log`); the trailing edge rejects a longer word (`git logger`) but
 * keeps flags and sub-forms (`git log --oneline`, `git diff-tree`). A command
 * that ends in a flag (`gh run view --log`) also matches with arguments before
 * the flag on the same line (`gh run view <run-id> --log-failed`).
 */
function ingestionPattern(command: string): RegExp {
  const flagAt = command.indexOf(" --");
  const body =
    flagAt === -1
      ? escapeRegExp(command)
      : `${escapeRegExp(command.slice(0, flagAt))}[^\\n]*?[ \\t]${escapeRegExp(command.slice(flagAt + 1))}`;
  return new RegExp(String.raw`(?<![\w-])${body}(?![A-Za-z0-9_])`);
}

/**
 * Check one SKILL.md against the `## Untrusted input` convention (R-2870).
 * Returns one finding when the skill names an ingestion command but has no such
 * section; empty when it complies or names none. The caller picks the severity
 * — see `UNTRUSTED_INPUT_SEVERITY`.
 */
export function untrustedInputFindings(
  directory: string,
  skillRaw: null | string,
): string[] {
  if (skillRaw === null) {
    return [];
  }

  const commands = ingestionCommandsIn(skillRaw);
  if (commands.length === 0 || hasUntrustedInputHeading(skillRaw)) {
    return [];
  }

  const named = commands.map((command) => `\`${command}\``).join(", ");
  return [
    `${directory}: SKILL.md names ${named} but has no "## Untrusted input" section (see docs/skill-conventions.md)`,
  ];
}

/**
 * Route one SKILL.md's untrusted-input findings to errors or warnings by
 * `severity` (default `UNTRUSTED_INPUT_SEVERITY`). Warnings never fail the run.
 */
export function classifyUntrustedInput(
  directory: string,
  skillRaw: null | string,
  severity: UntrustedInputSeverity = UNTRUSTED_INPUT_SEVERITY,
): { errors: string[]; warnings: string[] } {
  const findings = untrustedInputFindings(directory, skillRaw);
  return severity === "error"
    ? { errors: findings, warnings: [] }
    : { errors: [], warnings: findings };
}

/**
 * Top-level config keys whose value is a **data map** keyed by user data, not a
 * fixed structure — triage-pr's `reviewBotChecks` maps review-bot logins to check
 * specs. Its entries are values, so parity compares the key itself but never
 * recurses into it: the example ships the neutral `{}` (so a consumer's untouched
 * `{}` still equals the placeholder and is filled on reconcile) while this repo's
 * dogfood config carries the detected `claude` mapping (R-2453).
 */
const MAP_VALUED_TOPLEVEL = new Set(["reviewBotChecks"]);

/**
 * Every dotted key path in a JSON object (recursing into nested objects, but not
 * arrays — array contents are values, not structure — nor the top-level data maps
 * in `MAP_VALUED_TOPLEVEL`). `{a: 1, b: {c: 2}}` → `["a", "b", "b.c"]`.
 */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(path);
    if (!(prefix === "" && MAP_VALUED_TOPLEVEL.has(key))) {
      out.push(...keyPaths(nested, path));
    }
  }

  return out;
}

/**
 * Top-level config keys that may legitimately live in `config.json` without
 * appearing in the template `config.example.json`. These are opt-in, config-only
 * features a neutral single-package template deliberately omits — `send-it`'s
 * `bundleVersioning` is the canonical case (R-555): it is added by hand only in
 * multi-bundle repos, so shipping it in the example would force a bogus key into
 * every single-package consumer's reset config (and flag it `needs-manual-input`
 * on every `initialise-skills` run). The exemption applies to the **whole subtree**
 * but **only when the example omits the top-level key entirely** — a partially
 * present block (example has some sub-keys but not others) is still a genuine
 * mismatch and stays flagged.
 */
const OPTIONAL_CONFIG_ONLY_TOPLEVEL = new Set(["bundleVersioning"]);

function topLevelKey(key: string): string {
  const dot = key.indexOf(".");
  return dot === -1 ? key : key.slice(0, dot);
}

/**
 * The shipped `config.example.json` (the template a consumer copies over) and this
 * repo's own real config must share a key structure — a key in one but not the
 * other means an adopter silently gets a stale or incomplete config (R-538). Values
 * may differ (the example carries placeholders); only the key sets are compared,
 * recursively.
 *
 * Since R-615 the per-skill `config.json` is gitignored (it would otherwise be
 * vendored into consumers by `skills add --copy`), so this repo's real values live
 * in the tracked `infrastructure/dogfood-config/<name>.json` tree — that is what
 * `configRaw` carries here, not `skills/<name>/config.json`. Skills with no dogfood
 * config (e.g. `preflight`, whose config lives at the consumer root) are exempt, as
 * are the config-only optional subtrees in `OPTIONAL_CONFIG_ONLY_TOPLEVEL`. `*Raw`
 * are null when the file is absent.
 */
export function configKeyParityErrors(
  directory: string,
  configRaw: null | string,
  exampleRaw: null | string,
): string[] {
  if (configRaw === null || exampleRaw === null) {
    return [];
  }

  const errors: string[] = [];
  let config: unknown;
  let example: unknown;
  try {
    config = JSON.parse(configRaw);
  } catch (error) {
    errors.push(
      `${directory}: infrastructure/dogfood-config/${directory}.json is not valid JSON: ${(error as Error).message}`,
    );
  }

  try {
    example = JSON.parse(exampleRaw);
  } catch (error) {
    errors.push(
      `${directory}: config.example.json is not valid JSON: ${(error as Error).message}`,
    );
  }

  if (errors.length > 0) {
    return errors;
  }

  const configKeys = new Set(keyPaths(config));
  const exampleKeys = new Set(keyPaths(example));
  const onlyInConfig = [...configKeys].filter((key) => {
    if (exampleKeys.has(key)) {
      return false;
    }

    // A config-only optional subtree (e.g. bundleVersioning) is exempt only when
    // the example omits the top-level key wholesale; a partial block still flags.
    const top = topLevelKey(key);
    if (OPTIONAL_CONFIG_ONLY_TOPLEVEL.has(top) && !exampleKeys.has(top)) {
      return false;
    }

    return true;
  });
  const onlyInExample = [...exampleKeys].filter((key) => !configKeys.has(key));

  if (onlyInConfig.length > 0) {
    errors.push(
      `${directory}: infrastructure/dogfood-config/${directory}.json has keys missing from config.example.json: ${onlyInConfig.join(", ")}`,
    );
  }

  if (onlyInExample.length > 0) {
    errors.push(
      `${directory}: config.example.json has keys missing from infrastructure/dogfood-config/${directory}.json: ${onlyInExample.join(", ")}`,
    );
  }

  return errors;
}

function listSkillDirectories(directory: string): string[] {
  let stat;
  try {
    stat = statSync(directory);
  } catch {
    console.error(`skills directory not found: ${directory}`);
    process.exit(2);
  }

  if (!stat.isDirectory()) {
    console.error(`${directory} is not a directory`);
    process.exit(2);
  }

  return (
    readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      // A directory is a skill bundle if it has either marker file; a bare dir
      // with neither is ignored (e.g. future non-bundle scaffolding).
      .filter(
        (name) =>
          existsSync(join(directory, name, "SKILL.md")) ||
          existsSync(join(directory, name, "package.json")),
      )
  );
}

function readOrNull(path: string): null | string {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function main(): void {
  const directories = listSkillDirectories(SKILLS_DIR);
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const directory of directories) {
    const base = join(SKILLS_DIR, directory);
    const skillRaw = readOrNull(join(base, "SKILL.md"));
    errors.push(
      ...validateSkill(
        directory,
        readOrNull(join(base, "package.json")),
        skillRaw,
      ),
      ...configKeyParityErrors(
        directory,
        readOrNull(join(DOGFOOD_CONFIG_DIR, `${directory}.json`)),
        readOrNull(join(base, "config.example.json")),
      ),
    );
    const untrusted = classifyUntrustedInput(directory, skillRaw);
    errors.push(...untrusted.errors);
    warnings.push(...untrusted.warnings);
  }

  if (warnings.length > 0) {
    console.warn(`Skill validation produced ${warnings.length} warning(s):\n`);
    for (const message of warnings) {
      console.warn(`  - ${message}`);
    }

    console.warn("");
  }

  if (errors.length > 0) {
    console.error(`Skill validation failed with ${errors.length} error(s):\n`);
    for (const message of errors) {
      console.error(`  - ${message}`);
    }

    process.exit(1);
  }

  const skillCount = `${directories.length} skill${directories.length === 1 ? "" : "s"} checked`;
  const warningCount =
    warnings.length === 0
      ? ""
      : `, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`;
  console.log(`Skill validation passed (${skillCount}${warningCount}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
