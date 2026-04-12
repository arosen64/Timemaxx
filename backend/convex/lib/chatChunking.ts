import type { Doc, Id } from "../_generated/dataModel";

/** Tunable window over the concatenated transcript (chars). */
export const CHUNK_TARGET_CHARS = 500;
/** ~15% overlap so boundaries do not split semantic units awkwardly. */
export const CHUNK_OVERLAP_CHARS = 75;

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

/** Do not emit chunks shorter than this after boundary snapping (unless it's the tail). */
const MIN_CHUNK_CHARS = 100;
/** Max how far we move `end` backward to land on a space / newline. */
const END_SNAP_LOOKBACK = 140;

/**
 * Move `end` backward so we do not end mid-word (prefer breaks after `\n\n`, `\n`, or spaces).
 */
function snapEndBackward(
  transcript: string,
  start: number,
  desiredEnd: number,
): number {
  const len = transcript.length;
  let end = Math.min(desiredEnd, len);
  const minEnd = start + MIN_CHUNK_CHARS;
  if (end >= len) {
    return len;
  }
  if (end <= minEnd) {
    return end;
  }

  const from = Math.max(start + MIN_CHUNK_CHARS, end - END_SNAP_LOOKBACK);

  for (let i = end - 1; i >= from; i--) {
    if (transcript[i] === "\n" && i > 0 && transcript[i - 1] === "\n") {
      return i + 1;
    }
  }
  for (let i = end - 1; i >= from; i--) {
    if (transcript[i] === "\n") {
      return i + 1;
    }
  }
  for (let i = end - 1; i >= from; i--) {
    if (/\s/.test(transcript[i]!)) {
      return i + 1;
    }
  }

  return end;
}

/**
 * After subtracting overlap, `start` can land inside a word. Skip to the next
 * clean boundary so chunks do not begin with fragments like `stant`.
 */
function snapStartForward(transcript: string, rawStart: number): number {
  if (rawStart <= 0) {
    return 0;
  }
  if (rawStart >= transcript.length) {
    return transcript.length;
  }
  if (/\s/.test(transcript[rawStart - 1]!)) {
    return rawStart;
  }
  let s = rawStart;
  while (s < transcript.length && !/\s/.test(transcript[s]!)) {
    s += 1;
  }
  while (s < transcript.length && /\s/.test(transcript[s]!)) {
    s += 1;
  }
  return s;
}

/**
 * Sliding-window chunks over the transcript with overlap. Metadata is derived
 * from all messages that overlap each window.
 *
 * Chunk ends are snapped to whitespace / newlines so words and role labels
 * like `Assistant:` are not cut in half. The next window starts at
 * `end - overlap` so there are no gaps when `end` moves backward.
 */
export function buildChatChunkSpecs(
  messages: ChatMessageForChunking[],
): ChatChunkSpec[] {
  const selected = selectMessagesForChunking(messages);
  if (selected.length === 0) return [];

  const { transcript, spans } = buildTranscript(selected);
  if (transcript.trim().length === 0) return [];

  const specs: ChatChunkSpec[] = [];
  let chunkIndex = 0;
  let start = 0;

  while (start < transcript.length) {
    start = snapStartForward(transcript, start);
    if (start >= transcript.length) {
      break;
    }

    const rawEnd = Math.min(start + CHUNK_TARGET_CHARS, transcript.length);
    const end = snapEndBackward(transcript, start, rawEnd);
    const text = transcript.slice(start, end).trim();
    if (text.length === 0) {
      if (end >= transcript.length) {
        break;
      }
      start = Math.max(0, end - CHUNK_OVERLAP_CHARS);
      continue;
    }

    const overlapping = spansOverlappingRange(spans, start, end);
    if (overlapping.length === 0) {
      if (end >= transcript.length) {
        break;
      }
      start = Math.max(0, end - CHUNK_OVERLAP_CHARS);
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

    if (end >= transcript.length) {
      break;
    }
    start = Math.max(0, end - CHUNK_OVERLAP_CHARS);
  }

  return specs;
}
