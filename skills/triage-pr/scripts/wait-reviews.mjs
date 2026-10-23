#!/usr/bin/env node
// Review-bot settle wait for the triage-pr skill (SKILL.md Step 7).
//
// Polls `review-threads.mjs` until the configured review bots have settled on
// the PR's current head, then writes the last fetcher JSON to a file and prints
// a one-line verdict. It replaces the shell poll loop the agent used to write
// by hand, which broke in practice (zsh's `echo` expanded the `\n` escapes in
// CodeRabbit's summary JSON, the parse failed, and the loop reported "settled"
// on the empty result). Everything is parsed in Node here, and a fetch or parse
// failure is never evaluated: it is retried, then the script exits 1.
//
// Settled when any of (Step 7):
//   all     : every configured bot is `reported` or `skipped`;
//   idle    : at least one bot reported, no bot mapped in reviewBotChecks is
//             `pending`, and `activityFingerprint` has not changed for
//             `reviewIdleMinutes`;
//   maxwait : `reviewWaitMaxMinutes` have passed since the wait started.
//
// `reviewBots`, `reviewBotChecks`, `reviewIdleMinutes` and `reviewWaitMaxMinutes`
// come from the bundle's `config.json`; each has a flag override.
//
// Exit codes:
//   0  settled — `all` or `idle`
//   4  settled — `maxwait` (bots still missing; Step 7's slow-bot handling)
//   6  `--run-minutes` slice ended before a verdict — re-run with `--resume`
//   1  the fetcher failed or returned bad data more than `--retries` times in a row
//   2  usage or config error
//
// Usage:
//   node wait-reviews.mjs <pr>                       # wait, write JSON to the default --out
//   node wait-reviews.mjs <pr> --out /path/file.json # choose the output file
//   node wait-reviews.mjs <pr> --run-minutes 9       # cap one invocation (Cursor)
//   node wait-reviews.mjs <pr> --run-minutes 9 --resume  # continue the same wait
//   node wait-reviews.mjs --self-test                # run built-in offline fixtures

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
import { join } from "node:path";

const BOT_STATES = new Set(["missing", "pending", "reported", "skipped"]);
const DEFAULT_IDLE_MINUTES = 10;
const DEFAULT_MAX_MINUTES = 20;
const DEFAULT_INTERVAL_SECONDS = 60;
const DEFAULT_RETRIES = 2;
const MINUTE = 60_000;

export const EXIT = {
  continue: 6,
  error: 1,
  maxwait: 4,
  settled: 0,
  usage: 2,
};

/**
 * Check that a parsed fetcher result has every field the settle rule reads.
 * Throws on anything else, so bad data is never evaluated as settled.
 * @param {unknown} value
 */
export function validateFetch(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("fetcher output is not a JSON object");
  }

  for (const key of ["botStatus", "botsMissing", "botsReported"]) {
    if (!Array.isArray(value[key])) {
      throw new TypeError(`fetcher output has no ${key} array`);
    }
  }

  for (const key of ["activityFingerprint", "headRefOid"]) {
    if (typeof value[key] !== "string" || value[key] === "") {
      throw new Error(`fetcher output has no ${key}`);
    }
  }

  for (const entry of value.botStatus) {
    if (
      !entry ||
      typeof entry.bot !== "string" ||
      !BOT_STATES.has(entry.state)
    ) {
      throw new Error("fetcher output has a malformed botStatus entry");
    }
  }

  return value;
}

/**
 * Bots grouped by settle state, read from `botStatus` (the per-bot source of
 * truth) rather than the pre-grouped lists.
 * @param {{ botStatus: { bot: string, state: string }[] }} result
 */
export function groupBots(result) {
  function pick(...states) {
    return result.botStatus
      .filter((entry) => states.includes(entry.state))
      .map((entry) => entry.bot);
  }

  return {
    missing: pick("pending", "missing"),
    reported: pick("reported"),
    skipped: pick("skipped"),
  };
}

