// Shared plumbing for the triage-pr wait scripts (`wait-checks.mjs`,
// `wait-reviews.mjs`): config loading, the resumable state file, output paths,
// and the real (non-test) dependencies the poll loops are given.
//
// The loops themselves take `{ now, sleep, run }` as injected dependencies, so
// the vitest suites drive them with a fake clock and a fake `gh` runner and
// never wait in real time. Everything here is the thin real-world side of that
// seam.

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Path of the bundle's own `config.json`, beside `scripts/`.
 * @param {string} scriptFile `import.meta.filename` of the calling script
 */
export function defaultConfigPath(scriptFile) {
  return join(dirname(scriptFile), "..", "config.json");
}

/**
 * Read a skill `config.json`. A missing file is an empty config (every value
 * falls back to its default); a malformed one throws.
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
export function loadConfig(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path} must hold a JSON object`);
  }

  return parsed;
}

/**
 * Default output file for a PR, in the OS temp directory. The PR argument may
 * be a number or a URL, so it is reduced to a filename-safe slug.
 * @param {string} prefix e.g. `triage-pr-checks`
 * @param {string} prArgument
 */
export function defaultOutPath(prefix, prArgument) {
  const slug = String(prArgument)
    .replace(/^https?:\/\/github\.com\//, "")
    .replaceAll(/[^\w.-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return join(tmpdir(), `${prefix}-${slug}.json`);
}

/**
 * The state file that carries a wait's clocks between `--run-minutes` slices.
 * @param {string} outPath
 */
export function statePathFor(outPath) {
  return `${outPath}.state.json`;
}

/**
 * Read a saved wait state for `pr`, or null when there is none (or it belongs
 * to a different PR, or is unreadable — a fresh start is the safe fallback).
 * @param {string} path
 * @param {string} pr
 */
export function readState(path, pr) {
  try {
    const state = JSON.parse(readFileSync(path, "utf8"));
    return state && state.pr === pr && Number.isFinite(state.startedAt)
      ? state
      : null;
  } catch {
    return null;
  }
}

/**
 * Write a JSON document followed by a newline.
 * @param {string} path
 * @param {unknown} value
 */
export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Remove a file if it exists.
 * @param {string} path
 */
export function removeFile(path) {
  rmSync(path, { force: true });
}

/**
 * Parse a finite, strictly positive number for `flag`; throws on anything else
 * (including `Infinity`, which would overflow a timer into a busy loop).
 * @param {string} flag
 * @param {string|undefined} value
 */
export function parsePositive(flag, value) {
  const number = Number(value);
  if (
    value === undefined ||
    value.startsWith("--") ||
    !Number.isFinite(number) ||
    number <= 0
  ) {
    throw new Error(`${flag} requires a positive number`);
  }

  return number;
}

/**
 * Parse a whole number ≥ 0 for `flag`; throws on anything else.
 * @param {string} flag
 * @param {string|undefined} value
 */
export function parseCount(flag, value) {
  const number = Number(value);
  if (
    value === undefined ||
    value.startsWith("--") ||
    !Number.isInteger(number) ||
    number < 0
  ) {
    throw new Error(`${flag} requires a whole number ≥ 0`);
  }

  return number;
}

/**
 * Run a command and return stdout. Throws on a non-zero exit, with stderr
 * folded into the message so callers can see why (`HTTP 404`, auth, …).
 * @param {string} command
 * @param {string[]} args
 */
export function runCommand(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
  } catch (error) {
    const stderr = String(error.stderr ?? "").trim();
    throw new Error(stderr || error.message);
  }
}

/**
 * The real clock and sleep for the CLI entry points.
 */
// setTimeout treats a delay above 2^31-1 ms as 1 ms; clamp so a huge interval
// can never turn the poll loop into a busy loop.
const MAX_TIMER_MS = 2_147_483_647;

export const realDeps = {
  now: () => Date.now(),
  sleep: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, Math.min(ms, MAX_TIMER_MS));
    }),
};
