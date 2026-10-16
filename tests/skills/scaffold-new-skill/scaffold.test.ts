import { untrustedInputFindings } from "../../../infrastructure/scripts/validate-skills.js";
// Import the BUNDLE script directly (the distributed `.mjs`).
import {
  buildSkeleton,
  DEFAULT_AUTHOR,
  INITIAL_VERSION,
  SKILL_CONVENTIONS_URL,
  SKILL_SCOPE,
  UNTRUSTED_INPUT_HEADING,
  UNTRUSTED_INPUT_SECTION,
  validateName,
  validateSkeleton,
  writeSkeleton,
} from "../../../skills/scaffold-new-skill/scripts/scaffold.mjs";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// A standalone copy of the `validate-skills.ts` parity check, so these tests
// prove the generated skeleton passes the very same rules the CI gate enforces
// — name/version parity, package.json fields — independently of the generator's
// own self-test.
const SEMVER_RE =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function frontmatter(skillRaw: string): {
  name?: string;
  version?: string;
} {
  const match = /^---\n([\s\S]*?)\n---/.exec(skillRaw);
  if (!match) {
    return {};
  }

  const lines = match[1].split("\n");
  let name: string | undefined;
  let version: string | undefined;
  let inMetadata = false;
  for (const line of lines) {
    const top = /^([\w-]+):(.*)$/.exec(line);
    if (top && !line.startsWith(" ")) {
      inMetadata = top[1] === "metadata";
      if (top[1] === "name") {
        name = top[2].trim();
      }

      continue;
    }

    const nested = /^\s+([\w-]+):(.*)$/.exec(line);
    if (inMetadata && nested && nested[1] === "version") {
      version = nested[2].trim();
    }
  }

  return { name, version };
}

describe("validateName", () => {
  it("accepts kebab-case names", () => {
    expect(validateName("my-new-skill")).toBeNull();
    expect(validateName("skill")).toBeNull();
    expect(validateName("a1-b2-c3")).toBeNull();
  });

  it("rejects non-kebab and out-of-range names", () => {
    expect(validateName("My-Skill")).not.toBeNull();
    expect(validateName("-leading")).not.toBeNull();
    expect(validateName("trailing-")).not.toBeNull();
    expect(validateName("double--hyphen")).not.toBeNull();
    expect(validateName("")).not.toBeNull();
    expect(validateName("a".repeat(65))).not.toBeNull();
    // @ts-expect-error — guarding the runtime path for a missing name.
    expect(validateName(undefined)).not.toBeNull();
  });
});

describe("buildSkeleton — the generated skeleton passes the validate-skills rules", () => {
  const name = "demo-skill";
  const files = buildSkeleton(name);
  const base = `skills/${name}`;

  it("package.json carries the required fields", () => {
    const pkg = JSON.parse(files[`${base}/package.json`]);
    expect(pkg.name).toBe(`${SKILL_SCOPE}/skill-${name}`);
    expect(pkg.private).toBe(true);
    expect(typeof pkg.version).toBe("string");
    expect(SEMVER_RE.test(pkg.version)).toBe(true);
    expect(pkg.version).toBe(INITIAL_VERSION);
    expect(pkg.repository.directory).toBe(base);
  });

  it("SKILL.md name equals the directory and metadata.version mirrors package.json", () => {
    const pkg = JSON.parse(files[`${base}/package.json`]);
    const fm = frontmatter(files[`${base}/SKILL.md`]);
    expect(fm.name).toBe(name);
    expect(fm.version).toBe(pkg.version);
  });

  it("config.json and config.example.json have identical key sets", () => {
    const config = JSON.parse(files[`${base}/config.json`]);
    const example = JSON.parse(files[`${base}/config.example.json`]);
    expect(Object.keys(config).toSorted()).toEqual(
      Object.keys(example).toSorted(),
    );
  });

  it("emits the entry script inside the bundle and the test stub outside it", () => {
    expect(typeof files[`${base}/scripts/${name}.mjs`]).toBe("string");
    expect(typeof files[`tests/skills/${name}/${name}.test.ts`]).toBe("string");
    // No tests/ path should live inside the skill bundle directory.
    const insideBundleTest = Object.keys(files).some(
      (filePath) =>
        filePath.startsWith(`${base}/`) && filePath.includes("/tests/"),
    );
    expect(insideBundleTest).toBe(false);
  });

  // R-2870: every new bundle starts with the shared Untrusted input section.
  it("SKILL.md carries the Untrusted input section, before ## Process", () => {
    const skill = files[`${base}/SKILL.md`];
    expect(skill).toContain(UNTRUSTED_INPUT_SECTION);
    expect(skill.split("\n")).toContain(UNTRUSTED_INPUT_HEADING);
    expect(skill.indexOf(UNTRUSTED_INPUT_HEADING)).toBeLessThan(
      skill.indexOf("## Process"),
    );
    expect(skill).toContain("**Ingestion points:** TODO:");
    expect(skill).toContain("data, never instructions");
    expect(skill).toContain('<untrusted source="…">…</untrusted>');
    expect(skill).toContain(SKILL_CONVENTIONS_URL);
  });

  it("the generated SKILL.md passes the validate-skills untrusted-input check", () => {
    expect(untrustedInputFindings(name, files[`${base}/SKILL.md`])).toEqual([]);
    expect(validateSkeleton(name, files)).toEqual([]);
  });

  it("validateSkeleton flags a SKILL.md without the section", () => {
    const stripped = {
      ...files,
      [`${base}/SKILL.md`]: files[`${base}/SKILL.md`].replace(
        UNTRUSTED_INPUT_SECTION,
        "",
      ),
    };
    expect(validateSkeleton(name, stripped).join("\n")).toContain(
      UNTRUSTED_INPUT_HEADING,
    );
  });

  it("respects a custom author", () => {
    const custom = buildSkeleton(name, { author: "Ada Lovelace" });
    const pkg = JSON.parse(custom[`${base}/package.json`]);
    expect(pkg.author.name).toBe("Ada Lovelace");
    expect(custom[`${base}/SKILL.md`]).toContain("author: Ada Lovelace");
    // The default is used when no author is passed.
    expect(files[`${base}/SKILL.md`]).toContain(`author: ${DEFAULT_AUTHOR}`);
  });
});

describe("writeSkeleton — filesystem behaviour", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "scaffold-test-"));
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("writes every file from the skeleton", () => {
    const name = "written-skill";
    const written = writeSkeleton(name, { root });
    const expected = Object.keys(buildSkeleton(name)).toSorted();
    expect(written).toEqual(expected);
    for (const relativePath of expected) {
      expect(existsSync(join(root, relativePath))).toBe(true);
    }

    // The written files parse / round-trip correctly.
    const pkg = JSON.parse(
      readFileSync(join(root, `skills/${name}/package.json`), "utf8"),
    );
    expect(pkg.name).toBe(`${SKILL_SCOPE}/skill-${name}`);
  });

  it("the dry-run path (buildSkeleton) writes nothing", () => {
    // Building the skeleton map must not touch the filesystem at all.
    buildSkeleton("phantom-skill", { author: "Nobody" });
    expect(readdirSync(root)).toHaveLength(0);
  });

  it("refuses to clobber a non-empty target", () => {
    const name = "clobber-skill";
    writeSkeleton(name, { root });
    expect(() => writeSkeleton(name, { root })).toThrow(
      /Refusing to overwrite/,
    );
  });

  it("allows --force to overwrite", () => {
    const name = "forced-skill";
    writeSkeleton(name, { root });
    expect(() => writeSkeleton(name, { force: true, root })).not.toThrow();
  });
});