/**
 * Apply the Step 7 settle rule to one validated fetch. Pure: the caller owns
 * the clock and carries `state` between polls.
 * @param {object} result validated fetcher output
 * @param {{ startedAt: number, fingerprint: string|null, fingerprintSince: number }} state
 * @param {number} nowMs
 * @param {{ idleMs: number, maxMs: number }} limits
 * @returns {{ verdict: "all"|"idle"|"maxwait"|null, state: object }}
 */
export function evaluateSettle(result, state, nowMs, { idleMs, maxMs }) {
  const next = { ...state };
  if (result.activityFingerprint !== state.fingerprint) {
    next.fingerprint = result.activityFingerprint;
    next.fingerprintSince = nowMs;
  }

  const bots = groupBots(result);
  if (bots.missing.length === 0) {
    return { state: next, verdict: "all" };
  }

  const mappedPending = result.botStatus.some(
    (entry) => entry.via === "check" && entry.state === "pending",
  );
  if (
    bots.reported.length > 0 &&
    !mappedPending &&
    nowMs - next.fingerprintSince >= idleMs
  ) {
    return { state: next, verdict: "idle" };
  }

  if (nowMs - next.startedAt >= maxMs) {
    return { state: next, verdict: "maxwait" };
  }

  return { state: next, verdict: null };
}

/**
 * Poll the fetcher until the settle rule holds, the slice ends, or the fetcher
 * fails more than `retries` times in a row.
 * @param {{ fetch: () => string, intervalMs: number, idleMs: number, maxMs: number, retries: number, runMs: number|null, state: object }} options
 * @param {{ now: () => number, sleep: (ms: number) => Promise<void> }} deps
 * @returns {Promise<{ verdict: string, state: object, result: object|null, error?: string }>}
 */
export async function waitForReviews(options, { now, sleep }) {
  const { fetch, idleMs, intervalMs, maxMs, retries, runMs } = options;
  let { state } = options;
  const sliceEnd = runMs === null ? null : now() + runMs;
  let failures = 0;
  let last = null;

  for (;;) {
    let result = null;
    try {
      result = validateFetch(JSON.parse(fetch()));
      failures = 0;
    } catch (error) {
      failures += 1;
      if (failures > retries) {
        return {
          error: error.message,
          result: last,
          state,
          verdict: "error",
        };
      }
    }

    if (result) {
      last = result;
      const evaluated = evaluateSettle(result, state, now(), { idleMs, maxMs });
      ({ state } = evaluated);
      if (evaluated.verdict) {
        return { result, state, verdict: evaluated.verdict };
      }
    }

    if (sliceEnd !== null && now() + intervalMs > sliceEnd) {
      return { result: last, state, verdict: "continue" };
    }

    await sleep(intervalMs);
  }
}

/**
 * Parse argv. Values left `null` fall back to `config.json`, then the defaults.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const options = {
    botChecks: null,
    bots: null,
    config: null,
    idleMinutes: null,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    maxMinutes: null,
    out: null,
    pr: null,
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

    if (argument === "--resume") {
      options.resume = true;
    } else if (argument === "--bots") {
      options.bots = value();
    } else if (argument === "--bot-checks") {
      options.botChecks = value();
    } else if (argument === "--config") {
      options.config = value();
    } else if (argument === "--out") {
      options.out = value();
    } else if (argument === "--repo") {
      options.repo = value();
    } else if (argument === "--idle-minutes") {
      options.idleMinutes = parsePositive(argument, argv[++index]);
    } else if (argument === "--max-minutes") {
      options.maxMinutes = parsePositive(argument, argv[++index]);
    } else if (argument === "--interval") {
      options.intervalSeconds = parsePositive(argument, argv[++index]);
    } else if (argument === "--run-minutes") {
      options.runMinutes = parsePositive(argument, argv[++index]);
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
 * Merge flags over `config.json` into the fetcher arguments and wait limits.
 * @param {ReturnType<typeof parseArgs>} options
 * @param {Record<string, unknown>} config
 */
