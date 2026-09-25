#!/usr/bin/env node
// Validates infrastructure/skill-catalogue.json against the local skills/ tree (A-1904).

import {
  allCatalogueSkillNames,
  parseCatalogue,
  rhegedSkillNames,
} from "../../skills/rheged-skills-setup/scripts/lib/catalogue.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CATALOGUE_PATH = join(
  REPO_ROOT,
  "infrastructure",
  "skill-catalogue.json",
);
const SKILLS_DIR = join(REPO_ROOT, "skills");

function main() {
  const errors = [];
  if (!existsSync(CATALOGUE_PATH)) {
    console.error(`validate-catalogue: missing ${CATALOGUE_PATH}`);
    process.exit(1);
  }

  let catalogue;
  try {
    catalogue = parseCatalogue(readFileSync(CATALOGUE_PATH, "utf8"));
  } catch (error) {
    console.error(`validate-catalogue: ${error.message}`);
    process.exit(1);
  }

  if (allCatalogueSkillNames(catalogue).includes("scaffold-new-skill")) {
    errors.push("catalogue must not include scaffold-new-skill (A-729)");
  }

  for (const skill of rhegedSkillNames(catalogue)) {
    const skillMd = join(SKILLS_DIR, skill, "SKILL.md");
    if (!existsSync(skillMd)) {
      errors.push(
        `Rheged catalogue skill '${skill}' has no skills/${skill}/SKILL.md in this repo`,
      );
    }
  }

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

main();
