// Unit tests for the `--set` override parser/validator (A-704). Pure functions,
// no filesystem — resolveOverrides is fed plain skill stubs shaped like the
// InstalledSkill objects discoverSkills() produces (only `name` + `example` are
// read).
import {
  coerceValue,
  jsonType,
  parseSetAssignment,
  resolveOverrides,
} from "../../../skills/rheged-skills-setup/scripts/lib/overrides.mjs";
import { describe, expect, it } from "vitest";

describe("parseSetAssignment", () => {
  it("splits <skill>.<key>=<value> into its parts", () => {
    expect(parseSetAssignment("changelog.baseBranch=develop")).toEqual({
      key: "baseBranch",
      rawValue: "develop",
      skill: "changelog",
    });
  });

  it("splits on the first = so the value may contain = and /", () => {
    expect(parseSetAssignment("changelog.baseBranch=release/2.0=rc")).toEqual({
      key: "baseBranch",
      rawValue: "release/2.0=rc",
      skill: "changelog",
    });
  });

  it("splits on the first . so only the skill segment is taken", () => {
    // Config keys are flat today, but the split must not choke on a dotted value
    // or a (hypothetical) dotted key — the skill is always the first segment.
    expect(parseSetAssignment("cleanup-repo.mainBranch=a.b")).toEqual({
      key: "mainBranch",
      rawValue: "a.b",
      skill: "cleanup-repo",
    });
  });

  it("throws when there is no =", () => {
    expect(() => parseSetAssignment("changelog.baseBranch")).toThrow(/no "="/);
  });

  it("throws when the address has no . separating skill from key", () => {
    expect(() => parseSetAssignment("baseBranch=develop")).toThrow(/no "\."/);
  });

  it("throws on an empty skill or key segment", () => {
    expect(() => parseSetAssignment(".baseBranch=develop")).toThrow(/empty/);
    expect(() => parseSetAssignment("changelog.=develop")).toThrow(/empty/);
  });
});

describe("coerceValue", () => {
  it("parses JSON scalars to their real types", () => {
    expect(coerceValue("true")).toBe(true);
    expect(coerceValue("false")).toBe(false);
    expect(coerceValue("42")).toBe(42);
    expect(coerceValue("null")).toBe(null);
  });

  it("parses JSON arrays and objects", () => {
    expect(coerceValue('["A","B"]')).toEqual(["A", "B"]);
    expect(coerceValue('{"a":1}')).toEqual({ a: 1 });
  });

  it("falls back to the bare string when the value is not valid JSON", () => {
    expect(coerceValue("develop")).toBe("develop");
    expect(coerceValue("release/2.0")).toBe("release/2.0");
    expect(coerceValue("")).toBe("");
  });
});

describe("jsonType", () => {
  it("distinguishes array, object, and null from typeof", () => {
    expect(jsonType([])).toBe("array");
    expect(jsonType({})).toBe("object");
    expect(jsonType(null)).toBe("null");
    expect(jsonType("x")).toBe("string");
    expect(jsonType(1)).toBe("number");
    expect(jsonType(true)).toBe("boolean");
  });
});

describe("resolveOverrides", () => {
  const skills = [
    {
      example: {
        affectedPackages: true,
        baseBranch: "main",
        issueKeys: ["ABC", "XYZ"],
      },
      name: "changelog",
    },
    { example: { mainBranch: "main" }, name: "cleanup-repo" },
  ];

  it("resolves valid overrides into a per-skill map", () => {
    const { errors, overrides } = resolveOverrides(
      [
        "changelog.baseBranch=develop",
        "changelog.affectedPackages=false",
        "cleanup-repo.mainBranch=trunk",
      ],
      skills,
    );
    expect(errors).toEqual([]);
    expect(overrides.get("changelog")).toEqual({
      affectedPackages: false,
      baseBranch: "develop",
    });
    expect(overrides.get("cleanup-repo")).toEqual({ mainBranch: "trunk" });
  });

  it("coerces an array value that matches an array placeholder", () => {
    const { errors, overrides } = resolveOverrides(
      ['changelog.issueKeys=["A"]'],
      skills,
    );
    expect(errors).toEqual([]);
    expect(overrides.get("changelog")).toEqual({ issueKeys: ["A"] });
  });

  it("errors on an unknown skill", () => {
    const { errors, overrides } = resolveOverrides(["nope.x=1"], skills);
    expect(overrides.size).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/"nope" is not an installed skill/);
  });

  it("rejects a skill whose config.json is malformed", () => {
    // discoverSkills returns a malformed skill with a usable `example`, but the
    // reconcile loop skips it — so an override must be refused up front rather
    // than silently dropped.
    const withMalformed = [
      ...skills,
      { example: { baseBranch: "main" }, malformed: true, name: "broken" },
    ];
    const { errors, overrides } = resolveOverrides(
      ["broken.baseBranch=develop"],
      withMalformed,
    );
    expect(overrides.has("broken")).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/config\.json is malformed/);
  });

  it("errors on a key not in config.example.json", () => {
    const { errors } = resolveOverrides(["changelog.nope=1"], skills);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/not a known config key/);
  });

  it("errors on a value whose type differs from the placeholder", () => {
    const { errors } = resolveOverrides(
      ["changelog.affectedPackages=maybe"],
      skills,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/expected a boolean value but got a string/);
  });

  it("rejects a scalar into an array field (bare A is not a JSON array)", () => {
    const { errors } = resolveOverrides(["changelog.issueKeys=A"], skills);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/expected an array value but got a string/);
  });

  it("collects a malformed assignment as an error without throwing", () => {
    const { errors } = resolveOverrides(["changelog.baseBranch"], skills);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/no "="/);
  });

  it("lets a later assignment to the same key win", () => {
    const { overrides } = resolveOverrides(
      ["changelog.baseBranch=one", "changelog.baseBranch=two"],
      skills,
    );
    expect(overrides.get("changelog")).toEqual({ baseBranch: "two" });
  });

  it("rejects prototype-polluting keys before the bracket-notation write", () => {
    const { errors, overrides } = resolveOverrides(
      [
        "changelog.__proto__=oops",
        "changelog.constructor=oops",
        "changelog.prototype=oops",
      ],
      skills,
    );
    expect(errors).toHaveLength(3);
    for (const message of errors) {
      expect(message).toMatch(/is not an assignable config key/);
    }

    expect(overrides.size).toBe(0);
    // Object.prototype is untouched by the rejected keys.
    expect(({} as Record<string, unknown>).oops).toBeUndefined();
  });
});
