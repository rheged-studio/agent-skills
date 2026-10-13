import {
  finaliseEntry,
  makeResolver,
} from "../../../skills/changelog/scripts/finalise-changelog.mjs";
// Exercises the BUNDLE script directly (the distributed `.mjs`). finaliseEntry
// links bare Linear IDs via the bundle's own config.json (workspace
// `rheged-studio`, key A).
import { parseFrontmatter } from "../../../skills/changelog/scripts/lib/frontmatter.mjs";
import { describe, expect, it } from "vitest";

// The .mjs carries these shapes as JSDoc typedefs (no exported TS types); mirror
// them locally so the test fixtures and the runner stay typed.
type ResolvedPr = {
  additions: null | string;
  changedFiles: null | string;
  commits: null | string;
  deletions: null | string;
  mergedAt: string;
  mergeSha: string;
  mergeStrategy: null | string;
  prNumber: string;
};

type Runner = (cmd: string, args: readonly string[]) => string;

const PR: ResolvedPr = {
  additions: "10",
  changedFiles: "3",
  commits: "4",
  deletions: "2",
  mergedAt: "2026-05-24T09:00:00Z",
  mergeSha: "abc1234def",
  mergeStrategy: "squash",
  prNumber: "42",
};

function placeholderEntry(): string {
  return [
    "---",
    'title: "Fix a thing"',
    "version:",
    'created_at: "2026-05-23T14:55:37Z"',
    "merged_at:",
    'branch: "asw-123-fix-a-thing"',
    "pr:",
    "commit:",
    "category: fix",
    "breaking: false",
    'issues: ["R-123"]',
    "---",
    "",
    "## Fixed",
    "",
    "- A thing for R-123.",
    "",
  ].join("\n");
}

describe("finaliseEntry", () => {
  it("enriches, stamps version, and links an un-finalised entry", () => {
    const out = finaliseEntry(placeholderEntry(), "1.2.0", () => PR);
    expect(out).not.toBeNull();
    const { content, data } = parseFrontmatter(out as string);
    expect(data.version).toBe("1.2.0");
    expect(data.merged_at).toBe("2026-05-24T09:00:00Z");
    expect(data.commit).toBe("abc1234");
    expect(data.pr).toBe(42);
    expect(data.merge_strategy).toBe("squash");
    expect(data.stats).toEqual({
      commits: 4,
      files_changed: 3,
      loc_added: 10,
      loc_removed: 2,
    });
    expect(content).toContain(
      "[R-123](https://linear.app/rheged-studio/issue/R-123)",
    );
  });

  it("re-enriches when stats is present but the commits child is missing (R-579)", () => {
    // An entry finalised between stats existing (R-380) and stats.commits
    // (R-560): every other post-merge field is set and stats is populated, but
    // commits is absent. The gate must still treat it as enrichable so the
    // resolver fills commits — before version-stamping makes it permanent.
    const raw = [
      "---",
      'title: "Fix a thing"',
      "version:",
      'created_at: "2026-05-23T14:55:37Z"',
      'merged_at: "2026-05-24T09:00:00Z"',
      'branch: "asw-123-fix-a-thing"',
      "pr: 42",
      'commit: "abc1234"',
      "category: fix",
      "breaking: false",
      "stats:",
      "  files_changed: 3",
      "  loc_added: 10",
      "  loc_removed: 2",
      'issues: ["R-123"]',
      "---",
      "",
      "## Fixed",
      "",
      "- A thing for R-123.",
      "",
    ].join("\n");
    let called = false;
    const out = finaliseEntry(raw, "1.2.0", () => {
      called = true;
      return PR;
    });
    expect(called).toBe(true);
    expect(out).not.toBeNull();
    const { data } = parseFrontmatter(out as string);
    expect(data.version).toBe("1.2.0");
    expect(data.stats).toEqual({
      commits: 4,
      files_changed: 3,
      loc_added: 10,
      loc_removed: 2,
    });
  });

  it("returns null for an already-finalised entry (version set)", () => {
    const raw = placeholderEntry().replace("version:", 'version: "1.0.0"');
    expect(finaliseEntry(raw, "1.2.0", () => PR)).toBeNull();
  });

  it("stamps + links even when no PR is found (resolver returns null)", () => {
    const out = finaliseEntry(placeholderEntry(), "1.2.0", () => null);
    const { data } = parseFrontmatter(out as string);
    expect(data.version).toBe("1.2.0");
    expect(data.merged_at ?? "").toBe(""); // not enriched
    expect(data.pr ?? "").toBe("");
  });

  it("does not call the resolver when the entry has no branch", () => {
    const raw = placeholderEntry().replace(
      'branch: "asw-123-fix-a-thing"',
      "branch:",
    );
    let called = false;
    const out = finaliseEntry(raw, "9.9.9", () => {
      called = true;
      return PR;
    });
    expect(called).toBe(false);
    expect(parseFrontmatter(out as string).data.version).toBe("9.9.9");
  });

  it("stores mergeCommit.oid (not the feature tip) as commit for a merge-merge PR (R-825)", () => {
    const mergeOid = "cafebab1234567890abcdef1234567890abcd";
    const mergeMergePr: ResolvedPr = {
      ...PR,
      commits: "5",
      mergeSha: mergeOid,
      mergeStrategy: "merge",
      prNumber: "8",
    };
    const out = finaliseEntry(placeholderEntry(), "2.0.0", () => mergeMergePr);
    expect(out).not.toBeNull();
    const { data } = parseFrontmatter(out as string);
    expect(data.commit).toBe("cafebab");
    expect(data.merge_strategy).toBe("merge");
    expect(data.stats).toEqual({
      commits: 5,
      files_changed: 3,
      loc_added: 10,
      loc_removed: 2,
    });
  });
});

