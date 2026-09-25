// Imports the BUNDLE script directly (the distributed `.mjs`). Covers the pure
// diff transforms of check-updates (A-616): semver-core comparison and the
// lock-vs-target classification. main()/git I/O stay behind the isCliEntry() guard,
// so importing here runs nothing.
import {
  compareVersions,
  diffLock,
  formatHuman,
  hasUpdates,
  restrictToAllowlist,
} from "../../../skills/rheged-skills-setup/scripts/check-updates.mjs";
import { describe, expect, it } from "vitest";

// Build a report object of the shape formatHuman/updatesAvailable consume, with
// every partition empty by default so a test overrides only what it exercises.
function report(
  overrides: Partial<{
    added: Array<{ name: string; version: string }>;
    downgrades: Array<{ from: string; name: string; to: string }>;
    removed: string[];
    unknown: Array<{ from: string; name: string; to: string }>;
    updates: Array<{ bump: string; from: string; name: string; to: string }>;
  }> = {},
) {
  return {
    added: [],
    downgrades: [],
    lock: "/repo/.claude/skills.lock",
    lockRef: null,
    ref: null,
    removed: [],
    source: "/src",
    unknown: [],
    updates: [],
    upToDate: [],
    ...overrides,
  };
}

describe("compareVersions", () => {
  it("classifies forward bumps by the first differing component", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBe("patch");
    expect(compareVersions("1.0.0", "1.3.0")).toBe("minor");
    expect(compareVersions("1.0.0", "2.0.0")).toBe("major");
  });

  it("is 'none' for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe("none");
  });

  it("compares on the release core, ignoring pre-release/build metadata", () => {
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBe("none");
    expect(compareVersions("1.0.0", "1.1.0+build.5")).toBe("minor");
  });

  it("reports a downgrade when the target is older", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe("downgrade");
    expect(compareVersions("1.2.0", "1.1.0")).toBe("downgrade");
  });

  it("is 'unknown' when either side is null or not semver", () => {
    expect(compareVersions(null, "1.0.0")).toBe("unknown");
    expect(compareVersions("1.0.0", null)).toBe("unknown");
    expect(compareVersions("1.0", "1.0.0")).toBe("unknown");
    expect(compareVersions("x", "1.0.0")).toBe("unknown");
  });
});

describe("diffLock", () => {
  it("partitions skills into updates / upToDate / added / removed / downgrades / unknown", () => {
    const diff = diffLock(
      {
        ahead: "2.0.0", // consumer ahead → downgrade
        current: "1.0.0", // equal → upToDate
        gone: "1.0.0", // absent upstream → removed
        stale: "1.0.0", // behind → update (minor)
        weird: "1.0.0", // target unparseable → unknown
      },
      {
        ahead: "1.5.0",
        current: "1.0.0",
        fresh: "0.1.0", // upstream-only → added
        stale: "1.4.0",
        weird: "not-semver",
      },
    );

    expect(diff.updates).toEqual([
      { bump: "minor", from: "1.0.0", name: "stale", to: "1.4.0" },
    ]);
    expect(diff.upToDate).toEqual(["current"]);
    expect(diff.added).toEqual([{ name: "fresh", version: "0.1.0" }]);
    expect(diff.removed).toEqual(["gone"]);
    expect(diff.downgrades).toEqual([
      { from: "2.0.0", name: "ahead", to: "1.5.0" },
    ]);
    expect(diff.unknown).toEqual([
      { from: "1.0.0", name: "weird", to: "not-semver" },
    ]);
  });

  it("returns empty partitions when lock and target match exactly", () => {
    const same = { a: "1.0.0", b: "2.3.4" };
    const diff = diffLock(same, same);
    expect(diff.updates).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.upToDate).toEqual(["a", "b"]);
  });

  it("sorts each partition by name", () => {
    // Reversed insertion order (via fromEntries, which escapes the sort-objects
    // lint rule) so the assertion proves diffLock sorts its output.
    const diff = diffLock(
      Object.fromEntries([
        ["zed", "1.0.0"],
        ["abe", "1.0.0"],
      ]),
      Object.fromEntries([
        ["zed", "1.1.0"],
        ["abe", "1.1.0"],
      ]),
    );
    expect(diff.updates.map((update: { name: string }) => update.name)).toEqual(
      ["abe", "zed"],
    );
  });
});

