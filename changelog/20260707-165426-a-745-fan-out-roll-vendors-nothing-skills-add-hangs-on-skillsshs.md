---
title: fleet-update forces skills.sh's non-interactive install so an unattended roll actually vendors
release_note: The skills-update fan-out rolled every consumer but vendored NOTHING in CI — fleet-update shells out to "npx skills add … --copy", which shows an interactive "Installation scope" prompt and, with no TTY to answer it, aborts before writing any bundle files, so initialise recorded no versions and the verify failed. skills.sh only skips that prompt when it detects an agent environment; the fan-out "worked" by hand purely because it was run inside Claude Code (which sets CLAUDECODE). fleet-update now sets that agent env var on the skills-add child process, so the install is non-interactive and the vendor is deterministic in CI, cron, and by hand alike.
created_at: '2026-07-07T16:54:26Z'
branch: a-745-fan-out-roll-vendors-nothing-skills-add-hangs-on-skillsshs
category: fix
breaking: false
issues:
  - R-745
merged_at: '2026-07-07T17:04:40Z'
commit: bf03d8b
merge_strategy: squash
pr: 118
stats:
  loc_added: 66
  loc_removed: 5
  files_changed: 3
  commits: 2
version: 1.2.3
---

## Fixed

The skills-update fan-out ([R-713](https://linear.app/rheged-studio/issue/R-713)) reached its first live canary and **vendored
nothing**: `fleet-update.mjs --apply` wiped the bundle dirs, ran
`npx skills add … --copy`, restored configs, reconciled — but every re-vendored
bundle came out **without its `SKILL.md`**, so `initialise` recorded no versions
and `check-updates` reported every canonical skill as `added` (the post-`--skills`
symptom `0 skill(s) behind`; pre-fix it was `N behind`).

**Root cause.** `skills add` shows an interactive **`◆ Installation scope`**
prompt and, with no agent detected and no TTY to answer it, aborts before writing
files. [skills.sh](https://skills.sh) only skips that prompt when it detects an
**agent** via env (`CLAUDECODE`, `CLAUDE_CODE`, `AI_AGENT`, `CURSOR_AGENT`, …) —
"Agent detected — installing non-interactively". The fan-out only ever "worked" by
hand because it was run **inside Claude Code**, which sets `CLAUDECODE`; in CI and
cron no such variable is set. (`!process.stdin.isTTY` alone does **not** skip the
scope prompt — only agent detection does.)

**Fix.** `fleet-update` now invokes `skills add` with `CLAUDECODE=1` set on the
child process (via a new pure `skillsAddEnv` helper), forcing the non-interactive
install path so the vendor is deterministic everywhere — CI, cron, and by hand.
Verified by running `--apply` with every agent env var cleared from the parent
(mimicking CI): the roll now vendors all nine canonical bundles, the lock advances,
and the verify passes.
