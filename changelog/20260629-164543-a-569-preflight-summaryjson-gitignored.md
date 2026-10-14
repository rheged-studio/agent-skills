---
title: initialise-skills reconciles preflight's .preflight-summary.json into the consumer .gitignore
release_note: initialise-skills now ensures a consumer repo's root .gitignore excludes preflight's .preflight-summary.json scratch output — the one edit it makes outside a skill's config.json. The step is append-only and idempotent (adds the commented entry only when absent, creating .gitignore if there is none; never reorders or removes existing lines), gated on the preflight bundle being installed, and surfaced in the dry-run report via a new gitignore field. This stops the file surfacing as an untracked change after a /send-it run.
version: 1.2.0
created_at: '2026-06-29T16:45:43Z'
merged_at: '2026-06-29T19:33:44Z'
branch: a-569-preflight-summaryjson-is-not-gitignored-in-skill-consumer
pr: 74
commit: 497c6e5
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-569
stats:
  files_changed: 11
  loc_added: 359
  loc_removed: 17
  commits: 4
---

## Added

- **`initialise-skills` gitignores preflight's scratch output ([R-569](https://linear.app/rheged-studio/issue/R-569)).**
  The `preflight` skill writes `.preflight-summary.json` to the repo root on every real run,
  so without an ignore rule it surfaced as an untracked change after a `/send-it` run (which
  invokes preflight) — `gh pr create` then warned about an uncommitted change. `initialise-skills`
  now ensures the host repo's root `.gitignore` excludes it. This is the **one** mutation the
  skill makes outside a skill's `config.json`: an **append-only, idempotent** edit that adds the
  commented entry only when absent (creating `.gitignore` if there is none), never reordering or
  removing existing lines, and a no-op once present. It runs only when the `preflight` bundle —
  the producer of the file — is installed, and the dry-run report shows the pending edit (`will
  add …`) via a new `gitignore` field. Covered by a new `reconcilePreflightIgnore` unit test.

## Changed

- **`preflight` SKILL.md** documents that `.preflight-summary.json` is a transient artefact that
  consumer repos gitignore (the entry being added by `initialise-skills`). Bundle versions bump:
  `initialise-skills` to `0.6.0` and `preflight` to `0.1.8`.