type Call = { args: readonly string[]; cmd: string };

function makeRunner(handlers: Record<string, () => string>): {
  calls: Call[];
  run: Runner;
} {
  const calls: Call[] = [];
  function run(cmd: string, args: readonly string[]): string {
    calls.push({ args, cmd });
    const key = `${cmd} ${args.join(" ")}`;
    for (const prefix of Object.keys(handlers).toSorted(
      (a, b) => b.length - a.length,
    )) {
      if (key.startsWith(prefix)) {
        return handlers[prefix]();
      }
    }

    return "";
  }

  return { calls, run };
}

// A Runner that always throws, for the "gh fails" path. Module-scoped because
// it closes over nothing (unicorn/consistent-function-scoping).
function throwingRunner(): string {
  throw new Error("gh: API rate limit exceeded");
}

describe("makeResolver", () => {
  it("maps gh JSON to ResolvedPr and infers squash from a single-parent merge", () => {
    const { run } = makeRunner({
      "gh pr list": () =>
        JSON.stringify([
          {
            additions: 10,
            changedFiles: 3,
            deletions: 2,
            headRefOid: "head999",
            mergeCommit: { oid: "merge111" },
            mergedAt: "2026-05-24T09:00:00Z",
            number: 42,
          },
        ]),
      "git cat-file": () => "tree x\nparent p1\nauthor a\n",
    });
    const resolved = makeResolver(run)("asw-123-fix-a-thing");
    expect(resolved).toEqual({
      additions: "10",
      changedFiles: "3",
      // No `gh api` handler wired here, so the commit-count call fails softly.
      commits: null,
      deletions: "2",
      mergedAt: "2026-05-24T09:00:00Z",
      mergeSha: "merge111",
      mergeStrategy: "squash",
      prNumber: "42",
    });
  });

  it("resolves the non-merge commit count from the PR commits API", () => {
    const { run } = makeRunner({
      "gh api": () =>
        JSON.stringify([
          { parents: [{ sha: "p1" }] },
          { parents: [{ sha: "p2" }] },
          // A merge commit (two parents) is excluded from the count.
          { parents: [{ sha: "p3" }, { sha: "p4" }] },
          { parents: [{ sha: "p5" }] },
        ]),
      "gh pr list": () =>
        JSON.stringify([{ mergeCommit: { oid: "merge111" }, number: 42 }]),
      "git cat-file": () => "tree x\nparent p1\n",
    });
    expect(makeResolver(run)("a-1-branch")?.commits).toBe("3");
  });

  it("leaves commits null (without discarding other stats) when the count call fails", () => {
    const { run } = makeRunner({
      "gh api": () => {
        throw new Error("gh: API rate limit exceeded");
      },
      "gh pr list": () =>
        JSON.stringify([
          { additions: 10, mergeCommit: { oid: "merge111" }, number: 42 },
        ]),
      "git cat-file": () => "tree x\nparent p1\n",
    });
    const resolved = makeResolver(run)("a-1-branch");
    expect(resolved?.commits).toBeNull();
    expect(resolved?.additions).toBe("10"); // other stats survive
  });

  it("infers merge from a 2-parent merge commit", () => {
    const { run } = makeRunner({
      "gh pr list": () =>
        JSON.stringify([{ mergeCommit: { oid: "m" }, number: 1 }]),
      "git cat-file": () => "tree x\nparent p1\nparent p2\n",
    });
    expect(makeResolver(run)("b")?.mergeStrategy).toBe("merge");
  });

  it("returns null when no merged PR is found", () => {
    const { run } = makeRunner({ "gh pr list": () => "[]" });
    expect(makeResolver(run)("missing")).toBeNull();
  });

  it("returns null (does not throw) when gh fails, so the release isn't blocked", () => {
    expect(makeResolver(throwingRunner)("any-branch")).toBeNull();
  });

  it("returns null mergeStrategy when the PR has no merge commit", () => {
    const { run } = makeRunner({
      "gh pr list": () => JSON.stringify([{ number: 1 }]),
    });
    expect(makeResolver(run)("b")?.mergeStrategy).toBeNull();
  });

  it("returns null stat fields when gh omits them (so no NaN is written)", () => {
    const { run } = makeRunner({
      "gh pr list": () =>
        JSON.stringify([{ mergeCommit: { oid: "m" }, number: 7 }]),
      "git cat-file": () => "tree x\nparent p1\n",
    });
    const resolved = makeResolver(run)("b");
    expect(resolved?.additions).toBeNull();
    expect(resolved?.deletions).toBeNull();
    expect(resolved?.changedFiles).toBeNull();
  });

  it("uses mergeCommit.oid as mergeSha for a merge-merge PR (R-825)", () => {
    const mergeOid = "deadbeef1234567890abcdef1234567890abcd";
    const { run } = makeRunner({
      "gh api": () =>
        JSON.stringify([
          { parents: [{ sha: "p1" }] },
          { parents: [{ sha: "p2" }] },
          { parents: [{ sha: "p3" }] },
          { parents: [{ sha: "p4" }, { sha: "p5" }] },
        ]),
      "gh pr list": () =>
        JSON.stringify([
          {
            headRefOid: "feature-tip-sha-not-on-trunk",
            mergeCommit: { oid: mergeOid },
            mergedAt: "2026-08-03T12:00:00Z",
            number: 8,
          },
        ]),
      "git cat-file": () => "tree x\nparent p1\nparent p2\n",
    });
    const resolved = makeResolver(run)("a-825-multi-commit-merge");
    expect(resolved?.mergeSha).toBe(mergeOid);
    expect(resolved?.mergeStrategy).toBe("merge");
    expect(resolved?.commits).toBe("3");
  });
});
