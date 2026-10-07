// Covers the Node-major fail-closed gate (A-1702): the pure version parsers and
// the `.nvmrc` / `engines.node` resolution. The `process.exit` half
// (`assertNodeMajor`) stays behind the CLI guard.
import {
  enginesPinnedMajor,
  parseMajor,
  requiredNodeMajor,
} from "../../../skills/preflight/scripts/preflight.mjs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

describe("parseMajor", () => {
  it.each([
    ["v26.7.0", 26],
    ["24", 24],
    ["24.18.0\n", 24],
    ["  22  ", 22],
    ["lts/iron", null],
    ["", null],
  ])("%j → %j", (raw, expected) => {
    expect(parseMajor(raw)).toBe(expected);
  });
});

describe("enginesPinnedMajor", () => {
  it.each([
    ["24.x", 24],
    ["24", 24],
    ["24.18.0", 24],
    ["24.*", 24],
    [">=22", null],
    ["^24", null],
    ["~24.1", null],
    ["22 || 24", null],
    [undefined, null],
  ])("%j → %j", (spec, expected) => {
    expect(enginesPinnedMajor(spec)).toBe(expected);
  });
});

describe("requiredNodeMajor", () => {
  let root: string;

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  function repo(files: Record<string, string>) {
    root = mkdtempSync(join(tmpdir(), "preflight-node-"));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, name), content);
    }

    return root;
  }

  it("reads the .nvmrc major", () => {
    expect(requiredNodeMajor(repo({ ".nvmrc": "24\n" }))).toBe(24);
  });

  it("prefers an exact engines pin over .nvmrc", () => {
    const directory = repo({
      ".nvmrc": "22\n",
      "package.json": JSON.stringify({ engines: { node: "24.x" } }),
    });
    expect(requiredNodeMajor(directory)).toBe(24);
  });

  it("falls back to .nvmrc when engines is a range", () => {
    const directory = repo({
      ".nvmrc": "v22.11.0",
      "package.json": JSON.stringify({ engines: { node: ">=22" } }),
    });
    expect(requiredNodeMajor(directory)).toBe(22);
  });

  it("is a no-op with no .nvmrc and a >= engines range", () => {
    const directory = repo({
      "package.json": JSON.stringify({ engines: { node: ">=22" } }),
    });
    expect(requiredNodeMajor(directory)).toBeNull();
  });

  it("is a no-op with neither file", () => {
    expect(requiredNodeMajor(repo({}))).toBeNull();
  });

  it("reports invalid package.json JSON clearly rather than ignoring it", () => {
    const directory = repo({ ".nvmrc": "24\n", "package.json": "{ not json" });
    expect(() => requiredNodeMajor(directory)).toThrow(
      `preflight: ${join(directory, "package.json")} contains invalid JSON`,
    );
  });

  it.each([["null"], ["[]"], ["42"], ['"text"']])(
    "rejects a non-object package.json (%s)",
    (content) => {
      const directory = repo({ "package.json": content });
      expect(() => requiredNodeMajor(directory)).toThrow(
        `preflight: ${join(directory, "package.json")} must contain a JSON object`,
      );
    },
  );
});
