#!/usr/bin/env node
// Carry the `<!-- pr:keep -->` region of a PR body across a regeneration
// (R-2876), so the agent never reads the current body into its context.
//
// The agent writes the newly generated body — with the template's EMPTY keep
// region — to a file. This script fetches the PR's current body itself
// (`gh pr view --json body,number`, array args, no shell), lifts every
// `<!-- pr:keep -->` … `<!-- /pr:keep -->` region out of it verbatim, splices
// them into the new body in place of the empty region, and writes the result
// for `gh pr create|edit --body-file`. stdout carries metadata only — whether a
// region was found and how many lines it holds — never the body text.
//
// Zero dependencies: Node built-ins only. The pure transforms are covered by
// `--self-test` with NO network / `gh` access.
//
// Usage:
//   node splice-body.mjs --new <file> [--out <file>] [--pr <n>] [--repo o/n] [--json]
//   node splice-body.mjs --new <file> --no-pr       # creating: nothing to carry
//   node splice-body.mjs --self-test                # offline fixtures
//   node splice-body.mjs --help                     # usage (alias: -h)

import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";

const OPEN_MARKER = "<!-- pr:keep -->";
const CLOSE_MARKER = "<!-- /pr:keep -->";

// A marker counts only when it is the whole line (surrounding whitespace
// allowed) and sits outside a fenced code block. That keeps prose or inline
// code that merely *mentions* the marker — `<!-- pr:keep -->` in a bullet —
// from opening or closing a region.
const OPEN_LINE = /^\s*<!--\s*pr:keep\s*-->\s*$/;
const CLOSE_LINE = /^\s*<!--\s*\/pr:keep\s*-->\s*$/;
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;

export class SpliceError extends Error {
  constructor(message) {
    super(message);
    this.name = "SpliceError";
  }
}

// ---- pure transforms (no network) ---------------------------------------

/**
 * Find the marker lines in a body, skipping fenced code blocks.
 * @param {string} text
 * @returns {{ end: number; kind: "close" | "open"; start: number }[]}
 *   `start`/`end` are character offsets of the marker line, newline excluded.
 */
export function scanMarkers(text) {
  /** @type {{ end: number; kind: "close" | "open"; start: number }[]} */
  const markers = [];
  /** @type {string | null} */
  let fence = null;
  let offset = 0;
  for (const line of String(text).split("\n")) {
    const start = offset;
    const end = start + line.replace(/\r$/, "").length;
    offset += line.length + 1;

    const fenceMatch = FENCE_LINE.exec(line);
    if (fence === null) {
      if (fenceMatch) {
        fence = fenceMatch[1];
      } else if (OPEN_LINE.test(line)) {
        markers.push({ end, kind: "open", start });
      } else if (CLOSE_LINE.test(line)) {
        markers.push({ end, kind: "close", start });
      }
    } else if (
      fenceMatch &&
      fenceMatch[1][0] === fence[0] &&
      fenceMatch[1].length >= fence.length &&
      line.trim() === fenceMatch[1]
    ) {
      fence = null;
    }
  }

  return markers;
}

/**
 * Count the lines strictly between a region's markers.
 * @param {string} regionText the region, markers included
 */
function countContentLines(regionText) {
  const lines = regionText.split("\n").slice(1, -1);
  return lines.length;
}

/**
 * Lift every keep region out of the current body, verbatim and in order.
 *
 * - A closing marker with no opener is ignored (counted in `strayClosers`).
 * - An opening marker inside an open region is content, not a new region.
 * - An opening marker that is never closed keeps everything from it to the
 *   end of the body — the fail-safe that preserves hand-added material rather
 *   than dropping it — and gains a closing marker (`unclosed: true`).
 * @param {string | null | undefined} body
 */
export function extractKeepRegions(body) {
  const text = String(body ?? "");
  /** @type {{ closed: boolean; empty: boolean; lines: number; text: string }[]} */
  const regions = [];
  let strayClosers = 0;
  /** @type {number | null} */
  let openStart = null;

  for (const marker of scanMarkers(text)) {
    if (openStart === null) {
      if (marker.kind === "open") {
        openStart = marker.start;
      } else {
        strayClosers += 1;
      }
    } else if (marker.kind === "close") {
      const regionText = text.slice(openStart, marker.end);
      regions.push(describeRegion(regionText, true));
      openStart = null;
    }
  }

  let unclosed = false;
  if (openStart !== null) {
    unclosed = true;
    const tail = text.slice(openStart).replace(/\s+$/, "");
    regions.push(describeRegion(`${tail}\n${CLOSE_MARKER}`, false));
  }

  return { regions, strayClosers, unclosed };
}

