import {
  classifyUntrustedInput,
  configKeyParityErrors,
  hasUntrustedInputHeading,
  ingestionCommandsIn,
  UNTRUSTED_INPUT_INGESTION_COMMANDS,
  UNTRUSTED_INPUT_SEVERITY,
  untrustedInputFindings,
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

// R-2870: the shared `## Untrusted input` convention (docs/skill-conventions.md).
function skill(body: string): string {
  return `---\nname: pr\nmetadata:\n  version: 0.1.0\n---\n\n# pr\n\n${body}\n`;
}

describe("untrustedInputFindings", () => {
  const SECTION =
    "## Untrusted input\n\nThis skill reads text that people outside this project may have written.";

  it("passes a skill that names no ingestion command", () => {
    expect(untrustedInputFindings("pr", skill("Run `pnpm test`."))).toEqual([]);
  });

  it("flags each known ingestion command when the section is missing", () => {
    for (const command of UNTRUSTED_INPUT_INGESTION_COMMANDS) {
      const findings = untrustedInputFindings(
        "pr",
        skill(`Run \`${command}\` first.`),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0]).toContain(`\`${command}\``);
      expect(findings[0]).toContain("## Untrusted input");
    }
  });

  it("lists every matched command in one finding", () => {
    const findings = untrustedInputFindings(
      "pr",
      skill("Run `gh pr view --json body` and `git log --oneline`."),
    );
    expect(findings).toEqual([
      'pr: SKILL.md names `gh pr view`, `git log` but has no "## Untrusted input" section (see docs/skill-conventions.md)',
    ]);
  });

  it("passes when the section is present", () => {
    expect(
      untrustedInputFindings(
        "pr",
        skill(`${SECTION}\n\nRun \`gh pr view --json body\`.`),
      ),
    ).toEqual([]);
  });

  it("does not accept the heading at the wrong level or with other text", () => {
    for (const heading of [
      "### Untrusted input",
      "# Untrusted input",
      "## Untrusted inputs",
      "Untrusted input",
    ]) {
      expect(
        untrustedInputFindings("pr", skill(`${heading}\n\nRun \`git diff\`.`)),
      ).toHaveLength(1);
    }
  });

  it("does not count a heading inside a fenced example as the section", () => {
    for (const fence of ["```", "~~~", "````"]) {
      const body = `Run \`gh pr view\`.\n\n${fence}markdown\n## Untrusted input\n${fence}\n`;
      expect(untrustedInputFindings("pr", skill(body))).toHaveLength(1);
      expect(hasUntrustedInputHeading(body)).toBe(false);
    }
  });

  it("finds a real heading after a closed fence, but not before it closes", () => {
    expect(
      hasUntrustedInputHeading("```\ncode\n```\n\n## Untrusted input\n"),
    ).toBe(true);
    // A shorter or different-character marker does not close the fence.
    expect(
      hasUntrustedInputHeading("````\n```\n## Untrusted input\n````\n"),
    ).toBe(false);
    expect(
      hasUntrustedInputHeading("```\n~~~\n## Untrusted input\n```\n"),
    ).toBe(false);
  });

  it("keeps flags and sub-forms but ignores longer words", () => {
    expect(ingestionCommandsIn("gh run view --log-failed")).toEqual([
      "gh run view --log",
    ]);
    expect(ingestionCommandsIn("gh run view <run-id> --log-failed")).toEqual([
      "gh run view --log",
    ]);
    // `--log` on a later line is a different command, not a log read.
    expect(ingestionCommandsIn("gh run view 1\n--log")).toEqual([]);
    expect(ingestionCommandsIn("gh run view 1 --json status")).toEqual([]);
    expect(ingestionCommandsIn("git diff-tree HEAD")).toEqual(["git diff"]);
    expect(ingestionCommandsIn("legit log")).toEqual([]);
    expect(ingestionCommandsIn("git logger")).toEqual([]);
  });

  it("is exempt when SKILL.md is missing (validateSkill reports that)", () => {
    expect(untrustedInputFindings("pr", null)).toEqual([]);
  });
});

describe("classifyUntrustedInput", () => {
  const missing = "---\nname: pr\n---\n\nRun `gh pr list`.\n";

  it("is warn-only by default, so a missing section never fails the run", () => {
    expect(UNTRUSTED_INPUT_SEVERITY).toBe("warn");
    const result = classifyUntrustedInput("pr", missing);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it("routes the same findings to errors once switched to error", () => {
    const result = classifyUntrustedInput("pr", missing, "error");
    expect(result.warnings).toEqual([]);
    expect(result.errors).toHaveLength(1);
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

  // R-555: bundleVersioning is config-only optional (single-package templates omit
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

  // R-2453: reviewBotChecks is a data map (bot login → check spec), so its entries
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
