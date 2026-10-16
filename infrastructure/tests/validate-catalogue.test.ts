import {
  compareVersions,
  validateCatalogue,
} from "../scripts/validate-catalogue.mjs";
import { describe, expect, it } from "vitest";

const SHA = "0123456789abcdef0123456789abcdef01234567";

function catalogue() {
  return {
    sources: [
      {
        id: "rheged",
        ref: "v1.2.0",
        skills: ["send-it"],
        url: "https://github.com/rheged-studio/agent-skills",
      },
      {
        id: "matt-pocock",
        ref: SHA,
        skills: ["grill-me"],
        thirdParty: true,
        url: "https://github.com/mattpocock/skills",
      },
    ],
    version: 1,
  };
}

function errorsFor(
  value: ReturnType<typeof catalogue>,
  overrides: { vendoredText?: string | undefined } = {},
) {
  const text = JSON.stringify(value);
  return validateCatalogue({
    catalogueText: text,
    hasSkill: () => true,
    rootVersion: "1.2.0",
    vendoredText: "vendoredText" in overrides ? overrides.vendoredText : text,
  }).errors;
}

describe("validateCatalogue (R-2871)", () => {
  it("passes a pinned catalogue", () => {
    expect(errorsFor(catalogue())).toEqual([]);
  });

  it("requires thirdParty on a non-rheged-studio source", () => {
    const value = catalogue();
    delete (value.sources[1] as { thirdParty?: boolean }).thirdParty;
    expect(errorsFor(value).join("\n")).toMatch(/"thirdParty": true/);
  });

  it("rejects thirdParty on a rheged-studio source", () => {
    const value = catalogue();
    (value.sources[0] as { thirdParty?: boolean }).thirdParty = true;
    expect(errorsFor(value).join("\n")).toMatch(/marked thirdParty/);
  });

  it("requires a commit SHA for a third-party source", () => {
    const value = catalogue();
    value.sources[1].ref = "v1.3.1";
    expect(errorsFor(value).join("\n")).toMatch(/40-hex commit SHA/);
  });

  it("rejects a rheged tag ahead of the root version", () => {
    const value = catalogue();
    value.sources[0].ref = "v1.3.0";
    expect(errorsFor(value).join("\n")).toMatch(/newer than/);
  });

  it("rejects a missing or drifted vendored copy", () => {
    expect(
      errorsFor(catalogue(), { vendoredText: undefined }).join("\n"),
    ).toMatch(/missing skills\/rheged-skills-setup\/assets/);
    expect(errorsFor(catalogue(), { vendoredText: "{}" }).join("\n")).toMatch(
      /drifted/,
    );
  });

  it("reports a parse error for an unpinned ref", () => {
    const value = catalogue();
    value.sources[0].ref = "main";
    expect(errorsFor(value).join("\n")).toMatch(/pinned 'ref'/);
  });
});

describe("compareVersions", () => {
  it("orders semver tags", () => {
    expect(compareVersions("v1.13.2", "1.13.2")).toBe(0);
    expect(compareVersions("v1.9.0", "1.13.2")).toBeLessThan(0);
    expect(compareVersions("v2.0.0", "1.13.2")).toBeGreaterThan(0);
  });
});
