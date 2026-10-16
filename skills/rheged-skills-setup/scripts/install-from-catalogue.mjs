// Catalogue install path (R-1904): vendor estate skills via skills.sh, restore configs, optional reconcile.
// The trust chain is pinned (R-2871): the catalogue is read from the copy
// vendored in this bundle, every source carries a pinned ref, the skills CLI
// runs at an exact version, and third-party sources need --include-third-party.

import {
  buildPinnedSkillsCliArgv,
  buildSkillsAddArgsForSource,
  LEGACY_COMMAND_SHIM_NAMES,
  mattSkillNames,
  parseCatalogue,
  pinnedSourceUrl,
  resolveInstallSkills,
  resolveInstallSources,
  resolveWipeTargetsWithLegacy,
  RHEGED_AGENT_SKILLS_PACKAGE,
  rhegedSourceRef,
  rhegedSourceUrl,
  selectInstallSources,
  SKILLS_CLI_VERSION,
} from "./lib/catalogue.mjs";
import { parseClobberedConfigs } from "./lib/git.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The catalogue vendored inside this bundle — a byte-identical copy of the
 * source repo's `infrastructure/skill-catalogue.json` (CI's
 * `validate-catalogue.mjs` fails on drift). Reading it locally means
 * `--install` makes no network fetch for the catalogue (R-2871).
 */
export const VENDORED_CATALOGUE_PATH = join(
  import.meta.dirname,
  "..",
  "assets",
  "skill-catalogue.json",
);

export const CONSUMER_SKILL_DIRS = [
  ".claude/skills",
  ".agents/skills",
  ".cursor/skills",
];

const DEFAULT_AGENTS = ["claude-code", "cursor"];

/**
 * @param {Record<string, string | undefined>} [baseEnvironment]
 * @returns {Record<string, string | undefined>}
 */
export function skillsAddEnvironment(baseEnvironment = process.env) {
  return { ...baseEnvironment, CLAUDECODE: "1" };
}

/**
 * @param {string} repoRoot
 * @returns {boolean}
 */
export function isAgentSkillsSourceRepo(repoRoot) {
  const packagePath = join(repoRoot, "package.json");
  if (!existsSync(packagePath)) {
    return false;
  }

  try {
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    return pkg?.name === RHEGED_AGENT_SKILLS_PACKAGE;
  } catch {
    return false;
  }
}

/**
 * The catalogue text: the bundle's vendored copy by default (no network), or an
 * explicit `--catalogue <url-or-path>` override for advanced use. An override is
 * still parsed strictly, so every source in it must carry a pinned ref.
 * @param {string} repoRoot
 * @param {string | undefined} catalogueOverride
 * @param {string} [vendoredPath]
 * @returns {Promise<string>}
 */
export async function loadCatalogueText(
  repoRoot,
  catalogueOverride,
  vendoredPath = VENDORED_CATALOGUE_PATH,
) {
  if (catalogueOverride) {
    if (/^https?:\/\//i.test(catalogueOverride)) {
      const catalogueResponse = await fetch(catalogueOverride);
      if (!catalogueResponse.ok) {
        throw new Error(
          `could not fetch catalogue from ${catalogueOverride}: HTTP ${catalogueResponse.status}`,
        );
      }

      return await catalogueResponse.text();
    }

    const path = resolve(repoRoot, catalogueOverride);
    if (!existsSync(path)) {
      throw new Error(`catalogue file not found: ${path}`);
    }

    return readFileSync(path, "utf8");
  }

  if (!existsSync(vendoredPath)) {
    throw new Error(
      `vendored catalogue not found: ${vendoredPath} (re-install rheged-skills-setup, or pass --catalogue <path>)`,
    );
  }

  return readFileSync(vendoredPath, "utf8");
}

/**
 * The `npx` invocation for one pinned skills CLI run (R-2871).
 * @param {string[]} skillsArgs
 * @returns {{ command: string, args: string[] }}
 */
export function buildSkillsCliInvocation(skillsArgs) {
  return { args: buildPinnedSkillsCliArgv(skillsArgs), command: "npx" };
}

