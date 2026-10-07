// Imports the BUNDLE script directly (the distributed `.mjs`), so the published
// triage-pr bundle stays test-free whilst the pure fetch/transform logic is still
// covered in CI. The `gh` network layer is not exercised here — only `buildResult`,
// which is exactly the surface that needs verifying without hitting a real PR.
// Legacy and new follow-up-pending markers are kept in sync with respond-threads.mjs.
import { FOLLOW_UP_PENDING_MARKER } from "../../../skills/triage-pr/scripts/respond-threads.mjs";
import { buildResult } from "../../../skills/triage-pr/scripts/review-threads.mjs";
import { describe, expect, it } from "vitest";

const LEGACY_DEFER_PENDING_MARKER = "<!-- triage-pr:defer-pending -->";

function ids(threads: Array<{ threadId: string }>) {
  return threads.map((thread) => thread.threadId);
}

function summaryIds(comments: Array<{ commentId: string }>) {
  return comments.map((comment) => comment.commentId);
}

// A raw GraphQL review-thread node (bot logins come back without `[bot]`).
function threadNode(
  id: string,
  {
    author = "coderabbitai",
    body = "nit",
    extraComments = [] as string[],
  } = {},
) {
  return {
    comments: {
      nodes: [
        { author: { login: author }, body },
        ...extraComments.map((text) => ({
          author: { login: "RobEasthope" },
          body: text,
        })),
      ],
    },
    id,
    isOutdated: false,
    isResolved: false,
    line: 1,
    path: "a.ts",
  };
}

describe("buildResult — botsReported / botsMissing settle helpers", () => {
  it("lists configured bots with and without sticky headlines", () => {
    const result = buildResult({
      bots: ["claude", "cursor", "coderabbitai"],
      commentNodes: [
        {
          author: { login: "claude" },
          body: "<!-- use_sticky_comment --> Summary by Claude",
          id: "IC_claude",
        },
      ],
      isDraft: false,
      number: 1,
      reviewNodes: [],
      threadNodes: [],
    });
    expect(result.botsReported).toEqual(["claude"]);
    expect(result.botsMissing).toEqual(["cursor", "coderabbitai"]);
  });

  it("does not count a bare ack (first-candidate fallback) as reported", () => {
    const result = buildResult({
      bots: ["claude", "cursor", "coderabbitai"],
      commentNodes: [
        {
          author: { login: "claude" },
          body: "On it — reviewing PR #147 now.",
          id: "IC_ack",
        },
      ],
      isDraft: false,
      number: 1,
      reviewNodes: [],
      threadNodes: [],
    });
    // Still surfaces in aiSummaryComments as the only candidate, but settle
    // helpers require a sticky marker (or a thread).
    expect(result.aiSummaryComments).toHaveLength(1);
    expect(result.botsReported).toEqual([]);
    expect(result.botsMissing).toEqual(["claude", "cursor", "coderabbitai"]);
  });

  it("counts a bot as reported when it only has an unresolved thread", () => {
    const result = buildResult({
      bots: ["claude", "cursor", "coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 1,
      reviewNodes: [],
      threadNodes: [threadNode("T_cursor_only", { author: "cursor" })],
    });
    expect(result.botsReported).toEqual(["cursor"]);
    expect(result.botsMissing).toEqual(["claude", "coderabbitai"]);
  });

  it("treats all bots as reported when each has a sticky headline", () => {
    const result = buildResult({
      bots: ["claude", "cursor"],
      commentNodes: [
        {
          author: { login: "claude" },
          body: "<!-- use_sticky_comment --> Summary by Claude",
          id: "IC_claude",
        },
      ],
      isDraft: false,
      number: 1,
      reviewNodes: [
        {
          author: { login: "cursor" },
          body: "<!-- BUGBOT_REVIEW --> Bugbot summary",
          id: "REV_cursor",
        },
      ],
      threadNodes: [],
    });
    expect(result.botsMissing).toEqual([]);
    expect(result.botsReported.toSorted()).toEqual(["claude", "cursor"]);
  });
});

describe("buildResult — deferred bucket (follow-up-pending)", () => {
  it("routes a bot thread carrying the legacy defer marker into deferredThreads", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      threadNodes: [
        threadNode("T_plain"),
        threadNode("T_deferred", {
          extraComments: [
            `Noted for follow-up.\n\n${LEGACY_DEFER_PENDING_MARKER}`,
          ],
        }),
      ],
    });

    expect(ids(result.deferredThreads)).toEqual(["T_deferred"]);
    expect(ids(result.unresolvedThreads)).toEqual(["T_plain"]);
  });

  it("routes a bot thread carrying the new follow-up-pending marker into deferredThreads", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      threadNodes: [
        threadNode("T_follow_up", {
          extraComments: [`Noted.\n\n${FOLLOW_UP_PENDING_MARKER}`],
        }),
      ],
    });

    expect(ids(result.deferredThreads)).toEqual(["T_follow_up"]);
  });

  it("keeps a plain unresolved bot thread out of the deferred bucket", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      threadNodes: [threadNode("T_plain")],
    });

    expect(result.deferredThreads).toHaveLength(0);
    expect(ids(result.unresolvedThreads)).toEqual(["T_plain"]);
  });

  it("never routes a human thread into the deferred bucket, even if marked", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      threadNodes: [
        threadNode("T_human", {
          author: "alice",
          extraComments: [`stray\n\n${LEGACY_DEFER_PENDING_MARKER}`],
        }),
      ],
    });

    expect(result.deferredThreads).toHaveLength(0);
    expect(ids(result.humanThreads)).toEqual(["T_human"]);
    expect(result.unresolvedThreads).toHaveLength(0);
  });

  it("always returns the deferredThreads array (empty when none)", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      threadNodes: [],
    });

    expect(result.deferredThreads).toEqual([]);
  });
});

