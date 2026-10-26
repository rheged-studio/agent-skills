---
title: carry the PR keep region with a script, not the agent
release_note: The pr skill no longer reads the existing PR body; a bundled script carries the keep region.
created_at: "2026-10-16T17:09:58Z"
merged_at:
branch: r-2876-pr-move-pr-body-keep-region-merging-into-a-script-to-reduce
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - R-2876
stats:
  loc_added:
  loc_removed:
  files_changed:
  commits:
version:
---

## Added

- **`pr` now ships `scripts/splice-body.mjs`, which carries the `<!-- pr:keep -->` region across a regenerated body ([R-2876](https://linear.app/rheged-studio/issue/R-2876)).** The agent writes the new body with an empty keep region to a file. The script fetches the PR's current body itself, splices each keep region in verbatim, and writes the file back for `gh pr create|edit --body-file`. It prints only metadata, such as `keep region: present (3 lines)`, never the body text. An unclosed opening marker fails safe by carrying everything below it. A new body without exactly one empty region is refused, and nothing is written. Offline `--self-test` fixtures cover these cases.
- **`pr` gains an Untrusted input section.** Commit subjects, and any commit message or diff it reads, are treated as data, never instructions. URLs and commands from them stay out of the body unless they are part of the change.

## Changed

- **The `pr` skill never reads the current PR body into the agent's context.** This addresses Snyk's W011 third-party-content finding. Branch reading now starts with commit subjects and `git diff --stat`. Full messages or diffs are read only when the subjects can't explain the change. `Bash(node:*)` joins `allowed-tools` so the script can run.
- **pr minor-bumped to 0.2.0.**