export function resolveSettings(options, config) {
  const bots =
    options.bots ??
    (Array.isArray(config.reviewBots) ? config.reviewBots.join(",") : null);
  const botChecks =
    options.botChecks ??
    (config.reviewBotChecks && typeof config.reviewBotChecks === "object"
      ? JSON.stringify(config.reviewBotChecks)
      : null);
  const fetcherArgs = [options.pr];
  if (bots) {
    fetcherArgs.push("--bots", bots);
  }

  if (botChecks && botChecks !== "{}") {
    fetcherArgs.push("--bot-checks", botChecks);
  }

  if (options.repo) {
    fetcherArgs.push("--repo", options.repo);
  }

  const idleMinutes =
    options.idleMinutes ??
    positiveOr(config.reviewIdleMinutes, DEFAULT_IDLE_MINUTES);
  const maxMinutes =
    options.maxMinutes ??
    positiveOr(config.reviewWaitMaxMinutes, DEFAULT_MAX_MINUTES);
  return {
    fetcherArgs,
    idleMs: idleMinutes * MINUTE,
    intervalMs: options.intervalSeconds * 1000,
    maxMs: maxMinutes * MINUTE,
    runMs: options.runMinutes === null ? null : options.runMinutes * MINUTE,
  };
}

function positiveOr(value, fallback) {
  return typeof value === "number" && value > 0 ? value : fallback;
}

function list(values) {
  return values.length > 0 ? values.join(",") : "-";
}

/**
 * The one-line verdict printed on a settle.
 * @param {string} verdict
 * @param {object} result
 * @param {string} out
 */
export function formatVerdict(verdict, result, out) {
  const bots = groupBots(result);
  return `settled=${verdict} head=${result.headRefOid.slice(0, 7)} reported=${list(bots.reported)} skipped=${list(bots.skipped)} missing=${list(bots.missing)} out=${out}`;
}

/**
 * The whole CLI minus `process.exit`, so tests can drive it end to end.
 * @param {string[]} argv
 * @param {{ now: () => number, sleep: (ms: number) => Promise<void>, run: (cmd: string, args: string[]) => string, log: (line: string) => void, error: (line: string) => void, configPath: string, fetcherPath: string }} deps
 * @returns {Promise<number>} exit code
 */
export async function cli(argv, deps) {
  let options;
  let settings;
  try {
    options = parseArgs(argv);
    settings = resolveSettings(
      options,
      loadConfig(options.config ?? deps.configPath),
    );
  } catch (error) {
    deps.error(`wait-reviews: ${error.message}`);
    return EXIT.usage;
  }

  const out = options.out ?? defaultOutPath("triage-pr-reviews", options.pr);
  const statePath = statePathFor(out);
  // A stale result from an earlier wait must never be read as this wait's.
  removeFile(out);
  let state = options.resume ? readState(statePath, options.pr) : null;
  if (options.resume && state === null) {
    deps.error("wait-reviews: no saved wait to resume — starting a fresh one");
  }

  state ??= {
    fingerprint: null,
    fingerprintSince: deps.now(),
    pr: options.pr,
    startedAt: deps.now(),
  };

  const outcome = await waitForReviews(
    {
      ...settings,
      fetch: () =>
        deps.run(process.execPath, [deps.fetcherPath, ...settings.fetcherArgs]),
      retries: options.retries,
      state,
    },
    deps,
  );

  if (outcome.verdict === "error") {
    removeFile(statePath);
    deps.error(
      `wait-reviews: review-threads failed ${options.retries + 1} time(s) in a row — ${outcome.error}`,
    );
    return EXIT.error;
  }

  if (outcome.verdict === "continue") {
    writeJson(statePath, outcome.state);
    const elapsed = Math.round((deps.now() - outcome.state.startedAt) / MINUTE);
    deps.log(
      `wait=continue elapsed=${elapsed}m max=${settings.maxMs / MINUTE}m — re-run the same command with --resume`,
    );
    return EXIT.continue;
  }

  removeFile(statePath);
  writeJson(out, outcome.result);
  deps.log(formatVerdict(outcome.verdict, outcome.result, out));
  return outcome.verdict === "maxwait" ? EXIT.maxwait : EXIT.settled;
}