/**
 * @param {string} regionText
 * @param {boolean} closed
 */
function describeRegion(regionText, closed) {
  const inner = regionText.split("\n").slice(1, -1).join("\n");
  return {
    closed,
    empty: inner.trim() === "",
    lines: countContentLines(regionText),
    text: regionText,
  };
}

/**
 * Locate the single empty keep region the new body must carry as the splice
 * point. Anything else — none, more than one, an unclosed or non-empty one —
 * is refused, so a regenerated body can never silently drop a carried region.
 * @param {string} newBody
 * @returns {{ end: number; start: number }}
 */
export function findPlaceholder(newBody) {
  const text = String(newBody);
  const markers = scanMarkers(text);
  if (markers.length === 0) {
    throw new SpliceError(
      `the new body has no empty keep region — add a "${OPEN_MARKER}" line followed by a "${CLOSE_MARKER}" line where the template puts it`,
    );
  }

  if (
    markers.length !== 2 ||
    markers[0].kind !== "open" ||
    markers[1].kind !== "close"
  ) {
    throw new SpliceError(
      `the new body must hold exactly one keep region (one "${OPEN_MARKER}" line, then one "${CLOSE_MARKER}" line); found ${markers.length} marker line(s)`,
    );
  }

  const [open, close] = markers;
  if (text.slice(open.end, close.start).trim() !== "") {
    throw new SpliceError(
      "the new body's keep region must be empty — the script fills it from the current PR body",
    );
  }

  return { end: close.end, start: open.start };
}

/**
 * Splice the current body's keep regions into the new body. Empty regions in
 * the current body are not carried; when nothing non-empty remains, the new
 * body is returned unchanged with its empty region.
 * @param {string | null} currentBody null when there is no PR yet
 * @param {string} newBody
 */
export function spliceBody(currentBody, newBody) {
  const placeholder = findPlaceholder(newBody);
  const { regions, strayClosers, unclosed } =
    currentBody === null
      ? { regions: [], strayClosers: 0, unclosed: false }
      : extractKeepRegions(currentBody);
  const carried = regions.filter((region) => !region.empty);

  const body =
    carried.length === 0
      ? newBody
      : newBody.slice(0, placeholder.start) +
        carried.map((region) => region.text).join("\n\n") +
        newBody.slice(placeholder.end);

  return {
    body,
    meta: {
      carriedRegions: carried.length,
      emptyRegionsDropped: regions.length - carried.length,
      keepRegion: carried.length > 0 ? "present" : "absent",
      lines: carried.reduce((total, region) => total + region.lines, 0),
      strayClosers,
      unclosed,
    },
  };
}

// ---- CLI -----------------------------------------------------------------

const USAGE = `splice-body — carry a PR body's <!-- pr:keep --> region into a regenerated body

The agent writes the new body (with the template's EMPTY keep region) to a file;
this script fetches the PR's current body itself, splices its keep region(s) in,
and writes the result for \`gh pr create|edit --body-file\`. stdout is metadata
only — never body text.

Usage:
  node splice-body.mjs --new <file> [options]
  node splice-body.mjs --self-test     Run the offline fixtures
  node splice-body.mjs --help          Show this message (alias: -h)

Options:
  --new <file>           The newly generated body (required)
  --out <file>           Where to write the spliced body (default: overwrite --new)
  --pr <number>          The PR to read the current body from. Without it, the
                         current branch's PR is used; no PR means nothing to carry
  --no-pr                Creating a PR: skip gh, carry nothing
  --repo <owner/name>    Passed to gh as --repo
  --current-file <file>  Read the current body from a file instead of gh (offline)
  --json                 Print the metadata as JSON

Exit codes: 0 written; 1 gh or file error; 2 usage error, or a new body that does
not hold exactly one empty keep region (nothing is written).`;

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const options = {
    currentFile: null,
    help: false,
    json: false,
    newFile: null,
    noPr: false,
    out: null,
    pr: null,
    repo: null,
    selfTest: false,
  };

  /**
   * @param {number} index
   * @param {string} flag
   */
  function valueAt(index, flag) {
    const value = argv[index];
    if (!value || value.startsWith("--")) {
      throw new SpliceError(`${flag} requires a value`);
    }

    return value;
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--current-file": {
        options.currentFile = valueAt(++index, argument);
        break;
      }

      case "--help":
      case "-h": {
        options.help = true;
        break;
      }

      case "--json": {
        options.json = true;
        break;
      }

      case "--new": {
        options.newFile = valueAt(++index, argument);
        break;
      }

      case "--no-pr": {
        options.noPr = true;
        break;
      }

      case "--out": {
        options.out = valueAt(++index, argument);
        break;
      }

      case "--pr": {
        const value = valueAt(++index, argument);
        if (!/^[1-9]\d*$/.test(value)) {
          throw new SpliceError("--pr must be a positive PR number");
        }

        options.pr = value;
        break;
      }

      case "--repo": {
        const value = valueAt(++index, argument);
        if (!/^[^/\s]+\/[^/\s]+$/.test(value)) {
          throw new SpliceError("--repo must be exactly owner/name");
        }

        options.repo = value;
        break;
      }

      case "--self-test": {
        options.selfTest = true;
        break;
      }

      default: {
        throw new SpliceError(`unknown option: ${argument}`);
      }
    }
  }

  const sources = [
    options.noPr,
    options.pr !== null,
    options.currentFile !== null,
  ];
  if (sources.filter(Boolean).length > 1) {
    throw new SpliceError("pass at most one of --pr, --no-pr, --current-file");
  }

  if (!options.help && !options.selfTest && options.newFile === null) {
    throw new SpliceError("--new <file> is required");
  }

  return options;
}

