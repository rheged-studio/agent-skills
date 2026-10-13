#!/usr/bin/env node
// Scaffold a spec-compliant new-skill skeleton for the agent-skills repo.
//
// Given a kebab-case skill name (--name=<kebab>), this writes a fresh
// `skills/<name>/` bundle whose layout and metadata satisfy the same rules
// `pnpm validate:skills` enforces (ADR-0001 / R-364):
//
//   - package.json   : name "@rheged-studio/skill-<name>", private: true,
//                      version "0.1.0", repository.directory "skills/<name>"
//   - SKILL.md       : frontmatter name === <name>, metadata.version "0.1.0",
//                      metadata.author
//   - config.json    + config.example.json : IDENTICAL key sets (parity by
//                      construction — the example is generated from the same
//                      template object, so the two can never drift on creation)
//   - scripts/<name>.mjs : an entry script pre-wired to the standardised
//                      --help / --dry-run / --self-test dispatch idiom (R-462)
//   - tests/skills/<name>/<name>.test.ts : a vitest stub
//   - README.md      : install + usage skeleton
//
// The tests/ stub lands OUTSIDE the bundle (in the repo's `tests/` tree, which
// the root vitest glob already covers), so a generated skill's tests run with
// no config change. Every other artefact lives inside `skills/<name>/`.
//
// Zero runtime dependencies — Node built-ins only — matching the repo's other
// `.mjs` bundles.
//
// Usage:
//   node scaffold.mjs --name=<kebab>            Write skills/<name>/ + tests stub
//   node scaffold.mjs --name=<kebab> --dry-run  Print what it WOULD write; create nothing
//   node scaffold.mjs --name=<kebab> --author="…"  Override the author string
//   node scaffold.mjs --name=<kebab> --root=<dir>  Write under <dir> instead of cwd
//   node scaffold.mjs --self-test               Run the built-in offline assertions
//   node scaffold.mjs --help                    Show this message (alias: -h)

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const SKILL_SCOPE = "@rheged-studio";
export const DEFAULT_AUTHOR = "Rob Easthope";
export const INITIAL_VERSION = "0.1.0";

// A skill name must equal its directory name and match the Agent Skills spec:
// lower-case alphanumerics and single internal hyphens, max 64 chars.
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate a candidate skill name. Returns null when valid, else an error
 * string. Mirrors the spec constraints so the generator never produces a
 * bundle that `validate-skills.ts` would later reject on its name.
 */
export function validateName(name) {
  if (typeof name !== "string" || name.length === 0) {
    return "skill name is required (pass --name=<kebab-case>)";
  }

  if (name.length > 64) {
    return `skill name must be at most 64 characters (got ${name.length})`;
  }

  if (!NAME_RE.test(name)) {
    return `skill name must be kebab-case [a-z0-9-], no leading/trailing/consecutive hyphens (got ${JSON.stringify(name)})`;
  }

  return null;
}

/**
 * Build the in-memory file map for a skill skeleton. Keys are paths relative to
 * the repo root; values are the file contents. Pure — does no I/O — so the
 * dry-run preview and the self-test exercise exactly what a real write emits.
 */
export function buildSkeleton(name, options = {}) {
  const author = options.author ?? DEFAULT_AUTHOR;
  const base = `skills/${name}`;

  // config.json and config.example.json are generated from the SAME template
  // object, so their key sets are identical by construction.
  const configTemplate = {
    author,
    scope: SKILL_SCOPE,
  };

  const packageJson = {
    author: {
      name: author,
    },
    bugs: {
      url: "https://github.com/rheged-studio/agent-skills/issues",
    },
    description: `Agent skill: ${name}.`,
    engines: {
      node: ">=22",
    },
    homepage: `https://github.com/rheged-studio/agent-skills/tree/main/skills/${name}#readme`,
    keywords: ["agent-skill", "claude-code"],
    license: "MIT",
    name: `${SKILL_SCOPE}/skill-${name}`,
    private: true,
    repository: {
      directory: base,
      type: "git",
      url: "https://github.com/rheged-studio/agent-skills.git",
    },
    version: INITIAL_VERSION,
  };

  const files = {
    [`${base}/config.example.json`]: `${JSON.stringify(configTemplate, null, 2)}\n`,
    [`${base}/config.json`]: `${JSON.stringify(configTemplate, null, 2)}\n`,
    [`${base}/package.json`]: `${JSON.stringify(packageJson, null, 2)}\n`,
    [`${base}/README.md`]: readmeMd(name),
    [`${base}/scripts/${name}.mjs`]: entryScript(name),
    [`${base}/SKILL.md`]: skillMd(name, author),
    [`tests/skills/${name}/${name}.test.ts`]: testStub(name),
  };

  return files;
}

