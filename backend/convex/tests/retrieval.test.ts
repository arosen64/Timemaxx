import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  buildChatRetrievalQueryText,
  chunkHasMetadataOverlap,
  prioritizeRetrievedChatChunks,
} from "../lib/retrieval";

const taskA = "n7k2taskaaa" as Id<"tasks">;
const taskB = "n7k2taskbbb" as Id<"tasks">;
const courseX = "n7k2coursexx" as Id<"userCourses">;

function makeChunk(partial: {
  _id: Id<"chatChunks">;
  linkedTaskIds: Id<"tasks">[];
  linkedCourseIds: Id<"userCourses">[];
  text?: string;
}): Doc<"chatChunks"> {
  return {
    _id: partial._id,
    _creationTime: 1,
    userId: "n7k2userxxxx" as Id<"users">,
    sessionId: "sess_test",
    text: partial.text ?? "chunk text",
    chunkIndex: 0,
    startCreatedAt: 1,
    linkedTaskIds: partial.linkedTaskIds,
    linkedCourseIds: partial.linkedCourseIds,
    createdAt: 1,
  };
}

describe("buildChatRetrievalQueryText", () => {
  test("returns null when title and description are empty", () => {
    expect(
      buildChatRetrievalQueryText({
        _id: taskA,
        _creationTime: 1,
        userId: "n7k2userxxxx" as Id<"users">,
        title: "   ",
        description: "",
        taskType: "hw",
        dueDate: 1,
        createdAt: 1,
        isManualEstimate: false,
        status: "not_started",
      } as Doc<"tasks">)
    ).toBeNull();
  });

  test("builds query from title only and appends retrieval intent", () => {
    const q = buildChatRetrievalQueryText({
      _id: taskA,
      _creationTime: 1,
      userId: "n7k2userxxxx" as Id<"users">,
      title: "Midterm essay",
      description: "",
      taskType: "essay",
      dueDate: 1,
      createdAt: 1,
      isManualEstimate: false,
      status: "not_started",
    } as Doc<"tasks">);
    expect(q).not.toBeNull();
    expect(q).toContain("Midterm essay");
    expect(q).toContain("study time");
    expect(q).toContain("difficulty");
  });

  test("interleaves title, description, and intent when both present", () => {
    const q = buildChatRetrievalQueryText({
      _id: taskA,
      _creationTime: 1,
      userId: "n7k2userxxxx" as Id<"users">,
      title: "Lab 3",
      description: "Optics bench measurements.",
      taskType: "lab",
      dueDate: 1,
      createdAt: 1,
      isManualEstimate: false,
      status: "not_started",
    } as Doc<"tasks">);
    expect(q).toContain("Lab 3");
    expect(q).toContain("Optics bench");
    expect(q!.indexOf("Lab 3")).toBeLessThan(q!.indexOf("Optics bench"));
  });
});

describe("chunkHasMetadataOverlap", () => {
  const chunk = makeChunk({
    _id: "n7k2chunk001" as Id<"chatChunks">,
    linkedTaskIds: [taskA],
    linkedCourseIds: [],
  });

  test("true when current or related task id is linked", () => {
    expect(chunkHasMetadataOverlap(chunk, new Set([taskA]), new Set())).toBe(true);
    expect(chunkHasMetadataOverlap(chunk, new Set([taskB, taskA]), new Set())).toBe(true);
  });

  test("true when related course id is linked", () => {
    const c = makeChunk({
      _id: "n7k2chunk002" as Id<"chatChunks">,
      linkedTaskIds: [],
      linkedCourseIds: [courseX],
    });
    expect(chunkHasMetadataOverlap(c, new Set(), new Set([courseX]))).toBe(true);
  });

  test("false when task and course sets do not match links", () => {
    expect(chunkHasMetadataOverlap(chunk, new Set([taskB]), new Set())).toBe(false);
    const c = makeChunk({
      _id: "n7k2chunk003" as Id<"chatChunks">,
      linkedTaskIds: [],
      linkedCourseIds: [],
    });
    expect(chunkHasMetadataOverlap(c, new Set([taskA]), new Set([courseX]))).toBe(false);
  });
});

describe("prioritizeRetrievedChatChunks (RAG re-rank after vector search)", () => {
  const noLink = makeChunk({
    _id: "n7k2chunkz1" as Id<"chatChunks">,
    linkedTaskIds: [],
    linkedCourseIds: [],
    text: "dining hall hours",
  });
  const linked = makeChunk({
    _id: "n7k2chunkz2" as Id<"chatChunks">,
    linkedTaskIds: [taskA],
    linkedCourseIds: [],
    text: "midterm is 90 minutes",
  });

  test("moves metadata-overlap chunks before unrelated chunks", () => {
    const out = prioritizeRetrievedChatChunks(
      [noLink, linked],
      new Set([taskA]),
      new Set(),
      8
    );
    expect(out.map((c) => c._id)).toEqual([linked._id, noLink._id]);
  });

  test("preserves relative order within overlap and within non-overlap groups", () => {
    const a = makeChunk({
      _id: "n7k2chunka1" as Id<"chatChunks">,
      linkedTaskIds: [taskA],
      linkedCourseIds: [],
      text: "first overlap",
    });
    const b = makeChunk({
      _id: "n7k2chunka2" as Id<"chatChunks">,
      linkedTaskIds: [taskA],
      linkedCourseIds: [],
      text: "second overlap",
    });
    const x = makeChunk({
      _id: "n7k2chunkx1" as Id<"chatChunks">,
      linkedTaskIds: [],
      linkedCourseIds: [],
      text: "noise a",
    });
    const y = makeChunk({
      _id: "n7k2chunkx2" as Id<"chatChunks">,
      linkedTaskIds: [],
      linkedCourseIds: [],
      text: "noise b",
    });
    const out = prioritizeRetrievedChatChunks([a, x, b, y], new Set([taskA]), new Set(), 8);
    expect(out.map((c) => c.text)).toEqual(["first overlap", "second overlap", "noise a", "noise b"]);
  });

  test("caps total chunks returned", () => {
    const overlap = Array.from({ length: 5 }, (_, i) =>
      makeChunk({
        _id: `n7k2capo${i}` as Id<"chatChunks">,
        linkedTaskIds: [taskA],
        linkedCourseIds: [],
        text: `o${i}`,
      })
    );
    const noise = Array.from({ length: 5 }, (_, i) =>
      makeChunk({
        _id: `n7k2capn${i}` as Id<"chatChunks">,
        linkedTaskIds: [],
        linkedCourseIds: [],
        text: `n${i}`,
      })
    );
    const out = prioritizeRetrievedChatChunks([...noise, ...overlap], new Set([taskA]), new Set(), 8);
    expect(out).toHaveLength(8);
    // Overlap group first (5 items), then noise until cap (3 items).
    expect(out.slice(0, 5).every((c) => c.linkedTaskIds.includes(taskA))).toBe(true);
    expect(out.slice(5).every((c) => !c.linkedTaskIds.includes(taskA))).toBe(true);
  });

  test("course overlap counts toward first group", () => {
    const courseLinked = makeChunk({
      _id: "n7k2chunkcc" as Id<"chatChunks">,
      linkedTaskIds: [],
      linkedCourseIds: [courseX],
      text: "course chat",
    });
    const out = prioritizeRetrievedChatChunks(
      [noLink, courseLinked],
      new Set<Id<"tasks">>(),
      new Set([courseX]),
      8
    );
    expect(out.map((c) => c._id)).toEqual([courseLinked._id, noLink._id]);
  });
});
