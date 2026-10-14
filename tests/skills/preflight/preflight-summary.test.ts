// Imports the BUNDLE script directly (the distributed `.mjs`). Covers the pure
// summary assembler (R-465): the machine-readable verdict the ship flow reads —
// blocking/passed flags, per-category status, and the introduced/pre-existing
// violation split, across normal and --dry-run modes. The lint-running half
// (spawning eslint/markdownlint/actionlint) stays behind the CLI guard.
import { buildSummary } from "../../../skills/preflight/scripts/preflight.mjs";
import { describe, expect, it } from "vitest";

const SCOPE = {
  actionlintTargets: [],
  codeChanged: true,
  eslint: { root: ["eslint.config.js"], scripts: [] },
  markdown: ["README.md"],
  markdownChanged: true,
  mergeBase: "abc123",
  workflowsChanged: false,
};

const CLEAN = { introduced: [], preExisting: [] };

describe("buildSummary", () => {
  // R-1203: lint-surface changes are reported, never blocking.
  it("defaults lintSurface to an empty report", () => {
    const summary = buildSummary(
      SCOPE,
      { actionlintStatus: "skipped" },
      CLEAN,
      false,
    );
    expect(summary.lintSurface).toEqual({
      configFiles: [],
      count: 0,
      directives: [],
    });
  });

  it("carries lintSurface through without blocking", () => {
    const lintSurface = {
      configFiles: [".markdownlint-cli2.jsonc"],
      count: 1,
      directives: [],
    };
    const summary = buildSummary(
      SCOPE,
      { actionlintStatus: "skipped", lintSurface },
      CLEAN,
      false,
    );
    expect(summary.lintSurface).toEqual(lintSurface);
    expect(summary.passed).toBe(true);
    expect(summary.blocking).toBe(false);
  });

  it("passes when nothing is introduced and no linter failed", () => {
    const summary = buildSummary(
      SCOPE,
      { actionlintStatus: "skipped" },
      CLEAN,
      false,
    );
    expect(summary.passed).toBe(true);
    expect(summary.blocking).toBe(false);
    expect(summary.dryRun).toBe(false);
    expect(summary.categories.eslint).toEqual({
      root: ["eslint.config.js"],
      scripts: [],
    });
    expect(summary.categories.actionlint).toBe("skipped");
  });

  it("blocks on introduced violations and reports their count", () => {
    const summary = buildSummary(
      SCOPE,
      { actionlintStatus: "skipped" },
      { introduced: [{ file: "a.ts" }], preExisting: [] },
      false,
    );
    expect(summary.blocking).toBe(true);
    expect(summary.passed).toBe(false);
    expect(summary.violations.introducedCount).toBe(1);
  });

  it("blocks when a linter failed to run, even with no violations", () => {
    const summary = buildSummary(
      SCOPE,
      { actionlintStatus: "ran", failedLinters: ["eslint:root"] },
      CLEAN,
      false,
    );
    expect(summary.blocking).toBe(true);
    expect(summary.passed).toBe(false);
    expect(summary.results.failedLinters).toEqual(["eslint:root"]);
  });

  it("never marks pre-existing violations deferred under --dry-run", () => {
    const withPreExisting = {
      introduced: [],
      preExisting: [{ file: "old.ts" }],
    };
    expect(buildSummary(SCOPE, {}, withPreExisting, false).deferred).toBe(true);
    expect(buildSummary(SCOPE, {}, withPreExisting, true).deferred).toBe(false);
  });

  describe("warn-severity introduced findings (R-601)", () => {
    const withWarning = {
      introduced: [
        {
          file: "test.ts",
          line: 1,
          message: "Forbidden non-null assertion.",
          severity: "warning",
        },
      ],
      preExisting: [],
    };
    const withError = {
      introduced: [
        { file: "src.ts", line: 1, message: "boom", severity: "error" },
      ],
      preExisting: [],
    };

    it("does not block on an introduced warning by default", () => {
      const summary = buildSummary(
        SCOPE,
        { actionlintStatus: "skipped" },
        withWarning,
        false,
      );
      expect(summary.blocking).toBe(false);
      expect(summary.passed).toBe(true);
      // The finding is still surfaced — just non-blocking.
      expect(summary.violations.introducedCount).toBe(1);
      expect(summary.violations.introducedBlockingCount).toBe(0);
      expect(summary.violations.introducedWarningCount).toBe(1);
    });

    it("blocks on an introduced warning when blockOnWarnings is set", () => {
      const summary = buildSummary(
        SCOPE,
        { actionlintStatus: "skipped" },
        withWarning,
        false,
        true,
      );
      expect(summary.blocking).toBe(true);
      expect(summary.passed).toBe(false);
      expect(summary.violations.introducedBlockingCount).toBe(1);
      expect(summary.results.blockOnWarnings).toBe(true);
    });

    it("always blocks on an introduced error, regardless of blockOnWarnings", () => {
      expect(
        buildSummary(SCOPE, { actionlintStatus: "skipped" }, withError, false)
          .blocking,
      ).toBe(true);
      expect(
        buildSummary(
          SCOPE,
          { actionlintStatus: "skipped" },
          withError,
          false,
          false,
        ).blocking,
      ).toBe(true);
    });
  });
});
