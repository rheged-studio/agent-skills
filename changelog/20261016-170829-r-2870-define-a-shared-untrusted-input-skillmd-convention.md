---
title: add the Untrusted input SKILL.md convention and warn-only check
release_note: New skills now start with an "Untrusted input" section, and validate:skills warns when a skill that reads PRs, logs or Linear issues lacks one.
created_at: "2026-10-16T17:08:29Z"
merged_at:
branch: r-2870-define-a-shared-untrusted-input-skillmd-convention-and-lint
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - R-2870
stats:
version:
---

## Added

- **A shared `## Untrusted input` SKILL.md convention ([R-2870](https://linear.app/rheged-studio/issue/R-2870)).** The new `docs/skill-conventions.md` explains why the skills.sh audits flag skills that read outsider-authored text (Snyk W011 and Gen Agent Trust Hub's missing boundary markers). It gives the canonical section, which lists each ingestion point, treats the text as data, wraps quotes in `<untrusted source="…">` markers, and stops on embedded instructions. It also sets out the "prefer deterministic ingestion" principle: where a bundled script can return only structured fields, use it rather than handing raw text to the agent.
- **A warn-only `validate:skills` check.** A SKILL.md that names `gh pr view`, `gh pr list`, `gh run view --log`, `git log`, `git diff` or `mcp__linear-server__get_issue` without a `## Untrusted input` heading now prints a warning. The exit code stays 0 while the per-skill PRs land; switching `UNTRUSTED_INPUT_SEVERITY` to `"error"` makes it a hard failure later.

## Changed

- **scaffold-new-skill emits the section in every new skill, and is minor-bumped to 0.2.0.** The generated SKILL.md carries the section with placeholder ingestion points, and the self-test and tests check for it.
