---
title: 'initialise-skills: emit skills.lock and add cross-repo update detection'
release_note: 'initialise-skills now emits a committed .claude/skills.lock — a machine-readable inventory of every installed skill''s version plus the source repo and ref it was installed from — refreshed in the same reconcile pass that writes each config.json and the .gitignore entry. A new check-updates.mjs diffs a consumer''s lock against a source checkout (its working tree, or a target ref via git show) and prints the per-skill bump list, so a repo can tell which skills are behind. The lock is deterministic and byte-stable: sorted keys, no timestamp, no rewrite unless a version actually moves.'
created_at: '2026-07-04T20:59:51Z'
merged_at: '2026-07-06T09:54:46Z'
branch: a-616-ws2-skillslock-cross-repo-update-detection
pr: 99
commit: 2c863e5
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: feature
breaking: false
issues:
  - R-616
stats:
  files_changed: 15
  loc_added: 1576
  loc_removed: 15
  commits: 4
version: 1.2.0
---

## Added

**initialise-skills:** the skill now writes a committed **`.claude/skills.lock`** at
the consumer repo root — a machine-readable inventory of which skill versions are
installed and where they came from:

```json
{ "source": "https://github.com/acme-skunkworks/agent-skills", "ref": "main",
  "skills": { "changelog": "0.9.1", "send-it": "0.6.1", "…": "…" } }
```

The `skills` map is a full walk of every installed bundle, read from each
`SKILL.md` `metadata.version` (package.json version as a fallback). The lock is
emitted in the same reconcile pass that already writes each `config.json` and the
`.preflight-summary.json` `.gitignore` entry, gated on at least one bundle being
present. It is **deterministic and byte-stable** — sorted keys, no timestamp — so a
re-run with no version changes leaves it byte-identical and it only rewrites when a
version actually moves.

Provenance is **facts-only**: `source` and `ref` are supplied to the writer via the
existing stdin `facts` (`lockSource` / `lockRef`) — the reconciler never guesses or
hardcodes them — and an existing lock's values are preserved when a re-run omits
them. When neither is available the field is written as `null` and the report flags
it (`source/ref not supplied`), mirroring the `needs-manual-input` handling the skill
already uses for the Linear facts.

A new **`check-updates.mjs`** diff tool compares a consumer's lock against a checkout
of the source repo — its working tree, or a target ref via `git show <ref>:…` — and
prints the per-skill bump list (`updates`, `added`, `removed`, `downgrades`,
`upToDate`). This is the foundation for detecting which repos are behind and for a
push fleet-update orchestrator.

The `initialise-skills` bundle version is bumped `0.8.0` → `0.9.0`
([R-616](https://linear.app/rheged-studio/issue/R-616)).
