// Imports the BUNDLE script directly (the distributed `.mjs`). cleanup-repo is the
// one skill that irreversibly removes branches, worktrees, and directories, yet it
// shipped only an in-script `--self-test` that `pnpm test` never ran — so a
// regression in detect/apply/assertGitRepo could land green (R-528). These port the
// 15 self-test cases into vitest so the destructive surface is CI-gated.
import {
  apply,
  assertGitRepo,
  detect,
} from "../../../skills/cleanup-repo/scripts/filesystem-hygiene.mjs";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let root: string;

/**
 * Build the same fixture the bundle's in-script self-test uses.
 */
function buildFixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "cleanup-repo-fs-"));
  function makeDirectory(...segments: string[]) {
    return mkdirSync(join(directory, ...segments), { recursive: true });
  }

  function makeFile(relPath: string, body = "") {
    return writeFileSync(join(directory, relPath), body);
  }

  // A repo-like root marker so the root always has content (and the git guard
  // accepts it).
  makeDirectory(".git");
  makeFile(".git/HEAD", "ref: refs/heads/main\n");

  // 1. A recursively-empty directory (nested, no files) → top-most reported.
  makeDirectory("empty-top", "a", "b");
  // 2. A directory whose subtree holds only a placeholder → left alone.
  makeDirectory("placeholder-only");
  makeFile("placeholder-only/.gitkeep");
  // 3. A directory with a real file → left alone.
  makeDirectory("has-file");
  makeFile("has-file/index.ts", "export {};\n");
  // 4. Orphan node_modules (parent has no package.json).
  makeDirectory("orphan-pkg", "node_modules", "left-pad");
  // 5. Legitimate node_modules (parent has package.json) → not orphan.
  makeDirectory("real-pkg", "node_modules", "left-pad");
  makeFile("real-pkg/package.json", "{}\n");
  // 6. A nested .git (sub working tree) inside an otherwise file-free dir → must
  //    NOT be reported as empty.
  makeDirectory("nested-repo", ".git");

  return directory;
}

function rel(path: string): string {
  return path.slice(root.length).split(sep).filter(Boolean).join("/");
}

function hasGit(paths: string[]): boolean {
  return paths.map(rel).some((path) => path.split("/").includes(".git"));
}

beforeEach(() => {
  root = buildFixture();
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("detect", () => {
  it("reports the top-most empty directory, not its descendants", () => {
    const empties = detect(root).emptyDirs.map(rel);
    expect(empties).toContain("empty-top");
    expect(empties).not.toContain("empty-top/a");
    expect(empties).not.toContain("empty-top/a/b");
  });

  it("leaves placeholder-only and file-bearing directories alone", () => {
    const empties = detect(root).emptyDirs.map(rel);
    expect(empties).not.toContain("placeholder-only");
    expect(empties).not.toContain("has-file");
  });

  it("reports an orphan node_modules but not one with a sibling package.json", () => {
    const orphans = detect(root).orphanNodeModules.map(rel);
    expect(orphans).toContain("orphan-pkg/node_modules");
    expect(orphans).not.toContain("real-pkg/node_modules");
  });

  it("never lists a node_modules path among emptyDirs", () => {
    const empties = detect(root).emptyDirs.map(rel);
    expect(
      empties.some((path) => path.split("/").includes("node_modules")),
    ).toBe(false);
  });

  it("does not report a directory holding a nested .git as empty", () => {
    const empties = detect(root).emptyDirs.map(rel);
    expect(empties).not.toContain("nested-repo");
  });

  it("never reports or traverses .git", () => {
    const { emptyDirs, orphanNodeModules } = detect(root);
    expect(hasGit(emptyDirs)).toBe(false);
    expect(hasGit(orphanNodeModules)).toBe(false);
  });

  it("throws on a root that exists but is not a directory", () => {
    const fileRoot = join(tmpdir(), `cleanup-repo-fs-not-a-dir-${process.pid}`);
    writeFileSync(fileRoot, "");
    try {
      expect(() => detect(fileRoot)).toThrow();
    } finally {
      rmSync(fileRoot, { force: true });
    }
  });
});

describe("apply", () => {
  it("removes exactly the originally detected paths", () => {
    const before = detect(root);
    apply(root);
    for (const path of [...before.emptyDirs, ...before.orphanNodeModules]) {
      expect(existsSync(path)).toBe(false);
    }
  });

  it("reports every removed path and no failures on a clean run", () => {
    const before = detect(root);
    const applied = apply(root);
    expect(applied.failed).toEqual([]);
    expect(applied.removed.length).toBe(
      before.emptyDirs.length + before.orphanNodeModules.length,
    );
  });

  it("preserves placeholder-only and file-bearing directories", () => {
    apply(root);
    expect(existsSync(join(root, "placeholder-only"))).toBe(true);
    expect(existsSync(join(root, "has-file"))).toBe(true);
  });

  it("leaves a parent emptied by an orphan-node_modules removal for the next run", () => {
    apply(root);
    const after = detect(root);
    // Removing orphan-pkg/node_modules empties its parent — a deliberate cascade
    // swept by a *subsequent* run, never the same snapshot.
    expect(after.emptyDirs.map(rel)).toEqual(["orphan-pkg"]);
    expect(after.orphanNodeModules).toEqual([]);
  });
});

describe("assertGitRepo", () => {
  it("refuses a root with no .git entry", () => {
    const nonGitRoot = mkdtempSync(join(tmpdir(), "cleanup-repo-fs-nongit-"));
    try {
      expect(() => assertGitRepo(nonGitRoot)).toThrow();
    } finally {
      rmSync(nonGitRoot, { force: true, recursive: true });
    }
  });

  it("accepts a primary worktree (.git directory)", () => {
    expect(() => assertGitRepo(root)).not.toThrow();
  });

  it("accepts a linked worktree (.git file)", () => {
    const linkedWorktreeRoot = mkdtempSync(
      join(tmpdir(), "cleanup-repo-fs-linked-"),
    );
    writeFileSync(
      join(linkedWorktreeRoot, ".git"),
      "gitdir: /tmp/cleanup-repo-linked-worktree\n",
    );
    try {
      expect(() => assertGitRepo(linkedWorktreeRoot)).not.toThrow();
    } finally {
      rmSync(linkedWorktreeRoot, { force: true, recursive: true });
    }
  });
});