function run(command, args, cwd, environment) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: environment ?? process.env,
  });
  if (result.status !== 0) {
    const detail =
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      `${command} exited ${result.status}`;
    throw new Error(detail);
  }

  return result.stdout ?? "";
}

function restoreAllClobberedConfigs(repoRoot) {
  const diff = run(
    "git",
    ["diff", "HEAD", "--name-only", "--diff-filter=DM"],
    repoRoot,
  );
  const clobbered = parseClobberedConfigs(diff);
  if (clobbered.length === 0) {
    return [];
  }

  run("git", ["checkout", "HEAD", "--", ...clobbered], repoRoot);
  return clobbered;
}

function runSkillsAdd(repoRoot, args) {
  const invocation = buildSkillsCliInvocation(args);
  console.log(
    `rheged-skills-setup: ${invocation.command} ${invocation.args.join(" ")}`,
  );
  run(invocation.command, invocation.args, repoRoot, skillsAddEnvironment());
}

function wipeBeforeInstall(repoRoot, installSkills) {
  const targets = resolveWipeTargetsWithLegacy(
    CONSUMER_SKILL_DIRS,
    installSkills,
  );
  const removed = [];
  for (const relativePath of targets) {
    const absolute = join(repoRoot, relativePath);
    if (existsSync(absolute)) {
      rmSync(absolute, { force: true, recursive: true });
      removed.push(relativePath);
    }
  }

  // Consumers lose the old vendored bundle shim; agent-skills dogfood keeps the
  // tracked redirect at .claude/commands/initialise-skills.md (R-1904).
  if (!isAgentSkillsSourceRepo(repoRoot)) {
    for (const shim of LEGACY_COMMAND_SHIM_NAMES) {
      const commandPath = join(repoRoot, ".claude", "commands", `${shim}.md`);
      if (existsSync(commandPath)) {
        rmSync(commandPath, { force: true });
        removed.push(relative(repoRoot, commandPath));
      }
    }
  }

  if (removed.length > 0) {
    console.log(
      `rheged-skills-setup: wiped ${removed.length} bundle/shim path(s) before install.`,
    );
  }
}

function relative(repoRoot, absolute) {
  return absolute.startsWith(repoRoot)
    ? absolute.slice(repoRoot.length + 1)
    : absolute;
}

/**
 * @param {string} repoRoot
 * @param {string[]} mattSkills
 * @returns {string[]}
 */
export function findMissingMattBundles(repoRoot, mattSkills) {
  const missing = [];
  for (const skill of mattSkills) {
    let found = false;
    for (const mirror of CONSUMER_SKILL_DIRS) {
      const skillMd = join(repoRoot, mirror, skill, "SKILL.md");
      if (existsSync(skillMd)) {
        found = true;
        break;
      }
    }

    if (!found) {
      missing.push(skill);
    }
  }

  return missing;
}

/**
 * The install plan for a parsed catalogue (pure — no I/O): which sources install,
 * which third-party sources are skipped without `--include-third-party`, the
 * skill names the pre-install wipe targets, and the `skills add` argv per source.
 * Skipped third-party skills are left out of the wipe set, so a default run never
 * deletes a third-party bundle it won't re-install.
 * @param {ReturnType<typeof parseCatalogue>} catalogue
 * @param {{ agents?: string[], includeThirdParty?: boolean, isAgentSkillsSourceRepo?: boolean, profile?: object }} [options]
 */
export function planCatalogueInstall(catalogue, options = {}) {
  const profile = options.profile ?? { repoType: "single" };
  const agents = options.agents ?? DEFAULT_AGENTS;
  const sources = resolveInstallSources(catalogue, {
    isAgentSkillsSourceRepo: options.isAgentSkillsSourceRepo === true,
    profile,
  });
  const { install, skippedThirdParty } = selectInstallSources(sources, {
    includeThirdParty: options.includeThirdParty,
  });
  const skippedSkills = new Set(
    skippedThirdParty.flatMap((source) => source.skills),
  );
  const installSkills = resolveInstallSkills(profile, catalogue).filter(
    (skill) => !skippedSkills.has(skill),
  );

  return {
    addArgvs: install.map((source) =>
      buildSkillsAddArgsForSource(
        source.url,
        source.skills,
        agents,
        source.ref,
      ),
    ),
    install,
    installSkills,
    lockRef: rhegedSourceRef(catalogue),
    lockSource: rhegedSourceUrl(catalogue),
    skippedThirdParty,
  };
}

