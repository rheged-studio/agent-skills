// Imports the helpers directly (the distributed `.mjs`). Covers the pure core of
// the single-repo fleet update pipeline (A-617): profile parsing/validation,
// skill-subset resolution, the `skills add` argv, the initialise stdin facts,
// the config.json deletions --copy leaves behind (A-706), and the check-updates
// verify verdict. The same assertions back the script's `--self-test`; this
// wires them into CI, since `run-self-tests.mjs` scans only skills/<name>/scripts
// and not infrastructure/. The spawn pipeline (skills add / git / initialise /
// check-updates) is intentionally out of scope here — the self-test and manual
// runbook cover it.
import {
  buildInitialiseFacts,
  buildSkillsAddArgs,
  detectClobberedConfigs,
  interpretCheckUpdates,
  parseProfile,
  resolveSkills,
  resolveWipeTargets,
  skillsAddEnvironment,
  SOURCE_URL,
} from "../scripts/fleet-update.mjs";
import { describe, expect, it } from "vitest";

describe("parseProfile", () => {
  it("applies defaults for a minimal profile", () => {
    expect(parseProfile({ repo: "/tmp/x" })).toEqual({
      agents: ["claude-code"],
      facts: {},
      repo: "/tmp/x",
      repoType: "single",
      skills: undefined,
    });
  });

  it("trims repo and accepts a JSON string", () => {
    expect(parseProfile('{"repo":"  /tmp/x  "}').repo).toBe("/tmp/x");
  });

  it("preserves an explicit skills/agents/facts profile", () => {
    const profile = parseProfile({
      agents: ["claude-code", "cursor"],
      facts: { issueKeys: ["A"], linearTeamName: "Acme" },
      repo: "/tmp/x",
      repoType: "no-changelog",
      skills: ["send-it", "commit"],
    });
    expect(profile.skills).toEqual(["send-it", "commit"]);
    expect(profile.agents).toEqual(["claude-code", "cursor"]);
    expect(profile.repoType).toBe("no-changelog");
    expect(profile.facts.issueKeys).toEqual(["A"]);
  });

  it("rejects a missing or empty repo", () => {
    expect(() => parseProfile({})).toThrow(/repo/);
    expect(() => parseProfile({ repo: "   " })).toThrow(/repo/);
  });

  it("rejects non-array skills and agents", () => {
    expect(() => parseProfile({ repo: "/tmp/x", skills: "send-it" })).toThrow(
      /skills/,
    );
    expect(() => parseProfile({ agents: "cursor", repo: "/tmp/x" })).toThrow(
      /agents/,
    );
  });

  it("rejects a bad repoType and non-array issueKeys", () => {
    expect(() => parseProfile({ repo: "/tmp/x", repoType: "weird" })).toThrow(
      /repoType/,
    );
    expect(() =>
      parseProfile({ facts: { issueKeys: "A" }, repo: "/tmp/x" }),
    ).toThrow(/issueKeys/);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseProfile("{not json")).toThrow(/parse/);
  });
});

