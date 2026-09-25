// Imports the BUNDLE lib directly (the distributed `.mjs`). Covers the pure
// reconcile-report builder and its human renderer (A-465): aggregation of
// per-key statuses into totals + drift/manual buckets, and the text formatting
// Claude shows the user. No filesystem or git — `buildReport` consumes the merge
// results verbatim.
import {
  buildReport,
  buildReviewReport,
  formatHuman,
  formatReview,
} from "../../../skills/rheged-skills-setup/scripts/lib/report.mjs";
import { describe, expect, it } from "vitest";

const SKILL_REPORTS = [
  {
    configPath: "skills/changelog/config.json",
    malformed: false,
    name: "changelog",
    results: {
      baseBranch: { status: "inferred", write: "main" },
      changelogDir: { status: "unchanged" },
      issueKeys: { detected: ["XYZ"], keep: ["ABC"], status: "drift" },
      linearWorkspaceSlug: { status: "needs-manual-input" },
    },
  },
];

describe("buildReport", () => {
  it("aggregates totals and collects drift + manual buckets", () => {
    const report = buildReport(SKILL_REPORTS, false);

    expect(report.mode).toBe("dry-run");
    expect(report.totals).toEqual({
      drift: 1,
      inferred: 1,
      "needs-manual-input": 1,
      unchanged: 1,
    });

    expect(report.driftKeys).toEqual([
      {
        configPath: "skills/changelog/config.json",
        detected: ["XYZ"],
        kept: ["ABC"],
        key: "issueKeys",
        skill: "changelog",
      },
    ]);
    expect(report.manualKeys).toEqual([
      {
        configPath: "skills/changelog/config.json",
        key: "linearWorkspaceSlug",
        skill: "changelog",
      },
    ]);
  });

  it("marks a --write run with mode 'write'", () => {
    expect(buildReport(SKILL_REPORTS, true).mode).toBe("write");
  });

  it("threads the skills.lock result through, defaulting to null", () => {
    expect(buildReport(SKILL_REPORTS, false).lock).toBeNull();

    const lock = {
      needsFacts: false,
      path: ".claude/skills.lock",
      status: "would-write",
    };
    expect(buildReport(SKILL_REPORTS, false, null, lock).lock).toEqual(lock);
  });
});

describe("formatHuman", () => {
  it("renders the dry-run header, per-key details, and trailing guidance", () => {
    const text = formatHuman(buildReport(SKILL_REPORTS, false));

    expect(text).toContain("dry run (no files written)");
    expect(text).toContain("skills/changelog/config.json");
    expect(text).toContain("inferred");
    expect(text).toContain('keeps ["ABC"] vs detected ["XYZ"]');
    expect(text).toContain("1 drifted key(s) kept");
    expect(text).toContain(
      "1 key(s) need manual input: changelog.linearWorkspaceSlug.",
    );
  });

  it("renders the skills.lock line, with a needsFacts note when provenance is missing", () => {
    const written = formatHuman(
      buildReport(SKILL_REPORTS, true, null, {
        needsFacts: false,
        path: ".claude/skills.lock",
        status: "written",
      }),
    );
    expect(written).toContain(".claude/skills.lock: wrote skills.lock");
    expect(written).not.toContain("source/ref not supplied");

    const needsFacts = formatHuman(
      buildReport(SKILL_REPORTS, false, null, {
        needsFacts: true,
        path: ".claude/skills.lock",
        status: "would-write",
      }),
    );
    expect(needsFacts).toContain(
      ".claude/skills.lock: will write skills.lock (source/ref not supplied — pass lockSource/lockRef)",
    );
  });

  it("flags an unparseable config and skips its keys", () => {
    const text = formatHuman(
      buildReport(
        [
          {
            configPath: "skills/broken/config.json",
            malformed: true,
            name: "broken",
            results: {},
          },
        ],
        true,
      ),
    );
    expect(text).toContain("wrote inferred values");
    expect(text).toContain("⚠ existing config.json is unparseable — skipped");
  });
});

const SET_REPORTS = [
  {
    configPath: "skills/changelog/config.json",
    malformed: false,
    name: "changelog",
    results: {
      baseBranch: { from: "main", status: "set", write: "develop" },
      // A --set on a previously-unset key: no `from`.
      changelogDir: { status: "set", write: "docs/changes" },
    },
  },
];

