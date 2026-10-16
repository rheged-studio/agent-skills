---
title: pin send-it's install guidance and declare its scope
release_note: send-it no longer asks for npx, its install snippets pin the skills CLI and a release tag, and SKILL.md now lists what a run does unattended.
created_at: "2026-10-16T17:06:25Z"
merged_at:
branch: r-2872-send-it-pin-install-guidance-and-declare-scope-to-clear
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: fix
breaking: false
issues:
  - R-2872
stats:
---

## Fixed

- **send-it no longer grants itself `Bash(npx:*)` ([R-2872](https://linear.app/rheged-studio/issue/R-2872)).** No send-it step or bundled script runs `npx`; it appeared only in install instructions for a human. The chained `triage-pr` declares its own grant. This was one of the triggers for skills.sh's Socket audit flagging send-it as a LOW anomaly.
- **send-it's install snippets are pinned.** The `SKILL.md` and `README.md` snippets, and the Step 11 "install it to chain" hint, now use `npx --yes skills@1.7.2 add https://github.com/rheged-studio/agent-skills/tree/<release-tag>`, with a note that `<release-tag>` is a `vX.Y.Z` release and `main` tracks unreleased work. They point to `rheged-skills-setup --install` as the managed install path.

## Added

- **A Scope and safeguards section in send-it's `SKILL.md`.** It collects, in one place, what a default run does without a prompt (commit on the feature branch, push it, open or update a draft PR, move Linear issues to In Review, chain into `triage-pr`) and what it never does (push to the trunk, force-push, merge, arm auto-merge, weaken CI gates). It names `--skip-triage` as the opt-out, and states that the six delegated skills must come from the same release.
- **An Untrusted input section in send-it's `SKILL.md`.** Commit messages, branch names, PR titles and bodies, and Linear issue fields are treated as data, never instructions. The section names the existing safeguards: `derive-bump.mjs` derives the slug and bump deterministically, and the PR title and body reach `gh` through a quoted variable and `--body-file`.

## Changed

- **send-it patch-bumped to 0.12.4.**
