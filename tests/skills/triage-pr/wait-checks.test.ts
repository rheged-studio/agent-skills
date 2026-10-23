import {
  ciVerdict,
  classifyChecks,
  cli,
  EXIT,
  fetchRequiredContexts,
  fetchWorkflowRuns,
  parsePrView,
} from "../../../skills/triage-pr/scripts/wait-checks.mjs";
// Imports the BUNDLE script directly. The poll loop and the whole CLI are driven
// with a fake `gh` runner and an injected clock/sleep, so the Step 2/6 green
// test and send-it's cold-start gate are exercised without real time or a PR.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const MINUTE = 60_000;
const T0 = Date.parse("2026-10-23T10:00:00Z");
const URL = "https://github.com/acme/repo/pull/7";

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function checkRun(
  name: string,
  status: string,
  conclusion: null | string = null,
  atMs = T0,
  runId = 1,
) {
  return {
    __typename: "CheckRun",
    completedAt: status === "COMPLETED" ? iso(atMs) : "0001-01-01T00:00:00Z",
    conclusion: conclusion ?? "",
    detailsUrl: `https://github.com/acme/repo/actions/runs/${runId}/job/${name.length}`,
    name,
    startedAt: status === "QUEUED" ? "0001-01-01T00:00:00Z" : iso(atMs),
    status,
    workflowName: "Validate",
  };
}

function statusContext(context: string, state: string, atMs = T0) {
  return { __typename: "StatusContext", context, startedAt: iso(atMs), state };
}

function prView(rollup: null | unknown[]) {
  return JSON.stringify({
    baseRefName: "main",
    headRefOid: "abcdef1234567890",
    statusCheckRollup: rollup,
    url: URL,
  });
}

const RULES_PREFIX = "gh api repos/acme/repo/rules/branches/main";
const LEGACY_PREFIX =
  "gh api repos/acme/repo/branches/main/protection/required_status_checks";
const RUNS_PREFIX =
  "gh api repos/acme/repo/actions/runs?head_sha=abcdef1234567890";

function workflowRuns(...runs: Array<[number, string, string]>) {
  return JSON.stringify(
    runs.map(([id, name, status]) => ({ id, name, status })),
  );
}

type Handler = (() => string) | Array<() => string>;