function skillMd(name, author) {
  return `---
name: ${name}
description: >-
  TODO: one or two sentences on what ${name} does AND when an agent should fire
  it. This is the trigger contract (progressive-disclosure stage 1) — be
  specific, list keywords, and say when to use it. Vague descriptions silently
  miss.
license: MIT
metadata:
  version: ${INITIAL_VERSION}
  author: ${author}
---

# ${name}

TODO: a short summary of what this skill does.

## Configuration

Knobs live in [\`config.json\`](config.json) beside this file. Read it at the
start of a run and use its values throughout. A neutral
[\`config.example.json\`](config.example.json) ships alongside as a template.

## Process

1. TODO: describe the steps the agent follows.
2. TODO: …

## Scripts

The bundled [\`scripts/${name}.mjs\`](scripts/${name}.mjs) is a zero-dependency
Node helper. It supports the standard dispatch flags:

- \`--help\` — print usage.
- \`--dry-run\` — print what it would do without making changes.
- \`--self-test\` — run built-in offline assertions.
`;
}

function readmeMd(name) {
  return `# ${name}

TODO: one-line summary.

## Install

From any consumer repo:

\`\`\`bash
npx skills add https://github.com/rheged-studio/agent-skills --skill ${name} --agent claude-code --copy
\`\`\`

\`--copy\` writes real files so the bundle is portable. Don't use \`-g\` /
\`--global\` — the install should live in the consumer repo.

## Configure

The shipped [\`config.json\`](config.json) carries defaults; a neutral
[\`config.example.json\`](config.example.json) ships alongside as a template.

## Usage

TODO: describe how the skill is invoked and what it does.
`;
}

function entryScript(name) {
  return `#!/usr/bin/env node
// Entry script for the ${name} skill.
//
// Pre-wired to the standardised --help / --dry-run / --self-test dispatch idiom
// (R-462). Replace the TODO bodies with the skill's real logic; keep the three
// flags so the bundle stays consistent with the rest of the fleet.
//
// Usage:
//   node ${name}.mjs                 Run (TODO: real behaviour)
//   node ${name}.mjs --dry-run       Print what it would do; change nothing
//   node ${name}.mjs --self-test     Run the built-in offline assertions
//   node ${name}.mjs --help          Show this message (alias: -h)

import { realpathSync } from "node:fs";

const USAGE = \`${name} — TODO: one-line summary

Usage:
  node ${name}.mjs                 Run (TODO: real behaviour)
  node ${name}.mjs --dry-run       Print what it would do; change nothing
  node ${name}.mjs --self-test     Run the built-in offline assertions
  node ${name}.mjs --help          Show this message (alias: -h)\`;

// Pure core: TODO replace with the skill's real logic. Kept side-effect-free so
// --dry-run and --self-test can exercise it without touching the filesystem.
export function run() {
  return { ok: true };
}

function selfTest() {
  const cases = [];

  cases.push({
    name: "run() returns an ok result",
    ok: run().ok === true,
  });

  let failed = 0;
  for (const { name: caseName, ok } of cases) {
    if (ok) {
      console.log(\`  ok    \${caseName}\`);
    } else {
      failed += 1;
      console.log(\`  FAIL  \${caseName}\`);
    }
  }

  console.log(\`\\n\${cases.length - failed}/\${cases.length} passed\`);
  process.exit(failed === 0 ? 0 : 1);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return;
  }

  if (argv.includes("--self-test")) {
    selfTest();
    return;
  }

  if (argv.includes("--dry-run")) {
    console.log(JSON.stringify({ dryRun: true, ...run() }, null, 2));
    return;
  }

  console.log(JSON.stringify(run(), null, 2));
}

// Run main() only when invoked directly as a CLI, not when imported. Compare
// realpath'd paths so symlinks don't cause a false negative.
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
  main();
}
`;
}

function testStub(name) {
  return `import { describe, expect, it } from "vitest";

import { run } from "../../../skills/${name}/scripts/${name}.mjs";

describe("${name}", () => {
  it("run() returns an ok result", () => {
    // TODO: replace this stub with real assertions over the skill's behaviour.
    expect(run().ok).toBe(true);
  });
});
`;
}

// ---- write / dry-run ----------------------------------------------------

/**
 * Refuse to overwrite an existing, non-empty target. The skill bundle directory
 * (`<root>/skills/<name>/`) is the thing guarded: it is "occupied" if it exists
 * as a non-empty directory, or as a file. An empty/absent directory is fine.
 */