// ---- self-test -----------------------------------------------------------

function fixture(states, fingerprint = "fp1") {
  return {
    activityFingerprint: fingerprint,
    botsMissing: [],
    botsReported: [],
    botStatus: states.map(([bot, state, via = "activity"]) => ({
      bot,
      state,
      via,
    })),
    headRefOid: "abcdef1234567",
  };
}

async function selfTest() {
  const cases = [];
  const limits = { idleMs: 10 * MINUTE, maxMs: 20 * MINUTE };
  const fresh = { fingerprint: null, fingerprintSince: 0, startedAt: 0 };

  cases.push({
    name: "all bots reported or skipped settles as all",
    ok:
      evaluateSettle(
        fixture([
          ["claude", "reported"],
          ["coderabbitai", "skipped"],
        ]),
        fresh,
        0,
        limits,
      ).verdict === "all",
  });

  const idle = fixture([
    ["claude", "reported"],
    ["coderabbitai", "missing"],
  ]);
  const first = evaluateSettle(idle, fresh, 0, limits);
  cases.push({
    name: "idle needs the fingerprint unchanged for the idle window",
    ok:
      first.verdict === null &&
      evaluateSettle(idle, first.state, 10 * MINUTE, limits).verdict === "idle",
  });

  const mappedPending = fixture([
    ["claude", "reported"],
    ["coderabbitai", "pending", "check"],
  ]);
  cases.push({
    name: "a pending mapped bot blocks idle",
    ok:
      evaluateSettle(
        mappedPending,
        { ...fresh, fingerprint: "fp1" },
        15 * MINUTE,
        limits,
      ).verdict === null,
  });

  cases.push({
    name: "max wait settles as maxwait",
    ok:
      evaluateSettle(
        mappedPending,
        { ...fresh, fingerprint: "fp1" },
        20 * MINUTE,
        limits,
      ).verdict === "maxwait",
  });

  let threw = false;
  try {
    validateFetch({ botStatus: [] });
  } catch {
    threw = true;
  }

  cases.push({ name: "incomplete fetcher output is rejected", ok: threw });

  let clock = 0;
  const outcome = await waitForReviews(
    {
      fetch: () => "{not json",
      idleMs: limits.idleMs,
      intervalMs: MINUTE,
      maxMs: limits.maxMs,
      retries: 2,
      runMs: null,
      state: fresh,
    },
    {
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    },
  );
  cases.push({
    name: "repeated parse failures end in error, never settled",
    ok: outcome.verdict === "error",
  });

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

const USAGE = `wait-reviews — wait for a PR's review bots to settle (triage-pr Step 7)

Usage:
  node wait-reviews.mjs <pr> [options]

Options:
  --out <file>          Where to write the final review-threads JSON
                        (default: <tmpdir>/triage-pr-reviews-<pr>.json)
  --bots <a,b>          Override config reviewBots
  --bot-checks <json>   Override config reviewBotChecks
  --idle-minutes <n>    Override config reviewIdleMinutes
  --max-minutes <n>     Override config reviewWaitMaxMinutes
  --interval <seconds>  Poll interval (default ${DEFAULT_INTERVAL_SECONDS})
  --retries <n>         Consecutive fetch failures tolerated (default ${DEFAULT_RETRIES})
  --run-minutes <n>     End this invocation after n minutes (exit 6)
  --resume              Continue the wait a --run-minutes slice saved
  --config <file>       Read a different config.json
  --repo <owner/name>   Passed through to review-threads
  --self-test           Run the built-in offline fixtures
  --help, -h            Show this message

Exit codes: 0 settled (all/idle), 4 settled (maxwait), 6 slice ended (re-run
with --resume), 1 fetch/parse failure, 2 usage/config error.`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }

  if (argv.includes("--self-test")) {
    await selfTest();
    return 0;
  }

  return cli(argv, {
    ...realDeps,
    configPath: defaultConfigPath(import.meta.filename),
    error: (line) => console.error(line),
    fetcherPath: join(import.meta.dirname, "review-threads.mjs"),
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
