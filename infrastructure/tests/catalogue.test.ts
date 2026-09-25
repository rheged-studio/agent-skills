import {
  buildSkillsAddArgsForSource,
  parseCatalogue,
  resolveInstallSkills,
  resolveInstallSources,
  resolveRhegedSkills,
  resolveWipeTargetsWithLegacy,
} from "../../skills/rheged-skills-setup/scripts/lib/catalogue.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
});
