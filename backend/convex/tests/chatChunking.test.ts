import { describe, expect, test } from "vitest";
import {
  buildChatChunkSpecs,
  CHUNK_OVERLAP_CHARS,
  CHUNK_TARGET_CHARS,
} from "../lib/chatChunking";
import type { Id } from "../_generated/dataModel";

const taskA = "abc123" as Id<"tasks">;
const courseA = "def456" as Id<"userCourses">;

describe("buildChatChunkSpecs", () => {
  test("returns empty for no messages", () => {
    expect(buildChatChunkSpecs([])).toEqual([]);
  });

  test("single message yields one chunk", () => {
    const specs = buildChatChunkSpecs([
      {
        role: "user",
        content: "Hello world",
        createdAt: 1000,
      },
    ]);
    expect(specs).toHaveLength(1);
    expect(specs[0]!.text).toContain("User:");
    expect(specs[0]!.text).toContain("Hello world");
    expect(specs[0]!.chunkIndex).toBe(0);
    expect(specs[0]!.startCreatedAt).toBe(1000);
  });

  test("untagged messages inherit prior task/course for chunk links", () => {
    const specs = buildChatChunkSpecs([
      {
        role: "user",
        content: "About my homework",
        createdAt: 1,
        taskId: taskA,
        courseId: courseA,
      },
      {
        role: "assistant",
        content: "Here is help.",
        createdAt: 2,
      },
      {
        role: "user",
        content: "Thanks",
        createdAt: 3,
      },
    ]);
    expect(specs.length).toBeGreaterThanOrEqual(1);
    for (const s of specs) {
      expect(s.linkedTaskIds).toEqual([taskA]);
      expect(s.linkedCourseIds).toEqual([courseA]);
    }
  });

  test("carries task and course ids from overlapping messages with same taskId", () => {
    const specs = buildChatChunkSpecs([
      {
        role: "user",
        content: "Hard assignment",
        createdAt: 1,
        taskId: taskA,
      },
      {
        role: "assistant",
        content: "I can help.",
        createdAt: 2,
        taskId: taskA,
        courseId: courseA,
      },
    ]);
    expect(specs.length).toBeGreaterThanOrEqual(1);
    const withBoth = specs.find(
      (s) => s.linkedTaskIds.includes(taskA) && s.linkedCourseIds.includes(courseA),
    );
    expect(withBoth).toBeDefined();
  });

  test("messages with different taskIds are in separate chunks", () => {
    const taskB = "xyz789" as Id<"tasks">;
    const specs = buildChatChunkSpecs([
      {
        role: "user",
        content: "About task A",
        createdAt: 1,
        taskId: taskA,
      },
      {
        role: "user",
        content: "About task B",
        createdAt: 2,
        taskId: taskB,
      },
    ]);
    // Should have at least 2 chunks since messages have different taskIds
    expect(specs.length).toBeGreaterThanOrEqual(2);
    const taskAChunks = specs.filter(s => s.linkedTaskIds.includes(taskA));
    const taskBChunks = specs.filter(s => s.linkedTaskIds.includes(taskB));
    expect(taskAChunks.length).toBeGreaterThan(0);
    expect(taskBChunks.length).toBeGreaterThan(0);
    // No chunk should contain both taskIds
    const mixedChunks = specs.filter(s =>
      s.linkedTaskIds.includes(taskA) && s.linkedTaskIds.includes(taskB)
    );
    expect(mixedChunks.length).toBe(0);
  });

  test("long thread produces multiple chunks with overlap stride", () => {
    const filler = "x".repeat(CHUNK_TARGET_CHARS);
    const specs = buildChatChunkSpecs([
      {
        role: "user",
        content: filler,
        createdAt: 1,
      },
      {
        role: "assistant",
        content: filler,
        createdAt: 2,
      },
    ]);
    expect(specs.length).toBeGreaterThanOrEqual(2);
    const stride = CHUNK_TARGET_CHARS - CHUNK_OVERLAP_CHARS;
    expect(stride).toBeGreaterThan(0);
  });

  test("chunk text does not end with truncated Assistant label (Assi, etc.)", () => {
    const longUser = "word ".repeat(120);
    const specs = buildChatChunkSpecs([
      { role: "user", content: longUser, createdAt: 1 },
      {
        role: "assistant",
        content: "You can update preferences from the Preferences page.",
        createdAt: 2,
      },
      { role: "user", content: "what are your study tips", createdAt: 3 },
    ]);
    for (const s of specs) {
      expect(s.text.trimEnd()).not.toMatch(/^.*Assi$/s);
    }
  });
});
