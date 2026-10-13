// Tests the canonical repo-root `lib/linear-states.mjs` — the per-issue-team
// state resolution the linear-sync / cleanup-repo / send-it prose mirrors
// (R-2682). One repo configured with ["C","R","A"] carries `c-` (Cadogan),
// `r-` (Rheged) and legacy `a-` branches; an `a-` ID can belong to either team,
// so the team is read from each issue, never from config.
import { extractBranchIssueId } from "../../lib/issue-keys.mjs";
import {
  createTeamStateCache,
  planTransitions,
  resolveTargetState,
  shouldTransition,
} from "../../lib/linear-states.mjs";
import { describe, expect, it, vi } from "vitest";

type Status = { id: string; name: string; position: number; type: string };

const RHEGED: Status[] = [
  { id: "r-triage", name: "Triage", position: 0, type: "triage" },
  { id: "r-backlog", name: "Backlog", position: 1, type: "backlog" },
  { id: "r-todo", name: "Todo", position: 2, type: "unstarted" },
  { id: "r-progress", name: "In Progress", position: 3, type: "started" },
  { id: "r-review", name: "In Review", position: 4, type: "started" },
  { id: "r-done", name: "Done", position: 5, type: "completed" },
  { id: "r-canceled", name: "Canceled", position: 6, type: "canceled" },
];

// Cadogan renames its states, so name-matching alone would miss them.
const CADOGAN: Status[] = [
  { id: "c-backlog", name: "Backlog", position: 0, type: "backlog" },
  { id: "c-todo", name: "Todo", position: 1, type: "unstarted" },
  { id: "c-doing", name: "Doing", position: 2, type: "started" },
  { id: "c-code-review", name: "Code Review", position: 3, type: "started" },
  { id: "c-shipped", name: "Shipped", position: 4, type: "completed" },
];

const TEAMS: Record<string, Status[]> = {
  Cadogan: CADOGAN,
  "Rheged Studio": RHEGED,
};

// Shaped like `get_issue` output: team name, status name, status type.
const ISSUES: Record<
  string,
  { id: string; status: string; statusType: string; team: string }
> = {
  "A-99": {
    id: "A-99",
    status: "Doing",
    statusType: "started",
    team: "Cadogan",
  },
  "A-2651": {
    id: "A-2651",
    status: "Todo",
    statusType: "unstarted",
    team: "Rheged Studio",
  },
  "C-12": {
    id: "C-12",
    status: "Backlog",
    statusType: "backlog",
    team: "Cadogan",
  },
  "R-40": {
    id: "R-40",
    status: "In Progress",
    statusType: "started",
    team: "Rheged Studio",
  },
};

function issue(id: null | string) {
  const found = id === null ? undefined : ISSUES[id];
  if (!found) {
    throw new Error(`no fixture issue ${String(id)}`);
  }

  return found;
}

function fakeFetcher() {
  return vi.fn(async (team: string) => {
    const statuses = TEAMS[team];
    if (!statuses) {
      throw new Error(`unknown team ${team}`);
    }

    return statuses;
  });
}

describe("resolveTargetState", () => {
  it("resolves the default names", () => {
    expect(resolveTargetState(RHEGED, "In Progress")?.id).toBe("r-progress");
    expect(resolveTargetState(RHEGED, "In Review")?.id).toBe("r-review");
    expect(resolveTargetState(RHEGED, "Done")?.id).toBe("r-done");
  });

  it("falls back by type and position when states are renamed", () => {
    expect(resolveTargetState(CADOGAN, "In Progress")?.id).toBe("c-doing");
    expect(resolveTargetState(CADOGAN, "In Review")?.id).toBe("c-code-review");
    expect(resolveTargetState(CADOGAN, "Done")?.id).toBe("c-shipped");
  });

  it("resolves both started targets to a team's only started state", () => {
    const single = RHEGED.filter((state) => state.id !== "r-review");
    expect(resolveTargetState(single, "In Progress")?.id).toBe("r-progress");
    expect(resolveTargetState(single, "In Review")?.id).toBe("r-progress");
  });

  it("returns null when the team has no state of the target type", () => {
    const noCompleted = RHEGED.filter((state) => state.type !== "completed");
    expect(resolveTargetState(noCompleted, "Done")).toBeNull();
  });
});

