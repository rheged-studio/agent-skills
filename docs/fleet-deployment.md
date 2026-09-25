# Fleet deployment runbook

How to roll the shared agent skills onto a target repo: cleanly remove whatever
bespoke skill/command files it already has, install the canonical set via the
[skills.sh](https://skills.sh) CLI, reconcile each skill's `config.json` from the
repo's own facts, and verify. Every per-repo adoption issue (A-449–A-454) shares
this mechanism — this is the single place it is defined, so those issues just
link here.

The flow is **wipe → install → reconcile → verify**. It is idempotent: re-running
it upgrades an existing install rather than duplicating it. One caveat on a
**re-vendor** of a repo that already has reconciled configs: a `--copy` install
deletes your per-skill `config.json`, so restore it from the trunk between install
and reconcile — see [Re-install / upgrade behaviour](#re-install--upgrade-behaviour).

> **Scope.** This runbook lives in `agent-skills` and covers the repeatable
> mechanism plus the helper(s) this repo ships to support it. Migrating a
> specific target repo end-to-end is tracked under that repo's own adoption
> issue.

## Estate skill catalogue (A-1904)

The install set is defined in [`infrastructure/skill-catalogue.json`](../infrastructure/skill-catalogue.json): **Rheged** ship skills from this repo plus **Matt Pocock** engineering and productivity packs from `mattpocock/skills` (not copied into `skills/` here). Matt's `triage` and Rheged's `triage-pr` are different skills — keep both. Planning entry point: `/grill-me`; run `/setup-matt-pocock-skills` once if the pack requires it.

**Consumer — one command after bootstrapping `rheged-skills-setup`:**

```bash
npx skills add https://github.com/rheged-studio/agent-skills \
  --skill rheged-skills-setup --agent claude-code --agent cursor --copy
# then from the consumer repo root:
node .claude/skills/rheged-skills-setup/scripts/initialise.mjs --install --write
```

(or `/rheged-skills-setup --install --write` when the command shim is installed). The installer fetches the catalogue, runs `skills add --copy` per source, restores clobbered `config.json` (A-706), and reconciles. Legacy vendored `initialise-skills/` dirs and shims are removed during install.

**Clacks / fleet recurring roll:** `fleet-update.mjs --apply` reads the same catalogue (multi-source install, Rheged-only `check-updates` verify, Matt presence check). `--print-skills` emits the **Rheged** CSV only.

**Dogfood in this repo:** Rheged bundles stay under `skills/`; Matt packs vend into `.claude/skills/` and `.agents/skills/` via `--install` (the catalogue skips re-copying Rheged into mirrors on the source repo).

## The Rheged ship set

Published Rheged bundles live under `skills/<name>/` in agent-skills:

| Skill | Purpose | Notes |
| --- | --- | --- |
| `send-it` | All-in-one finisher (commit → preflight → changelog → PR → Linear) | Delegates to `preflight`, `changelog`, `linear-sync` — install those alongside it. |
| `commit` | Atomic Conventional Commits | Hard dependency of `send-it`. |
| `preflight` | Change-gated, branch-scoped lint | Self-configuring; reads an optional root `preflight.config.json`, no in-bundle `config.json`. |
| `changelog` | Author/refresh/validate dated changelog entries | Skip on repos with no changelog flow (see below). |
| `linear-sync` | Transition linked Linear issues | — |
| `cleanup-repo` | Prune merged branches, worktrees, filesystem cruft | — |
| `rheged-skills-setup` | Install catalogue + reconcile every skill's `config.json` | Renamed from `initialise-skills` (0.12.0). |
| `triage-pr` | Drive a PR from draft-with-failing-CI to merge-ready | — |
| `release-status` | Read-only release-please pipeline diagnosis | Sibling of `send-it`. |

**Set per repo type:**

- **Single-package repo with a release pipeline** — the full set.
- **Repo with no changelog/release flow** — omit `changelog`; `send-it`'s
  `changelog` config knob is detected as `false` by `rheged-skills-setup`, so it
  skips authoring rather than following an uninstalled skill (A-452).
- **Monorepo** — the full set; `rheged-skills-setup` detects the workspace and
  turns on the changelog `affectedPackages` field (A-461). Single↔monorepo
  flips (including accepting drift on a previously written `false`) are
  documented in the rheged-skills-setup bundle:
  [`skills/rheged-skills-setup/references/monorepo-config.md`](../skills/rheged-skills-setup/references/monorepo-config.md).

## Step 1 — Wipe existing

Remove the target repo's drifted, bespoke skill/command files so there is a clean
slate and no duplicate or competing definitions. Preview first.

**Remove:**

- Bespoke command shims under `.claude/commands/` that duplicate a canonical
  skill — e.g. a hand-rolled `.claude/commands/send-it.md` (the pattern every
  adoption issue calls out).
- Local prototype skill bundles under any agent skills dir (`.claude/skills/`,
  `.agents/skills/`, `.cursor/...`) that the shared set replaces. Find these by
  listing those dirs yourself (e.g. `ls .claude/skills .agents/skills`) — the
  helper below only flags dirs that share a canonical skill name, not
  arbitrarily-named prototypes.

**Preserve:**

- The repo's own `preflight.config.json` (a deliberate root-level override).
- Any already-reconciled per-skill `config.json` you intend to keep. Note the
  step 2 `--copy` install **deletes** these (the source bundle ships no
  `config.json` — see the re-vendor callout in step 2); restore them from the
  trunk before reconciling so your values survive.
- Anything genuinely repo-specific and not part of the shared set.

Use the bundled helper to preview and apply the command-shim removals:

```bash
# Preview (default — lists what would be removed, deletes nothing):
node infrastructure/scripts/fleet-wipe.mjs --repo /path/to/target

# Apply once the preview looks right:
node infrastructure/scripts/fleet-wipe.mjs --repo /path/to/target --apply
```

The helper only removes the canonical command shims it knows about
(`.claude/commands/<skill>.md`). Its "other candidates" list flags **only** skill
dirs whose name matches a canonical skill (a vendored install and a bespoke
prototype are indistinguishable by name, so it never auto-deletes them) — it does
**not** discover arbitrarily-named prototype dirs. Review the candidates it lists,
and separately scan the agent skill dirs yourself for any other bespoke bundles to
remove by hand.

## Step 2 — Install via skills.sh

Install the chosen set with `--copy` so each repo vendors a stable bundle (real
files, not symlinks):

Prefer the [estate catalogue](#estate-skill-catalogue-a-1904) (`--install`) for the full Rheged + Matt set. For Rheged-only manual installs:

```bash
npx skills add https://github.com/rheged-studio/agent-skills \
  --skill send-it --skill commit --skill preflight --skill changelog \
  --skill linear-sync --skill cleanup-repo --skill rheged-skills-setup \
  --skill triage-pr --skill release-status \
  --agent claude-code --agent cursor --copy
```

Never install without `--skill` flags (that would pull `scaffold-new-skill`, A-729). Never use `-g` / `--global` — installs belong in the consumer repo.

> **`commit` is a hard dependency of `send-it`.** Since the `send-it` bundle
> delegates its commit step to the standalone `commit` skill, install the two
> together — a `send-it` vendored without `commit` has no working commit step.
> `release-status` is a read-only sibling of `send-it` (it diagnoses the
> release-please pipeline after merge); it ships alongside the set for any repo
> that releases through release-please.

### Pinning and reproducibility

The skills.sh CLI has **no `--ref` flag** (ADR-0001 Decision 4), so `npx skills
add <url>` resolves the repo's default branch (`main`). `main` is kept
release-ready, so this is the normal path. For a reproducible, pinned install:

```bash
git clone --branch <tag> https://github.com/rheged-studio/agent-skills /tmp/agent-skills-<tag>
npx skills add /tmp/agent-skills-<tag> --skill <name> --agent claude-code --copy
```

(The `tree/<ref>/skills/<name>` URL form may also resolve a tag, but is not
officially supported by the CLI — prefer the local-clone path.)

### Re-install / upgrade behaviour

`npx skills add … --copy` over an existing copy **overwrites** the vendored
bundle files in place — it is the upgrade path, not a duplicator. To move a repo
to a newer bundle, re-run the same `add` command, then restore your configs (see
the callout below) and re-run step 3 (reconcile) to pick up any new config keys.
Because installs are `--copy`, an upgrade is a clean file replacement with no
symlink drift.

> **⚠️ A re-vendor clobbers your per-skill `config.json` — restore it before
> reconciling (A-706).** agent-skills gitignores its per-skill `config.json` and
> ships only the neutral `config.example.json` (A-615), so the source bundle
> carries **no** `config.json`. A `--copy` install is a clean bundle-directory
> replacement that mirrors the source exactly, so it **overwrites** (older CLIs
> **delete**) every existing `config.json` in the consumer — in both the
> `.claude/skills/` and `.agents/skills/` mirrors, resetting it to the neutral
> example. Your reconciled values, including the deliberate no-detector edits the
> detector can't reproduce, go with them.
>
> **Before** running step 3, restore the clobbered (tracked) configs from the
> trunk. `git diff HEAD` catches both an overwrite (`M`) and a delete (`D`) whether
> or not they've been staged, and the guard skips the restore cleanly on a
> first-ever install (nothing clobbered → no `git checkout … --` with an empty file
> list to error on). Restore from `HEAD` — not `origin/main` — so a config edit
> that lives only on the local branch survives:
>
> ```bash
> clobbered=$(git diff HEAD --name-only --diff-filter=DM | grep 'config\.json$')
> [ -n "$clobbered" ] && git checkout HEAD -- $clobbered
> ```
>
> Step 3 then merges any genuinely new keys in while keeping your restored values
> `unchanged`/`manual-kept`. **Skip the restore and step 3 recreates each
> `config.json` from scratch**, silently regressing every no-detector key
> (`linearTeamName`, `linearWorkspaceSlug`, `changelog.packageRoots`,
> `triage-pr.promoteOnGreen`, `release-status.releaseBranch`, …) — the exact
> regression class of A-612. A first-ever install has no tracked `config.json` to
> lose, so this applies only to re-vendors.

## Step 3 — Reconcile config

Write each skill's `config.json` from detected repo facts (base branch, package
roots, changelog dir, Linear keys, review bots, …). On a fresh install the
consumer has only `config.example.json` (agent-skills ships no `config.json` —
A-615), so `rheged-skills-setup` **creates** each `config.json` from the example's
key set plus the detected/supplied facts. **Commit those resolved configs** in
the consumer — they are runtime identity, not secrets. Do **not** copy the
agent-skills source gitignore rule (`skills/*/config.json`) into a consumer: that
rule exists only so `skills add --copy` cannot leak ACME values from the source
repo. `rheged-skills-setup` also strips erroneous `.claude`/`.agents`
`skills/*/config.json` ignore lines if a consumer inherited them (A-812). Dry-run
first; it is idempotent and never clobbers a deliberate edit (drift is reported,
not overwritten).

> **On a re-vendor, restore your configs first.** The step 2 `--copy` install
> deleted the consumer's existing `config.json` files. If you reach this step
> without restoring them from the trunk (see the step 2 callout), this recreation
> path silently regresses every no-detector key. Restore, then reconcile.

```bash
# Preview:
node <skills-dir>/rheged-skills-setup/scripts/initialise.mjs --dry-run

# Write, supplying the facts the script can't derive from git/fs:
echo '{"facts":{"linearTeamName":"…","linearWorkspaceSlug":"…","issueKeys":["A"]}}' \
  | node <skills-dir>/rheged-skills-setup/scripts/initialise.mjs --write
```

`<skills-dir>` is wherever `skills add` vendored the bundles (e.g.
`.claude/skills/`). See
[`skills/rheged-skills-setup/references/detectable-keys.md`](../skills/rheged-skills-setup/references/detectable-keys.md)
for the full key → detection-source table.

> **Renamed Linear team?** `issueKeys` is auto-detected from branch-name prefixes,
> preferring the most recently committed branch (A-556). If the team key was renamed
> and stale branches still carry old prefixes — or detection is otherwise wrong (e.g.
> a fresh repo with no keyed branches yet) — pass the canonical key(s) as a fact
> (`"issueKeys":["A"]`, as above) to override. The `facts.issueKeys` value always
> wins over detection, so it is the canonical fix for a renamed team.

## Step 4 — Verify

1. **Idempotency** — re-run `initialise.mjs --dry-run`; the second run must report
   no inferred changes (every key `unchanged`/`drift`/`manual-kept`).
2. **Safe previews** — exercise each installed skill's read-only path (e.g.
   `/preflight`, `changelog` validate, `cleanup-repo --dry-run`) and confirm it
   resolves config and runs without error.
3. **Bundle metadata** — if the target repo runs the validator, `pnpm
   validate:skills` confirms each bundle's `package.json` ↔ `SKILL.md`
   `metadata.version` parity.
4. **CI unaffected** — confirm the install added only vendored skill files and
   touched no CI config.

## Checklist

- [ ] Previewed and wiped bespoke command shims / prototype skills (step 1).
- [ ] Installed the repo-type-appropriate set via `skills add … --copy` (step 2).
- [ ] On a re-vendor: restored the per-skill `config.json` the `--copy` install deleted, from the trunk, before reconciling (step 2 callout).
- [ ] Reconciled config with `rheged-skills-setup` `--dry-run` then `--write`, supplying `facts.issueKeys` for a renamed team (step 3).
- [ ] Verified idempotency, safe previews, and CI (step 4).

## Automating a single-repo update (`fleet-update.mjs`)

Steps 1–4 above are the **human onboarding** path — the one-time wipe of bespoke
prototypes plus the first install. The **recurring update** — rolling an
already-onboarded repo onto newer bundles — is automated by
[`infrastructure/scripts/fleet-update.mjs`](../infrastructure/scripts/fleet-update.mjs)
(A-617). It runs **wipe (install set + legacy `initialise-skills`) → multi-source install → restore → reconcile → verify** for one repo (steps
2–4 automated), driven by an install profile rather than interactive edits:

```bash
# Preview (default — mutates nothing):
node infrastructure/scripts/fleet-update.mjs --profile ./acme.json
# Apply the update:
node infrastructure/scripts/fleet-update.mjs --profile ./acme.json --apply
# Orchestrator form — profile on stdin:
echo '{"repo":"…","agents":["claude-code"]}' \
  | node infrastructure/scripts/fleet-update.mjs --apply
```

It reads [`infrastructure/skill-catalogue.json`](../infrastructure/skill-catalogue.json), vendors Rheged from the GitHub URL and Matt from `mattpocock/skills` — **not** a local path (A-718) — so lock provenance stays remote. It **restores every `config.json` the
`--copy` re-vendor clobbers** from the consumer's trunk (`git checkout HEAD -- …`,
A-706), reconciles with `rheged-skills-setup`, and verifies Rheged skills with
`check-updates` scoped to the ship set (A-741) plus a Matt bundle presence check.
A re-run is a clean no-op when already current.