// A fake `gh` runner keyed by command prefix (longest wins). An array handler
// replays one response per call, repeating the last. The Actions runs lookup
// defaults to "no workflow runs" unless a test supplies it.
function harness(overrides: Record<string, Handler>, startMs = T0) {
  const handlers: Record<string, Handler> = {
    [RUNS_PREFIX]: () => "[]",
    ...overrides,
  };
  let clock = startMs;
  const calls: string[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  const counts: Record<string, number> = {};
  return {
    calls,
    deps: {
      configPath: "/nonexistent/config.json",
      error: (line: string) => errors.push(line),
      log: (line: string) => logs.push(line),
      now: () => clock,
      run: (cmd: string, args: readonly string[]) => {
        const key = `${cmd} ${args.join(" ")}`;
        calls.push(key);
        const prefix = Object.keys(handlers)
          .toSorted((a, b) => b.length - a.length)
          .find((candidate) => key.startsWith(candidate));
        if (!prefix) {
          throw new Error(`unexpected command: ${key}`);
        }

        const handler = handlers[prefix];
        if (typeof handler === "function") {
          return handler();
        }

        const index = Math.min(counts[prefix] ?? 0, handler.length - 1);
        counts[prefix] = (counts[prefix] ?? 0) + 1;
        return handler[index]();
      },
      sleep: async (ms: number) => {
        clock += ms;
      },
    },
    elapsedMinutes: () => (clock - startMs) / MINUTE,
    errors,
    logs,
  };
}

function judge(required: string[], rollup: unknown[], nowMs = T0 + MINUTE) {
  return ciVerdict(
    classifyChecks({
      botCheckNames: ["CodeRabbit"],
      cancelGraceMs: 3 * MINUTE,
      nowMs,
      required,
      rollup,
    }),
  );
}

describe("classifyChecks — the Step 2 green test", () => {
  it("is green only when every required context passes", () => {
    expect(
      judge(
        ["GO/NO GO", "pr-title / Validate PR title"],
        [
          checkRun("GO/NO GO", "COMPLETED", "SUCCESS"),
          checkRun("pr-title / Validate PR title", "COMPLETED", "SUCCESS"),
        ],
      ),
    ).toBe("green");
  });

  it("treats a missing required context as pending, never green", () => {
    expect(
      judge(
        ["GO/NO GO", "lint"],
        [checkRun("GO/NO GO", "COMPLETED", "SUCCESS")],
      ),
    ).toBeNull();
  });

  it("passes skipped and neutral conclusions", () => {
    expect(
      judge(
        ["a", "b"],
        [
          checkRun("a", "COMPLETED", "SKIPPED"),
          checkRun("b", "COMPLETED", "NEUTRAL"),
        ],
      ),
    ).toBe("green");
  });

  it("fails a red required context", () => {
    const classified = classifyChecks({
      botCheckNames: [],
      cancelGraceMs: 3 * MINUTE,
      nowMs: T0,
      required: ["GO/NO GO"],
      rollup: [checkRun("GO/NO GO", "COMPLETED", "FAILURE")],
    });
    expect(ciVerdict(classified)).toBe("failed");
    expect(classified.contexts[0]).toMatchObject({
      conclusion: "FAILURE",
      detailsUrl: expect.stringContaining("/actions/runs/1/"),
      state: "fail",
    });
  });

  it("waits out a fresh cancellation, then fails it", () => {
    const rollup = [checkRun("GO/NO GO", "COMPLETED", "CANCELLED")];
    expect(judge(["GO/NO GO"], rollup, T0 + 2 * MINUTE)).toBeNull();
    expect(judge(["GO/NO GO"], rollup, T0 + 3 * MINUTE)).toBe("failed");
  });

  it("lets a newer run supersede a cancelled one", () => {
    expect(
      judge(
        ["GO/NO GO"],
        [
          checkRun("GO/NO GO", "COMPLETED", "CANCELLED", T0),
          checkRun("GO/NO GO", "COMPLETED", "SUCCESS", T0 + MINUTE),
        ],
        T0 + 10 * MINUTE,
      ),
    ).toBe("green");
  });

  it("never lets a later pass of a different check mask a failed one", () => {
    // `build` prefix-matches both `build` and `build / docker`; latest-wins
    // applies only between reruns of the same check.
    expect(
      judge(
        ["build"],
        [
          checkRun("build", "COMPLETED", "FAILURE", T0),
          checkRun("build / docker", "COMPLETED", "SUCCESS", T0 + MINUTE),
        ],
        T0 + 10 * MINUTE,
      ),
    ).toBe("failed");
  });

  it("keeps a context pending while another check it matches is still running", () => {
    expect(
      judge(
        ["build"],
        [
          checkRun("build", "COMPLETED", "FAILURE", T0),
          checkRun("build / docker", "IN_PROGRESS"),
        ],
        T0 + 10 * MINUTE,
      ),
    ).toBeNull();
  });

  it("keeps a context pending while any of its runs is unfinished", () => {
    expect(
      judge(
        ["GO/NO GO"],
        [
          checkRun("GO/NO GO", "COMPLETED", "CANCELLED", T0),
          checkRun("GO/NO GO", "QUEUED"),
        ],
        T0 + 10 * MINUTE,
      ),
    ).toBeNull();
  });

  it("matches required contexts against status contexts too", () => {
    expect(
      judge(["ci/buildkite"], [statusContext("ci/buildkite", "PENDING")]),
    ).toBeNull();
    expect(
      judge(["ci/buildkite"], [statusContext("ci/buildkite", "SUCCESS")]),
    ).toBe("green");
    expect(
      judge(["ci/buildkite"], [statusContext("ci/buildkite", "ERROR")]),
    ).toBe("failed");
  });

  it("ignores a red non-required check but lists it as advisory", () => {
    const classified = classifyChecks({
      botCheckNames: [],
      cancelGraceMs: 0,
      nowMs: T0,
      required: ["GO/NO GO"],
      rollup: [
        checkRun("GO/NO GO", "COMPLETED", "SUCCESS"),
        checkRun("buildkite-mirror", "COMPLETED", "FAILURE"),
      ],
    });
    expect(ciVerdict(classified)).toBe("green");
    expect(classified.advisory.map((context) => context.name)).toEqual([
      "buildkite-mirror",
    ]);
  });

  it("falls back to the rollup minus review-bot checks with no required contexts", () => {
    const classified = classifyChecks({
      botCheckNames: ["CodeRabbit"],
      cancelGraceMs: 0,
      nowMs: T0,
      required: [],
      rollup: [
        checkRun("test", "COMPLETED", "SUCCESS"),
        statusContext("CodeRabbit", "PENDING"),
      ],
    });
    expect(classified.basis).toBe("rollup-fallback");
    expect(ciVerdict(classified)).toBe("green");
  });

  it("never reads an empty rollup as green", () => {
    expect(judge([], [])).toBe("empty");
    expect(judge(["GO/NO GO"], [])).toBeNull();
  });
});

describe("classifyChecks — newer workflow runs on the same head", () => {
  // Captured from PR #220: editing the PR body fired `edited`, which started a
  // second Validate run on the same head. Its GO/NO GO job didn't exist yet, so
  // only the first run's GO/NO GO (SUCCESS) was in the rollup.
  const rollup = [
    checkRun("GO/NO GO", "COMPLETED", "SUCCESS", T0, 39_962_144_338),
    checkRun("lint / Lint", "IN_PROGRESS", null, T0, 39_962_165_296),
  ];
  function classify(runs: Array<{ id: number; name: string; status: string }>) {
    return ciVerdict(
      classifyChecks({
        botCheckNames: [],
        cancelGraceMs: 0,
        nowMs: T0 + MINUTE,
        required: ["GO/NO GO"],
        rollup,
        workflowRuns: runs,
      }),
    );
  }

  it("keeps a required check pending while a newer run of its workflow is in progress", () => {
    expect(
      classify([
        { id: 39_962_144_338, name: "Validate", status: "completed" },
        { id: 39_962_165_296, name: "Validate", status: "in_progress" },
      ]),
    ).toBeNull();
  });

  it("counts a queued newer run too, even before it has any jobs", () => {
    expect(
      classify([{ id: 39_962_165_296, name: "Validate", status: "queued" }]),
    ).toBeNull();
  });

  it("ignores newer runs of other workflows and older runs of its own", () => {
    expect(
      classify([
        {
          id: 39_962_165_268,
          name: "Validate PR title",
          status: "in_progress",
        },
        { id: 39_962_100_000, name: "Validate", status: "in_progress" },
      ]),
    ).toBe("green");
  });

  it("goes green once the newer run has completed", () => {
    expect(
      classify([{ id: 39_962_165_296, name: "Validate", status: "completed" }]),
    ).toBe("green");
  });
});

describe("fetchWorkflowRuns", () => {
  it("reads the runs on the head commit", () => {
    const { calls, deps } = harness({
      [RUNS_PREFIX]: () => workflowRuns([2, "Validate", "in_progress"]),
    });
    expect(
      fetchWorkflowRuns(deps.run, "acme/repo", "abcdef1234567890"),
    ).toEqual([{ id: 2, name: "Validate", status: "in_progress" }]);
    expect(calls[0]).toContain("actions/runs?head_sha=abcdef1234567890");
  });

  it("treats a 404 (no Actions) as no runs", () => {
    const { deps } = harness({
      [RUNS_PREFIX]: () => {
        throw new Error("HTTP 404: Not Found");
      },
    });
    expect(
      fetchWorkflowRuns(deps.run, "acme/repo", "abcdef1234567890"),
    ).toEqual([]);
  });

  it("throws on any other failure or on malformed output", () => {
    const failing = harness({
      [RUNS_PREFIX]: () => {
        throw new Error("HTTP 502");
      },
    });
    expect(() =>
      fetchWorkflowRuns(failing.deps.run, "acme/repo", "abcdef1234567890"),
    ).toThrow(/502/);
    const malformed = harness({ [RUNS_PREFIX]: () => '[{"id":"x"}]' });
    expect(() =>
      fetchWorkflowRuns(malformed.deps.run, "acme/repo", "abcdef1234567890"),
    ).toThrow(/malformed/);
  });
});

describe("parsePrView", () => {
  it("reads a null rollup as empty", () => {
    expect(parsePrView(prView(null)).rollup).toEqual([]);
  });

  it.each([
    ["truncated JSON", '{"url": '],
    ["no url", JSON.stringify({ baseRefName: "main", headRefOid: "a" })],
    [
      "a malformed rollup",
      JSON.stringify({
        baseRefName: "main",
        headRefOid: "a",
        statusCheckRollup: {},
        url: URL,
      }),
    ],
  ])("rejects %s", (_label, stdout) => {
    expect(() => parsePrView(stdout)).toThrow();
  });
});

describe("fetchRequiredContexts", () => {
  it("prefers the rulesets' required contexts", () => {
    const { deps } = harness({
      [RULES_PREFIX]: () => "GO/NO GO\npr-title\nGO/NO GO\n",
    });
    expect(fetchRequiredContexts(deps.run, "acme/repo", "main")).toEqual([
      "GO/NO GO",
      "pr-title",
    ]);
  });

  it("falls back to legacy protection, where a 404 means none", () => {
    const legacy = harness({
      [LEGACY_PREFIX]: () => "build\n",
      [RULES_PREFIX]: () => "",
    });
    expect(fetchRequiredContexts(legacy.deps.run, "acme/repo", "main")).toEqual(
      ["build"],
    );

    const unprotected = harness({
      [LEGACY_PREFIX]: () => {
        throw new Error("gh: Branch not protected (HTTP 404)");
      },
      [RULES_PREFIX]: () => "",
    });
    expect(
      fetchRequiredContexts(unprotected.deps.run, "acme/repo", "main"),
    ).toEqual([]);
  });

  it("throws on any other gh failure rather than reading it as none", () => {
    const { deps } = harness({
      [RULES_PREFIX]: () => {
        throw new Error("HTTP 401: Bad credentials");
      },
    });
    expect(() => fetchRequiredContexts(deps.run, "acme/repo", "main")).toThrow(
      /401/,
    );
  });

  it("URL-encodes a base branch with a slash", () => {
    const { calls, deps } = harness({
      "gh api repos/acme/repo/rules/branches/release%2F1.x": () => "ci\n",
    });
    fetchRequiredContexts(deps.run, "acme/repo", "release/1.x");
    expect(calls[0]).toContain("rules/branches/release%2F1.x");
  });
});

describe("cli — default (green) mode", () => {
  let directory: string;
  let out: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "wait-checks-"));
    out = join(directory, "checks.json");
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("waits through pending checks to green and writes the report", async () => {
    const { deps, elapsedMinutes, logs } = harness({
      "gh pr view": [
        () => prView([]),
        () => prView([checkRun("GO/NO GO", "IN_PROGRESS")]),
        () => prView([checkRun("GO/NO GO", "COMPLETED", "SUCCESS")]),
      ],
      [RULES_PREFIX]: () => "GO/NO GO\n",
    });
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT.green);
    expect(elapsedMinutes()).toBe(1);
    expect(logs[0]).toMatch(
      /^ci=green head=abcdef1 basis=required pass=1 pending=0 fail=0/,
    );
    const report = JSON.parse(readFileSync(out, "utf8"));
    expect(report).toMatchObject({
      basis: "required",
      pr: 7,
      verdict: "green",
    });
  });

  it("waits for a newer run of the same workflow before calling it green (PR #220)", async () => {
    const first = checkRun("GO/NO GO", "COMPLETED", "SUCCESS", T0, 100);
    const second = checkRun(
      "GO/NO GO",
      "COMPLETED",
      "SUCCESS",
      T0 + MINUTE,
      200,
    );
    const { deps, elapsedMinutes, logs } = harness({
      "gh pr view": [
        () => prView([first]),
        () => prView([first]),
        () => prView([first, second]),
      ],
      [RULES_PREFIX]: () => "GO/NO GO\n",
      [RUNS_PREFIX]: [
        () =>
          workflowRuns(
            [100, "Validate", "completed"],
            [200, "Validate", "queued"],
          ),
        () =>
          workflowRuns(
            [100, "Validate", "completed"],
            [200, "Validate", "in_progress"],
          ),
        () =>
          workflowRuns(
            [100, "Validate", "completed"],
            [200, "Validate", "completed"],
          ),
      ],
    });
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT.green);
    expect(elapsedMinutes()).toBe(1);
    expect(logs[0]).toMatch(/^ci=green/);
  });

  it("exits 1 when the workflow-runs lookup keeps failing", async () => {
    const { deps } = harness({
      "gh pr view": () =>
        prView([checkRun("GO/NO GO", "COMPLETED", "SUCCESS")]),
      [RULES_PREFIX]: () => "GO/NO GO\n",
      [RUNS_PREFIX]: () => {
        throw new Error("HTTP 500");
      },
    });
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT.error);
  });

  it("reports failed with exit 3 once nothing is pending", async () => {
    const { deps, logs } = harness({
      "gh pr view": () =>
        prView([
          checkRun("GO/NO GO", "COMPLETED", "FAILURE"),
          checkRun("lint", "COMPLETED", "SUCCESS"),
        ]),
      [RULES_PREFIX]: () => "GO/NO GO\nlint\n",
    });
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT.failed);
    expect(logs[0]).toContain('failed="GO/NO GO"');
  });

  it("times out with exit 4 when a required context never registers", async () => {
    const { deps, elapsedMinutes, logs } = harness({
      "gh pr view": () => prView([checkRun("lint", "COMPLETED", "SUCCESS")]),
      [RULES_PREFIX]: () => "GO/NO GO\nlint\n",
    });
    expect(await cli(["7", "--out", out, "--max-minutes", "5"], deps)).toBe(
      EXIT.timeout,
    );
    expect(elapsedMinutes()).toBe(5);
    expect(logs[0]).toContain('waiting="GO/NO GO"');
  });

  it("never reads an empty rollup as green: no-checks after the empty grace", async () => {
    const { deps, logs } = harness({
      "gh pr view": () => prView([]),
      [LEGACY_PREFIX]: () => {
        throw new Error("HTTP 404");
      },
      [RULES_PREFIX]: () => "",
    });
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT["no-checks"]);
    expect(logs[0]).toMatch(/^ci=no-checks/);
  });

  it("exits 1 when gh keeps failing, never green", async () => {
    const { deps, errors, logs } = harness({
      "gh pr view": () => {
        throw new Error("HTTP 401: Bad credentials");
      },
    });
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT.error);
    expect(logs).toEqual([]);
    expect(errors[0]).toContain("Bad credentials");
    expect(existsSync(out)).toBe(false);
  });

  it("exits 1 when the required-context lookup fails", async () => {
    const { deps } = harness({
      "gh pr view": () =>
        prView([checkRun("GO/NO GO", "COMPLETED", "SUCCESS")]),
      [RULES_PREFIX]: () => {
        throw new Error("HTTP 500");
      },
    });
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT.error);
  });

  it("carries the budget across --run-minutes slices with --resume", async () => {
    const handlers = {
      "gh pr view": () => prView([checkRun("GO/NO GO", "IN_PROGRESS")]),
      [RULES_PREFIX]: () => "GO/NO GO\n",
    };
    const slice = [
      "7",
      "--out",
      out,
      "--max-minutes",
      "12",
      "--run-minutes",
      "9",
    ];
    const first = harness(handlers);
    expect(await cli(slice, first.deps)).toBe(EXIT.continue);
    const second = harness(handlers, T0 + first.elapsedMinutes() * MINUTE);
    expect(await cli([...slice, "--resume"], second.deps)).toBe(EXIT.timeout);
    expect(first.elapsedMinutes() + second.elapsedMinutes()).toBe(12);
  });
});

