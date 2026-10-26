# pr

Write or update a pull request body in the estate's shape: a **Summary** visual,
a full **Changes** list grouped by intent, honest before/after **Evidence**,
**Merge Danger** (door, blast radius, and the release note), and **Related
Issues**. A marked `<!-- pr:keep -->` region carries hand-added material, such as
screenshots, across every regeneration of the body.

The agent picks the skill up whenever it writes a PR body. [`send-it`](../send-it)
follows it in Step 9, passing in its release note and the linked issue IDs.

## Install

From any consumer repo:

```bash
npx skills add https://github.com/rheged-studio/agent-skills --skill pr --agent claude-code --agent cursor --copy
```

`--copy` writes real files so the bundle is portable. Don't use `-g` / `--global`
— the install should live in the consumer repo. The estate catalogue
(`rheged-skills-setup --install`) installs it alongside `send-it`.

This bundle replaces Matt Pocock's `pr` skill, which shares the name: installing
both into the same `.claude/skills/pr/` would collide, so the catalogue lists only
this one.

## Requirements

- `git`, to read the branch's commit subjects and diff stat.
- `gh` (authenticated), to publish the body (and, inside the script, to fetch
  the current one).
- Node.js ≥ 22, to run [`scripts/splice-body.mjs`](scripts/splice-body.mjs).
- **No npm dependencies, no build step, and no `config.json`.**
  [`SKILL.md`](SKILL.md) is the source of truth.
- Optional: a root `GLOSSARY.md`, whose terms the body uses when present.

## Keep-region script

`scripts/splice-body.mjs` carries the `<!-- pr:keep -->` region across a
regeneration, so the agent never reads the current PR body into its context
(R-2876). The agent writes the new body, with an empty keep region, to a file.
The script then fetches the PR's current body itself with `gh pr view` (array
arguments, no shell), splices its keep regions in verbatim, and writes the file
back for `gh pr create|edit --body-file`. It prints only metadata, such as
`keep region: present (3 lines)`, and never the body text.

```bash
node scripts/splice-body.mjs --new body.md --pr 123   # update: carry PR #123's region
node scripts/splice-body.mjs --new body.md --no-pr    # create: nothing to carry
node scripts/splice-body.mjs --new body.md --json     # current branch's PR; JSON metadata
node scripts/splice-body.mjs --self-test              # offline fixtures, no gh
node scripts/splice-body.mjs --help
```

An unclosed opening marker fails safe: everything below it is carried and a
closing marker is added, with a warning. A new body that lacks exactly one empty
keep region is refused (exit 2) and nothing is written. A `gh` failure other
than "no PR" exits 1. [`SKILL.md` § The keep region](SKILL.md#the-keep-region)
lists every case.

## Credits

Built on Matt Pocock's [`pr`](https://github.com/mattpocock/skills/tree/main/skills/engineering/pr)
skill (MIT) — its Summary visuals, Evidence tiers, and Merge Danger section — and,
through it, Dex Horthy's [`show-me`](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md)
(Humanlayer). The Changes list, release note, Related Issues, and keep region come
from `send-it`'s earlier template. Matt Pocock's MIT licence notice ships beside
this file as [`LICENSE-mattpocock-skills`](LICENSE-mattpocock-skills).