export function targetIsOccupied(root, name) {
  const directory = join(root, "skills", name);
  if (!existsSync(directory)) {
    return false;
  }

  if (statSync(directory).isDirectory()) {
    return readdirSync(directory).length > 0;
  }

  // A file where the bundle directory should be — definitely occupied.
  return true;
}

export function writeSkeleton(name, options = {}) {
  const root = options.root ?? process.cwd();
  const files = buildSkeleton(name, options);

  if (!options.force && targetIsOccupied(root, name)) {
    const base = join(root, "skills", name);
    throw new Error(
      `Refusing to overwrite a non-empty target: ${base} already exists with content. ` +
        "Remove it first, or choose a different --name.",
    );
  }

  const written = [];
  for (const [relativePath, contents] of Object.entries(files)) {
    const full = join(root, relativePath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
    written.push(relativePath);
  }

  return written.toSorted();
}

// ---- arg parsing --------------------------------------------------------

export function parseArgs(argv) {
  const flags = new Set();
  const options = {};
  for (const argument of argv) {
    if (argument.startsWith("--")) {
      const eq = argument.indexOf("=");
      if (eq === -1) {
        flags.add(argument);
      } else {
        options[argument.slice(2, eq)] = argument.slice(eq + 1);
      }
    } else if (argument === "-h") {
      flags.add("--help");
    }
  }

  return { flags, options };
}

// ---- self-test ----------------------------------------------------------

// Inline mirror of the validate-skills.ts rules, so the self-test proves the
// generated skeleton passes the very same gate without importing the TS file.
const SEMVER_RE =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseFrontmatterVersionAndName(skillRaw) {
  // Minimal YAML frontmatter reader — enough for the two fields the validator
  // checks (top-level `name`, `metadata.version`). Avoids a gray-matter dep.
  const match = /^---\n([\s\S]*?)\n---/.exec(skillRaw);
  if (!match) {
    return {};
  }

  const lines = match[1].split("\n");
  let name;
  let version;
  let inMetadata = false;
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon === -1) {
      continue;
    }

    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    // A top-level key has no leading whitespace; a nested one is indented.
    const isTopLevel = !/^\s/.test(line);

    if (isTopLevel) {
      inMetadata = key === "metadata";
      if (key === "name") {
        name = value;
      }
    } else if (inMetadata && key === "version") {
      version = value;
    }
  }

  return { name, version };
}

export function validateSkeleton(name, files) {
  const errors = [];
  const base = `skills/${name}`;

  const pkg = JSON.parse(files[`${base}/package.json`]);
  if (pkg.name !== `${SKILL_SCOPE}/skill-${name}`) {
    errors.push(`package.json name wrong: ${pkg.name}`);
  }

  if (pkg.private !== true) {
    errors.push("package.json private must be true");
  }

  if (typeof pkg.version !== "string" || !SEMVER_RE.test(pkg.version)) {
    errors.push(`package.json version not semver: ${pkg.version}`);
  }

  if (pkg.repository?.directory !== base) {
    errors.push(`repository.directory wrong: ${pkg.repository?.directory}`);
  }

  const fm = parseFrontmatterVersionAndName(files[`${base}/SKILL.md`]);
  if (fm.name !== name) {
    errors.push(`SKILL.md name must equal directory: ${fm.name}`);
  }

  if (fm.version !== pkg.version) {
    errors.push(
      `SKILL.md metadata.version (${fm.version}) must equal package.json version (${pkg.version})`,
    );
  }

  const config = JSON.parse(files[`${base}/config.json`]);
  const example = JSON.parse(files[`${base}/config.example.json`]);
  const configKeys = Object.keys(config).toSorted().join(",");
  const exampleKeys = Object.keys(example).toSorted().join(",");
  if (configKeys !== exampleKeys) {
    errors.push(
      `config.json / config.example.json key sets differ: [${configKeys}] vs [${exampleKeys}]`,
    );
  }

  return errors;
}

