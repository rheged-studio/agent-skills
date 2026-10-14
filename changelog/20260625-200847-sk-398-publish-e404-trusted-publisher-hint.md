---
title: Surface a Trusted Publisher hint when npm publish fails with E404/E403
release_note: When the npm publish leg of release.yml fails with what looks like an auth/visibility error (E404/E403), the publish wrapper now captures the output and prints an actionable hint pointing straight at the npm Trusted Publisher binding (repository, workflow, environment) — npm masks an unauthorised write to an existing package as a 404, so the bare error gave no clue to the real cause. Publish failures already self-report via release.yml's notify step now that the repo's GitHub Issues are enabled.
created_at: '2026-06-25T20:08:47Z'
merged_at: '2026-06-25T21:16:54Z'
branch: sk-398-agent-skills-improve-npm-publish-failure-observability
pr: 38
commit: ebc6492
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-398
affected_packages:
  - infrastructure
stats:
  files_changed: 3
  loc_added: 107
  loc_removed: 6
  commits: 3
version: 1.2.0
---

## Fixed

- **Actionable Trusted Publisher hint on a publish E404/E403.**
  `scripts/publish-via-raw-npm.sh` now captures the `npm publish` output and, on a
  failure whose error looks like an auth/visibility problem (`E404` / `E403` /
  `you do not have permission`), prints a framed hint naming the npm Trusted
  Publisher binding the package needs — repository `acme-skunkworks/agent-skills`,
  workflow `release.yml`, environment `npm-release`. npm masks an unauthorised
  write to an existing package as a 404, so the bare error never pointed at the
  missing binding. This is the [R-174](https://linear.app/rheged-studio/issue/R-174) learning applied to the `npm publish` call
  rather than the `npm view` probe. A generic (non-E404/E403) failure still aborts
  but deliberately does not misfire the hint.

## Changed

- **Publish failures self-report.** With the repo's GitHub Issues re-enabled at the
  repo level, `release.yml`'s existing failure-notify step can open a tracking issue
  on agent-skills itself — a publish failure is no longer visible only via the
  release orchestrator's alert.
