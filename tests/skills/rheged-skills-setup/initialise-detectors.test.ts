import { createDetectors } from "../../../skills/rheged-skills-setup/scripts/lib/detectors.mjs";
import {
  currentIssueKeys,
  detectIssueKeys,
  listBranchNames,
  parseIssueKeysFromBranches,
} from "../../../skills/rheged-skills-setup/scripts/lib/git.mjs";
import {
  globsFromWorkspacesField,
  parseWorkspaceGlobs,
  rootsFromGlobs,
} from "../../../skills/rheged-skills-setup/scripts/lib/workspace.mjs";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("parseIssueKeysFromBranches", () => {
  it("extracts and uppercases leading issue keys, de-duplicated and sorted", () => {
    expect(
      parseIssueKeysFromBranches([
        "abc-12-foo",
        "QA-3-bar",
        "abc-99-baz",
        "feature/x",
      ]),
    ).toEqual(["ABC", "QA"]);
  });

  it("matches single-letter keys (e.g. Linear's A) — A-556", () => {
    expect(parseIssueKeysFromBranches(["a-558-foo", "QA-3-bar"])).toEqual([
      "A",
      "QA",
    ]);
  });

  it("ignores branches without a leading <KEY>-<num> (v<num>- and pathy names)", () => {
    expect(
      parseIssueKeysFromBranches(["main", "v1-release", "feature/x"]),
    ).toEqual([]);
  });

  it("returns [] for an empty branch list", () => {
    expect(parseIssueKeysFromBranches([])).toEqual([]);
  });
});

// A-556: prefer the current key from the most recent branch over the historical
// union, so a renamed team (…→ASW→SK→A) yields the active key.
describe("currentIssueKeys", () => {
  it("returns the key of the most recently committed branch (recency-first input)", () => {
    expect(
      currentIssueKeys([
        "a-558-promoteongreen",
        "sk-99-old-thing",
        "asw-3-older-thing",
      ]),
    ).toEqual(["A"]);
  });

  it("skips leading non-keyed branches until it finds one with a key", () => {
    expect(
      currentIssueKeys([
        "main",
        "dependabot/npm/foo",
        "a-100-current",
        "asw-1-historical",
      ]),
    ).toEqual(["A"]);
  });

  it("returns [] when no branch carries a key", () => {
    expect(currentIssueKeys(["main", "release", "v1-foo"])).toEqual([]);
    expect(currentIssueKeys([])).toEqual([]);
  });
});

// A-580: the remote-prefix strip must only drop the ref namespace, not the first
// segment of a slash-named local branch — `A-123/demo` keeps its `A` key.
describe("listBranchNames / detectIssueKeys — slash-named local branches", () => {
  let repoRoot: string;

  function git(...args: string[]): void {
    const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    }
  }

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "init-git-"));
    git("init", "-b", "main");
    git("config", "user.email", "test@example.test");
    git("config", "user.name", "Test");
    git("commit", "--allow-empty", "-m", "init");
    git("branch", "A-123/demo");
  });

  afterEach(() => {
    rmSync(repoRoot, { force: true, recursive: true });
  });

  it("preserves the embedded slash in a local branch name", () => {
    expect(listBranchNames(repoRoot)).toContain("A-123/demo");
  });

  it("detects the key from a slash-named local branch", () => {
    expect(detectIssueKeys(repoRoot)).toEqual(["A"]);
  });
});

describe("parseWorkspaceGlobs / rootsFromGlobs", () => {
  it("reads the packages: block from pnpm-workspace.yaml and reduces to roots", () => {
    const yaml = [
      "packages:",
      "  - 'apps/*'",
      "  - 'packages/*'",
      "  - services/api",
      "other: 1",
    ].join("\n");
    expect(parseWorkspaceGlobs(yaml)).toEqual([
      "apps/*",
      "packages/*",
      "services/api",
    ]);
    expect(rootsFromGlobs(parseWorkspaceGlobs(yaml))).toEqual([
      "apps",
      "packages",
      "services",
    ]);
  });

  it("ignores '.', '*' and de-duplicates roots", () => {
    expect(rootsFromGlobs(["packages/ui", "packages/core", ".", "*"])).toEqual([
      "packages",
    ]);
  });

  it("ignores negated pnpm exclude globs", () => {
    expect(
      rootsFromGlobs(["!packages/private/*", "apps/*", "packages/*"]),
    ).toEqual(["apps", "packages"]);
  });

  it("returns [] when there is no packages: block", () => {
    expect(parseWorkspaceGlobs("name: thing\nversion: 1")).toEqual([]);
  });

  it("keeps tab-indented list items inside the packages: block", () => {
    const yaml = [
      "packages:",
      "\t- 'apps/*'",
      "\t- 'packages/*'",
      "other: 1",
    ].join("\n");
    expect(parseWorkspaceGlobs(yaml)).toEqual(["apps/*", "packages/*"]);
  });
});

describe("changelog detector", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "init-detect-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { force: true, recursive: true });
  });

  it("is false when there is no changelog/ dir, even if the changelog skill is vendored (A-570)", () => {
    // Skill-presence alone must not flip changelog true: a repo that
    // over-installed the bundle but keeps no changelog/ dir (e.g.
    // release-orchestrator) would otherwise try to author entries with nowhere
    // to live.
    const { detect } = createDetectors({ repoRoot });
    expect(detect("changelog")).toEqual({ value: false });
  });

  it("is true when a changelog/ directory exists", () => {
    mkdirSync(join(repoRoot, "changelog"));
    const { detect } = createDetectors({ repoRoot });
    expect(detect("changelog")).toEqual({ value: true });
  });

  it("is false when the repo has no changelog/ dir", () => {
    const { detect } = createDetectors({ repoRoot });
    expect(detect("changelog")).toEqual({ value: false });
  });

  it("is false when 'changelog' is a plain file rather than a directory", () => {
    writeFileSync(join(repoRoot, "changelog"), "not a dir\n");
    const { detect } = createDetectors({ repoRoot });
    expect(detect("changelog")).toEqual({ value: false });
  });
});

describe("mainBranch detector", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "init-detect-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { force: true, recursive: true });
  });

  it("mirrors the detected base branch (falls back to main with no git)", () => {
    const { detect } = createDetectors({ repoRoot });
    expect(detect("mainBranch")).toEqual(detect("baseBranch"));
    expect(detect("mainBranch")).toEqual({ value: "main" });
  });
});

describe("globsFromWorkspacesField", () => {
  it("accepts an array form", () => {
    expect(globsFromWorkspacesField(["apps/*", "libs/*"])).toEqual([
      "apps/*",
      "libs/*",
    ]);
  });

  it("accepts the { packages: [...] } object form", () => {
    expect(globsFromWorkspacesField({ packages: ["pkgs/*"] })).toEqual([
      "pkgs/*",
    ]);
  });

  it("returns [] for anything else", () => {
    expect(globsFromWorkspacesField(undefined)).toEqual([]);
    expect(globsFromWorkspacesField("apps/*")).toEqual([]);
  });
});
