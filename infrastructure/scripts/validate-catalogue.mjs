#!/usr/bin/env node
// Validates infrastructure/skill-catalogue.json against the local skills/ tree (R-1904)
// and the pinned install trust chain (R-2871):
//
//   - every source parses with a pinned `ref` (parseCatalogue enforces the shape);
//   - a third-party source (any repo outside the rheged-studio org) is marked
//     `thirdParty: true` and pins a full commit SHA, since a third party can move
//     its own tags;
//   - the Rheged source pins a `v<semver>` release tag no newer than this repo's
//     root package.json version (a tag ahead of it can't exist yet);
//   - the copy vendored into the rheged-skills-setup bundle is byte-identical.
//
//   node infrastructure/scripts/validate-catalogue.mjs              # validate the repo
//   node infrastructure/scripts/validate-catalogue.mjs --self-test  # offline self-check

import {
  allCatalogueSkillNames,
  isCommitSha,
  isReleaseTag,
  parseCatalogue,
  rhegedSkillNames,
} from "../../skills/rheged-skills-setup/scripts/lib/catalogue.mjs";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CATALOGUE_PATH = join(
  REPO_ROOT,
  "infrastructure",
  "skill-catalogue.json",
);
export const VENDORED_CATALOGUE_RELATIVE =
  "skills/rheged-skills-setup/assets/skill-catalogue.json";
const FIRST_PARTY_URL_PREFIX = "https://github.com/rheged-studio/";

/**
 * @param {string} value  `1.2.3` or `v1.2.3[-pre]`
 * @returns {number[]}
 */
function parseVersionParts(value) {
  return value
    .replace(/^v/, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10));
}

/**
 * Compare two `major.minor.patch` versions (pre-release suffixes ignored).
 * @param {string} left
 * @param {string} right
 * @returns {number} negative, zero or positive
 */
export function compareVersions(left, right) {
  const [a, b] = [parseVersionParts(left), parseVersionParts(right)];
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }

  return 0;
}

/**
 * Pure validation over already-read inputs. Returns the error messages (empty
 * when valid) plus the parsed catalogue when it parsed.
 * @param {{ catalogueText: string, vendoredText: string | undefined, rootVersion: string, hasSkill: (name: string) => boolean }} input
 * @returns {{ errors: string[], catalogue?: ReturnType<typeof parseCatalogue> }}
 */
export function validateCatalogue(input) {
  let catalogue;
  try {
    catalogue = parseCatalogue(input.catalogueText);
  } catch (error) {
    return { errors: [error.message] };
  }

  const errors = [];
  if (allCatalogueSkillNames(catalogue).includes("scaffold-new-skill")) {
    errors.push("catalogue must not include scaffold-new-skill (R-729)");
  }

  for (const skill of rhegedSkillNames(catalogue)) {
    if (!input.hasSkill(skill)) {
      errors.push(
        `Rheged catalogue skill '${skill}' has no skills/${skill}/SKILL.md in this repo`,
      );
    }
  }

  for (const source of catalogue.sources) {
    const firstParty = source.url.startsWith(FIRST_PARTY_URL_PREFIX);
    if (!firstParty && !source.thirdParty) {
      errors.push(
        `source '${source.id}' (${source.url}) is outside rheged-studio, so it must set "thirdParty": true (R-2871)`,
      );
    }

    if (firstParty && source.thirdParty) {
      errors.push(
        `source '${source.id}' is a rheged-studio repo but is marked thirdParty`,
      );
    }

    if (!firstParty && !isCommitSha(source.ref)) {
      errors.push(
        `third-party source '${source.id}' must pin a full 40-hex commit SHA, not ${JSON.stringify(source.ref)} (R-2871)`,
      );
    }
  }

  const rheged = catalogue.sources.find((source) => source.id === "rheged");
  if (rheged && isReleaseTag(rheged.ref)) {
    if (compareVersions(rheged.ref, input.rootVersion) > 0) {
      errors.push(
        `rheged ref ${rheged.ref} is newer than the root package.json version ${input.rootVersion}; pin a released tag`,
      );
    }
  } else if (rheged && !isCommitSha(rheged.ref)) {
    errors.push("rheged ref must be a v<semver> release tag or a commit SHA");
  }

  if (input.vendoredText === undefined) {
    errors.push(
      `missing ${VENDORED_CATALOGUE_RELATIVE}; copy infrastructure/skill-catalogue.json there`,
    );
  } else if (input.vendoredText !== input.catalogueText) {
    errors.push(
      `${VENDORED_CATALOGUE_RELATIVE} has drifted from infrastructure/skill-catalogue.json; ` +
        `run: cp infrastructure/skill-catalogue.json ${VENDORED_CATALOGUE_RELATIVE}`,
    );
  }

  return { catalogue, errors };
}

