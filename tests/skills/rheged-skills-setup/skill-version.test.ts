// Imports the BUNDLE lib directly (the distributed `.mjs`). Covers the installed-
// version inventory the skills.lock is built from (A-616): the scoped SKILL.md
// frontmatter scan and the package.json fallback. Uses a tmp skills dir so the
// walk doesn't depend on the host repo's own bundles.
import {
  parseSkillVersion,
  readBundleVersion,
  readInstalledVersions,
} from "../../../skills/rheged-skills-setup/scripts/lib/skill-version.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function skillMd(version: string): string {
  return `---\nname: demo\nmetadata:\n  version: ${version}\n  author: Someone\nallowed-tools: Read\n---\n\n# demo\n`;
}

describe("parseSkillVersion", () => {
  it("reads metadata.version from frontmatter", () => {
    expect(parseSkillVersion(skillMd("1.2.3"))).toBe("1.2.3");
  });

  it("strips surrounding quotes", () => {
    expect(parseSkillVersion('---\nmetadata:\n  version: "0.4.0"\n---\n')).toBe(
      "0.4.0",
    );
    expect(parseSkillVersion("---\nmetadata:\n  version: '0.4.0'\n---\n")).toBe(
      "0.4.0",
    );
  });

  it("returns null when there is no frontmatter fence on line 1", () => {
    expect(
      parseSkillVersion("# demo\nmetadata:\n  version: 1.0.0\n"),
    ).toBeNull();
  });

  it("returns null when metadata has no version child", () => {
    expect(
      parseSkillVersion("---\nmetadata:\n  author: Someone\n---\n"),
    ).toBeNull();
  });

  it("does not read a version outside the metadata block", () => {
    // A top-level `version:` sibling of metadata must not be picked up.
    expect(
      parseSkillVersion(
        "---\nname: demo\nversion: 9.9.9\nmetadata:\n  author: x\n---\n",
      ),
    ).toBeNull();
  });

  it("reads metadata.version, not a nested version under a metadata sub-key", () => {
    // A `version:` nested under a deeper metadata child (here `build:`) must be
    // ignored; only the direct-child `metadata.version` counts, even when the
    // nested one appears first.
    expect(
      parseSkillVersion(
        "---\nmetadata:\n  build:\n    version: bad\n  version: good\n---\n",
      ),
    ).toBe("good");
  });

  it("stops at the closing fence", () => {
    expect(
      parseSkillVersion("---\nname: demo\n---\nmetadata:\n  version: 1.0.0\n"),
    ).toBeNull();
  });
});

describe("readBundleVersion", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "bundle-version-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("prefers SKILL.md metadata.version", () => {
    writeFileSync(join(directory, "SKILL.md"), skillMd("2.0.0"));
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ version: "9.9.9" }),
    );
    expect(readBundleVersion(directory)).toBe("2.0.0");
  });

  it("falls back to package.json when SKILL.md has no version", () => {
    writeFileSync(join(directory, "SKILL.md"), "---\nname: demo\n---\n");
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ version: "3.1.4" }),
    );
    expect(readBundleVersion(directory)).toBe("3.1.4");
  });

  it("falls back to package.json when SKILL.md is absent", () => {
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ version: "1.1.1" }),
    );
    expect(readBundleVersion(directory)).toBe("1.1.1");
  });

  it("returns null when neither yields a version", () => {
    writeFileSync(join(directory, "SKILL.md"), "---\nname: demo\n---\n");
    expect(readBundleVersion(directory)).toBeNull();
  });
});

describe("readInstalledVersions", () => {
  let skillsDirectory: string;

  beforeEach(() => {
    skillsDirectory = mkdtempSync(join(tmpdir(), "installed-versions-"));
  });

  afterEach(() => {
    rmSync(skillsDirectory, { force: true, recursive: true });
  });

  function bundle(name: string, version: null | string) {
    const directory = join(skillsDirectory, name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "SKILL.md"),
      version ? skillMd(version) : `---\nname: ${name}\n---\n`,
    );
  }

  it("returns an empty object for a missing skills dir", () => {
    expect(readInstalledVersions(join(skillsDirectory, "nope"))).toEqual({});
  });

  it("walks every bundle with a SKILL.md, sorted, incl. version-less ones as null", () => {
    bundle("send-it", "0.6.1");
    bundle("changelog", "0.9.1");
    bundle("broken", null);
    // A directory without a SKILL.md is not a bundle and is skipped.
    mkdirSync(join(skillsDirectory, "not-a-bundle"), { recursive: true });

    const versions = readInstalledVersions(skillsDirectory);
    expect(Object.keys(versions)).toEqual(["broken", "changelog", "send-it"]);
    expect(versions).toEqual({
      broken: null,
      changelog: "0.9.1",
      "send-it": "0.6.1",
    });
  });
});