describe("buildResult — review-submission summaries", () => {
  it("surfaces a bot's walkthrough review body as an AI summary", () => {
    const result = buildResult({
      bots: ["claude"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      reviewNodes: [
        {
          author: { login: "claude" },
          body: "## Walkthrough\nClaude found 2 potential issues.",
          id: "REV_summary",
          state: "COMMENTED",
        },
      ],
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["REV_summary"]);
  });

  it("keeps the first non-marker bot comment until a sticky summary arrives", () => {
    const result = buildResult({
      bots: ["claude"],
      commentNodes: [
        {
          author: { login: "claude" },
          body: "Reviewing your changes now.",
          id: "IC_ack",
        },
      ],
      isDraft: false,
      number: 7,
      reviewNodes: [],
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["IC_ack"]);
  });

  it("prefers the sticky review-body summary over an earlier non-marker issue comment", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [
        {
          author: { login: "coderabbitai" },
          body: "Reviewing your changes now.",
          id: "IC_ack",
        },
      ],
      isDraft: false,
      number: 7,
      reviewNodes: [
        {
          author: { login: "coderabbitai" },
          body: "<!-- use_sticky_comment -->\nWalkthrough summary",
          id: "REV_summary",
          state: "COMMENTED",
        },
      ],
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["REV_summary"]);
  });

  it("prefers a re-review's newer sticky summary over an earlier sticky one", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      reviewNodes: [
        {
          author: { login: "coderabbitai" },
          body: "<!-- use_sticky_comment -->\nfound 3 potential issues.",
          id: "REV_old",
          state: "COMMENTED",
        },
        {
          author: { login: "coderabbitai" },
          body: "<!-- use_sticky_comment -->\nfound 1 potential issue.",
          id: "REV_new",
          state: "COMMENTED",
        },
      ],
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["REV_new"]);
  });

  it("never treats a blank review body as a summary", () => {
    const result = buildResult({
      bots: ["claude"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      reviewNodes: [
        { author: { login: "claude" }, body: "", id: "REV_blank" },
        { author: { login: "claude" }, body: "   \n ", id: "REV_ws" },
      ],
      threadNodes: [],
    });

    expect(result.aiSummaryComments).toHaveLength(0);
  });

  it("when a bot posts both a sticky issue comment and a sticky review body, the review body wins (concatenated later)", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [
        {
          author: { login: "coderabbitai" },
          body: "<!-- use_sticky_comment -->\nWalkthrough (issue comment)",
          id: "IC_sticky",
        },
      ],
      isDraft: false,
      number: 7,
      reviewNodes: [
        {
          author: { login: "coderabbitai" },
          body: "<!-- use_sticky_comment -->\nWalkthrough (review body)",
          id: "REV_walkthrough",
          state: "COMMENTED",
        },
      ],
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["REV_walkthrough"]);
  });

  it("leaves issue-comment summaries unchanged when no reviews are present", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [
        {
          author: { login: "coderabbitai" },
          body: "<!-- use_sticky_comment -->\n## Walkthrough",
          id: "IC_sticky",
        },
      ],
      isDraft: false,
      number: 7,
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["IC_sticky"]);
  });
});