describe("--set in the report", () => {
  it("collects set keys into totals and a setKeys bucket", () => {
    const report = buildReport(SET_REPORTS, false);
    expect(report.totals.set).toBe(2);
    expect(report.setKeys).toEqual([
      {
        configPath: "skills/changelog/config.json",
        key: "baseBranch",
        skill: "changelog",
        value: "develop",
      },
      {
        configPath: "skills/changelog/config.json",
        key: "changelogDir",
        skill: "changelog",
        value: "docs/changes",
      },
    ]);
  });

  it("renders the set line with the replaced value and a dry-run hint", () => {
    const text = formatHuman(buildReport(SET_REPORTS, false));
    expect(text).toContain('set to "develop" (was "main")');
    expect(text).toContain('set to "docs/changes"');
    // The previously-unset key shows no "(was …)" clause.
    expect(text).not.toContain('set to "docs/changes" (was');
    expect(text).toContain(
      "2 key(s) will be set via --set: changelog.baseBranch, changelog.changelogDir. Re-run with --write to apply.",
    );
  });
});

const REVIEW_INPUT = [
  {
    config: {
      baseBranch: "develop",
      extraKey: "kept-verbatim",
      issueKeys: ["A"],
    },
    configPath: "skills/changelog/config.json",
    malformed: false,
    name: "changelog",
    results: {
      baseBranch: { detected: "main", keep: "develop", status: "drift" },
      // In config but unknown to every template — a complete review must show it.
      extraKey: { keep: "kept-verbatim", status: "unknown-kept" },
      issueKeys: { status: "unchanged" },
      // In the template but not yet in config.json — rendered as "not set".
      linearWorkspaceSlug: { status: "needs-manual-input" },
    },
  },
];

const DESCRIPTIONS = new Map([
  [
    "baseBranch",
    {
      detectionSource: "`git symbolic-ref …/HEAD`",
      fallback: "`main`",
      usedBy: "changelog, send-it",
    },
  ],
]);

describe("buildReviewReport", () => {
  it("attaches current values, isSet, and descriptions per key", () => {
    const report = buildReviewReport(REVIEW_INPUT, DESCRIPTIONS);

    expect(report.mode).toBe("review");
    expect(report.totals).toEqual({
      drift: 1,
      "needs-manual-input": 1,
      unchanged: 1,
      "unknown-kept": 1,
    });

    const keys = Object.fromEntries(
      report.skills[0].keys.map((entry) => [entry.key, entry]),
    );

    // A drift key carries its current value plus its description.
    expect(keys.baseBranch).toMatchObject({
      detectionSource: "`git symbolic-ref …/HEAD`",
      isSet: true,
      status: "drift",
      usedBy: "changelog, send-it",
      value: "develop",
    });

    // A key detection doesn't know about is kept, with a null description.
    expect(keys.extraKey).toMatchObject({
      detectionSource: null,
      isSet: true,
      status: "unknown-kept",
      usedBy: null,
      value: "kept-verbatim",
    });

    // A template key not yet in config.json has no value and reports isSet false.
    expect(keys.linearWorkspaceSlug.isSet).toBe(false);
    expect("value" in keys.linearWorkspaceSlug).toBe(false);
  });
});

describe("formatReview", () => {
  it("renders the read-only header, values, statuses and descriptions", () => {
    const text = formatReview(buildReviewReport(REVIEW_INPUT, DESCRIPTIONS));

    expect(text).toContain("review (read-only)");
    expect(text).toContain("skills/changelog/config.json");
    expect(text).toContain('"develop"');
    expect(text).toContain("unknown-kept");
    expect(text).toContain(
      "used by changelog, send-it — `git symbolic-ref …/HEAD`",
    );
    // A not-yet-set template key is shown as such.
    expect(text).toContain("— not set");
  });

  it("flags an unparseable config in review too", () => {
    const text = formatReview(
      buildReviewReport(
        [
          {
            config: {},
            configPath: "skills/broken/config.json",
            malformed: true,
            name: "broken",
            results: {},
          },
        ],
        new Map(),
      ),
    );
    expect(text).toContain("⚠ existing config.json is unparseable — skipped");
  });

  it("surfaces the fallback for an unset key but not for a set one", () => {
    const text = formatReview(
      buildReviewReport(
        [
          {
            config: { baseBranch: "develop" },
            configPath: "skills/x/config.json",
            malformed: false,
            name: "x",
            results: {
              baseBranch: { status: "drift" },
              linearWorkspaceSlug: { status: "needs-manual-input" },
            },
          },
        ],
        new Map([
          [
            "baseBranch",
            { detectionSource: "d", fallback: "`main`", usedBy: "changelog" },
          ],
          [
            "linearWorkspaceSlug",
            {
              detectionSource: "d2",
              fallback: "needs-manual-input",
              usedBy: "changelog",
            },
          ],
        ]),
      ),
    );

    // An unset key surfaces its fallback default...
    expect(text).toContain("fallback: needs-manual-input");
    // ...while a set key's live value stands in for it (no fallback line).
    expect(text).not.toContain("fallback: `main`");
  });
});
