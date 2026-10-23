import {
  cli,
  evaluateSettle,
  EXIT,
  validateFetch,
} from "../../../skills/triage-pr/scripts/wait-reviews.mjs";
// Imports the BUNDLE script directly. The poll loop and the whole CLI are driven
// with a fake fetcher runner and an injected clock/sleep, so the Step 7 settle
// rule is exercised without real time or a real PR.
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const MINUTE = 60_000;

type BotState = "missing" | "pending" | "reported" | "skipped";

function fetchResult(
  bots: Array<[string, BotState, ("activity" | "check")?]>,
  fingerprint = "fp1",
) {
  const botStatus = bots.map(([bot, state, via = "activity"]) => ({
    bot,
    evidence: "",
    state,
    via,
  }));
  return {
    activityFingerprint: fingerprint,
    aiSummaryComments: [],
    botsMissing: botStatus
      .filter((entry) => entry.state === "missing" || entry.state === "pending")
      .map((entry) => entry.bot),
    botsReported: botStatus
      .filter((entry) => entry.state === "reported")
      .map((entry) => entry.bot),
    botsSkipped: botStatus
      .filter((entry) => entry.state === "skipped")
      .map((entry) => entry.bot),
    botStatus,
    headRefOid: "abcdef1234567890",
  };
}

// A fake clock whose sleep advances time, plus a fetcher runner that replays a
// script of responses (a string is stdout; an Error is thrown).
function harness(responses: Array<Error | string>, startMs = 0) {
  let clock = startMs;
  const calls: Array<{ args: readonly string[]; cmd: string }> = [];
  const logs: string[] = [];
  const errors: string[] = [];
  let index = 0;
  return {
    calls,
    deps: {
      configPath: "/nonexistent/config.json",
      error: (line: string) => errors.push(line),
      fetcherPath: "/bundle/scripts/review-threads.mjs",
      log: (line: string) => logs.push(line),
      now: () => clock,
      run: (cmd: string, args: readonly string[]) => {
        calls.push({ args, cmd });
        const response = responses[Math.min(index, responses.length - 1)];
        index += 1;
        if (response instanceof Error) {
          throw response;
        }

        return response;
      },
      sleep: async (ms: number) => {
        clock += ms;
      },
    },
    errors,
    logs,
    minutes: () => clock / MINUTE,
  };
}

describe("evaluateSettle — the Step 7 settle rule", () => {
  const limits = { idleMs: 10 * MINUTE, maxMs: 20 * MINUTE };
  const fresh = { fingerprint: null, fingerprintSince: 0, startedAt: 0 };

  it("settles as all when every bot is reported or skipped", () => {
    const result = fetchResult([
      ["claude", "reported"],
      ["coderabbitai", "skipped", "check"],
    ]);
    expect(evaluateSettle(result, fresh, 0, limits).verdict).toBe("all");
  });

  it("settles as idle once the fingerprint is unchanged for the idle window", () => {
    const result = fetchResult([
      ["claude", "reported"],
      ["coderabbitai", "missing"],
    ]);
    const first = evaluateSettle(result, fresh, 0, limits);
    expect(first.verdict).toBeNull();
    expect(
      evaluateSettle(result, first.state, 9 * MINUTE, limits).verdict,
    ).toBeNull();
    expect(
      evaluateSettle(result, first.state, 10 * MINUTE, limits).verdict,
    ).toBe("idle");
  });

  it("restarts the idle clock when the fingerprint changes", () => {
    const before = fetchResult(
      [
        ["claude", "reported"],
        ["coderabbitai", "missing"],
      ],
      "fp1",
    );
    const after = fetchResult(
      [
        ["claude", "reported"],
        ["coderabbitai", "missing"],
      ],
      "fp2",
    );
    const first = evaluateSettle(before, fresh, 0, limits);
    const changed = evaluateSettle(after, first.state, 8 * MINUTE, limits);
    expect(changed.state.fingerprintSince).toBe(8 * MINUTE);
    expect(
      evaluateSettle(after, changed.state, 12 * MINUTE, limits).verdict,
    ).toBeNull();
  });

  it("never settles as idle while a mapped bot's check is pending", () => {
    const result = fetchResult([
      ["claude", "reported"],
      ["coderabbitai", "pending", "check"],
    ]);
    const state = { ...fresh, fingerprint: "fp1" };
    expect(
      evaluateSettle(result, state, 15 * MINUTE, limits).verdict,
    ).toBeNull();
    expect(evaluateSettle(result, state, 20 * MINUTE, limits).verdict).toBe(
      "maxwait",
    );
  });

  it("never settles as idle when no bot has reported", () => {
    const result = fetchResult([["claude", "missing"]]);
    const state = { ...fresh, fingerprint: "fp1" };
    expect(
      evaluateSettle(result, state, 15 * MINUTE, limits).verdict,
    ).toBeNull();
  });
});

describe("validateFetch", () => {
  it("accepts a complete fetcher result", () => {
    const result = fetchResult([["claude", "reported"]]);
    expect(validateFetch(result)).toBe(result);
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["no botStatus", { ...fetchResult([]), botStatus: undefined }],
    ["no fingerprint", { ...fetchResult([]), activityFingerprint: "" }],
    ["no head", { ...fetchResult([]), headRefOid: undefined }],
    [
      "a malformed bot entry",
      { ...fetchResult([]), botStatus: [{ bot: "claude", state: "done" }] },
    ],
  ])("rejects %s", (_label, value) => {
    expect(() => validateFetch(value)).toThrow();
  });
});

