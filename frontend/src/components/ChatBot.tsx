import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { api } from "../../../backend/convex/_generated/api";
import type { ActiveAgent } from "../../../shared/chatEnums";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "./prompt-kit/chat-container";
import { Message, MessageAvatar, MessageContent } from "./prompt-kit/message";
import { PromptInput, PromptInputTextarea, PromptInputActions } from "./prompt-kit/prompt-input";
import { ScrollButton } from "./prompt-kit/scroll-button";
import { Loader } from "./prompt-kit/loader";
import { MessageSquareIcon, XIcon } from "./icons";
import Button from "./ui/Button";
import { useIsMobile } from "../hooks/useIsMobile";
import { useResizable } from "../hooks/useResizable";

const MAIN_MENU = [
  { label: "Give feedback on a task", route: "feedback" },
  { label: "Schedule something", route: "schedule" },
  { label: "Task help (create / edit / view)", route: "tasks" },
  { label: "Class questions", route: "classes" },
  { label: "Change preferences", route: "preferences" },
] as const;

const ACTIVE_AGENT_LABELS: Record<ActiveAgent, string> = {
  task: "Task agent",
  feedback: "Feedback agent",
  preferences: "Preferences agent",
  classes: "Classes agent",
  schedule: "Schedule agent",
};

type EntityCandidate = { id: string; label: string; subtitle: string };

type ChatApiResponse = {
  text?: string;
  status?: string;
  entityCandidates?: EntityCandidate[];
  entityHasMore?: boolean;
  phase?: "task" | "class" | "block";
};

function dedupeEntityCandidates(candidates: EntityCandidate[]): EntityCandidate[] {
  const seen = new Set<string>();
  const unique: EntityCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    unique.push(candidate);
  }
  return unique;
}

/** Assistant copy that introduces the task/class MCQ (must stay in sync with http_chat strings). */
function isMcqIntroAssistantContent(content: string): boolean {
  return (
    content.includes("Which task do you mean") ||
    content.includes("Which class do you mean") ||
    content.includes("Pick one below") ||
    content.includes("see more options") ||
    content.includes("tap one of the tasks") ||
    content.includes("tap one of the classes") ||
    content.includes("Pick a task") ||
    content.includes("Pick a class")
  );
}

function findLastMcqIntroAssistantIndex(
  msgs: ReadonlyArray<{ role: string; content: string }>
): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === "assistant" && isMcqIntroAssistantContent(m.content)) {
      return i;
    }
  }
  return -1;
}

