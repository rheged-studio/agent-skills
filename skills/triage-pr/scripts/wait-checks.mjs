#!/usr/bin/env node
// Required-check wait for the triage-pr skill (SKILL.md Steps 2 and 6), and
// send-it's cold-start gate (send-it Step 11.3, via `--registered`).
//
// Polls the PR's head-commit status-check rollup until CI reaches a verdict,
// writes a per-context JSON report, and prints a one-line verdict. It replaces
// the hand-written `gh pr checks --watch` re-checks and the cold-start shell
// loop. All JSON is parsed in Node, and a `gh` failure is never read as "no
// checks" or "green": it is retried, then the script exits 1.
//
// The green test (Step 2): every required context — from the base branch's
// rulesets, falling back to legacy branch protection — is present on the head
// commit and terminal-successful (success, skipped or neutral). Per context:
//   - not in the rollup yet      → pending (a gating job may still create it);
//   - any matching run unfinished → pending (a rerun or second run is coming);
//   - a newer run of the same workflow still in progress on the head commit
//                                 → pending, even before it has created the job
//                                   (an `edited` / `ready_for_review` event
//                                   re-runs the workflow on the same head);
//   - latest run cancelled        → pending for --cancel-grace-minutes, so a
//                                   superseding run can register; then failed;
//   - latest run otherwise red    → failed.
// With no required contexts at all, the whole rollup minus the reviewBotChecks
// contexts is judged instead (`basis: rollup-fallback`). An empty rollup is
// never green.
//
// Exit codes:
//   0  green (default mode) / at least one check registered (--registered)
//   3  failed — every context is terminal and at least one required one is red
//   4  timeout — --max-minutes passed with required contexts still pending
//   5  no-checks — nothing registered in the window (--registered), or the
//      rollup stayed empty with no required contexts (default mode)
//   6  `--run-minutes` slice ended before a verdict — re-run with `--resume`
//   1  `gh` failed more than `--retries` times in a row, or returned bad data
//   2  usage or config error
//
// Usage:
//   node wait-checks.mjs <pr>                    # wait for the required checks
//   node wait-checks.mjs <pr> --registered       # cold start: any check within 3 minutes
//   node wait-checks.mjs <pr> --run-minutes 9    # cap one invocation (Cursor)
//   node wait-checks.mjs <pr> --run-minutes 9 --resume
//   node wait-checks.mjs --self-test             # run built-in offline fixtures

import { contextMatches, contextTime } from "./review-threads.mjs";
import {
  defaultConfigPath,
  defaultOutPath,
  loadConfig,
  parseCount,
  parsePositive,
  readState,
  realDeps,
  removeFile,
  runCommand,
  statePathFor,
  writeJson,
} from "./wait-common.mjs";
import { realpathSync } from "node:fs";

const MINUTE = 60_000;
const DEFAULT_RETRIES = 2;
const DEFAULTS = {
  green: { intervalSeconds: 30, maxMinutes: 30 },
  registered: { intervalSeconds: 10, maxMinutes: 3 },
};
const DEFAULT_CANCEL_GRACE_MINUTES = 3;
const DEFAULT_EMPTY_GRACE_MINUTES = 3;

// Terminal outcomes GitHub counts as passing for a required check.
const PASSING = new Set(["NEUTRAL", "SKIPPED", "SUCCESS"]);
const PENDING_STATUS_STATES = new Set(["EXPECTED", "PENDING"]);
// gh reports an unset CheckRun time as the zero time, not null.
const ZERO_TIME = /^0001-01-01/;

export const EXIT = {
  continue: 6,
  error: 1,
  failed: 3,
  green: 0,
  "no-checks": 5,
  registered: 0,
  timeout: 4,
  usage: 2,
};

/**
 * Reshape a `gh pr view --json statusCheckRollup` node into the GraphQL shape
 * review-threads.mjs's `contextMatches` / `contextTime` read, so required
 * contexts are matched to checks exactly as the review-bot settle does.
 * @param {object} node
 */
