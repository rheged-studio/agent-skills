---
title: 'initialise-skills: remind (and probe) for the Claude GitHub App token'
release_note: 'initialise-skills gains a GitHub App & token check: when spinning up a repo that will run the shared Claude workflows, it reminds the operator to run /install-github-app and set the CLAUDE_CODE_OAUTH_TOKEN repository Actions secret (not ANTHROPIC_API_KEY). As a best-effort probe it runs `gh secret list --app actions` to check whether the secret is present, warning if it is absent and degrading to a plain reminder when gh is unavailable or lacks repo-admin scope (a 403 is a can''t-tell, never a failure). The probe is read-only — gh secret list returns names only, never values — and the skill makes no GitHub writes. Adds Bash(gh:*) to allowed-tools; the config-reconcile script is untouched.'
created_at: '2026-07-06T11:18:01Z'
merged_at: '2026-07-06T11:35:13Z'
branch: a-670-init-skills-remind-and-optionally-probe-for
pr: 104
commit: 2404aa9
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: feature
breaking: false
issues:
  - R-670
stats:
  files_changed: 3
  loc_added: 105
  loc_removed: 11
  commits: 3
version: 1.2.0
---

## Added

**initialise-skills:** a **GitHub App & token check** (new step 6 in the process).
When a repo is being spun up to run the shared Claude workflows, one per-repo step
is unavoidable regardless of the caller-tag strategy: the Claude GitHub App must be
installed and the `CLAUDE_CODE_OAUTH_TOKEN` repository Actions secret set, or the
workflows authenticate with an empty token and fail
([R-646](https://linear.app/rheged-studio/issue/R-646)). The required secret is
`CLAUDE_CODE_OAUTH_TOKEN`, **not** `ANTHROPIC_API_KEY` — a recurring confusion this
step names explicitly.

The skill now reminds the operator to run `/install-github-app`, and — as a
best-effort probe — checks whether the secret is actually present:

```bash
gh secret list --repo <owner>/<repo> --app actions | grep -q CLAUDE_CODE_OAUTH_TOKEN
```

It has three outcomes: **present** (report OK), **absent** (warn and point at
`/install-github-app`), and **can't verify** — when the `gh` call itself errors, e.g.
a `403` without repo-admin scope or `gh` not being installed, which is surfaced as a
"couldn't verify — confirm manually" note that **never blocks or fails the run**. A
can't-tell is not an absence. The App install itself can't be reliably introspected
without the App's own token, so the secret's presence is the reliable proxy and the
`/install-github-app` reminder covers both together.

The probe is **read-only**: `gh secret list` returns secret _names_ only, never
values, and the skill makes no GitHub writes — on an absent or unverifiable secret it
only ever prints a reminder. It follows the estate `gh`-probe pattern already used by
`send-it` / `triage-pr` / `cleanup-repo`, adding `Bash(gh:*)` to the skill's
`allowed-tools`; `gh` is **optional**, so the skill still runs fully without it and
falls back to a textual reminder. The pure-Node config-reconcile script
(`scripts/initialise.mjs`) is deliberately untouched — the check is prose-driven, so
its unit tests and the config-key contract are unaffected. The `initialise-skills`
bundle version is bumped `0.9.1` → `0.10.0`
([R-670](https://linear.app/rheged-studio/issue/R-670)).
