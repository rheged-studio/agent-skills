// Canonical Linear state-resolution rules — the tested reference the
// linear-sync, cleanup-repo and send-it prose mirrors (R-2682). Those skills
// drive the Linear MCP tools directly and ship no scripts, so nothing vendors
// this file; it exists so the rules the prose describes are pinned by tests.
//
// Multi-team: a repo can carry issues from several Linear teams (e.g. `c-`,
// `r-` and legacy `a-` branches), and workflow state IDs are per-team. So each
// issue's states are resolved against **that issue's own team** (from
// `get_issue`), cached per team — never once for the configured team.
//
// Pure and zero-dependency: the caller supplies the status fetcher.

/**
 * Progression order of Linear state types; `canceled` sits outside it.
 */
const TYPE_RANK = {
  backlog: 1,
  completed: 4,
  started: 3,
  triage: 0,
  unstarted: 2,
};

const TERMINAL_TYPES = new Set(["canceled", "completed"]);

/**
 * @typedef {{ id: string, name: string, position: number, type: string }} WorkflowState
 * @typedef {"In Progress" | "In Review" | "Done"} Target
 */

/**
 * @param {WorkflowState[]} statuses
 * @param {string} type
 * @returns {WorkflowState[]}
 */
function ofType(statuses, type) {
  return statuses
    .filter((state) => state.type === type)
    .toSorted((a, b) => a.position - b.position);
}

/**
 * @param {WorkflowState[]} states
 * @param {RegExp} re
 * @returns {WorkflowState | undefined}
 */
function named(states, re) {
  return states.find((state) => re.test(state.name));
}

/**
 * Resolve a transition target to one of a team's live states — by `type`, then
 * name, then `position`, because display names are customisable:
 *
 * - In Progress → the `started` state named "In Progress", else the earliest `started`.
 * - In Review → the `started` state named "In Review" / "Review", else the latest
 *   `started` when there are ≥2, else the In Progress state.
 * - Done → the `completed` state named "Done", else the earliest `completed`.
 * @param {WorkflowState[]} statuses
 * @param {Target} target
 * @returns {WorkflowState | null}
 */
export function resolveTargetState(statuses, target) {
  const started = ofType(statuses, "started");
  const inProgress = named(started, /^in progress$/i) ?? started[0];

  if (target === "In Progress") {
    return inProgress ?? null;
  }

  if (target === "In Review") {
    return (
      named(started, /review/i) ??
      (started.length >= 2 ? started.at(-1) : inProgress) ??
      null
    );
  }

  const completed = ofType(statuses, "completed");
  return named(completed, /^done$/i) ?? completed[0] ?? null;
}

/**
 * Whether moving from `current` to `target` advances the issue. Transitions are
 * idempotent and only ever forward: skip when the issue is at or past the
 * target, or in a terminal (`completed` / `canceled`) state. Within `started`,
 * `position` orders In Progress before In Review.
 * @param {{ position?: number, type: string }} current
 * @param {{ position: number, type: string }} target
 * @returns {boolean}
 */
export function shouldTransition(current, target) {
  if (TERMINAL_TYPES.has(current.type)) {
    return false;
  }

  const from = TYPE_RANK[/** @type {keyof typeof TYPE_RANK} */ (current.type)];
  const to = TYPE_RANK[/** @type {keyof typeof TYPE_RANK} */ (target.type)];
  if (from === undefined || to === undefined) {
    return false;
  }

  if (from !== to) {
    return from < to;
  }

  return (
    current.type === "started" &&
    current.position !== undefined &&
    current.position < target.position
  );
}

/**
 * Per-team cache over `list_issue_statuses`: each team's states are fetched at
 * most once per run, however many of its issues the branch set touches.
 * @param {(teamName: string) => Promise<WorkflowState[]>} fetchStatuses
 * @returns {{ get: (teamName: string) => Promise<WorkflowState[]> }}
 */
export function createTeamStateCache(fetchStatuses) {
  /** @type {Map<string, Promise<WorkflowState[]>>} */
  const byTeam = new Map();
  return {
    get(teamName) {
      let statuses = byTeam.get(teamName);
      if (!statuses) {
        statuses = fetchStatuses(teamName);
        byTeam.set(teamName, statuses);
      }

      return statuses;
    },
  };
}

/**
 * @typedef {{ id: string, status: string, statusType: string, team?: string }} IssueSnapshot
 *   shaped like `get_issue` output: team name, status name, status type
 * @typedef {{ action: "apply", from: string, id: string, stateId: string, team: string, to: string }
 *   | { action: "skip", id: string, reason: string }} PlannedTransition
 */

/**
 * Decide each issue's transition against **its own team's** states.
 * `fallbackTeamName` (the configured `linearTeamName`) is used only when an
 * issue carries no team.
 * @param {{
 *   cache: { get: (teamName: string) => Promise<WorkflowState[]> },
 *   fallbackTeamName?: string,
 *   issues: IssueSnapshot[],
 *   target: Target,
 * }} options
 * @returns {Promise<PlannedTransition[]>}
 */
export async function planTransitions({
  cache,
  fallbackTeamName,
  issues,
  target,
}) {
  /** @type {PlannedTransition[]} */
  const plan = [];
  for (const issue of issues) {
    const team = issue.team || fallbackTeamName;
    if (!team) {
      plan.push({
        action: "skip",
        id: issue.id,
        reason: "no team to resolve states against",
      });
      continue;
    }

    const statuses = await cache.get(team);
    const targetState = resolveTargetState(statuses, target);
    if (!targetState) {
      plan.push({
        action: "skip",
        id: issue.id,
        reason: `team ${team} has no ${target} state`,
      });
      continue;
    }

    const current = statuses.find((state) => state.name === issue.status);
    const from = { position: current?.position, type: issue.statusType };
    if (!shouldTransition(from, targetState)) {
      plan.push({
        action: "skip",
        id: issue.id,
        reason: "already at or past target",
      });
      continue;
    }

    plan.push({
      action: "apply",
      from: issue.status,
      id: issue.id,
      stateId: targetState.id,
      team,
      to: targetState.name,
    });
  }

  return plan;
}