describe("resolveSkills + buildSkillsAddArgs", () => {
  it("defaults to the canonical set (no scaffold-new-skill) for an unlisted single repo", () => {
    const skills = resolveSkills({ repoType: "single", skills: undefined });
    expect(skills).toContain("send-it");
    expect(skills).toContain("triage-pr");
    // Never the whole published set: the repo-internal scaffold-new-skill must
    // not be vendored into consumers (A-729).
    expect(skills).not.toContain("scaffold-new-skill");
  });

  it("drops changelog for an unlisted no-changelog repo", () => {
    const skills = resolveSkills({
      repoType: "no-changelog",
      skills: undefined,
    });
    expect(skills).not.toContain("changelog");
    expect(skills).toContain("send-it");
  });

  it("honours an explicit skills list verbatim", () => {
    expect(resolveSkills({ repoType: "single", skills: ["send-it"] })).toEqual([
      "send-it",
    ]);
  });

  it("installs from the GitHub URL with the canonical --skill set (no scaffold-new-skill), fans out agents, ends --copy", () => {
    const args = buildSkillsAddArgs({
      agents: ["claude-code", "cursor"],
      repoType: "single",
      skills: undefined,
    });
    expect(args[0]).toBe("add");
    // The install source is the canonical URL, never a local path (A-718).
    expect(args[1]).toBe(SOURCE_URL);
    // Defaults to explicit --skill pairs, never a bare install that would pull
    // the whole published set incl. the repo-internal scaffold-new-skill (A-729).
    expect(args).toContain("--skill");
    expect(args).toContain("send-it");
    expect(args).not.toContain("scaffold-new-skill");
    expect(args.filter((a) => a === "--agent")).toHaveLength(2);
    expect(args.at(-1)).toBe("--copy");
  });

  it("resolveWipeTargets covers every mirror × install skill (plus legacy bundles)", () => {
    const targets = resolveWipeTargets(
      [".claude/skills", ".agents/skills"],
      ["send-it", "commit"],
    );
    expect(targets).toHaveLength(6);
    expect(targets).toContain(".claude/skills/send-it");
    expect(targets).toContain(".agents/skills/commit");
    expect(targets).toContain(".claude/skills/initialise-skills");
  });

  it("resolveWipeTargets targets only the install set — never a consumer-extra bundle", () => {
    // The wipe must not remove bundles outside the profile (e.g. a skill the
    // consumer keeps that agent-skills no longer ships).
    const targets = resolveWipeTargets(
      [".claude/skills"],
      resolveSkills({ repoType: "single", skills: undefined }),
    );
    expect(targets).not.toContain(".claude/skills/scaffold-new-skill");
    expect(targets).toContain(".claude/skills/send-it");
  });

  it("resolveWipeTargets still wipes legacy bundles when install set is empty", () => {
    expect(resolveWipeTargets([".claude/skills"], [])).toEqual([
      ".claude/skills/initialise-skills",
    ]);
  });

  it("skillsAddEnv sets CLAUDECODE=1 (non-interactive install, A-745) without mutating the base env", () => {
    const base = { PATH: "/usr/bin" };
    const environment = skillsAddEnvironment(base);
    expect(environment.CLAUDECODE).toBe("1");
    expect(environment.PATH).toBe("/usr/bin");
    expect("CLAUDECODE" in base).toBe(false);
  });

  it("emits explicit --skill pairs for a subset", () => {
    const args = buildSkillsAddArgs({
      agents: ["claude-code"],
      repoType: "single",
      skills: ["send-it", "commit"],
    });
    expect(args).toEqual([
      "add",
      SOURCE_URL,
      "--skill",
      "send-it",
      "--skill",
      "commit",
      "--agent",
      "claude-code",
      "--copy",
    ]);
  });
});

describe("buildInitialiseFacts", () => {
  it("sets lockSource/lockRef and forwards supplied Linear facts", () => {
    const { facts } = buildInitialiseFacts(
      {
        facts: {
          followUpProject: "Follow-up issues",
          issueKeys: ["A"],
          linearTeamName: "Acme",
          linearWorkspaceSlug: "acme",
        },
      },
      { ref: "v1.2.3" },
    );
    expect(facts.lockSource).toBe(SOURCE_URL);
    expect(facts.lockRef).toBe("v1.2.3");
    expect(facts.linearTeamName).toBe("Acme");
    expect(facts.linearWorkspaceSlug).toBe("acme");
    expect(facts.followUpProject).toBe("Follow-up issues");
    expect(facts.issueKeys).toEqual(["A"]);
  });

  it("omits absent Linear facts", () => {
    const { facts } = buildInitialiseFacts({ facts: {} }, { ref: "main" });
    expect(facts).toEqual({
      lockRef: "main",
      lockSource: SOURCE_URL,
    });
  });
});

describe("detectClobberedConfigs", () => {
  it("keeps config.json in both mirrors and drops other changed paths", () => {
    const clobbered = detectClobberedConfigs(
      [
        ".claude/skills/send-it/config.json",
        ".agents/skills/send-it/config.json",
        "README.md",
        "",
      ].join("\n"),
    );
    expect(clobbered).toEqual([
      ".agents/skills/send-it/config.json",
      ".claude/skills/send-it/config.json",
    ]);
  });

  it("returns [] for empty input (a first-ever install clobbers nothing)", () => {
    expect(detectClobberedConfigs("")).toEqual([]);
  });
});

describe("interpretCheckUpdates", () => {
  it("is ok when updatesAvailable is false", () => {
    expect(
      interpretCheckUpdates({ updates: [], updatesAvailable: false }),
    ).toEqual({ bumps: [], ok: true });
  });

  it("is not ok and returns bumps when updates are available", () => {
    const verdict = interpretCheckUpdates({
      updates: [{ bump: "minor", from: "0.1.0", name: "send-it", to: "0.2.0" }],
      updatesAvailable: true,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.bumps).toHaveLength(1);
  });

  it("is not ok with a reason for a malformed report", () => {
    const verdict = interpretCheckUpdates({});
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBeTruthy();
  });
});
