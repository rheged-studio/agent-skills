// Imports the BUNDLE script directly (the distributed `.mjs`). Covers the pure
// lint-surface detector (A-1203): which changed paths are lint config, which
// added lines introduce an ignore / disable directive, and the report preflight
// writes to `.preflight-summary.json`. Directive fixtures are assembled from
// pieces so this file's own added lines never read as directives to the
// detector it tests.
import {
  buildLintSurface,
  findIgnoreDirective,
  isLintConfigPath,
  parseAddedLines,
} from "../../../skills/preflight/scripts/lib/lint-surface.mjs";
import { describe, expect, it } from "vitest";

const ESLINT_DISABLE = ["eslint", "disable"].join("-");
const MARKDOWNLINT_DISABLE = ["markdownlint", "disable"].join("-");
const PRETTIER_IGNORE = ["prettier", "ignore"].join("-");

describe("isLintConfigPath", () => {
  it.each([
    "eslint.config.mjs",
    "packages/web/eslint.config.ts",
    ".eslintrc.json",
    ".eslintignore",
    "eslint-suppressions.json",
    ".markdownlint-cli2.jsonc",
    ".markdownlint.yaml",
    ".markdownlintignore",
    ".yamllint.yml",
    ".prettierrc",
    ".prettierrc.json",
    ".prettierignore",
    "prettier.config.mjs",
    ".shellcheckrc",
    ".github/actionlint.yaml",
  ])("flags %s", (path) => {
    expect(isLintConfigPath(path)).toBe(true);
  });

  it.each([
    "src/eslint.ts",
    "docs/markdownlint.md",
    "tsconfig.json",
    ".github/workflows/validate.yml",
    "lib/lint-surfaces.md",
  ])("does not flag %s", (path) => {
    expect(isLintConfigPath(path)).toBe(false);
  });
});

describe("findIgnoreDirective", () => {
  it("finds an ESLint disable comment in a script", () => {
    expect(
      findIgnoreDirective(
        "src/a.ts",
        `foo(); // ${ESLINT_DISABLE}-line no-console`,
      ),
    ).toBe("eslint-disable");
    expect(findIgnoreDirective("src/a.mjs", `/* ${ESLINT_DISABLE} */`)).toBe(
      "eslint-disable",
    );
  });

  it("finds a markdownlint disable comment at the start of a markdown line", () => {
    expect(
      findIgnoreDirective(
        "README.md",
        `<!-- ${MARKDOWNLINT_DISABLE} MD013 -->`,
      ),
    ).toBe("markdownlint-disable");
  });

  it("finds yamllint, shellcheck and prettier directives in their own file types", () => {
    expect(
      findIgnoreDirective(
        ".github/workflows/ci.yml",
        "key: x # yamllint disable-line",
      ),
    ).toBe("yamllint disable");
    expect(
      findIgnoreDirective("scripts/run.sh", "# shellcheck disable=SC2086"),
    ).toBe("shellcheck disable");
    expect(findIgnoreDirective("src/a.tsx", `// ${PRETTIER_IGNORE}`)).toBe(
      "prettier-ignore",
    );
  });

  it("ignores prose that only mentions a directive", () => {
    expect(
      findIgnoreDirective(
        "docs/x.md",
        `- \`${ESLINT_DISABLE}\`, \`# yamllint disable\``,
      ),
    ).toBeNull();
    expect(
      findIgnoreDirective(
        "docs/x.md",
        `Use \`<!-- ${MARKDOWNLINT_DISABLE} -->\` sparingly`,
      ),
    ).toBeNull();
  });

  it("does not apply one file type's directive to another", () => {
    expect(findIgnoreDirective("README.md", `// ${ESLINT_DISABLE}`)).toBeNull();
    expect(
      findIgnoreDirective("src/a.ts", "# shellcheck disable=SC2086"),
    ).toBeNull();
  });
});

describe("parseAddedLines", () => {
  it("maps each file's added lines to their new line numbers", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 111..222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -3,0 +4,2 @@ function x() {",
      "+const a = 1;",
      "++++ a line that starts with three pluses",
      "diff --git a/old.md b/old.md",
      "deleted file mode 100644",
      "--- a/old.md",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-gone",
    ].join("\n");
    const added = parseAddedLines(diff);
    expect([...added.keys()]).toEqual(["src/a.ts"]);
    expect(added.get("src/a.ts")).toEqual([
      { line: 4, text: "const a = 1;" },
      { line: 5, text: "+++ a line that starts with three pluses" },
    ]);
  });
});

describe("buildLintSurface", () => {
  it("reports changed config files and added directives, with a count", () => {
    const added = new Map([
      ["eslint.config.mjs", [{ line: 2, text: `// ${ESLINT_DISABLE}` }]],
      ["README.md", [{ line: 1, text: "# Title" }]],
      ["src/a.ts", [{ line: 10, text: `  // ${ESLINT_DISABLE}-next-line` }]],
    ]);
    const report = buildLintSurface(
      ["src/a.ts", "eslint.config.mjs", "README.md"],
      added,
    );
    expect(report.configFiles).toEqual(["eslint.config.mjs"]);
    expect(report.directives).toEqual([
      {
        directive: "eslint-disable",
        file: "src/a.ts",
        line: 10,
        text: `// ${ESLINT_DISABLE}-next-line`,
      },
    ]);
    expect(report.count).toBe(2);
  });

  it("is empty when the branch touches no lint surface", () => {
    const report = buildLintSurface(
      ["src/a.ts"],
      new Map([["src/a.ts", [{ line: 1, text: "const a = 1;" }]]]),
    );
    expect(report).toEqual({ configFiles: [], count: 0, directives: [] });
  });
});
