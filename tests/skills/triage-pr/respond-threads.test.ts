// Imports the BUNDLE script directly (the distributed `.mjs`), so the published
// triage-pr bundle stays test-free whilst the symmetric reply/resolve +
// idempotency logic is still covered in CI. The `gh` mutation layer is not
// exercised here — only the pure planning/formatting functions, which is exactly
// the surface A-410's "verifiable without spamming a real PR" criterion needs.
// Legacy and new follow-up-pending markers are kept in sync with respond-threads.mjs.
import {
  buildConsolidatedComment,
  buildDispositionPlanComment,
  buildReplyBody,
  DISPOSITION_PLAN_MARKER,
  findExistingAckComment,
  findExistingDispositionPlanComment,
  FOLLOW_UP_PENDING_MARKER,
  hasMarker,
  isReviewBotAuthor,
  normalizeDecision,
  parseArgs,
  parseReplyOnAccept,
  planThreadResponses,
  SUMMARY_MARKER,
  THREAD_MARKER,
} from "../../../skills/triage-pr/scripts/respond-threads.mjs";
import { describe, expect, it } from "vitest";

const LEGACY_DEFER_PENDING_MARKER = "<!-- triage-pr:defer-pending -->";

describe("planThreadResponses — symmetric accept/decline", () => {
  it("accepts → reply-resolve referencing the fixing sha + marker", () => {
    const [action] = planThreadResponses([
      { decision: "accept", sha: "abc1234", threadId: "T1" },
    ]);
    expect(action.kind).toBe("reply-resolve");
    expect(action.body).toContain("abc1234");
    expect(action.body).toContain(THREAD_MARKER);
  });

  it("declines → reply-resolve carrying the technical reasoning", () => {
    const [action] = planThreadResponses([
      { decision: "decline", reason: "Breaks the public API.", threadId: "T2" },
    ]);
    expect(action.kind).toBe("reply-resolve");
    expect(action.body).toContain("Breaks the public API.");
  });

  it("outdated → reply-resolve with a default one-line reply", () => {
    const [action] = planThreadResponses([
      { decision: "outdated", threadId: "T3" },
    ]);
    expect(action.kind).toBe("reply-resolve");
    expect(action.body).toMatch(/^Outdated:/);
    expect(action.body).toContain(THREAD_MARKER);
  });

  it("follow-ups → reply-resolve referencing the follow-up ticket + marker", () => {
    const [action] = planThreadResponses([
      { decision: "follow-up", reference: "A-601", threadId: "T4" },
    ]);
    expect(action.kind).toBe("reply-resolve");
    expect(action.body).toContain("A-601");
    expect(action.body).toContain("follow-up issue");
    expect(action.body).toContain(THREAD_MARKER);
  });

  it("defer alias → same as follow-up", () => {
    const [action] = planThreadResponses([
      { decision: "defer", reference: "A-601", threadId: "T4_alias" },
    ]);
    expect(action.kind).toBe("reply-resolve");
    expect(action.body).toContain("A-601");
  });
});

describe("planThreadResponses — follow-up-pending (non-resolving marker)", () => {
  it("→ reply-only carrying the non-resolving marker, not the thread-ack", () => {
    const [action] = planThreadResponses([
      { decision: "follow-up-pending", threadId: "T_dp" },
    ]);
    expect(action.kind).toBe("reply-only");
    expect(action.body).toContain(FOLLOW_UP_PENDING_MARKER);
    expect(action.body).not.toContain(THREAD_MARKER);
  });

  it("is idempotent — a thread already pending (legacy marker) is skipped", () => {
    const [action] = planThreadResponses([
      {
        comments: [
          { author: "me", body: `Noted.\n\n${LEGACY_DEFER_PENDING_MARKER}` },
        ],
        decision: "follow-up-pending",
        threadId: "T_dp_again",
      },
    ]);
    expect(action).toEqual({
      kind: "skip",
      threadId: "T_dp_again",
      why: "already-pending",
    });
  });

  it("skips a fully-handled thread (thread-ack) even for follow-up-pending", () => {
    const [action] = planThreadResponses([
      {
        comments: [{ author: "me", body: `Addressed.\n\n${THREAD_MARKER}` }],
        decision: "follow-up-pending",
        threadId: "T_dp_handled",
      },
    ]);
    expect(action).toEqual({
      kind: "skip",
      threadId: "T_dp_handled",
      why: "already-handled",
    });
  });

  it("never auto-actions a human thread with a follow-up-pending decision", () => {
    const [action] = planThreadResponses([
      { decision: "follow-up-pending", isHuman: true, threadId: "H_dp" },
    ]);
    expect(action).toEqual({ kind: "skip", threadId: "H_dp", why: "human" });
  });
});

