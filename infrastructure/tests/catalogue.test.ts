import {
  buildPinnedSkillsCliArgv,
  buildSkillsAddArgsForSource,
  isCommitSha,
  isPinnedRef,
  isReleaseTag,
  parseCatalogue,
  pinnedSourceUrl,
  resolveInstallSkills,
  resolveInstallSources,
  resolveRhegedSkills,
  resolveWipeTargetsWithLegacy,
  rhegedSourceRef,
  selectInstallSources,
  SKILLS_CLI_VERSION,
} from "../../skills/rheged-skills-setup/scripts/lib/catalogue.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const catalogueJson = readFileSync(
  join(import.meta.dirname, "..", "skill-catalogue.json"),
  "utf8",
);

describe("parseCatalogue", () => {
  it("parses the tracked catalogue", () => {
    const catalogue = parseCatalogue(catalogueJson);
    expect(catalogue.sources).toHaveLength(2);
    expect(catalogue.sources[0].id).toBe("rheged");
    expect(catalogue.sources[1].skills).toContain("grill-me");
  });

  it("rejects duplicate skill names", () => {
    const bad = JSON.parse(catalogueJson);
    bad.sources[1].skills.push(bad.sources[0].skills[0]);
    expect(() => parseCatalogue(bad)).toThrow(/duplicate/);
  });
});

describe("resolveInstallSources", () => {
  const catalogue = parseCatalogue(catalogueJson);

  it("skips rheged source on agent-skills checkout", () => {
    const sources = resolveInstallSources(catalogue, {
      isAgentSkillsSourceRepo: true,
      profile: {},
    });
    expect(sources.map((source) => source.id)).toEqual(["matt-pocock"]);
  });

  it("includes both sources on a consumer", () => {
    const sources = resolveInstallSources(catalogue, {
      isAgentSkillsSourceRepo: false,
      profile: {},
    });
    expect(sources.map((source) => source.id)).toEqual([
      "rheged",
      "matt-pocock",
    ]);
  });
});

describe("resolveRhegedSkills", () => {
  const catalogue = parseCatalogue(catalogueJson);

  it("drops changelog for no-changelog repos", () => {
    const skills = resolveRhegedSkills({ repoType: "no-changelog" }, catalogue);
    expect(skills).not.toContain("changelog");
    expect(skills).toContain("send-it");
  });
});

describe("resolveInstallSkills", () => {
  const catalogue = parseCatalogue(catalogueJson);

  it("unions rheged and matt", () => {
    const skills = resolveInstallSkills({ repoType: "single" }, catalogue);
    expect(skills).toContain("rheged-skills-setup");
    expect(skills).toContain("grill-me");
    expect(skills).not.toContain("scaffold-new-skill");
  });
});

describe("buildSkillsAddArgsForSource", () => {
  it("builds add argv with agents and copy", () => {
    const args = buildSkillsAddArgsForSource(
      "https://github.com/example/repo",
      ["send-it"],
      ["claude-code", "cursor"],
    );
    expect(args[0]).toBe("add");
    expect(args).toContain("--copy");
    expect(args.filter((a) => a === "--agent")).toHaveLength(2);
  });

  it("passes a pinned ref through as a /tree/<ref> URL (R-2871)", () => {
    const args = buildSkillsAddArgsForSource(
      "https://github.com/example/repo",
      ["send-it", "commit"],
      ["claude-code"],
      SHA,
    );
    expect(args).toEqual([
      "add",
      `https://github.com/example/repo/tree/${SHA}`,
      "--skill",
      "send-it",
      "--skill",
      "commit",
      "--agent",
      "claude-code",
      "--copy",
    ]);
  });

  it("refuses an unpinned ref", () => {
    expect(() =>
      buildSkillsAddArgsForSource(
        "https://github.com/example/repo",
        ["send-it"],
        ["claude-code"],
        "main",
      ),
    ).toThrow(/unpinned ref/);
  });
});

describe("pinnedSourceUrl", () => {
  it("strips a trailing slash and .git before appending /tree/<ref>", () => {
    expect(
      pinnedSourceUrl("https://github.com/example/repo.git/", "v1.2.3"),
    ).toBe("https://github.com/example/repo/tree/v1.2.3");
  });

  it("returns the bare repo URL when no ref is given", () => {
    expect(pinnedSourceUrl("https://github.com/example/repo")).toBe(
      "https://github.com/example/repo",
    );
  });
});

