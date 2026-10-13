// Imports the BUNDLE script directly (the distributed `.mjs`). Covers the pure
// version-parsing helpers (R-465): the no-semver-dependency parsing of
// `.nvmrc` / `process.version` / `engines.node` ranges and the comparison the
// Node-version gate is built on. The IO half (reading files, spawning pnpm)
// stays behind the CLI `main()` guard and is not imported here.
import {
  coerceMinVersion,
  compareVersions,
  parseVersion,
  satisfiesGte,
} from "../../../skills/changelog/scripts/preflight-changelog-ci.mjs";
import { describe, expect, it } from "vitest";

describe("parseVersion", () => {
  it("parses full, partial, and v-prefixed versions, padding missing parts", () => {
    expect(parseVersion("v22.5.1")).toEqual([22, 5, 1]);
    expect(parseVersion("22")).toEqual([22, 0, 0]);
    expect(parseVersion("22.5")).toEqual([22, 5, 0]);
    expect(parseVersion("  v20.10.0\n")).toEqual([20, 10, 0]);
  });

  it("returns null when there is no leading version number", () => {
    expect(parseVersion("lts/hydrogen")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });
});

describe("coerceMinVersion", () => {
  it("extracts the lower bound from the common engines.node range forms", () => {
    expect(coerceMinVersion(">=22")).toEqual([22, 0, 0]);
    expect(coerceMinVersion(">=22.1.0")).toEqual([22, 1, 0]);
    expect(coerceMinVersion("^22.0.0")).toEqual([22, 0, 0]);
    expect(coerceMinVersion("~22.1")).toEqual([22, 1, 0]);
    expect(coerceMinVersion(">=22 <23")).toEqual([22, 0, 0]);
  });

  it("treats x / * wildcards as 0", () => {
    expect(coerceMinVersion("22.x")).toEqual([22, 0, 0]);
    expect(coerceMinVersion("22.1.*")).toEqual([22, 1, 0]);
  });

  it("returns null when there is no version-like token", () => {
    expect(coerceMinVersion("latest")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareVersions([22, 0, 0], [22, 0, 0])).toBe(0);
    expect(compareVersions([23, 0, 0], [22, 9, 9])).toBe(1);
    expect(compareVersions([22, 1, 0], [22, 2, 0])).toBe(-1);
    expect(compareVersions([22, 1, 1], [22, 1, 2])).toBe(-1);
  });
});

describe("satisfiesGte", () => {
  it("is true when the version is at or above the minimum", () => {
    expect(satisfiesGte([22, 5, 0], [22, 0, 0])).toBe(true);
    expect(satisfiesGte([22, 0, 0], [22, 0, 0])).toBe(true);
  });

  it("is false when the version is below the minimum", () => {
    expect(satisfiesGte([20, 0, 0], [22, 0, 0])).toBe(false);
    expect(satisfiesGte([22, 0, 0], [22, 1, 0])).toBe(false);
  });
});
