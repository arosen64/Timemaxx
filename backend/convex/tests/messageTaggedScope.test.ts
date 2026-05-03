import { describe, expect, test } from "vitest";
import {
  collectUniqueTaggedIds,
  getLastUserMessage,
  shouldOfferCourseEntityMcq,
  shouldOfferTaskEntityMcq,
  walkLatestTaggedCourseId,
  walkLatestTaggedTaskId,
  type TaggedMessageView,
} from "../lib/messageTaggedScope";
import type { Id } from "../_generated/dataModel";

const taskA = "taskA" as Id<"tasks">;
const taskB = "taskB" as Id<"tasks">;
const courseA = "courseA" as Id<"userCourses">;
const courseB = "courseB" as Id<"userCourses">;

function msg(
  partial: Partial<TaggedMessageView> & {
    role: "user" | "assistant";
    content: string;
    createdAt: number;
  }
): TaggedMessageView {
  return {
    _id: ("m" + partial.createdAt) as Id<"chatMessages">,
    ...partial,
  };
}

describe("getLastUserMessage", () => {
  test("returns null for empty history", () => {
    expect(getLastUserMessage([])).toBeNull();
  });

  test("returns null when only assistant messages exist", () => {
    expect(
      getLastUserMessage([
        msg({ role: "assistant", content: "hi", createdAt: 1 }),
        msg({ role: "assistant", content: "again", createdAt: 2 }),
      ])
    ).toBeNull();
  });

  test("returns the most recent user message, even if assistants follow it", () => {
    const recent = msg({ role: "user", content: "newest", createdAt: 3 });
    const result = getLastUserMessage([
      msg({ role: "user", content: "oldest", createdAt: 1 }),
      msg({ role: "assistant", content: "ack", createdAt: 2 }),
      recent,
      msg({ role: "assistant", content: "later", createdAt: 4 }),
    ]);
    expect(result).toBe(recent);
  });
});

describe("walkLatestTaggedTaskId", () => {
  test("returns undefined when no message has a taskId", () => {
    expect(
      walkLatestTaggedTaskId([
        msg({ role: "user", content: "hi", createdAt: 1 }),
        msg({ role: "assistant", content: "yo", createdAt: 2 }),
      ])
    ).toBeUndefined();
  });

  test("returns the most recent taskId, ignoring older ones", () => {
    expect(
      walkLatestTaggedTaskId([
        msg({ role: "user", content: "first", createdAt: 1, taskId: taskA }),
        msg({ role: "assistant", content: "ack", createdAt: 2 }),
        msg({ role: "user", content: "second", createdAt: 3, taskId: taskB }),
        msg({ role: "assistant", content: "ack2", createdAt: 4 }),
      ])
    ).toBe(taskB);
  });

  test("walks past untagged messages to find a tagged one", () => {
    expect(
      walkLatestTaggedTaskId([
        msg({ role: "user", content: "tagged", createdAt: 1, taskId: taskA }),
        msg({ role: "assistant", content: "ack", createdAt: 2 }),
        msg({ role: "user", content: "untagged", createdAt: 3 }),
      ])
    ).toBe(taskA);
  });
});

describe("walkLatestTaggedCourseId", () => {
  test("returns undefined when no message has a courseId", () => {
    expect(
      walkLatestTaggedCourseId([msg({ role: "user", content: "hi", createdAt: 1 })])
    ).toBeUndefined();
  });

  test("returns the most recent courseId, ignoring older ones", () => {
    expect(
      walkLatestTaggedCourseId([
        msg({ role: "user", content: "a", createdAt: 1, courseId: courseA }),
        msg({ role: "user", content: "b", createdAt: 2, courseId: courseB }),
      ])
    ).toBe(courseB);
  });
});