export function normaliseRollupNode(node) {
  if (node.__typename === "StatusContext") {
    return { ...node, createdAt: node.createdAt ?? node.startedAt ?? null };
  }

  return {
    ...node,
    checkSuite: {
      workflowRun: { workflow: { name: node.workflowName ?? "" } },
    },
    completedAt: realTime(node.completedAt),
    startedAt: realTime(node.startedAt),
  };
}

function realTime(value) {
  return !value || ZERO_TIME.test(value) ? null : value;
}

function distinctNames(list) {
  return [...new Set(list.map((node) => contextName(node)).filter(Boolean))];
}

function isUnfinished(node) {
  return node.__typename === "StatusContext"
    ? PENDING_STATUS_STATES.has(node.state)
    : node.status !== "COMPLETED";
}

function outcomeOf(node) {
  return node.__typename === "StatusContext" ? node.state : node.conclusion;
}

function contextName(node) {
  return node.__typename === "StatusContext" ? node.context : node.name;
}

/**
 * Classify one context against the (normalised) rollup. Pure.
 * @param {string} name
 * @param {object[]} nodes normalised rollup nodes
 * @param {{ nowMs: number, cancelGraceMs: number, workflowRuns?: { id: number, name: string, status: string }[] }} options
 *   `workflowRuns` are the Actions runs on the head commit (see `fetchWorkflowRuns`).
 * @returns {{ name: string, state: "pass"|"pending"|"fail", conclusion: string|null, detailsUrl: string|null, evidence: string }}
 */
export function classifyContext(
  name,
  nodes,
  { cancelGraceMs, nowMs, workflowRuns = [] },
) {
  const matching = nodes.filter((node) => contextMatches(node, name));
  if (matching.length === 0) {
    return {
      conclusion: null,
      detailsUrl: null,
      evidence: "not registered on the head commit yet",
      name,
      state: "pending",
    };
  }

  function describe(node, state, evidence) {
    return {
      conclusion: outcomeOf(node) ?? node.status ?? null,
      detailsUrl: node.detailsUrl ?? node.targetUrl ?? null,
      evidence,
      name,
      state,
    };
  }

  // A required context can match several distinct checks (`build` matches both
  // `build` and `build / docker`). "Latest wins" only holds between reruns of
  // the same check, so judge each check on its own, then fold: any pending
  // check keeps the context pending, else any failure fails it.
  const results = [...groupByCheck(matching).values()].map((runs) => {
    const unfinished = runs.find((node) => isUnfinished(node));
    if (unfinished) {
      return describe(
        unfinished,
        "pending",
        `${contextName(unfinished)} ${unfinished.status ?? unfinished.state}`,
      );
    }

    const latest = runs.toSorted(
      (a, b) => (contextTime(b) ?? 0) - (contextTime(a) ?? 0),
    )[0];
    const newer = supersedingRun(latest, workflowRuns);
    if (newer) {
      return describe(
        latest,
        "pending",
        `${contextName(latest)} — a newer "${newer.name}" run (${newer.id}) is ${newer.status}`,
      );
    }

    const outcome = outcomeOf(latest);
    if (PASSING.has(outcome)) {
      return describe(latest, "pass", `${contextName(latest)} ${outcome}`);
    }

    if (outcome === "CANCELLED") {
      const cancelledAt = contextTime(latest) ?? nowMs;
      if (nowMs - cancelledAt < cancelGraceMs) {
        return describe(
          latest,
          "pending",
          `${contextName(latest)} CANCELLED — waiting for a superseding run`,
        );
      }
    }

    return describe(latest, "fail", `${contextName(latest)} ${outcome}`);
  });

  return (
    results.find((result) => result.state === "pending") ??
    results.find((result) => result.state === "fail") ??
    results[0]
  );
}

/**
 * The Actions run a check-run node came from, parsed from its `detailsUrl`.
 * @param {object} node
 * @returns {number|null}
 */
