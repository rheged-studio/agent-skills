import {
  deriveBody,
  deriveBump,
  deriveCategory,
  deriveSlug,
  deriveType,
} from "../../../skills/send-it/scripts/derive-bump.mjs";
import { describe, expect, it } from "vitest";

describe("deriveSlug", () => {
  it("truncates over the 60-char ceiling at a word boundary when possible", () => {
    const slug = deriveSlug("asw-49-fold-in-send-it-claude-slash-command");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toBe("asw-49-fold-in-send-it-claude-slash-command");
  });

  it("normalises mixed separators and trims", () => {
    expect(deriveSlug("FOO_bar/baz   qux")).toBe("foo-bar-baz-qux");
  });

  it("strips leading and trailing hyphens", () => {
    expect(deriveSlug("---hello---")).toBe("hello");
  });

  it("truncates overlong slugs at a word boundary", () => {
    const long =
      "feature/very-long-branch-name-that-keeps-going-and-going-and-eventually-stops";
    const slug = deriveSlug(long);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("deriveBump", () => {
  it("is major on a BREAKING CHANGE trailer", () => {
    expect(
      deriveBump([
        { body: "BREAKING CHANGE: removes Y", subject: "feat: add x" },
      ]),
    ).toBe("major");
  });

  it("is major on a bang in a conventional-commit subject", () => {
    expect(
      deriveBump([{ body: "", subject: "refactor!: drop legacy API" }]),
    ).toBe("major");
  });

  it("is minor when the first commit is a feat", () => {
    expect(
      deriveBump([
        { body: "", subject: "feat: add new export" },
        { body: "", subject: "fix: typo" },
      ]),
    ).toBe("minor");
  });

  it("takes the strongest type across all commits: a later feat wins over a lead fix", () => {
    // R-387: the type signal is the strongest Conventional-Commit type across
    // ALL commits, mirroring the all-commits breaking-change scan — not HEAD only.
    expect(
      deriveBump([
        { body: "", subject: "fix: stabilise" },
        { body: "", subject: "feat: new export" },
      ]),
    ).toBe("minor");
  });

  it("is minor when the HEAD commit is a chore but an earlier commit is a feat", () => {
    // R-387 acceptance criteria: HEAD chore + earlier feat → minor.
    expect(
      deriveBump([
        { body: "", subject: "chore: tidy" },
        { body: "", subject: "feat: add export" },
      ]),
    ).toBe("minor");
  });

  it("is patch when the HEAD commit is a docs but an earlier commit is a fix", () => {
    // R-387 acceptance criteria: HEAD docs + earlier fix → patch.
    expect(
      deriveBump([
        { body: "", subject: "docs: notes" },
        { body: "", subject: "fix: handle null" },
      ]),
    ).toBe("patch");
  });

  it("is patch when the dominant type is a perf (third release tier)", () => {
    // HEAD chore + earlier perf → patch (perf ranks alongside fix).
    expect(
      deriveBump([
        { body: "", subject: "chore: tidy" },
        { body: "", subject: "perf: cache lookups" },
      ]),
    ).toBe("patch");
  });

  it("promotes a later release type over a HEAD `constructor:` commit (no prototype collision)", () => {
    // Guards significance() against the Object.prototype.constructor collision:
    // without the Object.hasOwn guard, significance("constructor") is a function,
    // `3 > <function>` is `3 > NaN` (false), and the feat is never promoted.
    expect(
      deriveBump([
        { body: "", subject: "constructor: x" },
        { body: "", subject: "feat: real feature" },
      ]),
    ).toBe("minor");
  });

  it("is minor on a scoped feat", () => {
    expect(deriveBump([{ body: "", subject: "feat(react): add hook" }])).toBe(
      "minor",
    );
  });

  it("is patch on a fix", () => {
    expect(deriveBump([{ body: "", subject: "fix: handle nullable" }])).toBe(
      "patch",
    );
  });

  it("is patch on a docs commit", () => {
    expect(deriveBump([{ body: "", subject: "docs: update readme" }])).toBe(
      "patch",
    );
  });

  it("is patch when there are no commits", () => {
    expect(deriveBump([])).toBe("patch");
  });
});

describe("deriveBody", () => {
  it("strips the conventional-commit prefix", () => {
    expect(
      deriveBody([{ body: "", subject: "feat(react): add useToast" }]),
    ).toBe("add useToast");
  });

  it("strips the bang variant", () => {
    expect(
      deriveBody([{ body: "", subject: "feat!: remove legacy API" }]),
    ).toBe("remove legacy API");
  });

  it("returns an empty string when there are no commits", () => {
    expect(deriveBody([])).toBe("");
  });
});

describe("deriveType", () => {
  it("reads the conventional type, scoped or not", () => {
    expect(deriveType("feat: add x")).toBe("feat");
    expect(deriveType("fix(scope): y")).toBe("fix");
    expect(deriveType("perf!: z")).toBe("perf");
    expect(deriveType("docs: readme")).toBe("docs");
  });

  it("folds a non-conventional subject to chore", () => {
    expect(deriveType("WIP random subject")).toBe("chore");
  });
});

describe("deriveCategory (R-598 — release-type by semantic category, not path)", () => {
  it("treats feat as a release with the feature category", () => {
    expect(deriveCategory([{ body: "", subject: "feat: add export" }])).toEqual(
      {
        breaking: false,
        category: "feature",
        releaseTriggering: true,
        type: "feat",
      },
    );
  });

  it("treats fix and perf as releases (patch category)", () => {
    expect(
      deriveCategory([{ body: "", subject: "fix: handle null" }]),
    ).toMatchObject({ category: "fix", releaseTriggering: true, type: "fix" });
    expect(
      deriveCategory([{ body: "", subject: "perf: cache lookups" }]),
    ).toMatchObject({
      category: "perf",
      releaseTriggering: true,
      type: "perf",
    });
  });

  it("does NOT release on docs/refactor/chore, even though they may touch a shippable path", () => {
    expect(
      deriveCategory([{ body: "", subject: "docs: rewrite SKILL.md" }]),
    ).toMatchObject({
      category: "docs",
      releaseTriggering: false,
      type: "docs",
    });
    expect(
      deriveCategory([{ body: "", subject: "refactor: extract helper" }]),
    ).toMatchObject({ category: "refactor", releaseTriggering: false });
    expect(
      deriveCategory([{ body: "", subject: "chore: bump dep" }]),
    ).toMatchObject({ category: "chore", releaseTriggering: false });
  });

  it("folds ci/build/test/style into the chore category, no release", () => {
    for (const type of ["ci", "build", "test", "style"]) {
      expect(
        deriveCategory([{ body: "", subject: `${type}: tweak` }]),
      ).toMatchObject({ category: "chore", releaseTriggering: false, type });
    }
  });

  it("is a breaking release on a bang or BREAKING CHANGE trailer, regardless of type", () => {
    expect(
      deriveCategory([{ body: "", subject: "feat!: drop legacy" }]),
    ).toMatchObject({ breaking: true, releaseTriggering: true, type: "feat" });
    // A `!` makes even a refactor a (major) release per release-please.
    expect(
      deriveCategory([{ body: "", subject: "refactor!: rip out API" }]),
    ).toMatchObject({
      breaking: true,
      category: "refactor",
      releaseTriggering: true,
    });
    expect(
      deriveCategory([
        { body: "BREAKING CHANGE: removes Y", subject: "fix: patch" },
      ]),
    ).toMatchObject({ breaking: true, releaseTriggering: true });
  });

  it("takes the strongest type/category across all commits, not HEAD (R-387)", () => {
    // HEAD chore + earlier feat → feature / releaseTriggering (acceptance criteria).
    expect(
      deriveCategory([
        { body: "", subject: "chore: tidy" },
        { body: "", subject: "feat: later feature" },
      ]),
    ).toMatchObject({
      category: "feature",
      releaseTriggering: true,
      type: "feat",
    });
  });

  it("takes an earlier fix over a lead docs commit (R-387)", () => {
    // HEAD docs + earlier fix → fix / releaseTriggering (acceptance criteria).
    expect(
      deriveCategory([
        { body: "", subject: "docs: notes" },
        { body: "", subject: "fix: handle null" },
      ]),
    ).toMatchObject({
      category: "fix",
      releaseTriggering: true,
      type: "fix",
    });
  });

  it("takes an earlier perf over a lead chore commit (third release tier, R-387)", () => {
    // HEAD chore + earlier perf → perf / releaseTriggering.
    expect(
      deriveCategory([
        { body: "", subject: "chore: tidy" },
        { body: "", subject: "perf: cache lookups" },
      ]),
    ).toMatchObject({
      category: "perf",
      releaseTriggering: true,
      type: "perf",
    });
  });

  it("promotes a later release type over a HEAD `constructor:` commit (no prototype collision)", () => {
    // significance() must guard against Object.prototype.constructor: without the
    // Object.hasOwn guard the HEAD `constructor:` pins the dominant type and the
    // later feat is silently dropped — defeating the all-commits scan (R-387).
    expect(
      deriveCategory([
        { body: "", subject: "constructor: x" },
        { body: "", subject: "feat: real feature" },
      ]),
    ).toMatchObject({
      category: "feature",
      releaseTriggering: true,
      type: "feat",
    });
  });

  it("stays on the newest commit's type when no commit is a release type", () => {
    // Non-release branch: neither docs nor refactor ranks, so the lead (docs) wins.
    expect(
      deriveCategory([
        { body: "", subject: "docs: notes" },
        { body: "", subject: "refactor: extract helper" },
      ]),
    ).toMatchObject({
      category: "docs",
      releaseTriggering: false,
      type: "docs",
    });
  });

  it("defaults to a non-release chore for an empty branch", () => {
    expect(deriveCategory([])).toEqual({
      breaking: false,
      category: "chore",
      releaseTriggering: false,
      type: "chore",
    });
  });

  it("folds a type colliding with an inherited Object key to chore (no prototype leak)", () => {
    // `CATEGORY_BY_TYPE["constructor"]` resolves to Object.prototype.constructor
    // on a plain object; the Object.hasOwn guard must return "chore" instead.
    // (deriveType lower-cases, so `constructor` is the real all-lowercase
    // collision — `toString` becomes the harmless `tostring`.)
    expect(deriveCategory([{ body: "", subject: "constructor: x" }])).toEqual({
      breaking: false,
      category: "chore",
      releaseTriggering: false,
      type: "constructor",
    });
  });
});