describe("planThreadResponses — replyOnAccept knob", () => {
  it("replyOnAccept:false → accept resolves silently (no reply)", () => {
    const [action] = planThreadResponses(
      [{ decision: "accept", sha: "abc1234", threadId: "T1" }],
      { replyOnAccept: false },
    );
    expect(action.kind).toBe("resolve-only");
  });

  it("declines still reply even when replyOnAccept is false", () => {
    const [action] = planThreadResponses(
      [{ decision: "decline", reason: "Out of scope.", threadId: "T2" }],
      { replyOnAccept: false },
    );
    expect(action.kind).toBe("reply-resolve");
  });

  it("follow-ups still reply even when replyOnAccept is false", () => {
    const [action] = planThreadResponses(
      [{ decision: "follow-up", reference: "A-601", threadId: "T3" }],
      { replyOnAccept: false },
    );
    expect(action.kind).toBe("reply-resolve");
  });
});

describe("planThreadResponses — guardrails and idempotency", () => {
  it("never auto-actions a human thread", () => {
    const [action] = planThreadResponses([
      { decision: "accept", isHuman: true, sha: "abc1234", threadId: "H1" },
    ]);
    expect(action).toEqual({ kind: "skip", threadId: "H1", why: "human" });
  });

  it("never auto-actions a human thread with a follow-up decision", () => {
    const [action] = planThreadResponses([
      {
        decision: "follow-up",
        isHuman: true,
        reference: "A-602",
        threadId: "H2",
      },
    ]);
    expect(action).toEqual({ kind: "skip", threadId: "H2", why: "human" });
  });

  it("skips a thread already carrying our marker (no double-post)", () => {
    const [action] = planThreadResponses([
      {
        comments: [
          { author: "me", body: `Addressed in x.\n\n${THREAD_MARKER}` },
        ],
        decision: "accept",
        sha: "feed123",
        threadId: "T_done",
      },
    ]);
    expect(action).toEqual({
      kind: "skip",
      threadId: "T_done",
      why: "already-handled",
    });
  });

  it("acts on a thread whose only comment lacks our marker", () => {
    const [action] = planThreadResponses([
      {
        comments: [{ author: "coderabbitai", body: "nit: rename this" }],
        decision: "accept",
        sha: "feed123",
        threadId: "T_fresh",
      },
    ]);
    expect(action.kind).toBe("reply-resolve");
  });

  it("throws on an unknown decision", () => {
    expect(() =>
      planThreadResponses([{ decision: "maybe", threadId: "T?" }]),
    ).toThrow(/unknown decision/);
  });
});

describe("buildReplyBody — validation + no sycophancy", () => {
  it("requires a sha for an accept", () => {
    expect(() => buildReplyBody({ decision: "accept" })).toThrow(/sha/);
  });

  it("requires reasoning for a decline", () => {
    expect(() =>
      buildReplyBody({ decision: "decline", reason: "   " }),
    ).toThrow(/reasoning/);
  });

  it("requires a reference for a follow-up", () => {
    expect(() =>
      buildReplyBody({ decision: "follow-up", reference: "  " }),
    ).toThrow(/reference/);
  });

  it("states facts without praise", () => {
    const body = buildReplyBody({ decision: "accept", sha: "abc1234" });
    expect(body).toMatch(/^Addressed in abc1234\./);
    expect(body).not.toMatch(/great|absolutely right|excellent/i);
  });

  it("builds a follow-up-pending body with no reference and the pending marker", () => {
    const body = buildReplyBody({ decision: "follow-up-pending" });
    expect(body).toContain("Linear issue may be filed");
    expect(body).toContain("after human approval");
    expect(body).toContain(FOLLOW_UP_PENDING_MARKER);
    expect(body).not.toContain(THREAD_MARKER);
  });
});

describe("buildConsolidatedComment — issue-level acknowledgement", () => {
  const findings = [
    {
      reference: "abc1234",
      status: "accepted",
      title: "Read missing from allowed-tools",
    },
    { reference: "YAGNI", status: "declined", title: "Add a retry wrapper" },
    { reference: "A-411", status: "out-of-scope", title: "Refactor fetch" },
  ];

  it("maps each finding to its outcome + reference and carries the marker", () => {
    const body = buildConsolidatedComment(findings);
    expect(body).toContain(
      "| Read missing from allowed-tools | Accepted | `abc1234` |",
    );
    expect(body).toContain("| Add a retry wrapper | Declined | YAGNI |");
    expect(body).toContain("| Refactor fetch | Follow-up | A-411 |");
    expect(body).toContain(SUMMARY_MARKER);
  });

  it("escapes pipes so a title/reason can't break the table", () => {
    const body = buildConsolidatedComment([
      { reference: "a|b", status: "declined", title: "x|y" },
    ]);
    expect(body).toContain("| x\\|y | Declined | a\\|b |");
  });

  it("throws on an unknown status", () => {
    expect(() =>
      buildConsolidatedComment([{ status: "dunno", title: "x" }]),
    ).toThrow(/unknown finding status/);
  });

  it("throws on no findings (caller must skip the step instead)", () => {
    expect(() => buildConsolidatedComment([])).toThrow(/at least one finding/);
  });
});