/** Renders `**like this**` as bold (common in assistant copy; plain text otherwise). */
function renderInlineBoldMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const { containerRef, size: chatSize, startResize, reset: resetSize } = useResizable();
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [optimistic, setOptimistic] = useState<{ role: "user" | "assistant"; content: string }[]>(
    []
  );
  const [historyLenAtSend, setHistoryLenAtSend] = useState(0);
  const [entityMcq, setEntityMcq] = useState<{
    phase: "task" | "class" | "block";
    candidates: EntityCandidate[];
    hasMore: boolean;
  } | null>(null);
  /** Insert MCQ right after this message index (the MCQ intro assistant line). */
  const [entityBlockAfterIndex, setEntityBlockAfterIndex] = useState<number | null>(null);

  const token = useAuthToken();
  const history = useQuery(api.queries.chatMessages.getChatHistory, { sessionId, limit: 50 }) ?? [];
  const entityScope =
    useQuery(api.queries.chatSessions.getChatSessionEntityScope, isOpen ? { sessionId } : "skip") ??
    null;

  // Show optimistic[i] only while history hasn't committed that index yet.
  // Using a cursor (history length at send time) instead of content comparison
  // avoids false deduplication when the user sends identical messages back-to-back.
  const pendingMessages = isLoading
    ? optimistic.slice(Math.max(0, history.length - historyLenAtSend))
    : [];
  const messages = [...history, ...pendingMessages];

  const showSuggestions = messages.length === 0 && !isLoading;
  const chatLocked = entityScope?.chatInputLocked === true;

  const shouldShowEntityBlock = entityMcq !== null && entityMcq.candidates.length > 0;

  useEffect(() => {
    if (!shouldShowEntityBlock || entityBlockAfterIndex !== null) return;
    const idx = findLastMcqIntroAssistantIndex(messages);
    if (idx >= 0) {
      setEntityBlockAfterIndex(idx);
    }
    // `messages` is intentionally omitted: deps track when history grows so we re-scan for the MCQ intro line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShowEntityBlock, entityBlockAfterIndex, history.length, optimistic.length]);

  function applyEntityResponse(data: ChatApiResponse, userEcho: string | null) {
    const aiText = data.text ?? "";
    if (data.status === "entity_scope_locked" || data.status === "chat_input_locked") {
      setEntityBlockAfterIndex(null);
    }
    const uniqueCandidates = data.entityCandidates
      ? dedupeEntityCandidates(data.entityCandidates)
      : [];
    if (uniqueCandidates.length > 0 && data.phase) {
      setEntityBlockAfterIndex(null);
      setEntityMcq({
        phase: data.phase,
        candidates: uniqueCandidates,
        hasMore: data.entityHasMore ?? false,
      });
    } else {
      setEntityMcq(null);
      setEntityBlockAfterIndex(null);
    }
    if (userEcho !== null) {
      setOptimistic([
        { role: "user", content: userEcho },
        { role: "assistant", content: aiText },
      ]);
    } else {
      // MCQ actions persist via Convex; avoid double-rendering with optimistic rows
      setOptimistic([]);
    }
  }

  async function postChat(body: Record<string, unknown>, userEcho: string | null) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(`${import.meta.env.VITE_CONVEX_SITE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...body, timezone }),
    });
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error("Maxx has hit the AI rate limit — please wait a moment and try again.");
      }
      const errText = await res.text().catch(() => "(no body)");
      throw new Error(`Chat request failed: ${res.status} ${errText}`);
    }
    const data = (await res.json()) as ChatApiResponse;
    applyEntityResponse(data, userEcho);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading || chatLocked) return;

    setInput("");
    setIsLoading(true);
    setEntityMcq(null);
    setEntityBlockAfterIndex(null);
    setHistoryLenAtSend(history.length);
    setOptimistic([{ role: "user", content: text }]);

    try {
      await postChat({ message: text, sessionId }, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ChatBot] error:", msg);
      setOptimistic((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePickEntity(phase: "task" | "class" | "block", id: string) {
    if (isLoading || chatLocked || !entityMcq) return;
    setIsLoading(true);
    try {
      if (phase === "task") {
        await postChat({ sessionId, entity: { action: "pick_task", taskId: id } }, null);
      } else if (phase === "block") {
        await postChat({ sessionId, entity: { action: "pick_block", blockId: id } }, null);
      } else {
        await postChat({ sessionId, entity: { action: "pick_course", courseId: id } }, null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOptimistic((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOtherEntity() {
    if (!entityMcq || isLoading || chatLocked || !entityMcq.hasMore) return;
    const ids = entityMcq.candidates.map((c) => c.id);
    setIsLoading(true);
    try {
      if (entityMcq.phase === "task") {
        await postChat({ sessionId, entity: { action: "other_tasks", excludeTaskIds: ids } }, null);
      } else {
        await postChat(
          { sessionId, entity: { action: "other_courses", excludeCourseIds: ids } },
          null
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOptimistic((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMenuPick(route: string, label: string) {
    if (isLoading || chatLocked) return;
    setIsLoading(true);
    setEntityMcq(null);
    setEntityBlockAfterIndex(null);
    setHistoryLenAtSend(history.length);
    setOptimistic([{ role: "user", content: label }]);
    try {
      await postChat({ sessionId, entity: { action: "menu_pick", route } }, label);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOptimistic((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  function renderEntityMcqBlock() {
    if (!shouldShowEntityBlock || !entityMcq) return null;
    return (
      <div className="p-3 space-y-2 bg-white border rounded-xl border-border">
        <p className="text-[11px] font-heading font-semibold text-navy">
          {entityMcq.phase === "task"
            ? "Pick a task"
            : entityMcq.phase === "block"
              ? "Pick a block"
              : "Pick a class"}
        </p>
        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {entityMcq.candidates.map((c, index) => (
            <button
              key={`${c.id}-${index}`}
              type="button"
              onClick={() => void handlePickEntity(entityMcq.phase, c.id)}
              disabled={isLoading}
              className="text-left rounded-lg border border-border px-2.5 py-2.5 md:py-2 text-[13px] md:text-[12px] hover:bg-bg-gray active:bg-bg-gray transition disabled:opacity-50"
            >
              <span className="block font-medium text-navy">{c.label}</span>
              <span className="text-light-blue text-[11px]">{c.subtitle}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void handleOtherEntity()}
          disabled={isLoading || !entityMcq.hasMore}
          title={entityMcq.hasMore ? "Show more options" : "No more matches for this search"}
          className={
            entityMcq.hasMore
              ? "w-full rounded-lg border border-dashed border-teal/50 py-2 text-[12px] font-medium text-teal hover:bg-teal/5 transition disabled:opacity-50"
              : "w-full rounded-lg border border-dashed border-border py-2 text-[12px] font-medium text-light-blue cursor-not-allowed opacity-70"
          }
        >
          Other…
        </button>
      </div>
    );
  }

  return (
    <div className="fixed z-50 flex flex-col items-end gap-3 bottom-6 right-6">
      {/* Overlay */}
      {isOpen && (
        <div
          ref={containerRef}
          className={`fixed inset-0 z-40 flex flex-col overflow-hidden bg-white md:static md:inset-auto md:z-auto md:rounded-2xl md:border md:border-border md:shadow-xl md:relative md:min-w-64 md:min-h-64${chatSize ? "" : " md:w-[400px] md:h-[600px]"}`}
          style={
            chatSize && !isMobile ? { width: chatSize.width, height: chatSize.height } : undefined
          }
        >
          {/* Resize handles — desktop only, box is anchored bottom-right */}
          <div
            onMouseDown={(e) => startResize(e, "nw")}
            className="hidden md:block absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-20"
          />
          <div
            onMouseDown={(e) => startResize(e, "n")}
            className="hidden md:block absolute top-0 left-3 right-3 h-1 cursor-n-resize z-20"
          />
          <div
            onMouseDown={(e) => startResize(e, "ne")}
            className="hidden md:block absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-20"
          />
          <div
            onMouseDown={(e) => startResize(e, "w")}
            className="hidden md:block absolute top-3 bottom-3 left-0 w-1 cursor-w-resize z-20"
          />
          <div
            onMouseDown={(e) => startResize(e, "sw")}
            className="hidden md:block absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-20"
          />

          {/* Header */}
          <div className="flex min-h-14 shrink-0 items-start justify-between gap-3 bg-navy px-5 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full shrink-0 bg-teal" />
                <span className="font-heading text-[15px] font-semibold text-white">Maxx ✦</span>
              </div>
              {entityScope &&
                (entityScope.entityScopeTags.length > 0 || entityScope.activeAgent !== null) && (
                  <div className="flex flex-wrap gap-1 pl-4">
                    {entityScope.entityScopeTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90"
                      >
                        {tag === "task_id_set" ? "Task ID set" : "Class ID set"}
                      </span>
                    ))}
                    {entityScope.activeAgent !== null && (
                      <span className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90">
                        {ACTIVE_AGENT_LABELS[entityScope.activeAgent]}
                      </span>
                    )}
                  </div>
                )}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSessionId(crypto.randomUUID());
                setOptimistic([]);
                setEntityMcq(null);
                setEntityBlockAfterIndex(null);
                setInput("");
                resetSize();
              }}
              aria-label="Close chat"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 hover:bg-white/20 transition"
            >
              <XIcon color="white" size={12} />
            </button>
          </div>

          {/* Messages */}
          <div className="relative flex-1 min-h-0">
            <ChatContainerRoot className="h-full bg-bg-gray">
              <ChatContainerContent className="gap-3 px-4 py-4">
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center gap-2 pt-8 text-center">
                    <span className="text-sm font-semibold font-heading text-navy">
                      What can I help you with?
                    </span>
                    <span className="text-xs font-body text-light-blue">
                      Pick an option below or type your question.
                    </span>
                  </div>
                )}

                {messages.map((msg, i) => {
                  const m = msg as { role: "user" | "assistant"; content: string; _id?: string };
                  const key = typeof m._id === "string" ? m._id : `m-${i}`;
                  const showEntityAfterThis =
                    shouldShowEntityBlock &&
                    entityBlockAfterIndex !== null &&
                    i === entityBlockAfterIndex;
                  return (
                    <Fragment key={key}>
                      {m.role === "assistant" ? (
                        <Message className="items-start">
                          <MessageAvatar fallback="AI" />
                          <div className="flex flex-col gap-1 max-w-[82%]">
                            <span className="font-heading text-[11px] font-semibold text-teal px-0.5">
                              Maxx
                            </span>
                            <MessageContent className="bg-white border rounded-tl-sm border-border text-navy rounded-2xl whitespace-pre-wrap">
                              {renderInlineBoldMarkdown(m.content)}
                            </MessageContent>
                          </div>
                        </Message>
                      ) : (
                        <Message className="justify-end">
                          <MessageContent className="bg-navy text-white max-w-[82%] rounded-2xl rounded-tr-sm">
                            {m.content}
                          </MessageContent>
                        </Message>
                      )}
                      {showEntityAfterThis ? renderEntityMcqBlock() : null}
                    </Fragment>
                  );
                })}
                {shouldShowEntityBlock && entityBlockAfterIndex === null
                  ? renderEntityMcqBlock()
                  : null}

                {isLoading && optimistic.length <= 1 && (
                  <Message className="items-start">
                    <MessageAvatar fallback="AI" />
                    <MessageContent className="bg-white border rounded-tl-sm border-border rounded-2xl">
                      <Loader />
                    </MessageContent>
                  </Message>
                )}

                {showSuggestions && (
                  <div className="flex flex-col gap-2 pt-1">
                    {MAIN_MENU.map((opt) => (
                      <button
                        key={opt.route}
                        type="button"
                        onClick={() => void handleMenuPick(opt.route, opt.label)}
                        disabled={isLoading}
                        className="text-left rounded-xl border border-border bg-white px-3.5 py-3 md:py-2.5 text-[13px] md:text-[12px] font-body text-navy hover:border-navy/30 hover:bg-bg-gray active:bg-bg-gray transition disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <ChatContainerScrollAnchor />
              </ChatContainerContent>

              <div className="absolute z-10 -translate-x-1/2 bottom-2 left-1/2">
                <ScrollButton />
              </div>
            </ChatContainerRoot>
          </div>

          {/* Input */}
          <div className="px-4 py-3 bg-white border-t shrink-0 border-border">
            {chatLocked && (
              <p className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-[11px] font-body text-amber-950">
                This chat is closed for new messages. Tap × and open Maxx again to start a new
                session.
              </p>
            )}
            <PromptInput
              value={input}
              onValueChange={setInput}
              onSubmit={handleSend}
              isLoading={isLoading}
              disabled={isLoading || chatLocked}
            >
              <PromptInputTextarea
                placeholder={
                  chatLocked
                    ? "Chat closed — open a new session…"
                    : "Ask me anything… (Enter to send)"
                }
              />
              <PromptInputActions>
                <Button
                  variant="primary"
                  onClick={handleSend}
                  disabled={isLoading || chatLocked || !input.trim()}
                  className="w-16 text-sm rounded-lg h-9 shrink-0"
                >
                  Send
                </Button>
              </PromptInputActions>
            </PromptInput>
            <p className="hidden md:block mt-1.5 text-center text-[11px] font-body text-light-blue">
              {chatLocked
                ? "Start a new chat from the widget to continue."
                : "Enter to send · Shift+Enter for new line"}
            </p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            setSessionId(crypto.randomUUID());
            setOptimistic([]);
            setEntityMcq(null);
            setEntityBlockAfterIndex(null);
            setInput("");
            resetSize();
          } else {
            setIsOpen(true);
          }
        }}
        aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
        className={`items-center justify-center transition rounded-full shadow-lg h-14 w-14 bg-navy hover:opacity-90 active:opacity-80 ${isOpen ? "hidden md:flex" : "flex"}`}
      >
        <MessageSquareIcon color="white" size={22} />
      </button>
    </div>
  );
}