/**
 * Fetch the PR's current body with gh. Returns `{ body: null }` when no PR
 * was named and the current branch has none (the create case). Any other gh
 * failure throws — a missed fetch must never look like "nothing to carry".
 * @param {{ pr: string | null; repo: string | null }} options
 * @returns {{ body: string | null; number: number | null }}
 */
function fetchCurrentBody({ pr, repo }) {
  const args = ["pr", "view"];
  if (pr !== null) {
    args.push(pr);
  }

  args.push("--json", "body,number");
  if (repo !== null) {
    args.push("--repo", repo);
  }

  let raw;
  try {
    raw = execFileSync("gh", args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = String(error?.stderr ?? "");
    if (pr === null && /no (open )?pull requests? found/i.test(stderr)) {
      return { body: null, number: null };
    }

    const reason = stderr.split("\n")[0]?.trim() || error.message;
    throw new Error(`gh pr view failed: ${reason}`, { cause: error });
  }

  const parsed = JSON.parse(raw);
  return {
    body: typeof parsed.body === "string" ? parsed.body : "",
    number: typeof parsed.number === "number" ? parsed.number : null,
  };
}

/**
 * Run the splice for parsed options. `deps` lets the self-test swap the gh
 * fetch and the filesystem for in-memory fakes.
 * @param {ReturnType<typeof parseArgs>} options
 * @param {{ fetch?: typeof fetchCurrentBody; read?: (path: string) => string; write?: (path: string, text: string) => void }} [deps]
 */
export function run(options, deps = {}) {
  const fetch = deps.fetch ?? fetchCurrentBody;
  const read = deps.read ?? ((path) => readFileSync(path, "utf8"));
  const write = deps.write ?? ((path, text) => writeFileSync(path, text));

  const newBody = read(options.newFile);

  /** @type {string | null} */
  let current = null;
  /** @type {number | null} */
  let number = options.pr === null ? null : Number(options.pr);
  let source = "none";
  if (options.currentFile !== null) {
    current = read(options.currentFile);
    source = "file";
  } else if (!options.noPr) {
    const fetched = fetch({ pr: options.pr, repo: options.repo });
    current = fetched.body;
    number = fetched.number ?? number;
    source = current === null ? "none" : "gh";
  }

  const { body, meta } = spliceBody(current, newBody);
  const out = options.out ?? options.newFile;
  write(out, body);

  return {
    ...meta,
    mode: current === null ? "create" : "update",
    out,
    pr: number,
    source,
  };
}

/**
 * Human-readable metadata lines — never any body text.
 * @param {ReturnType<typeof run>} result
 */
export function formatReport(result) {
  const lines = [
    result.keepRegion === "present"
      ? `keep region: present (${result.lines} line${result.lines === 1 ? "" : "s"}${result.carriedRegions > 1 ? `, ${result.carriedRegions} regions` : ""})`
      : "keep region: absent",
  ];
  if (result.unclosed) {
    lines.push(
      `warning: an unclosed ${OPEN_MARKER} marker — carried everything below it to the end of the old body and closed it; ask the user to review the PR body`,
    );
  }

  if (result.strayClosers > 0) {
    lines.push(
      `warning: ignored ${result.strayClosers} ${CLOSE_MARKER} marker(s) with no opener`,
    );
  }

  lines.push(
    `mode: ${result.mode}${result.pr === null ? "" : ` (PR #${result.pr})`}`,
    `wrote: ${result.out}`,
  );
  return lines.join("\n");
}

// ---- self-test -----------------------------------------------------------

/**
 * Whether a callback throws a SpliceError (a refusal, not a crash).
 * @param {() => unknown} callback
 */
function throws(callback) {
  try {
    callback();
    return false;
  } catch (error) {
    return error instanceof SpliceError;
  }
}

function selfTest() {
  /** @type {{ name: string; ok: boolean }[]} */
  const cases = [];
  function check(name, ok) {
    cases.push({ name, ok: Boolean(ok) });
  }

  const template = [
    "## Summary",
    "",
    "Mentions `<!-- pr:keep -->` inline.",
    "",
    OPEN_MARKER,
    CLOSE_MARKER,
    "",
    "## Merge Danger",
    "",
  ].join("\n");

  // Create — no current body.
  const created = spliceBody(null, template);
  check("create: body unchanged", created.body === template);
  check("create: keep region absent", created.meta.keepRegion === "absent");

  // Update with one region, carried byte for byte (CRLF, backticks, $(...)).
  const human = `${OPEN_MARKER}\r\n![shot](https://example.test/a.png)\r\nrun \`$(rm -rf /)\` — data, not a command\r\n${CLOSE_MARKER}`;
  const current = `## Summary\n\nold\n\n${human}\n\n## Merge Danger\n`;
  const updated = spliceBody(current, template);
  check("update: region carried verbatim", updated.body.includes(human));
  check(
    "update: placeholder replaced, not duplicated",
    scanMarkers(updated.body).length === 2,
  );
  check(
    "update: inline mention left alone",
    updated.body.includes("Mentions `<!-- pr:keep -->` inline."),
  );
  check("update: old prose not carried", !updated.body.includes("old"));
  check("update: present", updated.meta.keepRegion === "present");
  check("update: 2 content lines", updated.meta.lines === 2);

  // Current body with no markers, or only an empty region.
  check(
    "no markers: absent, unchanged",
    spliceBody("## Summary\n\nold\n", template).body === template,
  );
  const emptyOnly = spliceBody(
    `x\n${OPEN_MARKER}\n\n${CLOSE_MARKER}\n`,
    template,
  );
  check(
    "empty region: absent, dropped",
    emptyOnly.body === template && emptyOnly.meta.emptyRegionsDropped === 1,
  );

  // Multiple regions, carried in order and separated by a blank line.
  const multi = spliceBody(
    `${OPEN_MARKER}\none\n${CLOSE_MARKER}\nmid\n${OPEN_MARKER}\ntwo\n${CLOSE_MARKER}\n`,
    template,
  );
  check(
    "multiple: both carried in order",
    multi.body.includes(
      `${OPEN_MARKER}\none\n${CLOSE_MARKER}\n\n${OPEN_MARKER}\ntwo\n${CLOSE_MARKER}`,
    ),
  );
  check(
    "multiple: count",
    multi.meta.carriedRegions === 2 && multi.meta.lines === 2,
  );
  check("multiple: between-text dropped", !multi.body.includes("mid"));

  // Unclosed opener keeps the rest of the body and gains a closer.
  const unclosed = spliceBody(
    `top\n${OPEN_MARKER}\nkeep me\n## Merge Danger\nold tail\n\n`,
    template,
  );
  check("unclosed: flagged", unclosed.meta.unclosed);
  check(
    "unclosed: tail kept and closed",
    unclosed.body.includes(
      `${OPEN_MARKER}\nkeep me\n## Merge Danger\nold tail\n${CLOSE_MARKER}`,
    ),
  );
  check("unclosed: text above dropped", !unclosed.body.includes("top"));

  // Stray closer ignored; nested opener is content.
  const stray = spliceBody(`${CLOSE_MARKER}\nx\n`, template);
  check(
    "stray closer: ignored",
    stray.meta.strayClosers === 1 && stray.meta.keepRegion === "absent",
  );
  const nested = extractKeepRegions(
    `${OPEN_MARKER}\na\n${OPEN_MARKER}\nb\n${CLOSE_MARKER}\n`,
  );
  check(
    "nested opener: one region",
    nested.regions.length === 1 && nested.regions[0].lines === 3,
  );

  // Markers inside a fenced code block are not markers.
  const fenced = extractKeepRegions(
    `\`\`\`markdown\n${OPEN_MARKER}\nexample\n${CLOSE_MARKER}\n\`\`\`\n`,
  );
  check("fenced markers ignored", fenced.regions.length === 0);
  check(
    "placeholder found after a fenced example",
    findPlaceholder(
      `\`\`\`\n${OPEN_MARKER}\n\`\`\`\n${OPEN_MARKER}\n${CLOSE_MARKER}\n`,
    ).start > 0,
  );

  // New-body validation refuses rather than dropping a region.
  check(
    "new body: no region → refused",
    throws(() => findPlaceholder("## Summary\n")),
  );
  check(
    "new body: two regions → refused",
    throws(() =>
      findPlaceholder(`${template}\n${OPEN_MARKER}\n${CLOSE_MARKER}\n`),
    ),
  );
  check(
    "new body: unclosed → refused",
    throws(() => findPlaceholder(`${OPEN_MARKER}\n`)),
  );
  check(
    "new body: non-empty region → refused",
    throws(() => findPlaceholder(`${OPEN_MARKER}\nx\n${CLOSE_MARKER}\n`)),
  );
  check(
    "new body: reversed markers → refused",
    throws(() => findPlaceholder(`${CLOSE_MARKER}\n${OPEN_MARKER}\n`)),
  );

  // run(): fetch wiring, create fallback, out default, report has no body.
  /** @type {Map<string, string>} */
  const files = new Map([["new.md", template]]);
  const fakeFs = {
    read: (path) => {
      const text = files.get(path);
      if (text === undefined) {
        throw new Error(`no such file: ${path}`);
      }

      return text;
    },
    write: (path, text) => files.set(path, text),
  };
  const viaGh = run(
    parseArgs(["--new", "new.md", "--out", "out.md", "--pr", "7"]),
    {
      ...fakeFs,
      fetch: () => ({ body: current, number: 7 }),
    },
  );
  check(
    "run: update via gh",
    viaGh.mode === "update" &&
      viaGh.pr === 7 &&
      files.get("out.md")?.includes(human),
  );
  const report = formatReport(viaGh);
  check(
    "report: metadata only",
    report.startsWith("keep region: present (2 lines)") &&
      !report.includes("example.test") &&
      !report.includes("rm -rf"),
  );
  const noPr = run(parseArgs(["--new", "new.md"]), {
    ...fakeFs,
    fetch: () => ({ body: null, number: null }),
  });
  check(
    "run: no PR yet → create, in place",
    noPr.mode === "create" &&
      noPr.out === "new.md" &&
      files.get("new.md") === template,
  );
  let fetched = false;
  run(parseArgs(["--new", "new.md", "--no-pr", "--out", "c.md"]), {
    ...fakeFs,
    fetch: () => {
      fetched = true;
      return { body: "", number: 1 };
    },
  });
  check("run: --no-pr skips gh", !fetched);
  files.set("cur.md", current);
  const fromFile = run(
    parseArgs(["--new", "new.md", "--current-file", "cur.md", "--out", "f.md"]),
    fakeFs,
  );
  check(
    "run: --current-file",
    fromFile.source === "file" && fromFile.lines === 2,
  );

  // Argument validation.
  check(
    "args: --new required",
    throws(() => parseArgs([])),
  );
  check(
    "args: bad --pr",
    throws(() => parseArgs(["--new", "a", "--pr", "7;x"])),
  );
  check(
    "args: --pr with --no-pr",
    throws(() => parseArgs(["--new", "a", "--pr", "7", "--no-pr"])),
  );
  check(
    "args: unknown",
    throws(() => parseArgs(["--new", "a", "--nope"])),
  );

  const failed = cases.filter((testCase) => !testCase.ok);
  for (const testCase of cases) {
    console.log(`${testCase.ok ? "ok  " : "FAIL"}  ${testCase.name}`);
  }

  console.log(`\n${cases.length - failed.length}/${cases.length} passed.`);
  return failed.length === 0;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`splice-body: ${error.message}\n\n${USAGE}`);
    process.exit(2);
  }

  if (options.help) {
    console.log(USAGE);
    return;
  }

  if (options.selfTest) {
    process.exit(selfTest() ? 0 : 1);
  }

  try {
    const result = run(options);
    console.log(
      options.json ? JSON.stringify(result, null, 2) : formatReport(result),
    );
  } catch (error) {
    console.error(`splice-body: ${error.message}`);
    process.exit(error instanceof SpliceError ? 2 : 1);
  }
}

// Run main() only when invoked directly, not when imported. Compare realpaths
// so symlinks (macOS /var → /private/var, pnpm's store) don't miss.
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
  main();
}
