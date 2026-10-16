# rheged-skills-setup

Rheged skills setup — install the estate catalogue and reconcile per-skill `config.json`
from detected repo facts.

```bash
npx skills add https://github.com/rheged-studio/agent-skills \
  --skill rheged-skills-setup --agent claude-code --agent cursor --copy
```

**Estate install (Rheged ship set; Matt Pocock packs opt-in):**

```bash
node skills/rheged-skills-setup/scripts/initialise.mjs --install            # preview
node skills/rheged-skills-setup/scripts/initialise.mjs --install --write    # first-party only
node skills/rheged-skills-setup/scripts/initialise.mjs --install --include-third-party --write
```

`--install` reads the catalogue vendored at `assets/skill-catalogue.json`, runs a
pinned `skills` CLI, and installs each source at its pinned ref. See
[`SKILL.md`](SKILL.md#scope-and-safeguards).

**Reconcile only:**

```bash
node skills/rheged-skills-setup/scripts/initialise.mjs --dry-run
echo '{"facts":{"linearTeamName":"…","linearWorkspaceSlug":"…","issueKeys":["R"]}}' \
  | node skills/rheged-skills-setup/scripts/initialise.mjs --write
```

See [`SKILL.md`](SKILL.md) for the full orchestration flow.
