// Imports the BUNDLE lib directly (the distributed `.mjs`). Covers the sibling-
// bundle discovery (A-465): which installed skills get reconciled — only those
// shipping a config.example.json — with the self-configuring `preflight` skill
// and unparseable config.json files handled specially. Uses a tmp skills directory so
// the assertions don't depend on which skills happen to be installed here.
import {
  discoverSkills,
  isPreflightInstalled,
} from "../../../skills/rheged-skills-setup/scripts/lib/discover.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("discoverSkills", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "discover-skills-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  function makeBundle(
    name: string,
    files: { config?: string; example?: object },
  ) {
    const bundle = join(directory, name);
    mkdirSync(bundle, { recursive: true });
    if (files.example !== undefined) {
      writeFileSync(
        join(bundle, "config.example.json"),
        JSON.stringify(files.example),
      );
    }

    if (files.config !== undefined) {
      writeFileSync(join(bundle, "config.json"), files.config);
    }
  }

  it("returns config-bearing bundles sorted by name, with config state attached", () => {
    makeBundle("alpha", {
      config: JSON.stringify({ key: 2 }),
      example: { key: 1 },
    });
    makeBundle("zeta", { example: { x: "y" } }); // no config.json yet

    const skills = discoverSkills(directory);
    expect(skills.map((skill) => skill.name)).toEqual(["alpha", "zeta"]);

    const alpha = skills.find((skill) => skill.name === "alpha");
    expect(alpha?.example).toEqual({ key: 1 });
    expect(alpha?.config.exists).toBe(true);
    expect(alpha?.config.data).toEqual({ key: 2 });

    const zeta = skills.find((skill) => skill.name === "zeta");
    expect(zeta?.config.exists).toBe(false);
    expect(zeta?.malformed).toBe(false);
  });

  it("skips the self-configuring preflight skill and bundles with no config surface", () => {
    makeBundle("preflight", { example: { workspaces: {} } });
    makeBundle("no-surface", {}); // no config.example.json
    makeBundle("real", { example: { key: 1 } });

    expect(discoverSkills(directory).map((skill) => skill.name)).toEqual([
      "real",
    ]);
  });

  it("flags a bundle whose config.json is unparseable without throwing", () => {
    makeBundle("broken", { config: "{ not json", example: { key: 1 } });

    const skills = discoverSkills(directory);
    const broken = skills.find((skill) => skill.name === "broken");
    expect(broken?.malformed).toBe(true);
    expect(broken?.config.exists).toBe(true);
  });

  it("returns an empty list when the skills directory does not exist", () => {
    expect(discoverSkills(join(directory, "nope"))).toEqual([]);
  });
});

describe("isPreflightInstalled", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "preflight-installed-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("is true when the preflight bundle ships a SKILL.md", () => {
    mkdirSync(join(directory, "preflight"), { recursive: true });
    writeFileSync(
      join(directory, "preflight", "SKILL.md"),
      "---\nname: preflight\n---\n",
    );
    expect(isPreflightInstalled(directory)).toBe(true);
  });

  it("is false when the preflight directory is absent", () => {
    expect(isPreflightInstalled(directory)).toBe(false);
  });

  it("is false when the directory exists but has no SKILL.md (empty leftover)", () => {
    mkdirSync(join(directory, "preflight"), { recursive: true });
    expect(isPreflightInstalled(directory)).toBe(false);
  });
});