function claudeState(result: ReturnType<typeof buildResult>) {
  return result.botStatus.find(
    (status: { bot: string }) => status.bot === "claude",
  );
}

// A-2453: claude-code-action posts its tracking comment early as an in-progress
// ack and edits it in place to "**Claude finished @…'s task …**". On a clean
// review that edit is Claude's only activity, so an unmapped `claude` must settle
// on it — but only on the finished form, after ready, on the current head.
describe("buildResult — claude-code-action finished summary (unmapped claude)", () => {
  const READY = "2026-10-07T14:00:00Z";
  const COMMITTED = "2026-10-07T13:50:00Z";
  const FINISHED =
    "**Claude finished @RobEasthope's task in 5m 9s** —— [View job](https://github.com/acme/repo/actions/runs/1)\n\n---\n### Claude is working on this\n\n- [x] Gather context\n\nNo issues found.";
  const WORKING =
    'Claude Code is working… <img src="https://github.com/user-attachments/assets/spinner" width="14px" height="14px" />\n\nI\'ll analyze this and get back to you.';

  function settle(
    body: string,
    createdAt: string,
    updatedAt: string,
    headCommittedAt = COMMITTED,
  ) {
    return buildResult({
      bots: ["claude", "coderabbitai"],
      commentNodes: [
        {
          author: { __typename: "Bot", login: "claude" },
          body,
          createdAt,
          id: "IC_claude_tracking",
          updatedAt,
        },
      ],
      headCommittedAt,
      headRefOid: "head",
      isDraft: false,
      number: 1,
      readyAt: READY,
      reviewNodes: [],
      threadNodes: [],
    });
  }

  it("settles as reported on a finished 'No issues found' summary after ready", () => {
    const result = settle(
      FINISHED,
      "2026-10-07T14:01:19Z",
      "2026-10-07T14:06:28Z",
    );
    expect(claudeState(result)).toMatchObject({
      state: "reported",
      via: "activity",
    });
    expect(result.botsReported).toEqual(["claude"]);
  });

  it("counts the in-place edit (updatedAt) even when the ack was created before ready", () => {
    const result = settle(
      FINISHED,
      "2026-10-07T13:59:00Z",
      "2026-10-07T14:06:28Z",
    );
    expect(claudeState(result)?.state).toBe("reported");
  });

  it("stays missing on an in-progress 'Claude Code is working…' comment", () => {
    const result = settle(
      WORKING,
      "2026-10-07T14:01:19Z",
      "2026-10-07T14:01:19Z",
    );
    expect(claudeState(result)?.state).toBe("missing");
    expect(result.botsMissing).toContain("claude");
  });

  it("does not count a finished summary from before the ready flip", () => {
    const result = settle(
      FINISHED,
      "2026-10-07T13:40:00Z",
      "2026-10-07T13:45:00Z",
    );
    expect(claudeState(result)?.state).toBe("missing");
  });

  it("does not count a finished summary on a superseded head", () => {
    const result = settle(
      FINISHED,
      "2026-10-07T14:01:19Z",
      "2026-10-07T14:06:28Z",
      "2026-10-07T14:10:00Z",
    );
    expect(claudeState(result)?.state).toBe("missing");
  });

  it("does not count an errored run's tracking comment", () => {
    const result = settle(
      "**Claude encountered an error after 1m 2s** —— [View job](https://github.com/acme/repo/actions/runs/1)",
      "2026-10-07T14:01:19Z",
      "2026-10-07T14:02:21Z",
    );
    expect(claudeState(result)?.state).toBe("missing");
  });

  it("does not count a 'Claude finished' phrase that is not the comment header", () => {
    const result = settle(
      "Quoting the bot: **Claude finished @RobEasthope's task in 1m** — done",
      "2026-10-07T14:01:19Z",
      "2026-10-07T14:06:28Z",
    );
    expect(claudeState(result)?.state).toBe("missing");
  });
});