/**
 * @param {{ id: string, url: string, ref?: string, skills: string[] }} source
 * @returns {string}
 */
function describeSource(source) {
  return `  ${source.id}: ${source.skills.length} skill(s) from ${pinnedSourceUrl(source.url, source.ref)}`;
}

/**
 * Dry-run lines for an install plan: first-party sources, then third-party ones
 * listed separately — as opted in, or as skipped with the flag that adds them.
 * @param {ReturnType<typeof planCatalogueInstall>} plan
 * @returns {string[]}
 */
export function formatInstallPlan(plan) {
  const firstParty = plan.install.filter((source) => !source.thirdParty);
  const thirdParty = plan.install.filter((source) => source.thirdParty);
  const lines = [
    `rheged-skills-setup: would install ${plan.installSkills.length} skill(s) from ${plan.install.length} source(s) with skills@${SKILLS_CLI_VERSION}.`,
  ];
  if (firstParty.length > 0) {
    lines.push("First-party source(s):", ...firstParty.map(describeSource));
  }

  if (thirdParty.length > 0) {
    lines.push(
      "Third-party source(s), opted in with --include-third-party:",
      ...thirdParty.map(describeSource),
    );
  }

  if (plan.skippedThirdParty.length > 0) {
    lines.push(
      "Third-party source(s) SKIPPED; re-run with --include-third-party to install them:",
      ...plan.skippedThirdParty.map(describeSource),
    );
  }

  return lines;
}

/**
 * @param {{ repoRoot: string, agents?: string[], cataloguePath?: string, profile?: object, dryRun?: boolean, includeThirdParty?: boolean }} options
 * @returns {Promise<{ catalogue: object, installSkills: string[], lockRef: string | undefined, lockSource: string, skippedThirdParty: object[] }>}
 */
export async function runCatalogueInstall(options) {
  const repoRoot = resolve(options.repoRoot);
  if (!existsSync(repoRoot) || !statSync(repoRoot).isDirectory()) {
    throw new Error(`repo root is not a directory: ${repoRoot}`);
  }

  const text = await loadCatalogueText(repoRoot, options.cataloguePath);
  const catalogue = parseCatalogue(text);
  const plan = planCatalogueInstall(catalogue, {
    agents: options.agents,
    includeThirdParty: options.includeThirdParty,
    isAgentSkillsSourceRepo: isAgentSkillsSourceRepo(repoRoot),
    profile: options.profile,
  });
  const result = {
    catalogue,
    installSkills: plan.installSkills,
    lockRef: plan.lockRef,
    lockSource: plan.lockSource,
    skippedThirdParty: plan.skippedThirdParty,
  };

  if (options.dryRun) {
    for (const line of formatInstallPlan(plan)) {
      console.log(line);
    }

    return result;
  }

  if (plan.skippedThirdParty.length > 0) {
    console.log(
      `rheged-skills-setup: skipping third-party source(s) ${plan.skippedThirdParty.map((source) => source.id).join(", ")}; pass --include-third-party to install them.`,
    );
  }

  wipeBeforeInstall(repoRoot, plan.installSkills);
  for (const addArgs of plan.addArgvs) {
    runSkillsAdd(repoRoot, addArgs);
  }

  const restored = restoreAllClobberedConfigs(repoRoot);
  console.log(
    `rheged-skills-setup: restored ${restored.length} config.json from HEAD (R-706).`,
  );

  if (plan.install.some((source) => source.id === "matt-pocock")) {
    const missingMatt = findMissingMattBundles(
      repoRoot,
      mattSkillNames(catalogue),
    );
    if (missingMatt.length > 0) {
      throw new Error(
        `Matt pack install incomplete — missing bundles: ${missingMatt.join(", ")}`,
      );
    }
  }

  return result;
}