describe("shouldTransition", () => {
  const review = { position: 4, type: "started" };
  it.each([
    [{ position: 2, type: "unstarted" }, true],
    [{ position: 3, type: "started" }, true],
    [{ position: 4, type: "started" }, false],
    [{ position: 5, type: "completed" }, false],
    [{ position: 6, type: "canceled" }, false],
  ])("current %o → In Review applies: %s", (current, expected) => {
    expect(shouldTransition(current, review)).toBe(expected);
  });

  it("never advances a terminal state, even to Done", () => {
    const done = { position: 5, type: "completed" };
    expect(shouldTransition({ position: 6, type: "canceled" }, done)).toBe(
      false,
    );
    expect(shouldTransition({ position: 4, type: "started" }, done)).toBe(true);
  });
});

describe("createTeamStateCache", () => {
  it("fetches each team's statuses at most once", async () => {
    const fetch = fakeFetcher();
    const cache = createTeamStateCache(fetch);
    await cache.get("Cadogan");
    await cache.get("Rheged Studio");
    await cache.get("Cadogan");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("planTransitions — one repo, three keys, two teams (R-2682)", () => {
  const KEYS = ["C", "R", "A"];
  const BRANCHES = [
    "c-12-fix-r-3-thing",
    "r-40-add-c-2-support",
    "a-2651-2-agent-skills-make-the-linear-skills-multi-team",
    "a-99-legacy-cadogan-work",
  ];

  it("transitions each branch's issue with its own team's state", async () => {
    const ids = BRANCHES.map((branch) => extractBranchIssueId(branch, KEYS));
    expect(ids).toEqual(["C-12", "R-40", "A-2651", "A-99"]);

    const fetch = fakeFetcher();
    const plan = await planTransitions({
      cache: createTeamStateCache(fetch),
      issues: ids.map((id) => issue(id)),
      target: "In Review",
    });

    expect(plan).toEqual([
      {
        action: "apply",
        from: "Backlog",
        id: "C-12",
        stateId: "c-code-review",
        team: "Cadogan",
        to: "Code Review",
      },
      {
        action: "apply",
        from: "In Progress",
        id: "R-40",
        stateId: "r-review",
        team: "Rheged Studio",
        to: "In Review",
      },
      {
        action: "apply",
        from: "Todo",
        id: "A-2651",
        stateId: "r-review",
        team: "Rheged Studio",
        to: "In Review",
      },
      {
        action: "apply",
        from: "Doing",
        id: "A-99",
        stateId: "c-code-review",
        team: "Cadogan",
        to: "Code Review",
      },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("skips issues already at or past the target", async () => {
    const plan = await planTransitions({
      cache: createTeamStateCache(fakeFetcher()),
      issues: [issue("R-40"), issue("A-99")],
      target: "In Progress",
    });
    expect(plan.map((entry) => [entry.id, entry.action])).toEqual([
      ["R-40", "skip"],
      ["A-99", "skip"],
    ]);
  });

  it("falls back to the configured team only when the issue carries none", async () => {
    const fetch = fakeFetcher();
    const plan = await planTransitions({
      cache: createTeamStateCache(fetch),
      fallbackTeamName: "Rheged Studio",
      issues: [{ id: "R-7", status: "Todo", statusType: "unstarted" }],
      target: "In Progress",
    });
    expect(plan[0]).toMatchObject({
      action: "apply",
      stateId: "r-progress",
      team: "Rheged Studio",
    });
    expect(fetch).toHaveBeenCalledWith("Rheged Studio");
  });

  it("skips with a reason when the team can't be resolved", async () => {
    const plan = await planTransitions({
      cache: createTeamStateCache(fakeFetcher()),
      issues: [{ id: "R-7", status: "Todo", statusType: "unstarted" }],
      target: "In Progress",
    });
    expect(plan[0]).toMatchObject({ action: "skip", id: "R-7" });
    expect(plan[0]?.reason).toMatch(/team/i);
  });
});
