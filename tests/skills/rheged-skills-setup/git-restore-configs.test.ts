// A-706: a `skills add --copy` re-vendor clobbers each tracked config.json
// (agent-skills ships none — A-615), so initialise-skills restores them from HEAD
// before reconciling. Covers the pure parser and the real-git restore/detect path.
import { restoreOutcomeSuffix } from "../../../skills/rheged-skills-setup/scripts/initialise.mjs";
import {
  parseClobberedConfigs,
  restoreClobberedConfigs,
} from "../../../skills/rheged-skills-setup/scripts/lib/git.mjs";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("parseClobberedConfigs", () => {
  it("keeps config.json paths and drops everything else", () => {
    expect(
      parseClobberedConfigs(
        [
          ".claude/skills/send-it/config.json",
          ".claude/skills/send-it/SKILL.md",
          "README.md",
          "",
          ".agents/skills/commit/config.json",
        ].join("\n"),
      ),
    ).toEqual([
      ".agents/skills/commit/config.json",
      ".claude/skills/send-it/config.json",
    ]);
  });

  it("does not match a file merely ending in config.json (no boundary)", () => {
    expect(parseClobberedConfigs("dir/notconfig.json\n")).toEqual([]);
  });

  it("returns [] for empty input", () => {
    expect(parseClobberedConfigs("")).toEqual([]);
  });
});

describe("restoreOutcomeSuffix", () => {
  it("tells a dry-run to re-run with --write", () => {
    expect(restoreOutcomeSuffix(2, 0, false)).toMatch(/re-run with --write/);
  });

  it("claims success only when every clobbered file was restored", () => {
    expect(restoreOutcomeSuffix(2, 2, true)).toMatch(/restored from HEAD/);
  });

  it("does NOT claim success when a --write restore failed", () => {
    // The CodeRabbit case: git checkout failed → restoredCount 0 under --write.
    const suffix = restoreOutcomeSuffix(2, 0, true);
    expect(suffix).toMatch(/FAILED/);
    expect(suffix).not.toMatch(/restored from HEAD before reconciling/);
  });
});

describe("restoreClobberedConfigs (real git)", () => {
  let repoRoot: string;
  const CONFIG = ".claude/skills/send-it/config.json";
  const REAL = '{ "linearTeamName": "Acme" }\n';

  function git(...args: string[]): void {
    const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    }
  }

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "a706-restore-"));
    git("init", "-b", "main");
    git("config", "user.email", "test@example.test");
    git("config", "user.name", "Test");
    mkdirSync(join(repoRoot, ".claude/skills/send-it"), { recursive: true });
    writeFileSync(join(repoRoot, CONFIG), REAL);
    git("add", "-A");
    git("commit", "-m", "vendor with real config");
  });

  afterEach(() => {
    rmSync(repoRoot, { force: true, recursive: true });
  });

  it("restores a deleted config.json from HEAD under --write", () => {
    rmSync(join(repoRoot, CONFIG)); // the older-CLI delete behaviour
    const result = restoreClobberedConfigs(repoRoot, [CONFIG], { write: true });
    expect(result.clobbered).toEqual([CONFIG]);
    expect(result.restored).toEqual([CONFIG]);
    expect(readFileSync(join(repoRoot, CONFIG), "utf8")).toBe(REAL);
  });

  it("restores an overwritten config.json from HEAD under --write", () => {
    writeFileSync(join(repoRoot, CONFIG), '{ "linearTeamName": "" }\n'); // example reset
    const result = restoreClobberedConfigs(repoRoot, [CONFIG], { write: true });
    expect(result.restored).toEqual([CONFIG]);
    expect(readFileSync(join(repoRoot, CONFIG), "utf8")).toBe(REAL);
  });

  it("detects but does not restore when write is false", () => {
    rmSync(join(repoRoot, CONFIG));
    const result = restoreClobberedConfigs(repoRoot, [CONFIG], {
      write: false,
    });
    expect(result.clobbered).toEqual([CONFIG]);
    expect(result.restored).toEqual([]);
    // Untouched: still deleted.
    expect(() => readFileSync(join(repoRoot, CONFIG), "utf8")).toThrow();
  });

  it("is a no-op on a clean tree (nothing clobbered)", () => {
    expect(
      restoreClobberedConfigs(repoRoot, [CONFIG], { write: true }),
    ).toEqual({ clobbered: [], restored: [] });
  });

  it("is a no-op with no config paths and never touches unrelated changes", () => {
    // A tracked non-config file was modified — must stay out of scope.
    writeFileSync(join(repoRoot, ".claude/skills/send-it/SKILL.md"), "changed");
    expect(restoreClobberedConfigs(repoRoot, [], { write: true })).toEqual({
      clobbered: [],
      restored: [],
    });
  });

  it("degrades to a no-op outside a git repo", () => {
    const notGit = mkdtempSync(join(tmpdir(), "a706-nogit-"));
    try {
      expect(
        restoreClobberedConfigs(notGit, [CONFIG], { write: true }),
      ).toEqual({ clobbered: [], restored: [] });
    } finally {
      rmSync(notGit, { force: true, recursive: true });
    }
  });
});
