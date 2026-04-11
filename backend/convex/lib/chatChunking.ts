import type { Doc, Id } from "../_generated/dataModel";

/** Tunable window over the concatenated transcript (chars). */
export const CHUNK_TARGET_CHARS = 1200;
/** ~15% overlap so boundaries do not split semantic units awkwardly. */
export const CHUNK_OVERLAP_CHARS = 180;

export const MAX_MESSAGES_PER_REBUILD = 200;
export const MAX_TRANSCRIPT_CHARS = 100_000;

export type ChatMessageForChunking = Pick<
  Doc<"chatMessages">,
  | "role"
  | "content"
  | "createdAt"
  | "taskId"
  | "courseId"
  | "clarificationIntent"
>;

export interface ChatChunkSpec {
  text: string;
  chunkIndex: number;
  startCreatedAt: number;
  linkedTaskIds: Id<"tasks">[];
  linkedCourseIds: Id<"userCourses">[];
  clarificationIntent?: "task_feedback" | "class_difficulty" | "none";
}

function lineForMessage(m: ChatMessageForChunking): string {
  const prefix = m.role === "user" ? "User" : "Assistant";
  return `${prefix}: ${m.content}\n\n`;
}

function estimateTranscriptLength(messages: ChatMessageForChunking[]): number {
  let n = 0;
  for (const m of messages) {
    n += lineForMessage(m).length;
  }
  return n;
}

/**
 * Keep the most recent tail of the thread, capped by message count and total size.
 */
export function selectMessagesForChunking(
  messages: ChatMessageForChunking[],
): ChatMessageForChunking[] {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  let slice = sorted.slice(-MAX_MESSAGES_PER_REBUILD);
  while (
    slice.length > 1 &&
    estimateTranscriptLength(slice) > MAX_TRANSCRIPT_CHARS
  ) {
    slice = slice.slice(1);
  }
  return slice;
}

type Span = {
  start: number;
  end: number;
  message: ChatMessageForChunking;
};

function buildTranscript(messages: ChatMessageForChunking[]): {
  transcript: string;
  spans: Span[];
} {
  let transcript = "";
  const spans: Span[] = [];
  for (const m of messages) {
    const start = transcript.length;
    transcript += lineForMessage(m);
    spans.push({ start, end: transcript.length, message: m });
  }
  return { transcript, spans };
}

function spansOverlappingRange(
  spans: Span[],
  rangeStart: number,
  rangeEnd: number,
): Span[] {
  return spans.filter(
    (s) => rangeStart < s.end && rangeEnd > s.start,
  );
}

function mergeIntent(
  messages: ChatMessageForChunking[],
): ChatChunkSpec["clarificationIntent"] {
  let sawNone = false;
  for (const m of messages) {
    const t = m.clarificationIntent;
    if (t === "task_feedback") return "task_feedback";
    if (t === "class_difficulty") return "class_difficulty";
    if (t === "none") sawNone = true;
  }
  if (sawNone) return "none";
  return undefined;
}

function linkedTaskIdsFrom(messages: ChatMessageForChunking[]): Id<"tasks">[] {
  const set = new Set<Id<"tasks">>();
  for (const m of messages) {
    if (m.taskId !== undefined) set.add(m.taskId);
  }
  return [...set];
}

function linkedCourseIdsFrom(messages: ChatMessageForChunking[]): Id<"userCourses">[] {
  const set = new Set<Id<"userCourses">>();
  for (const m of messages) {
    if (m.courseId !== undefined) set.add(m.courseId);
  }
  return [...set];
}

/**
 * Sliding-window chunks over the transcript with overlap. Metadata is derived
 * from all messages that overlap each window.
 */
export function buildChatChunkSpecs(
  messages: ChatMessageForChunking[],
): ChatChunkSpec[] {
  const selected = selectMessagesForChunking(messages);
  if (selected.length === 0) return [];

  const { transcript, spans } = buildTranscript(selected);
  if (transcript.trim().length === 0) return [];

  const stride = CHUNK_TARGET_CHARS - CHUNK_OVERLAP_CHARS;
  const specs: ChatChunkSpec[] = [];
  let chunkIndex = 0;

  for (let start = 0; start < transcript.length; start += stride) {
    const end = Math.min(start + CHUNK_TARGET_CHARS, transcript.length);
    const text = transcript.slice(start, end).trim();
    if (text.length === 0) {
      if (end >= transcript.length) break;
      continue;
    }

    const overlapping = spansOverlappingRange(spans, start, end);
    if (overlapping.length === 0) {
      if (end >= transcript.length) break;
      continue;
    }

    const msgs = overlapping.map((s) => s.message);
    const startCreatedAt = Math.min(...msgs.map((m) => m.createdAt));

    specs.push({
      text,
      chunkIndex,
      startCreatedAt,
      linkedTaskIds: linkedTaskIdsFrom(msgs),
      linkedCourseIds: linkedCourseIdsFrom(msgs),
      clarificationIntent: mergeIntent(msgs),
    });
    chunkIndex += 1;

    if (end >= transcript.length) break;
  }

  return specs;
}
