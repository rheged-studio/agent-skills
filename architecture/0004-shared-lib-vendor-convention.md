# ADR-0004: Shared logic is a canonical `lib/` vendored into each bundle

- **Status:** Accepted
- **Date:** 2026-06-27
- **Tracking:** [R-534](https://linear.app/rheged-studio/issue/R-534)
- **Supersedes:** —
- **Superseded by:** —

## Context

Skill bundles must stay **independently installable** — a consumer runs
`npx skills add … --skill <name>` and gets a self-contained directory, so a bundle
may not `import` from another bundle or from a repo-level module that isn't shipped
inside it. To honour that, load-bearing logic that several bundles need has been
**hand-copied** between them. The copies drift:

- **issue-key regex / branch→issue-key extraction** — the correct, tested
  construction lives in `changelog/scripts/add-links.mjs` (`ISSUE_RE`); `linear-sync`
  and `cleanup-repo` re-derived it in prose and shipped the naive-join bug. R-539 was
  the interim fix (it pointed both at the canonical impl) but left the code copied.
- **`detectBaseBranch`** — byte-identical in `preflight/scripts/lib/scope.mjs` and
  `initialise-skills/scripts/lib/git.mjs`, each carrying a "keep the two in sync"
  comment and no test asserting they agree.
- Other dupes in the same shape: `normaliseBot` (triage-pr), base-branch/workspace
  detection, the `assertGitRepo` destructive-safety primitive.

R-466 catalogued the duplication but did not settle the mechanism. This ADR settles
it and migrates the first two dupes as proof.

## Decision

**Shared logic has one canonical source under a repo-root `lib/`, which a build-time
vendor step copies verbatim into each consuming bundle, gated by a CI drift-check.**
This keeps every bundle self-contained (the copy ships inside it) while there is
exactly one editable source of truth.

### Canonical `lib/`

- Each shared module is a **zero-dependency** `.mjs` file at the repo root (Node
  built-ins only — no npm deps, no build step), e.g. `lib/issue-keys.mjs` (exports
  `buildIssueRe`) and `lib/base-branch.mjs` (exports `detectBaseBranch`). They take
  their inputs as arguments — the host bundle owns its config and passes values in —
  so the same file works in every consumer. Keep them as close to referentially pure
  as the job allows: `issue-keys` is pure; `base-branch` shells out to `git` but
  parameterises the repo root and the fallback, so it stays portable and testable.
- `lib/` is **not** in `package.json` `files: ["skills/"]`, so it is never published.
  It is dev-time source; only the vendored copies (which live under `skills/`) ship.

### Vendored copies

- Each consumer receives `skills/<name>/scripts/lib/vendor/<file>.mjs`, whose content
  is a generated do-not-edit banner followed by the canonical file verbatim.
- Bundle code imports the vendored copy with a normal relative import
  (`./lib/vendor/issue-keys.mjs`), so the bundle stays standalone — there is no
  cross-bundle or repo-root import at runtime.

### The vendor step and drift-check

- `infrastructure/scripts/vendor-sync.mjs` holds a manifest (canonical file →
  destinations). `pnpm vendor:sync` writes every copy; `pnpm vendor:check` recomputes
  the expected bytes and exits non-zero on any missing/drifted copy.
- CI runs `pnpm vendor:check` in `build-and-lint` (after `validate:skills`), so a
  canonical edit that wasn't re-vendored, or a hand-edited copy, fails the build. The
  pure core is unit-tested (`infrastructure/tests/vendor-sync.test.ts`) and exercised
  by the script's `--self-test`.

### Versioning

Vendored copies live inside their bundle, so a sync that changes a copy is a change to
that bundle — its `package.json` `version` + `SKILL.md metadata.version` are hand-bumped
per ADR-0001's semver discipline (enforced by `pnpm validate:skills`), exactly as any
other bundle edit. The shared `lib/` itself carries no version.

## Rejected alternatives

- **(b) Accept the duplication, add golden cross-bundle tests.** Tests would _detect_
  drift but never _prevent_ it — the maintainer still edits N copies by hand, and a new
  consumer is one forgotten copy away from the next naive-join bug. Vendoring removes
  the hand-sync entirely; the drift-check is the test, for free.
- **Real cross-bundle imports (one bundle imports another's module).** Breaks the
  independent-installability invariant — a consumer installing one skill wouldn't get
  the other's code.
- **Extract a published npm package the bundles depend on.** Reintroduces a runtime
  dependency and an install/version-resolution step into bundles whose whole point is
  to be copy-in, zero-dependency. Disproportionate for a handful of small helpers.

## Consequences

- **First migrations (this ADR's PR):** `lib/issue-keys.mjs` is vendored into the
  `changelog` bundle (`add-links.mjs` now imports `buildIssueRe`); `linear-sync` and
  `cleanup-repo` prose point at the canonical `lib/`. `lib/base-branch.mjs` is vendored
  into `preflight` and `initialise-skills`, whose `scope.mjs`/`git.mjs` re-export it
  (preserving their public signatures and existing tests). The "keep in sync" comments
  are gone.
- **Adding a shared helper** is now: write `lib/<file>.mjs`, add a manifest row, run
  `pnpm vendor:sync`, bump the touched bundles. `pnpm vendor:check` guards the rest.
- **Pairs with scaffold-new-skill (R-535):** a generated skill can emit the vendored
  helpers it needs straight from the manifest.

## Out of scope

The remaining catalogued dupes are deferred to follow-up migrations under the same
mechanism: `normaliseBot` (triage-pr's two scripts), workspace/package-root detection
(preflight ↔ initialise-skills), and `assertGitRepo` (cleanup-repo). This ADR
establishes the convention and migrates the two clearest cases; the rest follow when
each is touched.