function runIdOf(node) {
  const match = String(node.detailsUrl ?? "").match(/\/actions\/runs\/(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * A newer, unfinished run of the same workflow as `node`'s run, if any. Such a
 * run supersedes `node`'s result even before it has created the matching job
 * (GitHub's merge gate waits on it), so the check stays pending until it ends.
 * @param {object} node normalised check-run node
 * @param {{ id: number, name: string, status: string }[]} workflowRuns
 */
function supersedingRun(node, workflowRuns) {
  const runId = runIdOf(node);
  const workflow = node.checkSuite?.workflowRun?.workflow?.name;
  if (node.__typename === "StatusContext" || runId === null || !workflow) {
    return null;
  }

  return (
    workflowRuns.find(
      (run) =>
        run.name === workflow && run.id > runId && run.status !== "completed",
    ) ?? null
  );
}

/**
 * Group rollup nodes by check identity — a status context, or a workflow's
 * check run — so reruns of one check share a group.
 * @param {object[]} nodes normalised rollup nodes
 * @returns {Map<string, object[]>}
 */
function groupByCheck(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    const key =
      node.__typename === "StatusContext"
        ? `status\u0000${node.context}`
        : `check\u0000${node.checkSuite?.workflowRun?.workflow?.name ?? ""}\u0000${node.name}`;
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }

  return groups;
}

/**
 * Apply the Step 2 green test to a rollup. Pure.
 * @param {{ required: string[], rollup: object[], nowMs: number, cancelGraceMs: number, botCheckNames: string[], workflowRuns?: { id: number, name: string, status: string }[] }} input
 */
export function classifyChecks({
  botCheckNames,
  cancelGraceMs,
  nowMs,
  required,
  rollup,
  workflowRuns = [],
}) {
  const nodes = rollup.map((node) => normaliseRollupNode(node));
  const options = { cancelGraceMs, nowMs, workflowRuns };

  if (required.length > 0) {
    const advisoryNodes = nodes.filter(
      (node) => !required.some((name) => contextMatches(node, name)),
    );
    return {
      advisory: distinctNames(advisoryNodes)
        .map((name) => classifyContext(name, advisoryNodes, options))
        .filter((context) => context.state !== "pass"),
      basis: "required",
      contexts: required.map((name) => classifyContext(name, nodes, options)),
    };
  }

  const judged = nodes.filter(
    (node) => !botCheckNames.some((name) => contextMatches(node, name)),
  );
  return {
    advisory: [],
    basis: "rollup-fallback",
    contexts: distinctNames(judged).map((name) =>
      classifyContext(name, judged, options),
    ),
  };
}

/**
 * The overall CI verdict for a classification: `green`, `failed`, `empty` (no
 * contexts to judge), or null while anything is pending.
 * @param {{ contexts: { state: string }[] }} classified
 */
export function ciVerdict({ contexts }) {
  if (contexts.length === 0) {
    return "empty";
  }

  if (contexts.some((context) => context.state === "pending")) {
    return null;
  }

  return contexts.some((context) => context.state === "fail")
    ? "failed"
    : "green";
}

/**
 * Parse and check `gh pr view --json url,headRefOid,baseRefName,statusCheckRollup`.
 * Throws on anything incomplete, so bad data is never judged.
 * @param {string} stdout
 */
export function parsePrView(stdout) {
  const value = JSON.parse(stdout);
  if (!value || typeof value !== "object") {
    throw new Error("gh pr view output is not a JSON object");
  }

  const match = String(value.url ?? "").match(
    /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/,
  );
  if (!match) {
    throw new Error("gh pr view output has no PR url");
  }

  for (const key of ["headRefOid", "baseRefName"]) {
    if (typeof value[key] !== "string" || value[key] === "") {
      throw new Error(`gh pr view output has no ${key}`);
    }
  }

  const rollup = value.statusCheckRollup ?? [];
  if (!Array.isArray(rollup)) {
    throw new TypeError("gh pr view output has a malformed statusCheckRollup");
  }

  return {
    baseRefName: value.baseRefName,
    headRefOid: value.headRefOid,
    number: Number(match[2]),
    repo: match[1],
    rollup,
    url: value.url,
  };
}

function lines(stdout) {
  return [
    ...new Set(
      String(stdout)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * The base branch's required status-check contexts: rulesets first, then
 * legacy branch protection. Only a 404 from legacy protection ("Branch not
 * protected") means none; any other `gh` failure throws.
 * @param {(cmd: string, args: string[]) => string} run
 * @param {string} repo owner/name
 * @param {string} base
 */
export function fetchRequiredContexts(run, repo, base) {
  const branch = encodeURIComponent(base);
  const fromRules = lines(
    run("gh", [
      "api",
      `repos/${repo}/rules/branches/${branch}`,
      "--paginate",
      "--jq",
      '.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context',
    ]),
  );
  if (fromRules.length > 0) {
    return fromRules;
  }

  try {
    return lines(
      run("gh", [
        "api",
        `repos/${repo}/branches/${branch}/protection/required_status_checks`,
        "--jq",
        "[(.contexts // [])[], ((.checks // [])[].context)] | unique | .[]",
      ]),
    );
  } catch (error) {
    if (/HTTP 404/.test(error.message)) {
      return [];
    }

    throw error;
  }
}

/**
 * The GitHub Actions workflow runs on a commit, as `{ id, name, status }`. A
 * repo without Actions (404) has none; any other `gh` failure throws.
 * @param {(cmd: string, args: string[]) => string} run
 * @param {string} repo owner/name
 * @param {string} sha full head commit SHA
 * @returns {{ id: number, name: string, status: string }[]}
 */
export function fetchWorkflowRuns(run, repo, sha) {
  let stdout;
  try {
    stdout = run("gh", [
      "api",
      `repos/${repo}/actions/runs?head_sha=${sha}&per_page=100`,
      "--jq",
      "[.workflow_runs[] | { id, name, status }]",
    ]);
  } catch (error) {
    if (/HTTP 404/.test(error.message)) {
      return [];
    }

    throw error;
  }

  const runs = JSON.parse(stdout);
  if (
    !Array.isArray(runs) ||
    runs.some(
      (entry) =>
        !Number.isInteger(entry?.id) ||
        typeof entry.name !== "string" ||
        typeof entry.status !== "string",
    )
  ) {
    throw new Error("gh api actions/runs output is malformed");
  }

  return runs;
}

/**
 * Poll until a verdict, the slice ends, or `gh` fails more than `retries` times
 * in a row.
 * @param {{ mode: "green"|"registered", fetchPr: () => string, fetchRequired: (repo: string, base: string) => string[], fetchRuns: (repo: string, sha: string) => { id: number, name: string, status: string }[], botCheckNames: string[], intervalMs: number, maxMs: number, cancelGraceMs: number, emptyGraceMs: number, retries: number, runMs: number|null, state: { startedAt: number } }} options
 * @param {{ now: () => number, sleep: (ms: number) => Promise<void> }} deps
 */
export async function waitForChecks(options, { now, sleep }) {
  const { intervalMs, maxMs, mode, retries, runMs, state } = options;
  const sliceEnd = runMs === null ? null : now() + runMs;
  let failures = 0;
  let required = null;
  let report = null;

  for (;;) {
    let pr = null;
    let workflowRuns = [];
    try {
      const fetched = parsePrView(options.fetchPr());
      if (mode === "green") {
        required ??= options.fetchRequired(fetched.repo, fetched.baseRefName);
        workflowRuns = options.fetchRuns(fetched.repo, fetched.headRefOid);
      }

      pr = fetched;
      failures = 0;
    } catch (error) {
      failures += 1;
      if (failures > retries) {
        return { error: error.message, report, state, verdict: "error" };
      }
    }

    const elapsed = now() - state.startedAt;
    if (pr && mode === "registered") {
      report = {
        checks: pr.rollup.length,
        headRefOid: pr.headRefOid,
        pr: pr.number,
        url: pr.url,
      };
      if (pr.rollup.length > 0) {
        return { report, state, verdict: "registered" };
      }

      if (elapsed >= maxMs) {
        return { report, state, verdict: "no-checks" };
      }
    } else if (pr) {
      const classified = classifyChecks({
        botCheckNames: options.botCheckNames,
        cancelGraceMs: options.cancelGraceMs,
        nowMs: now(),
        required,
        rollup: pr.rollup,
        workflowRuns,
      });
      report = {
        ...classified,
        headRefOid: pr.headRefOid,
        pr: pr.number,
        required,
        url: pr.url,
      };
      const verdict = ciVerdict(classified);
      if (verdict === "green" || verdict === "failed") {
        return { report, state, verdict };
      }

      if (verdict === "empty" && elapsed >= options.emptyGraceMs) {
        return { report, state, verdict: "no-checks" };
      }

      if (elapsed >= maxMs) {
        return { report, state, verdict: "timeout" };
      }
    }

    if (sliceEnd !== null && now() + intervalMs > sliceEnd) {
      return { report, state, verdict: "continue" };
    }

    await sleep(intervalMs);
  }
}

/**
 * Parse argv; mode-dependent defaults are applied in `resolveSettings`.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const options = {
    cancelGraceMinutes: DEFAULT_CANCEL_GRACE_MINUTES,
    config: null,
    emptyGraceMinutes: DEFAULT_EMPTY_GRACE_MINUTES,
    intervalSeconds: null,
    maxMinutes: null,
    out: null,
    pr: null,
    registered: false,
    repo: null,
    resume: false,
    retries: DEFAULT_RETRIES,
    runMinutes: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    function value() {
      const next = argv[++index];
      if (next === undefined || next.startsWith("--")) {
        throw new Error(`${argument} requires a value`);
      }

      return next;
    }

    if (argument === "--registered") {
      options.registered = true;
    } else if (argument === "--resume") {
      options.resume = true;
    } else if (argument === "--config") {
      options.config = value();
    } else if (argument === "--out") {
      options.out = value();
    } else if (argument === "--repo") {
      options.repo = value();
      if (!/^[^/\s]+\/[^/\s]+$/.test(options.repo)) {
        throw new Error("--repo must be exactly owner/name");
      }
    } else if (argument === "--interval") {
      options.intervalSeconds = parsePositive(argument, argv[++index]);
    } else if (argument === "--max-minutes") {
      options.maxMinutes = parsePositive(argument, argv[++index]);
    } else if (argument === "--run-minutes") {
      options.runMinutes = parsePositive(argument, argv[++index]);
    } else if (argument === "--cancel-grace-minutes") {
      options.cancelGraceMinutes = parseCount(argument, argv[++index]);
    } else if (argument === "--empty-grace-minutes") {
      options.emptyGraceMinutes = parseCount(argument, argv[++index]);
    } else if (argument === "--retries") {
      options.retries = parseCount(argument, argv[++index]);
    } else if (!argument.startsWith("--") && options.pr === null) {
      options.pr = argument;
    } else if (argument.startsWith("--")) {
      throw new Error(`unknown option: ${argument}`);
    } else {
      throw new Error(`unexpected argument: ${argument}`);
    }
  }

  if (options.pr === null) {
    throw new Error("no PR number or URL given");
  }

  return options;
}

/**
 * Check names configured in `reviewBotChecks` (string or `{ name }` values).
 * @param {Record<string, unknown>} config
 */
export function botCheckNamesFrom(config) {
  const checks = config.reviewBotChecks;
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
    return [];
  }

  return Object.values(checks)
    .map((spec) => (typeof spec === "string" ? spec : spec?.name))
    .filter((name) => typeof name === "string" && name.trim() !== "");
}

function formatVerdict(verdict, report, out) {
  if (verdict === "registered" || report === null || !report.contexts) {
    const checks = report ? ` checks=${report.checks}` : "";
    return `ci=${verdict}${checks} out=${out}`;
  }

  function named(state) {
    return report.contexts
      .filter((context) => context.state === state)
      .map((context) => context.name);
  }

  const parts = [
    `ci=${verdict}`,
    `head=${report.headRefOid.slice(0, 7)}`,
    `basis=${report.basis}`,
    `pass=${named("pass").length}`,
    `pending=${named("pending").length}`,
    `fail=${named("fail").length}`,
  ];
  if (named("fail").length > 0) {
    parts.push(`failed=${JSON.stringify(named("fail").join(", "))}`);
  }

  if (named("pending").length > 0) {
    parts.push(`waiting=${JSON.stringify(named("pending").join(", "))}`);
  }

  parts.push(`out=${out}`);
  return parts.join(" ");
}

/**
 * The whole CLI minus `process.exit`, so tests can drive it end to end.
 * @param {string[]} argv
 * @param {{ now: () => number, sleep: (ms: number) => Promise<void>, run: (cmd: string, args: string[]) => string, log: (line: string) => void, error: (line: string) => void, configPath: string }} deps
 * @returns {Promise<number>} exit code
 */
export async function cli(argv, deps) {
  let options;
  let config;
  try {
    options = parseArgs(argv);
    config = loadConfig(options.config ?? deps.configPath);
  } catch (error) {
    deps.error(`wait-checks: ${error.message}`);
    return EXIT.usage;
  }

  const mode = options.registered ? "registered" : "green";
  const out =
    options.out ??
    defaultOutPath(
      options.registered ? "triage-pr-registered" : "triage-pr-checks",
      options.pr,
    );
  const statePath = statePathFor(out);
  // A stale report from an earlier wait must never be read as this wait's.
  removeFile(out);
  let state = options.resume ? readState(statePath, options.pr) : null;
  if (options.resume && state === null) {
    deps.error("wait-checks: no saved wait to resume — starting a fresh one");
  }

  state ??= { pr: options.pr, startedAt: deps.now() };

  const prArgs = ["pr", "view", options.pr];
  if (options.repo) {
    prArgs.push("--repo", options.repo);
  }

  prArgs.push("--json", "url,headRefOid,baseRefName,statusCheckRollup");
  const maxMinutes = options.maxMinutes ?? DEFAULTS[mode].maxMinutes;
  const outcome = await waitForChecks(
    {
      botCheckNames: botCheckNamesFrom(config),
      cancelGraceMs: options.cancelGraceMinutes * MINUTE,
      emptyGraceMs: options.emptyGraceMinutes * MINUTE,
      fetchPr: () => deps.run("gh", prArgs),
      fetchRequired: (repo, base) =>
        fetchRequiredContexts(deps.run, repo, base),
      fetchRuns: (repo, sha) => fetchWorkflowRuns(deps.run, repo, sha),
      intervalMs:
        (options.intervalSeconds ?? DEFAULTS[mode].intervalSeconds) * 1000,
      maxMs: maxMinutes * MINUTE,
      mode,
      retries: options.retries,
      runMs: options.runMinutes === null ? null : options.runMinutes * MINUTE,
      state,
    },
    deps,
  );

  if (outcome.verdict === "error") {
    removeFile(statePath);
    deps.error(
      `wait-checks: gh failed ${options.retries + 1} time(s) in a row — ${outcome.error}`,
    );
    return EXIT.error;
  }

  if (outcome.verdict === "continue") {
    writeJson(statePath, outcome.state);
    const elapsed = Math.round((deps.now() - outcome.state.startedAt) / MINUTE);
    deps.log(
      `wait=continue elapsed=${elapsed}m max=${maxMinutes}m — re-run the same command with --resume`,
    );
    return EXIT.continue;
  }

  removeFile(statePath);
  writeJson(out, { verdict: outcome.verdict, ...outcome.report });
  deps.log(formatVerdict(outcome.verdict, outcome.report, out));
  return EXIT[outcome.verdict];
}

// ---- self-test -----------------------------------------------------------

function checkRun(name, status, conclusion, at = "2026-10-23T10:00:00Z") {
  return {
    __typename: "CheckRun",
    completedAt: status === "COMPLETED" ? at : "0001-01-01T00:00:00Z",
    conclusion,
    name,
    startedAt: at,
    status,
    workflowName: "Validate",
  };
}

function selfTest() {
  const cases = [];
  const now = Date.parse("2026-10-23T10:01:00Z");
  function judge(required, rollup, nowMs = now) {
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

  cases.push({
    name: "every required context passing is green",
    ok:
      judge(
        ["GO/NO GO"],
        [
          checkRun("GO/NO GO", "COMPLETED", "SUCCESS"),
          checkRun("advisory", "COMPLETED", "FAILURE"),
        ],
      ) === "green",
  });
  cases.push({
    name: "a missing required context is pending, never green",
    ok:
      judge(
        ["GO/NO GO", "pr-title"],
        [checkRun("GO/NO GO", "COMPLETED", "SUCCESS")],
      ) === null,
  });
  cases.push({
    name: "a fresh cancellation waits; a stale one fails",
    ok:
      judge(["GO/NO GO"], [checkRun("GO/NO GO", "COMPLETED", "CANCELLED")]) ===
        null &&
      judge(
        ["GO/NO GO"],
        [checkRun("GO/NO GO", "COMPLETED", "CANCELLED")],
        now + 10 * MINUTE,
      ) === "failed",
  });
  cases.push({
    name: "a queued rerun keeps a cancelled context pending",
    ok:
      judge(
        ["GO/NO GO"],
        [
          checkRun("GO/NO GO", "COMPLETED", "CANCELLED"),
          checkRun("GO/NO GO", "QUEUED", null),
        ],
        now + 10 * MINUTE,
      ) === null,
  });
  const fromRun100 = {
    ...checkRun("GO/NO GO", "COMPLETED", "SUCCESS"),
    detailsUrl: "https://github.com/a/b/actions/runs/100/job/1",
  };
  cases.push({
    name: "a newer in-progress run of the same workflow keeps a pass pending",
    ok:
      ciVerdict(
        classifyChecks({
          botCheckNames: [],
          cancelGraceMs: 0,
          nowMs: now,
          required: ["GO/NO GO"],
          rollup: [fromRun100],
          workflowRuns: [{ id: 200, name: "Validate", status: "in_progress" }],
        }),
      ) === null,
  });
  cases.push({
    name: "an empty rollup with no required contexts is empty, never green",
    ok: judge([], []) === "empty",
  });

  let threw = false;
  try {
    parsePrView('{"url":"https://github.com/a/b/pull/1"}');
  } catch {
    threw = true;
  }

  cases.push({ name: "incomplete gh pr view output is rejected", ok: threw });

  let failed = 0;
  for (const { name, ok } of cases) {
    if (ok) {
      console.log(`  ok    ${name}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${name}`);
    }
  }

  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

// ---- main ----------------------------------------------------------------

const USAGE = `wait-checks — wait for a PR's required checks (triage-pr Steps 2/6, send-it cold start)

Usage:
  node wait-checks.mjs <pr> [options]

Options:
  --registered                 Cold-start mode: succeed once any check is registered
                               (defaults: --interval 10 --max-minutes 3)
  --out <file>                 Where to write the JSON report
                               (default: <tmpdir>/triage-pr-checks-<pr>.json)
  --interval <seconds>         Poll interval (default 30; 10 with --registered)
  --max-minutes <n>            Budget (default 30; 3 with --registered)
  --cancel-grace-minutes <n>   How long a cancelled run waits for a superseding run (default ${DEFAULT_CANCEL_GRACE_MINUTES})
  --empty-grace-minutes <n>    With no required contexts, how long an empty rollup waits (default ${DEFAULT_EMPTY_GRACE_MINUTES})
  --retries <n>                Consecutive gh failures tolerated (default ${DEFAULT_RETRIES})
  --run-minutes <n>            End this invocation after n minutes (exit 6)
  --resume                     Continue the wait a --run-minutes slice saved
  --config <file>              Read a different config.json (for reviewBotChecks)
  --repo <owner/name>          Set the repo explicitly
  --self-test                  Run the built-in offline fixtures
  --help, -h                   Show this message

Exit codes: 0 green/registered, 3 failed, 4 timeout, 5 no-checks, 6 slice
ended (re-run with --resume), 1 gh failure/bad data, 2 usage/config error.`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }

  if (argv.includes("--self-test")) {
    selfTest();
    return 0;
  }

  return cli(argv, {
    ...realDeps,
    configPath: defaultConfigPath(import.meta.filename),
    error: (line) => console.error(line),
    log: (line) => console.log(line),
    run: runCommand,
  });
}

// Normalise both sides through realpath (see review-threads.mjs isCliEntry).
function isCliEntry() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(import.meta.filename) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  process.exitCode = await main();
}