function selfTest() {
  const cases = [];

  // 1. Name validation accepts good names, rejects bad ones.
  cases.push({
    name: "validateName accepts a good kebab name",
    ok: validateName("my-new-skill") === null,
  });
  for (const bad of [
    "My-Skill",
    "-leading",
    "trailing-",
    "double--hyphen",
    "",
  ]) {
    cases.push({
      name: `validateName rejects ${JSON.stringify(bad)}`,
      ok: validateName(bad) !== null,
    });
  }

  // 2. The generated skeleton passes the validate-skills rules.
  const files = buildSkeleton("my-new-skill");
  const errors = validateSkeleton("my-new-skill", files);
  cases.push({
    name: "generated skeleton passes the validate-skills rules",
    ok: errors.length === 0,
  });
  if (errors.length > 0) {
    for (const message of errors) {
      console.log(`        ${message}`);
    }
  }

  // 3. config.json and config.example.json have identical key sets.
  cases.push({
    name: "config and example key sets are identical",
    ok:
      Object.keys(JSON.parse(files["skills/my-new-skill/config.json"]))
        .toSorted()
        .join(",") ===
      Object.keys(JSON.parse(files["skills/my-new-skill/config.example.json"]))
        .toSorted()
        .join(","),
  });

  // 4. The bundle includes the entry script and the tests stub lands outside it.
  cases.push({
    name: "entry script and out-of-bundle test stub are emitted",
    ok:
      typeof files["skills/my-new-skill/scripts/my-new-skill.mjs"] ===
        "string" &&
      typeof files["tests/skills/my-new-skill/my-new-skill.test.ts"] ===
        "string",
  });

  // 5. --dry-run writes nothing; a real write produces the files; clobber refused.
  const temporary = mkdtempSync(join(tmpdir(), "scaffold-self-test-"));
  try {
    // The dry-run path uses only the pure buildSkeleton, so prove the tmp dir
    // stays empty after building.
    buildSkeleton("dryrun-skill");
    cases.push({
      name: "buildSkeleton (the dry-run path) touches no filesystem",
      ok: readdirSync(temporary).length === 0,
    });

    const written = writeSkeleton("real-skill", { root: temporary });
    cases.push({
      name: "writeSkeleton creates the bundle files",
      ok:
        written.includes("skills/real-skill/package.json") &&
        written.includes("skills/real-skill/SKILL.md") &&
        existsSync(
          join(temporary, "skills/real-skill/scripts/real-skill.mjs"),
        ) &&
        existsSync(
          join(temporary, "tests/skills/real-skill/real-skill.test.ts"),
        ),
    });

    let clobberRefused = false;
    try {
      writeSkeleton("real-skill", { root: temporary });
    } catch {
      clobberRefused = true;
    }

    cases.push({
      name: "writeSkeleton refuses to clobber a non-empty target",
      ok: clobberRefused,
    });
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }

  let failed = 0;
  for (const { name: caseName, ok } of cases) {
    if (ok) {
      console.log(`  ok    ${caseName}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${caseName}`);
    }
  }

  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

// ---- CLI ----------------------------------------------------------------

const USAGE = `scaffold — generate a spec-compliant new-skill skeleton under skills/<name>/

Usage:
  node scaffold.mjs --name=<kebab>            Write skills/<name>/ + a tests stub
  node scaffold.mjs --name=<kebab> --dry-run  Print what it WOULD write; create nothing
  node scaffold.mjs --name=<kebab> --author="…"  Override the author string
  node scaffold.mjs --name=<kebab> --root=<dir>  Write under <dir> instead of cwd
  node scaffold.mjs --self-test               Run the built-in offline assertions
  node scaffold.mjs --help                    Show this message (alias: -h)`;

function main() {
  const argv = process.argv.slice(2);
  const { flags, options } = parseArgs(argv);

  if (flags.has("--help")) {
    console.log(USAGE);
    return;
  }

  if (flags.has("--self-test")) {
    selfTest();
    return;
  }

  const name = options.name;
  const nameError = validateName(name);
  if (nameError) {
    console.error(nameError);
    process.exit(1);
  }

  const buildOptions = {};
  if (options.author !== undefined) {
    buildOptions.author = options.author;
  }

  if (flags.has("--dry-run")) {
    const files = buildSkeleton(name, buildOptions);
    console.log(`Would write ${Object.keys(files).length} file(s):\n`);
    for (const path of Object.keys(files).toSorted()) {
      console.log(`  ${path}`);
    }

    console.log("\n(dry-run — nothing was written)");
    return;
  }

  const writeOptions = { ...buildOptions };
  if (options.root !== undefined) {
    writeOptions.root = options.root;
  }

  let written;
  try {
    written = writeSkeleton(name, writeOptions);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(
    `Scaffolded skills/${name}/ — wrote ${written.length} file(s):\n`,
  );
  for (const path of written) {
    console.log(`  ${path}`);
  }

  console.log(
    `\nNext: fill in the TODOs in skills/${name}/SKILL.md, then run ` +
      "pnpm validate:skills && pnpm test.",
  );
}

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
  main();
}
