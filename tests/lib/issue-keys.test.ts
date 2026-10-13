// Tests the canonical repo-root `lib/issue-keys.mjs` — the helper the
// linear-sync / cleanup-repo / triage-pr / send-it prose mirrors and the
// changelog bundle vendors (ADR-0004). The multi-team fixtures model one repo
// carrying `c-` (Cadogan), `r-` (Rheged) and legacy `a-` branches (R-2682).
import {
  buildBranchIssueRe,
  buildIssueRe,
  extractBranchIssueId,
} from "../../lib/issue-keys.mjs";
import { describe, expect, it } from "vitest";

const MULTI_TEAM_KEYS = ["C", "R", "A"];

describe("extractBranchIssueId — leading ID only (R-2682)", () => {
  it.each([
    ["c-12-fix-r-3-thing", "C-12"],
    ["r-40-add-c-2-support", "R-40"],
    ["a-2651-2-agent-skills-make-the-linear-skills-multi-team", "A-2651"],
    ["R-123/demo", "R-123"],
    ["R-7", "R-7"],
  ])("%s → %s", (branch, expected) => {
    expect(extractBranchIssueId(branch, MULTI_TEAM_KEYS)).toBe(expected);
  });

  it.each([
    "main",
    "feature/r-1-x",
    "fix-c-2-slug-token",
    "dependabot/npm_and_yarn/vitest-3.0.0",
    "c12-missing-dash",
  ])("%s → null (no leading configured key)", (branch) => {
    expect(extractBranchIssueId(branch, MULTI_TEAM_KEYS)).toBeNull();
  });

  it("does not let a configured key match the prefix of a longer key", () => {
    expect(extractBranchIssueId("ab-1-x", ["A"])).toBeNull();
    expect(extractBranchIssueId("ab-1-x", ["A", "AB"])).toBe("AB-1");
  });

  it("takes the whole leading number, not a prefix of it", () => {
    expect(extractBranchIssueId("r-1234-x", ["R"])).toBe("R-1234");
  });

  it("ignores keys the repo doesn't configure", () => {
    expect(extractBranchIssueId("zz-9-x", MULTI_TEAM_KEYS)).toBeNull();
    expect(extractBranchIssueId("c-9-x", ["R", "A"])).toBeNull();
  });

  it("matches nothing with no configured keys", () => {
    expect(extractBranchIssueId("a-1-x", [])).toBeNull();
  });
});

describe("buildBranchIssueRe", () => {
  it("is anchored and non-global", () => {
    const re = buildBranchIssueRe(MULTI_TEAM_KEYS);
    expect(re?.source.startsWith("^")).toBe(true);
    expect(re?.flags).not.toContain("g");
  });

  it("groups several keys and leaves a single key bare", () => {
    expect(buildBranchIssueRe(["R", "A"])?.source).toBe(
      String.raw`^(?:R|A)-\d+\b`,
    );
    expect(buildBranchIssueRe(["A"])?.source).toBe(String.raw`^A-\d+\b`);
  });

  it("escapes metacharacters in keys", () => {
    expect(extractBranchIssueId("C++-4-x", ["C++"])).toBe("C++-4");
  });

  it("returns null for no keys", () => {
    expect(buildBranchIssueRe([])).toBeNull();
  });
});

describe("buildIssueRe — prose matcher stays unanchored", () => {
  it("still finds every ID anywhere in prose", () => {
    const re = buildIssueRe(MULTI_TEAM_KEYS) ?? /$^/;
    expect("Closes C-12, see R-3 and R-9.".match(re)).toEqual([
      "C-12",
      "R-3",
      "R-9",
    ]);
  });
});