describe("buildPinnedSkillsCliArgv", () => {
  it("runs the exact pinned skills CLI version with --yes (R-2871)", () => {
    expect(SKILLS_CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(buildPinnedSkillsCliArgv(["add", "x"])).toEqual([
      "--yes",
      `skills@${SKILLS_CLI_VERSION}`,
      "add",
      "x",
    ]);
  });
});

describe("pinned refs and third-party sources (R-2871)", () => {
  const catalogue = parseCatalogue(catalogueJson);

  it("pins every first-party source to a SHA or release tag", () => {
    for (const source of catalogue.sources.filter(
      (entry) => !entry.thirdParty,
    )) {
      expect(isPinnedRef(source.ref)).toBe(true);
    }
  });

  it("leaves matt-pocock unpinned, tracking its default branch", () => {
    const matt = catalogue.sources.find(
      (source) => source.id === "matt-pocock",
    );
    expect(matt?.ref).toBeUndefined();
  });

  it("marks only matt-pocock as third-party", () => {
    expect(
      catalogue.sources
        .filter((source) => source.thirdParty)
        .map((source) => source.id),
    ).toEqual(["matt-pocock"]);
  });

  it("rejects a first-party source without a ref", () => {
    const bad = JSON.parse(catalogueJson);
    delete bad.sources[0].ref;
    expect(() => parseCatalogue(bad)).toThrow(/pinned 'ref'/);
  });

  it("accepts a third-party source without a ref", () => {
    const value = JSON.parse(catalogueJson);
    delete value.sources[1].ref;
    expect(parseCatalogue(value).sources[1].ref).toBeUndefined();
  });

  it("rejects a branch name even on a third-party source", () => {
    const bad = JSON.parse(catalogueJson);
    bad.sources[1].ref = "main";
    expect(() => parseCatalogue(bad)).toThrow(/pinned 'ref'/);
  });

  it("rejects a branch name as a ref", () => {
    const bad = JSON.parse(catalogueJson);
    bad.sources[0].ref = "main";
    expect(() => parseCatalogue(bad)).toThrow(/pinned 'ref'/);
  });

  it("rejects a non-boolean thirdParty", () => {
    const bad = JSON.parse(catalogueJson);
    bad.sources[1].thirdParty = "yes";
    expect(() => parseCatalogue(bad)).toThrow(/thirdParty must be boolean/);
  });

  it("rejects a non-GitHub repo URL", () => {
    const bad = JSON.parse(catalogueJson);
    bad.sources[1].url = "https://example.com/skills";
    expect(() => parseCatalogue(bad)).toThrow(/github\.com/);
  });

  it("recognises SHAs and release tags", () => {
    expect(isCommitSha(SHA)).toBe(true);
    expect(isCommitSha("abc123")).toBe(false);
    expect(isReleaseTag("v1.13.2")).toBe(true);
    expect(isReleaseTag("1.13.2")).toBe(false);
    expect(isPinnedRef("main")).toBe(false);
  });

  it("reports the pinned rheged ref for lock provenance", () => {
    expect(rhegedSourceRef(catalogue)).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});

describe("selectInstallSources", () => {
  const catalogue = parseCatalogue(catalogueJson);
  const sources = resolveInstallSources(catalogue, {
    isAgentSkillsSourceRepo: false,
    profile: {},
  });

  it("skips third-party sources by default", () => {
    const { install, skippedThirdParty } = selectInstallSources(sources);
    expect(install.map((source) => source.id)).toEqual(["rheged"]);
    expect(skippedThirdParty.map((source) => source.id)).toEqual([
      "matt-pocock",
    ]);
  });

  it("installs third-party sources with includeThirdParty", () => {
    const { install, skippedThirdParty } = selectInstallSources(sources, {
      includeThirdParty: true,
    });
    expect(install.map((source) => source.id)).toEqual([
      "rheged",
      "matt-pocock",
    ]);
    expect(skippedThirdParty).toEqual([]);
  });
});

describe("resolveWipeTargetsWithLegacy", () => {
  it("includes legacy initialise-skills dirs", () => {
    const targets = resolveWipeTargetsWithLegacy(
      [".claude/skills"],
      ["send-it"],
    );
    expect(targets).toContain(".claude/skills/initialise-skills");
    expect(targets).toContain(".claude/skills/send-it");
  });

  it("wipes skills removed upstream", () => {
    const targets = resolveWipeTargetsWithLegacy([".agents/skills"], []);
    expect(targets).toContain(".agents/skills/resolving-merge-conflicts");
  });
});

describe("matt-pocock source (mattpocock/skills 1.3.1)", () => {
  const catalogue = parseCatalogue(catalogueJson);
  const matt = catalogue.sources.find((source) => source.id === "matt-pocock");

  it("lists the skills added in 1.3.0", () => {
    expect(matt?.skills).toEqual(
      expect.arrayContaining(["implement-spec", "retro"]),
    );
  });

  it("leaves pr to the Rheged source (R-2429)", () => {
    const rheged = catalogue.sources.find((source) => source.id === "rheged");
    expect(matt?.skills).not.toContain("pr");
    expect(rheged?.skills).toContain("pr");
  });

  it("drops resolving-merge-conflicts", () => {
    expect(matt?.skills).not.toContain("resolving-merge-conflicts");
  });
});
