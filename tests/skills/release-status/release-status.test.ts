// Imports the BUNDLE script directly (the distributed `.mjs`), so the published
// release-status bundle stays test-free whilst its pure-logic surface — the
// bump-rule derivation, the stale-`autorelease: pending` detector, and the
// tag-vs-version parity check — is covered in CI. The gh/git network layer is
// not exercised here; only the pure transforms, which is exactly the
// "verifiable without hitting GitHub" surface this skill needs.
import {
  applyBump,
  classifyTitle,
  detectStalePending,
  parseArgs,
  parseGitLog,
  parseJson,
  previewBump,
  requiredCheckState,
  tagParity,
} from "../../../skills/release-status/scripts/release-status.mjs";
import { describe, expect, it } from "vitest";

const UNIT_SEP = "\u001F";
const RECORD_SEP = "\u001E";

describe("classifyTitle — Conventional-Commit bump rules", () => {
  it("feat → minor", () => {
    expect(classifyTitle("feat(x): add")).toBe("minor");
    expect(classifyTitle("feat: add")).toBe("minor");
  });

  it("fix / perf / revert → patch", () => {
    expect(classifyTitle("fix: bug")).toBe("patch");
    expect(classifyTitle("perf(core): faster")).toBe("patch");
    expect(classifyTitle("revert: oops")).toBe("patch");
  });

  it("! or BREAKING CHANGE → major", () => {
    expect(classifyTitle("feat(x)!: drop")).toBe("major");
    expect(classifyTitle("fix!: drop")).toBe("major");
    expect(classifyTitle("fix: x", "body\n\nBREAKING CHANGE: y")).toBe("major");
  });

  it("docs / chore / ci / refactor / test / build / style → none", () => {
    for (const type of [
      "docs",
      "chore",
      "ci",
      "refactor",
      "test",
      "build",
      "style",
    ]) {
      expect(classifyTitle(`${type}: x`)).toBe("none");
    }
  });

  it("treats a non-string subject defensively", () => {
    expect(classifyTitle(undefined)).toBe("none");
  });

  it("merge-commit subjects are non-conventional → none", () => {
    expect(classifyTitle("Merge pull request #12 from acme/feature")).toBe(
      "none",
    );
  });
});

describe("previewBump — strongest bump across commits (R-824)", () => {
  it("feat beats fix", () => {
    expect(previewBump([{ subject: "fix: a" }, { subject: "feat: b" }])).toBe(
      "minor",
    );
  });

  it("a breaking subject wins over everything", () => {
    expect(
      previewBump([{ subject: "feat: a" }, { subject: "refactor!: b" }]),
    ).toBe("major");
  });

  it("BREAKING CHANGE in a body promotes to major", () => {
    expect(
      previewBump([{ body: "BREAKING CHANGE: drop X", subject: "fix: a" }]),
    ).toBe("major");
  });

  it("no release-triggering subjects → none", () => {
    expect(previewBump([{ subject: "chore: a" }, { subject: "docs: b" }])).toBe(
      "none",
    );
    expect(previewBump([])).toBe("none");
  });

  it("feat then revert still minors — no cancel/netting (matches release-please 17.9.0)", () => {
    // Empirical: DefaultVersioningStrategy sees both feat and revert; feat
    // wins. release-status mirrors that — it does NOT invent netting.
    expect(
      previewBump([
        { subject: "feat: add x" },
        { subject: "revert: feat: add x" },
      ]),
    ).toBe("minor");
  });
});

describe("parseGitLog — git log --format unit/record separators", () => {
  it("parses hash/subject/body records", () => {
    const raw = [
      `abc123${UNIT_SEP}feat: one${UNIT_SEP}body one${RECORD_SEP}`,
      `def456${UNIT_SEP}fix: two${UNIT_SEP}${RECORD_SEP}`,
    ].join("");
    expect(parseGitLog(raw)).toEqual([
      { body: "body one", hash: "abc123", subject: "feat: one" },
      { body: "", hash: "def456", subject: "fix: two" },
    ]);
  });

  it("returns [] for empty input", () => {
    expect(parseGitLog("")).toEqual([]);
    expect(parseGitLog(undefined)).toEqual([]);
  });
});

