---
title: emit structured PR and commit fields from release-status, not raw text
release_note: release-status now reports PRs and commits as classified fields (type, scope, breaking, bump, version) and never prints a raw PR title, label or commit message.
version:
created_at: "2026-10-16T17:08:36Z"
merged_at:
branch: r-2875-release-status-emit-structured-pr-fields-not-raw-titles-to
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - R-2875
stats:
  files_changed:
  loc_added:
  loc_removed:
---

## Changed

- **release-status emits structure, not free text ([R-2875](https://linear.app/rheged-studio/issue/R-2875)).** Snyk's audit flagged the skill (W011) because PR titles and commit messages, which outsiders can write, reached the agent through the helper's output. The helper still reads them to classify the version bump, but its human report and `--json` now carry only validated fields. Each commit since the last tag is `{ hash, type, scope, breaking, bump }`, and the open release PR is `{ number, url, version, requiredCheck }`, with the version parsed from the release-please title. Commit bodies only feed the `breaking` boolean, label names are never printed, and the merged-PR query no longer requests the title at all.
- **The manual `gh pr list` fallback is gone.** When the helper fails, SKILL.md now tells the agent to report the failure rather than read labels with raw `gh` calls.
- **New `## Untrusted input` section** in SKILL.md names the ingestion points, says the bundled script is their only reader, and lists the safeguards: structured output, the `\u001E`/`\u001F` record delimiters and the `--repo` validation. A new `## Output shape` section documents the `--json` schema.
- **`--json` shape change.** `releasePr.title` and `releasePr.requiredCheck.conclusion` are removed. `releasePr.version` and `versionPreview.commits` are added.
- **release-status minor-bumped to 0.3.0.**