describe("normalizeDecision", () => {
  it("maps legacy defer aliases to follow-up names", () => {
    expect(normalizeDecision("defer")).toBe("follow-up");
    expect(normalizeDecision("defer-pending")).toBe("follow-up-pending");
    expect(normalizeDecision("accept")).toBe("accept");
  });
});

describe("buildDispositionPlanComment — unattended Phase B plan upsert", () => {
  it("embeds the marker and plan body", () => {
    const body = buildDispositionPlanComment("1. [accept] Fix guard.");
    expect(body).toContain("### triage-pr — Phase B disposition plan");
    expect(body).toContain("1. [accept] Fix guard.");
    expect(hasMarker(body, DISPOSITION_PLAN_MARKER)).toBe(true);
  });

  it("rejects empty plan markdown", () => {
    expect(() => buildDispositionPlanComment("   ")).toThrow(
      /non-empty plan markdown/,
    );
  });
});

describe("findExistingDispositionPlanComment — upsert detection", () => {
  it("returns the marker-bearing comment so it is edited in place", () => {
    const found = findExistingDispositionPlanComment([
      { body: "noise", id: 1, user: "human" },
      { body: `plan\n${DISPOSITION_PLAN_MARKER}`, id: 3, user: "me" },
    ]);
    expect(found?.id).toBe(3);
  });

  it("returns null when no prior plan comment exists", () => {
    expect(
      findExistingDispositionPlanComment([
        { body: "lgtm", id: 1, user: "human" },
      ]),
    ).toBeNull();
  });
});

describe("findExistingAckComment — upsert detection", () => {
  it("returns the marker-bearing comment so it is edited in place", () => {
    const found = findExistingAckComment([
      { body: "lgtm", id: 1, user: "human" },
      { body: `### summary\n${SUMMARY_MARKER}`, id: 2, user: "me" },
    ]);
    expect(found?.id).toBe(2);
  });

  it("returns null when no prior summary exists", () => {
    expect(
      findExistingAckComment([{ body: "lgtm", id: 1, user: "human" }]),
    ).toBeNull();
  });

  it("does not mistake a thread reply marker for the summary", () => {
    expect(
      findExistingAckComment([{ body: THREAD_MARKER, id: 9, user: "me" }]),
    ).toBeNull();
  });
});

describe("isReviewBotAuthor — CLI human/bot guardrail", () => {
  it("matches a configured bot login", () => {
    expect(isReviewBotAuthor("coderabbitai", ["coderabbitai"])).toBe(true);
  });

  it("normalises the [bot] suffix on either side", () => {
    expect(isReviewBotAuthor("claude[bot]", ["claude"])).toBe(true);
    expect(isReviewBotAuthor("claude", ["claude[bot]"])).toBe(true);
  });

  it("rejects a human author so the thread is treated as human", () => {
    expect(isReviewBotAuthor("RobEasthope", ["claude", "coderabbitai"])).toBe(
      false,
    );
    expect(isReviewBotAuthor(undefined, ["claude"])).toBe(false);
  });
});

describe("hasMarker", () => {
  it("matches a specific marker and the any-marker form", () => {
    expect(hasMarker(`x ${THREAD_MARKER}`, THREAD_MARKER)).toBe(true);
    expect(hasMarker(`x ${SUMMARY_MARKER}`)).toBe(true);
    expect(hasMarker("plain text")).toBe(false);
  });
});

describe("arg parsing", () => {
  it("parses flags, camel-cases keys, and reads --dry-run", () => {
    const parsed = parseArgs([
      "--thread",
      "PRRT_1",
      "--reply-on-accept",
      "false",
      "--dry-run",
    ]);
    expect(parsed).toMatchObject({
      dryRun: true,
      replyOnAccept: "false",
      thread: "PRRT_1",
    });
  });

  it("throws when a flag lacks a value", () => {
    expect(() => parseArgs(["--thread"])).toThrow(/requires a value/);
  });

  it("rejects an unknown flag when given an allow-list (operator typo)", () => {
    expect(() =>
      parseArgs(["--reply-on-accep", "false"], ["replyOnAccept"]),
    ).toThrow(/unknown option/);
  });

  it("accepts an allowed flag and --dry-run with an allow-list", () => {
    expect(parseArgs(["--sha", "abc", "--dry-run"], ["sha"])).toMatchObject({
      dryRun: true,
      sha: "abc",
    });
  });

  it("parseReplyOnAccept defaults true and rejects non-booleans", () => {
    expect(parseReplyOnAccept(undefined)).toBe(true);
    expect(parseReplyOnAccept("false")).toBe(false);
    expect(() => parseReplyOnAccept("yes")).toThrow();
  });
});
