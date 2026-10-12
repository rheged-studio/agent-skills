# triage-pr — follow-up capture and routing

Turning a **follow-up** disposition into a tracked Linear issue. Loaded when the
disposition plan includes any `follow-up` — or, on the unattended path, any
`[gated]` review finding that becomes a follow-up there — and capture is enabled
(`linearTeamName` set).

Under `humanEnvelope: true`, capture is part of the same envelope approval (not a
second prompt). Under unattended (`humanEnvelope: false` / `--auto-apply`), create
follow-ups in Step 11 after the plan is posted — no second prompt. Capture is
**opt-in**: when `linearTeamName` is empty, it is disabled (no Linear MCP calls);
skip silently when the Linear MCP server is unavailable.

## Configuration keys

| Key | Meaning | Default |
| --- | --- | --- |
| `linearTeamName` | Linear team **name** (not the key — the key is renamed over time, the name is stable) the follow-up issues are created under. Empty disables capture entirely. | `""` |
| `issueKeys` | Team-key prefixes that may appear in branch names, used to recognise issue ids the same way `linear-sync` does. Mirrors the established `issueKeys` convention. | `[]` |
| `followUpLabel` | Label applied to every created follow-up (provenance: this came from a review disposition). **Required when `linearTeamName` is set** — empty or unresolved must refuse create (never mint without the label). Do not also apply the repo's agent-ready triage label. Rheged estate value: `follow-up`. | `"follow-up"` |
| `followUpProject` | Linear project (name, id, or slug) used as the **catch-all** when the PR has no linked Linear issue to file the follow-up under (or that issue has no project). **Required when `linearTeamName` is set** — empty or unresolved must refuse create (never file with no project). Rheged estate value: `Follow-up issues`. | `""` |
| `followUpState` | Optional initial workflow state (type, name, or id — e.g. `Backlog`) for created issues. Empty = the team's default state. | `"Backlog"` |

## Step 9 — read-only destination resolve

Before mint, each follow-up item in the plan needs a destination line.

When the plan includes any `follow-up` — or, on the unattended path, any `[gated]`
item — and capture is enabled (`linearTeamName` set), run the **destination rule
below read-only** — before Step 10 on the envelope path, and before mint on the
unattended path. Use only `get_issue`, `list_projects`, and `list_issue_labels`; do
**not** call `save_issue` in this step.

Reuse that destination on mint in Step 11; do not re-decide it then.

If routing fail-closes (no parent and an empty or unresolved catch-all, or an empty
or unresolved `followUpLabel`), keep the item as a follow-up candidate but say on the
plan line that capture will decline / `Follow-up not tracked`. Skip this resolve when
capture is disabled (`linearTeamName` empty). Under `--dry-run`, this resolve stays
read-only too (no Linear writes).

## Step 11 — mint as a sub-issue of the PR's issue

A follow-up is filed as a **sub-issue of the Linear issue the PR was raised under**,
so it stays visible from that issue. Only when the PR has no linked issue does it go
to the catch-all project. Linear create details (team by **name**, state by **type**,
the required **label**, **project**, `parentId`, and the parent's **milestone** when
it has one) — resolve via `list_issue_statuses` / `list_projects` /
`list_issue_labels` and fail loudly on typos.

**Fail closed on project and label.** When capture is enabled (`linearTeamName`
set), every minted issue **must** have a resolved `project` and the configured
`followUpLabel`. Never omit `project`. Never omit the label, and do not also
apply the repo's agent-ready triage label. Never call `save_issue` if routing or the
label fails.

Mint after Step 10 approval on the envelope path; after the plan comment on the
unattended path, with no Linear-only gate.

1. **Require `followUpLabel`.** Resolve the configured name with
   `list_issue_labels` (exact name). If `followUpLabel` is empty or the label
   does not exist → **do not** call `save_issue`. Abort capture loudly (tell
   the human to set `followUpLabel` in `config.json` and to create that label),
   and fall back to decline / `Follow-up not tracked` for each follow-up
   candidate. On success, pass that label on every `save_issue` create. Rheged
   estate value: `follow-up`.
2. **Resolve the parent id.** Extract issue ids using the same `issueKeys`
   regex as `linear-sync` (`lib/issue-keys.mjs` / `buildIssueRe`: `\bA-\d+\b`
   for a single key; grouped alternation when there are several). Skip lookup
   if there are no configured keys. Match in this order — **stop at the first
   source that yields a match**:
   1. the **upper-cased** branch name — if it has at least one match, the
      **first** match is the parent (later matches on the branch, and every
      match on the PR title, are ignored);
   2. else the PR title — if it has at least one match, the **first** match is
      the parent;
   3. else there is **no** parent id.
   Then `get_issue` on that id. A miss (the id doesn't exist, or isn't visible)
   counts as **no parent**.
3. **Parent resolved → file as its sub-issue.** Pass `parentId` set to the
   parent, `project` set to the parent's project, and `milestone` set to the
   parent's milestone when it has one. Take them as they are — no project-status
   check and no milestone lookup. Plan line:
   `file as sub-issue of A-NNNN (<project>)`. If the parent has no project,
   still pass `parentId`, but take `project` from `followUpProject` (step 4's
   resolve and fail-closed rules apply). Plan line:
   `file as sub-issue of A-NNNN (<catch-all>)`.
4. **No parent → the `followUpProject` catch-all, flat.** No `parentId`, no
   milestone. If `followUpProject` is empty → **do not** call `save_issue`.
   Abort capture loudly (tell the human to set `followUpProject` in
   `config.json`), and fall back to decline / `Follow-up not tracked` for each
   follow-up candidate. If set → resolve it with `list_projects` (name, id, or
   slug). On a miss → **do not** call `save_issue`; fail loudly with the
   unresolved value (same decline fallback). Plan line:
   `file under <catch-all> (no linked issue)`.
5. Always pass the resolved `project` and the resolved `followUpLabel` on every
   `save_issue` create. Never omit `project`. Never omit the label.

## Unattended follow-up issue body

On the unattended path (`humanEnvelope: false` / `--auto-apply`), follow-up issue
bodies must include: a falsifiable claim; what this agent verified; why it was
deferred; a labelled leaning (not an instruction); permalinks and the SHA; a
non-binding note of what was considered; an instruction to re-verify and to
decline if the claim is wrong, already done, or out of scope. No prescribed patch.
Urgent uses `priority: 1`; ordinary issues use `followUpState` (default Backlog)
with no priority bump.
