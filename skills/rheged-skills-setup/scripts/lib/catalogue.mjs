// Estate skill catalogue — parse, resolve install sets, and build skills.sh argv (R-1904).
// Pure functions only; fleet-update and rheged-skills-setup import this module.

/**
 * The exact `skills` CLI version `--install` runs (R-2871). A bare `npx skills`
 * resolves `latest` at run time, so a new upstream release could change what
 * runs without a change here. Bump deliberately: review the release, update this
 * constant, and bump the bundle version.
 */
export const SKILLS_CLI_VERSION = "1.7.2";

/**
 * A pinned ref is either a full 40-hex commit SHA or a release tag
 * (`v<major>.<minor>.<patch>`, optional pre-release suffix). Branch names such
 * as `main` are rejected: they move, so they can't pin a trust chain (R-2871).
 */
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * Catalogue sources must be plain GitHub repo URLs, so the pinned ref can be
 * passed as a `/tree/<ref>` URL the skills CLI parses (R-2871).
 */
const GITHUB_REPO_URL_PATTERN = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;

/**
 * Sources under this org are first-party. Any other source must be marked
 * `thirdParty: true`, so a `--catalogue` override can't skip the
 * `--include-third-party` opt-in by leaving the flag off (R-2871).
 */
export const FIRST_PARTY_URL_PREFIX = "https://github.com/rheged-studio/";

/**
 * @param {unknown} ref
 * @returns {boolean}
 */
export function isCommitSha(ref) {
  return typeof ref === "string" && COMMIT_SHA_PATTERN.test(ref);
}

/**
 * @param {unknown} ref
 * @returns {boolean}
 */
export function isReleaseTag(ref) {
  return typeof ref === "string" && RELEASE_TAG_PATTERN.test(ref);
}

/**
 * @param {unknown} ref
 * @returns {boolean}
 */
export function isPinnedRef(ref) {
  return isCommitSha(ref) || isReleaseTag(ref);
}

export const RHEGED_AGENT_SKILLS_PACKAGE = "@rheged-studio/agent-skills";

/**
 * Bundles retired by rename (R-1904) or removed upstream with no replacement
 * (`resolving-merge-conflicts`, mattpocock/skills 1.3.0 — R-2298); wipe on
 * consumers but never re-install.
 */
export const LEGACY_BUNDLE_NAMES = [
  "initialise-skills",
  "resolving-merge-conflicts",
];

/**
 * Command shims to remove alongside legacy bundles.
 */
export const LEGACY_COMMAND_SHIM_NAMES = ["initialise-skills"];

/**
 * @param {string | object} json
 * @returns {{ version: number, sources: Array<{ id: string, url: string, ref: string | undefined, skills: string[], skipWhenSourceRepo: boolean, thirdParty: boolean }> }}
 */
export function parseCatalogue(json) {
  let catalogue = json;
  if (typeof json === "string") {
    try {
      catalogue = JSON.parse(json);
    } catch (error) {
      throw new Error(`could not parse skill catalogue JSON: ${error.message}`);
    }
  }

  if (!catalogue || typeof catalogue !== "object" || Array.isArray(catalogue)) {
    throw new Error("skill catalogue must be a JSON object");
  }

  if (catalogue.version !== 1) {
    throw new Error(
      `skill catalogue version must be 1 (got ${JSON.stringify(catalogue.version)})`,
    );
  }

  if (!Array.isArray(catalogue.sources) || catalogue.sources.length === 0) {
    throw new Error("skill catalogue 'sources' must be a non-empty array");
  }

  const seenSkills = new Set();
  /** @type {Array<{ id: string, url: string, ref: string | undefined, skills: string[], skipWhenSourceRepo: boolean, thirdParty: boolean }>} */
  const sources = [];
  for (const entry of catalogue.sources) {
    if (!entry || typeof entry !== "object") {
      throw new Error("each catalogue source must be an object");
    }

    if (typeof entry.id !== "string" || !entry.id.trim()) {
      throw new Error("each catalogue source needs a non-empty 'id'");
    }

    if (typeof entry.url !== "string" || !entry.url.trim()) {
      throw new Error(`catalogue source '${entry.id}' needs a non-empty 'url'`);
    }

    if (!GITHUB_REPO_URL_PATTERN.test(entry.url.trim())) {
      throw new Error(
        `catalogue source '${entry.id}' url must be https://github.com/<owner>/<repo> (got ${JSON.stringify(entry.url)})`,
      );
    }

    if (
      entry.thirdParty !== undefined &&
      typeof entry.thirdParty !== "boolean"
    ) {
      throw new Error(
        `catalogue source '${entry.id}' thirdParty must be boolean`,
      );
    }

    if (
      !entry.url.trim().startsWith(FIRST_PARTY_URL_PREFIX) &&
      entry.thirdParty !== true
    ) {
      throw new Error(
        `catalogue source '${entry.id}' (${entry.url.trim()}) is outside rheged-studio, so it must set "thirdParty": true`,
      );
    }

    // A third-party source may omit `ref` to track its default branch: it is
    // opt-in, and its upstream moves outside our control. If it does pin, the
    // ref must be a full commit SHA, since a third party can move its own tags.
    // First-party sources must pin a SHA or a release tag (R-2871).
    if (entry.thirdParty === true) {
      if (entry.ref !== undefined && !isCommitSha(entry.ref)) {
        throw new Error(
          `third-party catalogue source '${entry.id}' 'ref' must be a full 40-hex commit SHA or omitted (got ${JSON.stringify(entry.ref)})`,
        );
      }
    } else if (!isPinnedRef(entry.ref)) {
      throw new Error(
        `catalogue source '${entry.id}' needs a pinned 'ref': a full 40-hex commit SHA or a v<major>.<minor>.<patch> tag (got ${JSON.stringify(entry.ref)})`,
      );
    }

    if (!isStringArray(entry.skills) || entry.skills.length === 0) {
      throw new Error(
        `catalogue source '${entry.id}' 'skills' must be a non-empty string array`,
      );
    }

    for (const skill of entry.skills) {
      if (seenSkills.has(skill)) {
        throw new Error(
          `duplicate skill name '${skill}' across catalogue sources`,
        );
      }

      seenSkills.add(skill);
    }

    if (
      entry.skipWhenSourceRepo !== undefined &&
      typeof entry.skipWhenSourceRepo !== "boolean"
    ) {
      throw new Error(
        `catalogue source '${entry.id}' skipWhenSourceRepo must be boolean`,
      );
    }

    sources.push({
      id: entry.id.trim(),
      ref: entry.ref,
      skills: [...entry.skills],
      skipWhenSourceRepo: entry.skipWhenSourceRepo === true,
      thirdParty: entry.thirdParty === true,
      url: entry.url.trim(),
    });
  }

  return { sources, version: 1 };
}