describe("hasUpdates", () => {
  it("is true when a locked skill has a newer target", () => {
    const diff = diffLock({ stale: "1.0.0" }, { stale: "1.1.0" });
    expect(hasUpdates(diff)).toBe(true);
  });

  it("is true when only a new upstream skill is missing (added, no updates)", () => {
    // The regression: a repo behind on a brand-new bundle must not read as clean.
    const diff = diffLock(
      { current: "1.0.0" },
      { current: "1.0.0", fresh: "0.1.0" },
    );
    expect(diff.updates).toEqual([]);
    expect(diff.added).toEqual([{ name: "fresh", version: "0.1.0" }]);
    expect(hasUpdates(diff)).toBe(true);
  });

  it("is false when everything matches", () => {
    const same = { a: "1.0.0" };
    expect(hasUpdates(diffLock(same, same))).toBe(false);
  });
});

describe("restrictToAllowlist", () => {
  it("is a no-op without an allow-list", () => {
    const versions = { a: "1.0.0", b: "2.0.0" };
    expect(restrictToAllowlist(versions, undefined)).toEqual(versions);
    expect(restrictToAllowlist(versions, [])).toEqual(versions);
  });

  it("keeps only the allow-listed skills", () => {
    expect(
      restrictToAllowlist(
        { "scaffold-new-skill": "0.1.1", "send-it": "1.0.0" },
        ["send-it"],
      ),
    ).toEqual({ "send-it": "1.0.0" });
  });

  it("scoping both sides drops an upstream-only internal skill from `added` (A-741)", () => {
    // scaffold-new-skill ships in every source checkout but no consumer installs it,
    // so unscoped it is a perpetual `added` update that wedges the fan-out verify.
    const lockSkills = { "send-it": "1.0.0" };
    const target = { "scaffold-new-skill": "0.1.1", "send-it": "1.0.0" };
    expect(hasUpdates(diffLock(lockSkills, target))).toBe(true);
    const scoped = diffLock(
      restrictToAllowlist(lockSkills, ["send-it"]),
      restrictToAllowlist(target, ["send-it"]),
    );
    expect(scoped.added).toEqual([]);
    expect(hasUpdates(scoped)).toBe(false);
  });

  it("keeps a genuinely-new CANONICAL skill as `added` so adoption still fires", () => {
    // Scoping must not defeat legitimate new-skill adoption: a skill added to the
    // canonical set that the consumer lacks yet is still `added` (→ a roll).
    const scoped = diffLock(
      restrictToAllowlist({ "send-it": "1.0.0" }, ["send-it", "new-skill"]),
      restrictToAllowlist({ "new-skill": "0.1.0", "send-it": "1.0.0" }, [
        "send-it",
        "new-skill",
      ]),
    );
    expect(scoped.added).toEqual([{ name: "new-skill", version: "0.1.0" }]);
    expect(hasUpdates(scoped)).toBe(true);
  });
});

describe("formatHuman", () => {
  const ALL_CLEAR = "All installed skills are up to date.";

  it("prints the all-clear only when nothing is off-target", () => {
    expect(formatHuman(report({ upToDate: ["a"] }))).toContain(ALL_CLEAR);
  });

  it("omits the all-clear when a new upstream skill is not installed", () => {
    const out = formatHuman(
      report({ added: [{ name: "fresh", version: "0.1.0" }] }),
    );
    expect(out).not.toContain(ALL_CLEAR);
    expect(out).toContain("new upstream skill(s) not installed");
    expect(out).toContain("fresh@0.1.0");
  });

  it("omits the all-clear when downgrades or unknowns exist without updates", () => {
    const out = formatHuman(
      report({
        downgrades: [{ from: "2.0.0", name: "ahead", to: "1.0.0" }],
        unknown: [{ from: "1.0.0", name: "weird", to: "x" }],
      }),
    );
    expect(out).not.toContain(ALL_CLEAR);
    expect(out).toContain("downgrade");
    expect(out).toContain("uncomparable version");
  });

  it("lists the update block when updates exist", () => {
    const out = formatHuman(
      report({
        updates: [{ bump: "minor", from: "1.0.0", name: "stale", to: "1.4.0" }],
      }),
    );
    expect(out).toContain("1 update(s) available:");
    expect(out).toContain("stale");
    expect(out).not.toContain(ALL_CLEAR);
  });
});
