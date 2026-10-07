import {
  configKeyParityErrors,
  validateSkill,
} from "../scripts/validate-skills.js";
import { describe, expect, it } from "vitest";

function pkg(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: "@rheged-studio/skill-cleanup-repo",
    private: true,
    version: "0.1.0",
    ...over,
  });
}

// Build the SKILL.md frontmatter as explicit YAML so gray-matter parses it
// the same way it parses the real bundles.
function yamlSkill(name: string, version: null | string): string {
  const versionLine = version === null ? "" : `\n  version: ${version}`;
  return `---\nname: ${name}\nmetadata:${versionLine || "\n  other: x"}\n---\n\n# body\n`;
}

describe("validateSkill", () => {
  it("passes a well-formed bundle", () => {
    expect(
      validateSkill("cleanup-repo", pkg(), yamlSkill("cleanup-repo", "0.1.0")),
    ).toEqual([]);
  });

  it("flags a missing package.json", () => {
    const errors = validateSkill(
      "cleanup-repo",
      null,
      yamlSkill("cleanup-repo", "0.1.0"),
    );
    expect(errors.some((error) => error.includes("missing package.json"))).toBe(
      true,
    );
  });

  it("flags a missing SKILL.md", () => {
    const errors = validateSkill("cleanup-repo", pkg(), null);
    expect(errors.some((error) => error.includes("missing SKILL.md"))).toBe(
      true,
    );
  });

  it("rejects a name that doesn't match the dir + skill- prefix", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg({ name: "@rheged-studio/cleanup-repo" }),
      yamlSkill("cleanup-repo", "0.1.0"),
    );
    expect(
      errors.some((error) =>
        error.includes("@rheged-studio/skill-cleanup-repo"),
      ),
    ).toBe(true);
  });

  it("rejects private: false", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg({ private: false }),
      yamlSkill("cleanup-repo", "0.1.0"),
    );
    expect(errors.some((error) => error.includes("private"))).toBe(true);
  });

  it("rejects a non-semver version", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg({ version: "v1" }),
      yamlSkill("cleanup-repo", "0.1.0"),
    );
    expect(errors.some((error) => error.includes("semver"))).toBe(true);
  });

  it("flags a SKILL.md name that doesn't equal the dir", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg(),
      yamlSkill("wrong-name", "0.1.0"),
    );
    expect(errors.some((error) => error.includes("directory name"))).toBe(true);
  });

  it("flags metadata.version drift from package.json version", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg({ version: "0.2.0" }),
      yamlSkill("cleanup-repo", "0.1.0"),
    );
    expect(
      errors.some((error) => error.includes("must equal package.json version")),
    ).toBe(true);
  });

  it("flags a missing metadata.version", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg(),
      yamlSkill("cleanup-repo", null),
    );
    expect(
      errors.some((error) => error.includes("metadata.version is missing")),
    ).toBe(true);
  });
});

describe("configKeyParityErrors", () => {
  it("passes when the key sets match (values may differ)", () => {
    const config = JSON.stringify({ a: 1, nested: { x: true } });
    const example = JSON.stringify({ a: 99, nested: { x: false } });
    expect(configKeyParityErrors("s", config, example)).toEqual([]);
  });

  it("is exempt when only one file ships (e.g. preflight's example-only)", () => {
    expect(configKeyParityErrors("s", null, JSON.stringify({ a: 1 }))).toEqual(
      [],
    );
    expect(configKeyParityErrors("s", JSON.stringify({ a: 1 }), null)).toEqual(
      [],
    );
  });

  it("flags a key in config.json missing from the example", () => {
    const errors = configKeyParityErrors(
      "s",
      JSON.stringify({ a: 1, b: 2 }),
      JSON.stringify({ a: 1 }),
    );
    expect(
      errors.some((error) => error.includes("missing from config.example")),
    ).toBe(true);
    expect(errors.join("\n")).toContain("b");
  });

  it("flags a key in the example missing from config.json", () => {
    const errors = configKeyParityErrors(
      "s",
      JSON.stringify({ a: 1 }),
      JSON.stringify({ a: 1, extra: 3 }),
    );
    expect(
      errors.some((error) =>
        error.includes("config.example.json has keys missing"),
      ),
    ).toBe(true);
    expect(errors.join("\n")).toContain("extra");
  });

  it("compares nested object keys recursively (dotted paths)", () => {
    const errors = configKeyParityErrors(
      "s",
      JSON.stringify({ bundleVersioning: { manifest: "p", root: "skills" } }),
      JSON.stringify({ bundleVersioning: { root: "skills" } }),
    );
    expect(errors.join("\n")).toContain("bundleVersioning.manifest");
  });

  // A-555: bundleVersioning is config-only optional (single-package templates omit
  // it). config.json may carry the whole subtree while the example omits it entirely.
  it("exempts a config-only bundleVersioning subtree when the example omits it wholesale", () => {
    const config = JSON.stringify({
      baseBranch: "main",
      bundleVersioning: {
        manifest: "package.json",
        root: "skills",
        skillFile: "SKILL.md",
      },
    });
    const example = JSON.stringify({ baseBranch: "main" });
    expect(configKeyParityErrors("s", config, example)).toEqual([]);
  });

  // …but a partially-present block is still a genuine mismatch, not exempted.
  it("still flags a partial bundleVersioning block (example has the top-level key)", () => {
    const config = JSON.stringify({
      bundleVersioning: { manifest: "package.json", root: "skills" },
    });
    const example = JSON.stringify({ bundleVersioning: { root: "skills" } });
    expect(configKeyParityErrors("s", config, example).join("\n")).toContain(
      "bundleVersioning.manifest",
    );
  });

  // A-2453: reviewBotChecks is a data map (bot login → check spec), so its entries
  // are values, not structure — but the key itself must still be in both.
  it("does not recurse into the reviewBotChecks data map", () => {
    const config = JSON.stringify({
      reviewBotChecks: {
        claude: { name: "claude-review", producer: "github-actions" },
      },
    });
    const example = JSON.stringify({ reviewBotChecks: {} });
    expect(configKeyParityErrors("s", config, example)).toEqual([]);
  });

  it("still flags a reviewBotChecks key missing from the example", () => {
    const config = JSON.stringify({ reviewBotChecks: {} });
    expect(
      configKeyParityErrors("s", config, JSON.stringify({})).join("\n"),
    ).toContain("reviewBotChecks");
  });

  it("reports invalid JSON instead of throwing", () => {
    const errors = configKeyParityErrors("s", "{not json", JSON.stringify({}));
    expect(errors.some((error) => error.includes("not valid JSON"))).toBe(true);
  });
});