describe("collectUniqueTaggedIds", () => {
  test("returns empty arrays for empty history", () => {
    expect(collectUniqueTaggedIds([])).toEqual({ taskIds: [], courseIds: [] });
  });

  test("deduplicates repeated task and course ids across messages", () => {
    const result = collectUniqueTaggedIds([
      msg({ role: "user", content: "1", createdAt: 1, taskId: taskA, courseId: courseA }),
      msg({ role: "user", content: "2", createdAt: 2, taskId: taskA }),
      msg({ role: "user", content: "3", createdAt: 3, taskId: taskB, courseId: courseA }),
      msg({ role: "user", content: "4", createdAt: 4, courseId: courseB }),
    ]);
    expect(result.taskIds.sort()).toEqual([taskA, taskB].sort());
    expect(result.courseIds.sort()).toEqual([courseA, courseB].sort());
  });

  test("ignores messages that have neither tag", () => {
    expect(
      collectUniqueTaggedIds([
        msg({ role: "user", content: "untagged", createdAt: 1 }),
        msg({ role: "assistant", content: "also untagged", createdAt: 2 }),
      ])
    ).toEqual({ taskIds: [], courseIds: [] });
  });
});

describe("shouldOfferTaskEntityMcq", () => {
  test("returns false when clarification is not needed", () => {
    expect(shouldOfferTaskEntityMcq(false, [], "anything")).toBe(false);
  });

  test("with empty message, falls back to scanning history for any task tag", () => {
    expect(shouldOfferTaskEntityMcq(true, [], "")).toBe(true);
    expect(shouldOfferTaskEntityMcq(true, [], "   ")).toBe(true);
    expect(
      shouldOfferTaskEntityMcq(
        true,
        [msg({ role: "user", content: "x", createdAt: 1, taskId: taskA })],
        ""
      )
    ).toBe(false);
  });

  test("when message matches latest user line, decides based on that line's tag", () => {
    const history = [
      msg({ role: "user", content: "old", createdAt: 1, taskId: taskA }),
      msg({ role: "assistant", content: "ack", createdAt: 2 }),
      msg({ role: "user", content: "delete it", createdAt: 3 }),
    ];
    // Latest user line ("delete it") has no tag → should offer MCQ even though
    // an older message in the window has a task tag.
    expect(shouldOfferTaskEntityMcq(true, history, "delete it")).toBe(true);
  });

  test("when latest user line has a task tag, does not offer MCQ", () => {
    const history = [msg({ role: "user", content: "delete it", createdAt: 1, taskId: taskA })];
    expect(shouldOfferTaskEntityMcq(true, history, "delete it")).toBe(false);
  });

  test("when message does not match latest user line, falls back to window scan", () => {
    const history = [
      msg({ role: "user", content: "old", createdAt: 1, taskId: taskA }),
      msg({ role: "assistant", content: "ack", createdAt: 2 }),
      msg({ role: "user", content: "different", createdAt: 3 }),
    ];
    // "new request" doesn't match any user line; fallback finds taskA in window.
    expect(shouldOfferTaskEntityMcq(true, history, "new request")).toBe(false);
  });

  test("ignores leading/trailing whitespace when matching against latest user line", () => {
    const history = [msg({ role: "user", content: "delete it", createdAt: 1 })];
    expect(shouldOfferTaskEntityMcq(true, history, "  delete it  ")).toBe(true);
  });
});

describe("shouldOfferCourseEntityMcq", () => {
  test("returns false when clarification is not needed", () => {
    expect(shouldOfferCourseEntityMcq(false, [], "anything")).toBe(false);
  });

  test("when message matches latest user line, uses its courseId", () => {
    const history = [msg({ role: "user", content: "drop it", createdAt: 1, courseId: courseA })];
    expect(shouldOfferCourseEntityMcq(true, history, "drop it")).toBe(false);
  });

  test("when latest user line has no courseId, offers MCQ regardless of older tags", () => {
    const history = [
      msg({ role: "user", content: "old", createdAt: 1, courseId: courseA }),
      msg({ role: "assistant", content: "ack", createdAt: 2 }),
      msg({ role: "user", content: "drop it", createdAt: 3 }),
    ];
    expect(shouldOfferCourseEntityMcq(true, history, "drop it")).toBe(true);
  });

  test("with empty message, falls back to window scan", () => {
    expect(
      shouldOfferCourseEntityMcq(
        true,
        [msg({ role: "user", content: "x", createdAt: 1, courseId: courseA })],
        ""
      )
    ).toBe(false);
    expect(shouldOfferCourseEntityMcq(true, [], "")).toBe(true);
  });
});