function main() {
  if (!existsSync(CATALOGUE_PATH)) {
    console.error(`validate-catalogue: missing ${CATALOGUE_PATH}`);
    process.exit(1);
  }

  const vendoredPath = join(REPO_ROOT, VENDORED_CATALOGUE_RELATIVE);
  const rootVersion = JSON.parse(
    readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
  ).version;
  const { catalogue, errors } = validateCatalogue({
    catalogueText: readFileSync(CATALOGUE_PATH, "utf8"),
    hasSkill: (name) => existsSync(join(REPO_ROOT, "skills", name, "SKILL.md")),
    rootVersion,
    vendoredText: existsSync(vendoredPath)
      ? readFileSync(vendoredPath, "utf8")
      : undefined,
  });

  if (errors.length > 0) {
    console.error(
      `Catalogue validation failed with ${errors.length} error(s):\n`,
    );
    for (const message of errors) {
      console.error(`  - ${message}`);
    }

    process.exit(1);
  }

  console.log(
    `Catalogue validation passed (${allCatalogueSkillNames(catalogue).length} skills across ${catalogue.sources.length} sources).`,
  );
}

// ---- self-test ----------------------------------------------------------

const SELF_TEST_SHA = "0123456789abcdef0123456789abcdef01234567";

function selfTestCatalogue() {
  return {
    sources: [
      {
        id: "rheged",
        ref: "v1.2.0",
        skills: ["send-it"],
        url: "https://github.com/rheged-studio/agent-skills",
      },
      {
        id: "matt-pocock",
        ref: SELF_TEST_SHA,
        skills: ["grill-me"],
        thirdParty: true,
        url: "https://github.com/mattpocock/skills",
      },
    ],
    version: 1,
  };
}

function selfTestErrors(catalogue, overrides = {}) {
  const text = JSON.stringify(catalogue);
  return validateCatalogue({
    catalogueText: text,
    hasSkill: () => true,
    rootVersion: "1.2.0",
    vendoredText: text,
    ...overrides,
  }).errors;
}

function selfTest() {
  const base = selfTestCatalogue;
  const run = selfTestErrors;

  const cases = [];
  cases.push({
    name: "a pinned catalogue passes",
    ok: run(base()).length === 0,
  });

  const noRef = base();
  delete noRef.sources[1].ref;
  cases.push({
    name: "a source without a ref fails",
    ok: run(noRef).some((message) => message.includes("pinned 'ref'")),
  });

  const branchRef = base();
  branchRef.sources[0].ref = "main";
  cases.push({
    name: "a branch ref fails",
    ok: run(branchRef).some((message) => message.includes("pinned 'ref'")),
  });

  const unmarked = base();
  delete unmarked.sources[1].thirdParty;
  cases.push({
    name: "an unmarked third-party source fails",
    ok: run(unmarked).some((message) => message.includes('"thirdParty": true')),
  });

  const taggedThirdParty = base();
  taggedThirdParty.sources[1].ref = "v1.3.1";
  cases.push({
    name: "a third-party source pinned to a tag fails",
    ok: run(taggedThirdParty).some((message) =>
      message.includes("40-hex commit SHA"),
    ),
  });

  const future = base();
  future.sources[0].ref = "v9.0.0";
  cases.push({
    name: "a rheged tag ahead of the root version fails",
    ok: run(future).some((message) => message.includes("newer than")),
  });

  cases.push({
    name: "a drifted vendored copy fails",
    ok: run(base(), { vendoredText: "{}" }).some((message) =>
      message.includes("drifted"),
    ),
  });

  cases.push({
    name: "a missing vendored copy fails",
    ok: run(base(), { vendoredText: undefined }).some((message) =>
      message.startsWith("missing"),
    ),
  });

  let failed = 0;
  for (const { name, ok } of cases) {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
    if (!ok) {
      failed += 1;
    }
  }

  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

function isCliEntry() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(import.meta.filename) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  if (process.argv.includes("--self-test")) {
    selfTest();
  } else {
    main();
  }
}