describe("applyBump — next version from current + bump", () => {
  it("bumps each level correctly", () => {
    expect(applyBump("1.2.3", "major")).toBe("2.0.0");
    expect(applyBump("1.2.3", "minor")).toBe("1.3.0");
    expect(applyBump("1.2.3", "patch")).toBe("1.2.4");
  });

  it("none is identity (no release)", () => {
    expect(applyBump("1.2.3", "none")).toBe("1.2.3");
  });

  it("tolerates a v-prefixed current version", () => {
    expect(applyBump("v0.1.0", "minor")).toBe("0.2.0");
  });

  it("throws on a non-semver current version", () => {
    expect(() => applyBump("not-a-version", "patch")).toThrow(/semver/);
  });
});

describe("tagParity — release.yml version-vs-tag gate", () => {
  it("tagged version → clean no-op", () => {
    const parity = tagParity("1.2.0", ["v1.1.0", "v1.2.0"]);
    expect(parity.state).toBe("tagged");
    expect(parity.tagged).toBe(true);
    expect(parity.tag).toBe("v1.2.0");
  });

  it("untagged version → publish pending", () => {
    const parity = tagParity("1.3.0", ["v1.1.0", "v1.2.0"]);
    expect(parity.state).toBe("untagged");
    expect(parity.tagged).toBe(false);
  });

  it("normalises a v-prefixed version before comparing", () => {
    expect(tagParity("v1.2.0", ["v1.2.0"]).tagged).toBe(true);
  });

  it("treats an empty tag set as untagged (bootstrap)", () => {
    expect(tagParity("0.1.0", []).state).toBe("untagged");
  });
});

describe("detectStalePending — the autorelease: pending stall", () => {
  it("detects the stall when a merged release PR still carries the label", () => {
    const result = detectStalePending({
      labels: [{ name: "autorelease: pending" }],
      number: 42,
    });
    expect(result.detected).toBe(true);
    expect(result.pr).toBe(42);
    expect(result.reason).toMatch(/abort/);
  });

  it("is clear when the label is absent", () => {
    expect(
      detectStalePending({
        labels: [{ name: "autorelease: tagged" }],
        number: 42,
      }).detected,
    ).toBe(false);
  });

  it("handles labels given as plain strings", () => {
    expect(
      detectStalePending({ labels: ["autorelease: pending"], number: 7 })
        .detected,
    ).toBe(true);
  });

  it("honours a custom label name", () => {
    expect(
      detectStalePending(
        { labels: ["release: blocked"], number: 9 },
        "release: blocked",
      ).detected,
    ).toBe(true);
  });

  it("is not detected when there is no merged release PR", () => {
    const result = detectStalePending(null);
    expect(result.detected).toBe(false);
    expect(result.pr).toBeNull();
  });
});

describe("requiredCheckState — required-check rollup reading", () => {
  it("reads an Actions conclusion", () => {
    expect(
      requiredCheckState([{ conclusion: "SUCCESS", name: "GO/NO GO" }]).state,
    ).toBe("success");
  });

  it("reads a status-check state", () => {
    expect(
      requiredCheckState([{ name: "GO/NO GO", state: "PENDING" }]).state,
    ).toBe("pending");
  });

  it("reports not-found when the named check is absent", () => {
    const result = requiredCheckState([{ name: "other" }]);
    expect(result.found).toBe(false);
    expect(result.state).toBeNull();
  });

  it("honours a custom check name", () => {
    expect(
      requiredCheckState([{ conclusion: "FAILURE", name: "CI" }], "CI").state,
    ).toBe("failure");
  });
});

describe("parseArgs", () => {
  it("reads --json and --repo", () => {
    expect(parseArgs(["--json"]).json).toBe(true);
    expect(parseArgs(["--repo", "acme/widgets"]).repo).toBe("acme/widgets");
  });

  it("throws on an unknown flag", () => {
    expect(() => parseArgs(["--nope"])).toThrow(/unknown option/);
  });

  it("throws on a malformed --repo", () => {
    expect(() => parseArgs(["--repo", "acme/widgets/extra"])).toThrow(/owner/);
    expect(() => parseArgs(["--repo"])).toThrow(/owner/);
  });
});

describe("parseJson — diagnosed parse failures", () => {
  it("parses valid JSON transparently", () => {
    expect(parseJson('[{"id":1}]', "x")).toEqual([{ id: 1 }]);
  });

  it("names the context when gh returns non-JSON (warning line, empty output)", () => {
    expect(() =>
      parseJson("gh: could not authenticate", "merged-PR list"),
    ).toThrow(/could not parse merged-PR list/);
    expect(() => parseJson("", "open release PR")).toThrow(
      /could not parse open release PR/,
    );
  });
});