function isStringArray(value) {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * @param {{ sources: Array<{ id: string }> }} catalogue
 * @param {string} sourceId
 * @returns {{ id: string, url: string, skills: string[], skipWhenSourceRepo?: boolean }}
 */
export function getSourceById(catalogue, sourceId) {
  const source = catalogue.sources.find((entry) => entry.id === sourceId);
  if (!source) {
    throw new Error(`catalogue has no source with id '${sourceId}'`);
  }

  return source;
}

/**
 * Rheged ship-set skill names (first source with id 'rheged', else first source).
 * @param {{ sources: Array<{ id: string, skills: string[] }> }} catalogue
 * @returns {string[]}
 */
export function rhegedSkillNames(catalogue) {
  const rheged = catalogue.sources.find((entry) => entry.id === "rheged");
  return rheged ? [...rheged.skills] : [...catalogue.sources[0].skills];
}

/**
 * @param {{ sources: Array<{ id: string, skills: string[] }> }} catalogue
 * @returns {string[]}
 */
export function mattSkillNames(catalogue) {
  const matt = catalogue.sources.find((entry) => entry.id === "matt-pocock");
  return matt ? [...matt.skills] : [];
}

/**
 * Union of all catalogue skill names.
 * @param {{ sources: Array<{ skills: string[] }> }} catalogue
 * @returns {string[]}
 */
export function allCatalogueSkillNames(catalogue) {
  return catalogue.sources.flatMap((entry) => entry.skills);
}

/**
 * Effective Rheged install list for fleet profiles (no-changelog drops changelog).
 * @param {{ repoType?: string, skills?: string[] }} profile
 * @param {{ sources: Array<{ skills: string[] }> }} catalogue
 * @returns {string[]}
 */
export function resolveRhegedSkills(profile, catalogue) {
  const canonical = rhegedSkillNames(catalogue);
  if (Array.isArray(profile.skills)) {
    return profile.skills;
  }

  if (profile.repoType === "no-changelog") {
    return canonical.filter((skill) => skill !== "changelog");
  }

  return canonical;
}

/**
 * Full install set (Rheged resolved list + Matt names), deduped in catalogue order.
 * @param {{ repoType?: string, skills?: string[] }} profile
 * @param {{ sources: Array<{ skills: string[] }> }} catalogue
 * @returns {string[]}
 */
export function resolveInstallSkills(profile, catalogue) {
  const rheged = resolveRhegedSkills(profile, catalogue);
  const matt = mattSkillNames(catalogue);
  const combined = [...rheged];
  for (const name of matt) {
    if (!combined.includes(name)) {
      combined.push(name);
    }
  }

  return combined;
}

/**
 * Sources to run `skills add` for, honouring skipWhenSourceRepo on the agent-skills checkout.
 * Returns every source, third-party ones included; {@link selectInstallSources}
 * applies the `--include-third-party` opt-in on top.
 * @param {{ sources: Array<{ id: string, url: string, ref?: string, skills: string[], skipWhenSourceRepo?: boolean, thirdParty?: boolean }> }} catalogue
 * @param {{ isAgentSkillsSourceRepo?: boolean, profile?: { repoType?: string, skills?: string[] } }} options
 * @returns {Array<{ id: string, url: string, ref: string | undefined, skills: string[], thirdParty: boolean }>}
 */
export function resolveInstallSources(catalogue, options = {}) {
  const { isAgentSkillsSourceRepo = false, profile = {} } = options;
  const rheged = resolveRhegedSkills(profile, catalogue);
  const matt = mattSkillNames(catalogue);

  return catalogue.sources
    .filter((source) => {
      if (source.skipWhenSourceRepo && isAgentSkillsSourceRepo) {
        return false;
      }

      return true;
    })
    .map((source) => {
      let skills = [...source.skills];
      if (source.id === "rheged") {
        skills = rheged;
      } else if (source.id === "matt-pocock") {
        skills = matt;
      }

      return {
        id: source.id,
        ref: source.ref,
        skills,
        thirdParty: source.thirdParty === true,
        url: source.url,
      };
    })
    .filter((source) => source.skills.length > 0);
}

/**
 * Apply the third-party opt-in (R-2871). First-party sources always install.
 * Sources marked `thirdParty: true` install only when `includeThirdParty` is
 * set; otherwise they come back in `skippedThirdParty`, so the dry-run can list
 * them as skipped.
 * @template {{ thirdParty?: boolean }} T
 * @param {T[]} sources
 * @param {{ includeThirdParty?: boolean }} [options]
 * @returns {{ install: T[], skippedThirdParty: T[] }}
 */
export function selectInstallSources(sources, options = {}) {
  const includeThirdParty = options.includeThirdParty === true;
  const install = [];
  const skippedThirdParty = [];
  for (const source of sources) {
    if (source.thirdParty && !includeThirdParty) {
      skippedThirdParty.push(source);
    } else {
      install.push(source);
    }
  }

  return { install, skippedThirdParty };
}

/**
 * Primary Rheged URL for lock provenance.
 * @param {{ sources: Array<{ id: string, url: string }> }} catalogue
 * @returns {string}
 */
export function rhegedSourceUrl(catalogue) {
  const rheged = catalogue.sources.find((entry) => entry.id === "rheged");
  return rheged?.url ?? catalogue.sources[0].url;
}

/**
 * Pinned Rheged ref for lock provenance, and so the default `lockRef` (R-2871).
 * @param {{ sources: Array<{ id: string, ref?: string }> }} catalogue
 * @returns {string | undefined}
 */
export function rhegedSourceRef(catalogue) {
  const rheged = catalogue.sources.find((entry) => entry.id === "rheged");
  return rheged ? rheged.ref : catalogue.sources[0].ref;
}

/**
 * The install URL for a source: `https://github.com/<owner>/<repo>/tree/<ref>`.
 * skills 1.7.2 parses a `/tree/<ref>` URL with no subpath into `{ url, ref }`,
 * clones with `--branch <ref>`, and falls back to a fetch by SHA for a commit
 * SHA (R-2871). With no ref, the bare repo URL is returned (default branch).
 * @param {string} url
 * @param {string} [ref]
 * @returns {string}
 */
export function pinnedSourceUrl(url, ref) {
  const base = url.replace(/\/+$/, "").replace(/\.git$/, "");
  if (ref === undefined) {
    return base;
  }

  if (!isPinnedRef(ref)) {
    throw new Error(
      `refusing to install ${base} at unpinned ref ${JSON.stringify(ref)}`,
    );
  }

  return `${base}/tree/${ref}`;
}

/**
 * `npx skills` argv tail for one source:
 * `add <url>[/tree/<ref>] [--skill X]… [--agent Y]… --copy`. The optional `ref`
 * pins the source (R-2871); a caller that omits it installs the default branch.
 * @param {string} url
 * @param {string[]} skills
 * @param {string[]} agents
 * @param {string} [ref]
 * @returns {string[]}
 */
export function buildSkillsAddArgsForSource(url, skills, agents, ref) {
  const skillFlags = skills.flatMap((skill) => ["--skill", skill]);
  const agentFlags = agents.flatMap((agent) => ["--agent", agent]);
  return [
    "add",
    pinnedSourceUrl(url, ref),
    ...skillFlags,
    ...agentFlags,
    "--copy",
  ];
}

/**
 * Full `npx` argv for a pinned skills CLI run:
 * `--yes skills@<SKILLS_CLI_VERSION> …`. `--yes` skips npx's install prompt, and
 * the exact version stops npx resolving `latest` at run time (R-2871).
 * @param {string[]} skillsArgs
 * @param {string} [version]
 * @returns {string[]}
 */
export function buildPinnedSkillsCliArgv(
  skillsArgs,
  version = SKILLS_CLI_VERSION,
) {
  return ["--yes", `skills@${version}`, ...skillsArgs];
}

/**
 * Wipe targets for install set + legacy retired bundles (R-1904).
 * @param {string[]} mirrors
 * @param {string[]} installSkills
 * @param {string[]} [legacyNames]
 * @returns {string[]}
 */
export function resolveWipeTargetsWithLegacy(
  mirrors,
  installSkills,
  legacyNames = LEGACY_BUNDLE_NAMES,
) {
  const names = [...new Set([...installSkills, ...legacyNames])];
  return mirrors.flatMap((mirror) =>
    names.map((skill) => `${mirror}/${skill}`.replaceAll("\\", "/")),
  );
}