describe("cli — --registered (send-it cold start)", () => {
  let directory: string;
  let out: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "wait-checks-"));
    out = join(directory, "registered.json");
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("succeeds as soon as any check registers, without reading branch rules", async () => {
    const { calls, deps, elapsedMinutes, logs } = harness({
      "gh pr view": [
        () => prView([]),
        () => prView([checkRun("anything", "QUEUED")]),
      ],
    });
    expect(await cli(["7", "--registered", "--out", out], deps)).toBe(
      EXIT.registered,
    );
    expect(elapsedMinutes() * 60).toBe(10);
    expect(logs[0]).toMatch(/^ci=registered checks=1/);
    expect(calls.every((call) => call.startsWith("gh pr view"))).toBe(true);
  });

  it("exits 5 when nothing registers within 3 minutes", async () => {
    const { deps, elapsedMinutes } = harness({
      "gh pr view": () => prView([]),
    });
    expect(await cli(["7", "--registered", "--out", out], deps)).toBe(
      EXIT["no-checks"],
    );
    expect(elapsedMinutes()).toBe(3);
  });

  it("exits 1 — not 5 — when gh fails", async () => {
    const { deps } = harness({
      "gh pr view": () => {
        throw new Error("HTTP 401");
      },
    });
    expect(await cli(["7", "--registered", "--out", out], deps)).toBe(
      EXIT.error,
    );
  });
});