describe("cli", () => {
  let directory: string;
  let out: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "wait-reviews-"));
    out = join(directory, "reviews.json");
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("parses a payload full of escaped newlines and settles correctly", async () => {
    // The cadogan PR #34 failure: CodeRabbit's summary JSON is full of `\n`
    // escapes, which zsh's echo expanded into raw control characters.
    const result = {
      ...fetchResult([
        ["claude", "reported"],
        ["coderabbitai", "reported", "check"],
      ]),
      aiSummaryComments: [
        {
          author: "coderabbitai",
          body: "## Walkthrough\n\n| File | Change |\n|---|---|\n| `a.ts` | \\n literal and \t tab |\n",
        },
      ],
    };
    const { deps, logs } = harness([JSON.stringify(result, null, 2)]);
    const code = await cli(["7", "--out", out], deps);
    expect(code).toBe(EXIT.settled);
    expect(logs[0]).toMatch(
      /^settled=all head=abcdef1 reported=claude,coderabbitai/,
    );
    expect(JSON.parse(readFileSync(out, "utf8"))).toEqual(result);
  });

  it("passes the config's bots and bot checks to the fetcher", async () => {
    const { calls, deps } = harness([
      JSON.stringify(fetchResult([["claude", "reported"]])),
    ]);
    const config = join(directory, "config.json");
    writeFileSync(
      config,
      JSON.stringify({
        reviewBotChecks: { coderabbitai: "CodeRabbit" },
        reviewBots: ["claude", "coderabbitai"],
      }),
    );
    await cli(["7", "--out", out, "--config", config], deps);
    expect(calls[0].cmd).toBe(process.execPath);
    expect(calls[0].args).toEqual([
      "/bundle/scripts/review-threads.mjs",
      "7",
      "--bots",
      "claude,coderabbitai",
      "--bot-checks",
      '{"coderabbitai":"CodeRabbit"}',
    ]);
  });

  it("exits 1 and never reports settled when the fetch keeps failing", async () => {
    const { deps, errors, logs } = harness([new Error("HTTP 502")]);
    const code = await cli(["7", "--out", out], deps);
    expect(code).toBe(EXIT.error);
    expect(logs).toEqual([]);
    expect(errors[0]).toMatch(/failed 3 time\(s\) in a row — HTTP 502/);
    expect(existsSync(out)).toBe(false);
  });

  it("exits 1 on truncated JSON, never settled", async () => {
    const { deps, logs } = harness(['{"botStatus": [']);
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT.error);
    expect(logs).toEqual([]);
  });

  it("rides out a transient failure within the retry budget", async () => {
    const { deps } = harness([
      new Error("HTTP 502"),
      JSON.stringify(fetchResult([["claude", "reported"]])),
    ]);
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT.settled);
  });

  it("reports maxwait with exit 4 and still writes the JSON", async () => {
    const { deps, logs, minutes } = harness([
      JSON.stringify(
        fetchResult([
          ["claude", "reported"],
          ["coderabbitai", "pending", "check"],
        ]),
      ),
    ]);
    const code = await cli(["7", "--out", out, "--max-minutes", "20"], deps);
    expect(code).toBe(EXIT.maxwait);
    expect(minutes()).toBe(20);
    expect(logs[0]).toMatch(/^settled=maxwait .*missing=coderabbitai/);
    expect(existsSync(out)).toBe(true);
  });

  it("removes a stale output file before waiting", async () => {
    writeFileSync(out, '{"stale": true}');
    const { deps } = harness([new Error("down")]);
    await cli(["7", "--out", out], deps);
    expect(existsSync(out)).toBe(false);
  });

  it("carries the max-wait clock across --run-minutes slices with --resume", async () => {
    const pending = JSON.stringify(
      fetchResult([
        ["claude", "reported"],
        ["coderabbitai", "pending", "check"],
      ]),
    );
    const slice = ["7", "--out", out, "--run-minutes", "9"];
    const first = harness([pending]);
    expect(await cli(slice, first.deps)).toBe(EXIT.continue);
    expect(first.logs[0]).toMatch(/^wait=continue .*--resume/);
    expect(existsSync(`${out}.state.json`)).toBe(true);

    // Each slice is a new process, but wall-clock time carries on.
    const second = harness([pending], first.minutes() * MINUTE);
    expect(await cli([...slice, "--resume"], second.deps)).toBe(EXIT.continue);

    const third = harness([pending], second.minutes() * MINUTE);
    expect(await cli([...slice, "--resume"], third.deps)).toBe(EXIT.maxwait);
    expect(third.minutes()).toBe(20);
    expect(existsSync(`${out}.state.json`)).toBe(false);
  });

  it("starts a fresh wait without --resume, ignoring saved state", async () => {
    writeFileSync(
      `${out}.state.json`,
      JSON.stringify({ pr: "7", startedAt: -60 * MINUTE }),
    );
    const { deps, minutes } = harness([
      JSON.stringify(fetchResult([["claude", "pending", "check"]])),
    ]);
    expect(await cli(["7", "--out", out], deps)).toBe(EXIT.maxwait);
    expect(minutes()).toBe(20);
  });

  it("exits 2 on a usage error", async () => {
    const { deps } = harness([]);
    expect(await cli([], deps)).toBe(EXIT.usage);
    expect(await cli(["7", "--interval", "0"], deps)).toBe(EXIT.usage);
    expect(await cli(["7", "--interval", "Infinity"], deps)).toBe(EXIT.usage);
    expect(await cli(["7", "--max-minutes", "NaN"], deps)).toBe(EXIT.usage);
  });
});