The script **holds no repo list.** It takes one repo's profile as input and is
meant to run inside Clacks's fan-out (A-713), whose
unified manifest (A-715) supplies one profile per consumer — so private repo
names never surface in this public repo. The driver (token minting, per-repo PR
creation) lives in the orchestrator, not here.

### Install-profile schema

The profile is the documented input contract the orchestrator populates. `repo`
is the only required field:

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `repo` | string | ✔ | — | Path to the consumer repo (absolute, or relative to cwd). |
| `skills` | string[] | | all canonical | Omit to install the full set; list a subset to narrow it. |
| `agents` | string[] | | `["claude-code"]` | `--agent` targets; each maps to a vendored skills-dir mirror. |
| `repoType` | `single` \| `mono` \| `no-changelog` | | `single` | Informational — actual behaviour is detected by `rheged-skills-setup`. When `skills` is omitted, `no-changelog` subtracts `changelog` from the Rheged set (A-452). |
| `facts.linearTeamName` | string | | — | Forwarded to `rheged-skills-setup` (it can't derive this). |
| `facts.linearWorkspaceSlug` | string | | — | Forwarded to `rheged-skills-setup`. |
| `facts.issueKeys` | string[] | | detected | Overrides branch-prefix detection (e.g. `["A"]`) — see the renamed-team note above. |
| `facts.followUpProject` | string | | — | Fallback catch-all for triage-pr follow-ups that cannot inherit a live project from the PR's Linear issue (required when `linearTeamName` is set — A-1204 / A-1541). Rheged estate value: `Follow-up issues`. |

The lock provenance (`lockSource`, `lockRef`) is supplied by the script, not the
profile. Worked example:

```json
{
  "repo": "/path/to/consumer",
  "skills": ["send-it", "commit", "preflight", "linear-sync"],
  "agents": ["claude-code", "cursor"],
  "repoType": "single",
  "facts": {
    "linearTeamName": "Rheged Studio",
    "linearWorkspaceSlug": "rheged-studio",
    "issueKeys": ["A"],
    "followUpProject": "Follow-up issues"
  }
}
```
