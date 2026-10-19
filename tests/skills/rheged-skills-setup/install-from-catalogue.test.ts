import {
  buildSkillsCliInvocation,
  formatInstallPlan,
  loadCatalogueText,
  planCatalogueInstall,
  VENDORED_CATALOGUE_PATH,
} from "../../../skills/rheged-skills-setup/scripts/install-from-catalogue.mjs";
import { parseCatalogue } from "../../../skills/rheged-skills-setup/scripts/lib/catalogue.mjs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const vendoredText = readFileSync(VENDORED_CATALOGUE_PATH, "utf8");
const catalogue = parseCatalogue(vendoredText);
const rheged = catalogue.sources.find((source) => source.id === "rheged");
const matt = catalogue.sources.find((source) => source.id === "matt-pocock");

describe("vendored catalogue (R-2871)", () => {
  it("is byte-identical to infrastructure/skill-catalogue.json", () => {
    expect(vendoredText).toBe(
      readFileSync(
        join(REPO_ROOT, "infrastructure", "skill-catalogue.json"),
        "utf8",
      ),
    );
  });

  let scratch: string | undefined;
  afterEach(() => {
    if (scratch) {
      rmSync(scratch, { force: true, recursive: true });
      scratch = undefined;
    }
  });

  it("is what loadCatalogueText reads by default, with no fetch", async () => {
    scratch = mkdtempSync(join(tmpdir(), "rss-install-"));
    expect(await loadCatalogueText(scratch, undefined)).toBe(vendoredText);
  });

  it("fails clearly when the vendored copy is missing", async () => {
    scratch = mkdtempSync(join(tmpdir(), "rss-install-"));
    await expect(
      loadCatalogueText(scratch, undefined, join(scratch, "absent.json")),
    ).rejects.toThrow(/vendored catalogue not found/);
  });
});

describe("buildSkillsCliInvocation", () => {
  it("runs npx with --yes and the pinned skills version", () => {
    const invocation = buildSkillsCliInvocation(["add", "x", "--copy"]);
    expect(invocation.command).toBe("npx");
    expect(invocation.args).toEqual([
      "--yes",
      "skills@1.7.2",
      "add",
      "x",
      "--copy",
    ]);
  });
});

describe("planCatalogueInstall", () => {
  it("installs only first-party sources by default", () => {
    const plan = planCatalogueInstall(catalogue, { agents: ["claude-code"] });
    expect(plan.install.map((source) => source.id)).toEqual(["rheged"]);
    expect(plan.skippedThirdParty.map((source) => source.id)).toEqual([
      "matt-pocock",
    ]);
    expect(plan.addArgvs).toHaveLength(1);
    expect(plan.addArgvs[0][1]).toBe(
      `https://github.com/rheged-studio/agent-skills/tree/${rheged?.ref}`,
    );
  });

  it("leaves skipped third-party skills out of the wipe set", () => {
    const plan = planCatalogueInstall(catalogue);
    expect(plan.installSkills).toContain("send-it");
    expect(plan.installSkills).not.toContain("grill-me");
  });

  it("adds the third-party source at its default branch with includeThirdParty", () => {
    const plan = planCatalogueInstall(catalogue, {
      agents: ["claude-code"],
      includeThirdParty: true,
    });
    expect(plan.install.map((source) => source.id)).toEqual([
      "rheged",
      "matt-pocock",
    ]);
    expect(plan.installSkills).toContain("grill-me");
    expect(matt?.ref).toBeUndefined();
    expect(plan.addArgvs[1][1]).toBe("https://github.com/mattpocock/skills");
    expect(plan.addArgvs[1]).toContain("--copy");
  });

  it("skips the Rheged source on the agent-skills checkout", () => {
    const plan = planCatalogueInstall(catalogue, {
      isAgentSkillsSourceRepo: true,
    });
    expect(plan.install).toEqual([]);
    expect(plan.skippedThirdParty.map((source) => source.id)).toEqual([
      "matt-pocock",
    ]);
  });

  it("defaults lockRef to the pinned Rheged ref, not main", () => {
    const plan = planCatalogueInstall(catalogue);
    expect(plan.lockRef).toBe(rheged?.ref);
    expect(plan.lockRef).not.toBe("main");
    expect(plan.lockSource).toBe(rheged?.url);
  });
});

describe("formatInstallPlan", () => {
  it("lists skipped third-party sources separately", () => {
    const text = formatInstallPlan(planCatalogueInstall(catalogue)).join("\n");
    expect(text).toContain("skills@1.7.2");
    expect(text).toContain("First-party source(s):");
    expect(text).toMatch(/SKIPPED; re-run with --include-third-party/);
    expect(text).toContain("from https://github.com/mattpocock/skills");
    expect(text).not.toContain("mattpocock/skills/tree/");
  });

  it("labels opted-in third-party sources", () => {
    const text = formatInstallPlan(
      planCatalogueInstall(catalogue, { includeThirdParty: true }),
    ).join("\n");
    expect(text).toContain("opted in with --include-third-party");
    expect(text).not.toContain("SKIPPED");
  });
});
