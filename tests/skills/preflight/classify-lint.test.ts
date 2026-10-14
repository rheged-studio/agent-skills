import {
  parseEslintJson,
  parseMarkdownlintText,
  splitBySeverity,
} from "../../../skills/preflight/scripts/classify-lint.mjs";
import { describe, expect, it } from "vitest";

// Real markdownlint-cli2 v0.22.1 default output (the format preflight parses).
// Banner lines are interleaved with the violation lines and must be ignored.
const SAMPLE = `markdownlint-cli2 v0.22.1 (markdownlint v0.40.0)
Finding: bad.md
Linting: 1 file(s)
Summary: 4 error(s)
bad.md:1 error MD022/blanks-around-headings Headings should be surrounded by blank lines [Expected: 1; Actual: 0; Below] [Context: "# Title"]
bad.md:3 error MD022/blanks-around-headings Headings should be surrounded by blank lines [Expected: 1; Actual: 0; Above] [Context: "## Heading"]
bad.md:4:81 error MD013/line-length Line length [Expected: 80; Actual: 132]`;

describe("parseMarkdownlintText", () => {
  it("parses real markdownlint-cli2 default output and ignores banner lines", () => {
    const violations = parseMarkdownlintText(SAMPLE);
    expect(violations).toHaveLength(3);
    // None of `markdownlint-cli2 vX`, `Finding:`, `Linting:`, `Summary:` parsed.
    expect(
      violations.every((violation) => violation.source === "markdownlint"),
    ).toBe(true);
  });

  it("captures file, line, rule and message for a column-less violation", () => {
    const [first] = parseMarkdownlintText(SAMPLE);
    expect(first).toMatchObject({
      file: "bad.md",
      line: 1,
      ruleId: "MD022/blanks-around-headings",
      source: "markdownlint",
    });
    expect(first.message).toMatch(/^Headings should be surrounded/);
    expect(first.column).toBeUndefined();
  });

  it("captures the column when present", () => {
    const md013 = parseMarkdownlintText(SAMPLE).find(
      (violation) => violation.ruleId === "MD013/line-length",
    );
    expect(md013).toMatchObject({
      column: 81,
      file: "bad.md",
      line: 4,
      message: "Line length [Expected: 80; Actual: 132]",
    });
  });

  it("tolerates output without the severity token (older markdownlint-cli2)", () => {
    const violations = parseMarkdownlintText(
      "README.md:4:81 MD013/line-length Line length [Expected: 80; Actual: 90]",
    );
    expect(violations).toEqual([
      {
        column: 81,
        file: "README.md",
        line: 4,
        message: "Line length [Expected: 80; Actual: 90]",
        ruleId: "MD013/line-length",
        severity: "error",
        source: "markdownlint",
      },
    ]);
  });

  it("returns [] for empty / whitespace / banner-only output (a clean pass)", () => {
    expect(parseMarkdownlintText("")).toEqual([]);
    expect(parseMarkdownlintText("   \n  ")).toEqual([]);
    expect(
      parseMarkdownlintText(
        "markdownlint-cli2 v0.22.1 (markdownlint v0.40.0)\nFinding: a.md\nLinting: 1 file(s)\nSummary: 0 error(s)",
      ),
    ).toEqual([]);
  });

  it("does not misparse pnpm/npm noise as violations", () => {
    const noise = `npm warn Unknown project config "auto-install-peers".
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "markdownlint-cli2" not found
some-pkg@1.2.3: deprecated do not use`;
    expect(parseMarkdownlintText(noise)).toEqual([]);
  });

  it("handles a file path that itself contains a colon-and-digits", () => {
    const violations = parseMarkdownlintText(
      "docs/v1:2/notes.md:10:5 error MD009/no-trailing-spaces Trailing spaces",
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      column: 5,
      file: "docs/v1:2/notes.md",
      line: 10,
      ruleId: "MD009/no-trailing-spaces",
    });
  });
});

describe("parseEslintJson severity tagging (R-601)", () => {
  const json = JSON.stringify([
    {
      filePath: "/repo/src/a.ts",
      messages: [
        { column: 1, line: 10, message: "boom", ruleId: "no-x", severity: 2 },
        { column: 1, line: 20, message: "meh", ruleId: "no-y", severity: 1 },
        { column: 1, line: 30, message: "off", ruleId: "no-z", severity: 0 },
      ],
    },
  ]);

  it("tags severity 2 as error and severity 1 as warning, dropping severity 0", () => {
    const violations = parseEslintJson(json);
    expect(violations).toHaveLength(2);
    expect(violations[0]).toMatchObject({ line: 10, severity: "error" });
    expect(violations[1]).toMatchObject({ line: 20, severity: "warning" });
  });
});

describe("splitBySeverity (R-601)", () => {
  const introduced = [
    { file: "a.ts", line: 1, message: "e", severity: "error" as const },
    { file: "a.ts", line: 2, message: "w", severity: "warning" as const },
  ];

  it("excludes warnings from the blocking set by default", () => {
    const { blocking, warnings } = splitBySeverity(introduced, false);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].severity).toBe("error");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("warning");
  });

  it("folds warnings into the blocking set under blockOnWarnings", () => {
    const { blocking, warnings } = splitBySeverity(introduced, true);
    expect(blocking).toHaveLength(2);
    // `warnings` still reports the warn-severity findings for visibility.
    expect(warnings).toHaveLength(1);
  });

  it("treats an untagged violation as blocking (back-compat)", () => {
    const { blocking } = splitBySeverity([{ file: "x.ts", line: 1 }], false);
    expect(blocking).toHaveLength(1);
  });
});
