import { useState, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { useAuthToken } from '@convex-dev/auth/react'
import { api } from '../../../backend/convex/_generated/api'
import { ChatContainerRoot, ChatContainerContent, ChatContainerScrollAnchor } from './prompt-kit/chat-container'
import { Message, MessageAvatar, MessageContent } from './prompt-kit/message'
import { PromptInput, PromptInputTextarea, PromptInputActions } from './prompt-kit/prompt-input'
import { ScrollButton } from './prompt-kit/scroll-button'
import { Loader } from './prompt-kit/loader'
import { MessageSquareIcon, XIcon } from './icons'
import Button from './ui/Button'

const SUGGESTIONS = [
  'How many study hours do I have left?',
  'What tasks are due this week?',
  'Help me prioritize my workload',
]

type EntityCandidate = { id: string; label: string; subtitle: string }

type ChatApiResponse = {
  text?: string
  status?: string
  entityCandidates?: EntityCandidate[]
  entityHasMore?: boolean
  phase?: 'task' | 'class'
  scopeConfirmTaskLabel?: string | null
  scopeConfirmClassLabel?: string | null
}

type EntityPickMeta = { phase: 'task' | 'class'; label: string }

/** Renders `**like this**` as bold (common in assistant copy; plain text otherwise). */
function renderInlineBoldMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [optimistic, setOptimistic] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [historyLenAtSend, setHistoryLenAtSend] = useState(0)
  const [entityMcq, setEntityMcq] = useState<{
    phase: 'task' | 'class'
    candidates: EntityCandidate[]
    hasMore: boolean
  } | null>(null)
  /** Confirmed picks in the current clarification flow (shown above the active MCQ). */
  const [entityChoiceHistory, setEntityChoiceHistory] = useState<EntityPickMeta[]>([])

  const token = useAuthToken()
  const history = useQuery(api.queries.chatMessages.getChatHistory, { sessionId, limit: 50 }) ?? []
  const entityScope =
    useQuery(
      api.queries.chatSessions.getChatSessionEntityScope,
      isOpen ? { sessionId } : 'skip',
    ) ?? null

  // Show optimistic[i] only while history hasn't committed that index yet.
  // Using a cursor (history length at send time) instead of content comparison
  // avoids false deduplication when the user sends identical messages back-to-back.
  const pendingMessages = isLoading
    ? optimistic.slice(Math.max(0, history.length - historyLenAtSend))
    : []
  const messages = [...history, ...pendingMessages]

  const showSuggestions = messages.length === 0 && !isLoading
  const chatLocked = entityScope?.chatInputLocked === true
  const scopeConfirmOpen = entityScope?.awaitingScopeConfirm === true

  async function handleScopeConfirm(yes: boolean) {
    if (isLoading || chatLocked) return
    setIsLoading(true)
    try {
      await postChat(
        {
          sessionId,
          entity: { action: yes ? 'scope_confirm_yes' : 'scope_confirm_no' },
        },
        null,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setOptimistic((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setIsLoading(false)
    }
  }

  function applyEntityResponse(
    data: ChatApiResponse,
    userEcho: string | null,
    entityPick?: EntityPickMeta,
  ) {
    const aiText = data.text ?? ''
    if (data.status === 'awaiting_scope_reply') {
      setEntityMcq(null)
      if (userEcho !== null) setInput(userEcho)
      setOptimistic([{ role: 'assistant', content: aiText }])
      return
    }
    if (data.status === 'needs_scope_confirmation') {
      setEntityMcq(null)
      if (userEcho !== null) {
        setEntityChoiceHistory([])
        setOptimistic([{ role: 'user', content: userEcho }])
      } else {
        setOptimistic([])
      }
      return
    }
    if (userEcho !== null) {
      setEntityChoiceHistory([])
    }
    if (data.status === 'entity_scope_locked' || data.status === 'chat_input_locked') {
      setEntityChoiceHistory([])
    } else if (entityPick) {
      setEntityChoiceHistory((prev) => [...prev, entityPick])
    }
    if (data.entityCandidates && data.entityCandidates.length > 0 && data.phase) {
      setEntityMcq({
        phase: data.phase,
        candidates: data.entityCandidates,
        hasMore: data.entityHasMore ?? false,
      })
    } else {
      setEntityMcq(null)
    }
    if (userEcho !== null) {
      setOptimistic([
        { role: 'user', content: userEcho },
        { role: 'assistant', content: aiText },
      ])
    } else {
      // MCQ actions persist via Convex; avoid double-rendering with optimistic rows
      setOptimistic([])
    }
  }

  async function postChat(
    body: Record<string, unknown>,
    userEcho: string | null,
    entityPick?: EntityPickMeta,
  ) {
    const res = await fetch(`${import.meta.env.VITE_CONVEX_SITE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('Maxx has hit the AI rate limit — please wait a moment and try again.')
      }
      const errText = await res.text().catch(() => '(no body)')
      throw new Error(`Chat request failed: ${res.status} ${errText}`)
    }
    const data = (await res.json()) as ChatApiResponse
    applyEntityResponse(data, userEcho, entityPick)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading || chatLocked) return

    setInput('')
    setIsLoading(true)
    setEntityMcq(null)
    setEntityChoiceHistory([])
    setHistoryLenAtSend(history.length)
    setOptimistic([{ role: 'user', content: text }])

    try {
      await postChat({ message: text, sessionId }, text)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ChatBot] error:', msg)
      setOptimistic((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePickEntity(phase: 'task' | 'class', id: string) {
    if (isLoading || chatLocked || !entityMcq) return
    const picked = entityMcq.candidates.find((c) => c.id === id)
    const label = picked?.label ?? 'Your choice'
    setIsLoading(true)
    try {
      if (phase === 'task') {
        await postChat(
          { sessionId, entity: { action: 'pick_task', taskId: id } },
          null,
          { phase: 'task', label },
        )
      } else {
        await postChat(
          { sessionId, entity: { action: 'pick_course', courseId: id } },
          null,
          { phase: 'class', label },
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setOptimistic((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOtherEntity() {
    if (!entityMcq || isLoading || chatLocked || !entityMcq.hasMore) return
    const ids = entityMcq.candidates.map((c) => c.id)
    setIsLoading(true)
    try {
      if (entityMcq.phase === 'task') {
        await postChat(
          { sessionId, entity: { action: 'other_tasks', excludeTaskIds: ids } },
          null,
        )
      } else {
        await postChat(
          { sessionId, entity: { action: 'other_courses', excludeCourseIds: ids } },
          null,
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setOptimistic((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Overlay */}
      {isOpen && (
        <div className="flex w-[400px] h-[600px] flex-col rounded-2xl border border-border bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex min-h-14 shrink-0 items-start justify-between gap-3 bg-navy px-5 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-teal" />
                <span className="font-heading text-[15px] font-semibold text-white">Maxx ✦</span>
              </div>
              {entityScope && entityScope.entityScopeTags.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-4">
                  {entityScope.entityScopeTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90"
                    >
                      {tag === 'task_id_set' ? 'Task ID set' : 'Class ID set'}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setSessionId(crypto.randomUUID())
                setOptimistic([])
                setEntityMcq(null)
                setEntityChoiceHistory([])
                setInput('')
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
                    <span className="font-heading text-sm font-semibold text-navy">How can I help?</span>
                    <span className="font-body text-xs text-light-blue">Ask about your schedule, tasks, or deadlines.</span>
                  </div>
                )}

                {messages.map((msg, i) =>
                  msg.role === 'assistant' ? (
                    <Message key={i} className="items-start">
                      <MessageAvatar fallback="AI" />
                      <div className="flex flex-col gap-1 max-w-[82%]">
                        <span className="font-heading text-[11px] font-semibold text-teal px-0.5">
                          Maxx
                        </span>
                        <MessageContent className="bg-white border border-border text-navy rounded-2xl rounded-tl-sm">
                          {renderInlineBoldMarkdown(msg.content)}
                        </MessageContent>
                      </div>
                    </Message>
                  ) : (
                    <Message key={i} className="justify-end">
                      <MessageContent className="bg-navy text-white max-w-[82%] rounded-2xl rounded-tr-sm">
                        {msg.content}
                      </MessageContent>
                    </Message>
                  )
                )}

                {isLoading && optimistic.length <= 1 && (
                  <Message className="items-start">
                    <MessageAvatar fallback="AI" />
                    <MessageContent className="bg-white border border-border rounded-2xl rounded-tl-sm">
                      <Loader />
                    </MessageContent>
                  </Message>
                )}

                {showSuggestions && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setInput(s)}
                        className="rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-body text-slate-blue hover:border-navy/30 hover:text-navy transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {scopeConfirmOpen && (
                  <div className="rounded-xl border border-teal/40 bg-white p-3 space-y-2.5">
                    <p className="text-[11px] font-heading font-semibold text-navy">
                      Still the same task or class?
                    </p>
                    {(entityScope?.scopeConfirmTaskLabel || entityScope?.scopeConfirmClassLabel) && (
                      <div className="rounded-lg bg-bg-gray/90 px-2.5 py-2 text-[12px] text-navy space-y-1">
                        {entityScope?.scopeConfirmTaskLabel ? (
                          <div>
                            <span className="font-heading text-[10px] font-semibold text-teal">Task </span>
                            <span className="font-medium">{entityScope.scopeConfirmTaskLabel}</span>
                          </div>
                        ) : null}
                        {entityScope?.scopeConfirmClassLabel ? (
                          <div>
                            <span className="font-heading text-[10px] font-semibold text-teal">Class </span>
                            <span className="font-medium">{entityScope.scopeConfirmClassLabel}</span>
                          </div>
                        ) : null}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => void handleScopeConfirm(true)}
                        className="flex-1 rounded-lg bg-teal py-2 text-[12px] font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => void handleScopeConfirm(false)}
                        className="flex-1 rounded-lg border border-border py-2 text-[12px] font-semibold text-navy hover:bg-bg-gray transition disabled:opacity-50"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}

                {(entityChoiceHistory.length > 0 || (entityMcq && entityMcq.candidates.length > 0)) && (
                  <div className="rounded-xl border border-border bg-white p-3 space-y-2">
                    {entityChoiceHistory.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[10px] font-heading font-semibold uppercase tracking-wide text-light-blue">
                          Your picks
                        </p>
                        <ul className="flex flex-col gap-1">
                          {entityChoiceHistory.map((c, idx) => (
                            <li
                              key={`${c.phase}-${idx}-${c.label}`}
                              className="flex items-baseline gap-2 rounded-lg bg-bg-gray/80 px-2.5 py-1.5 text-[12px]"
                            >
                              <span className="shrink-0 font-heading text-[10px] font-semibold text-teal">
                                {c.phase === 'task' ? 'Task' : 'Class'}
                              </span>
                              <span className="font-medium text-navy">{c.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {entityMcq && entityMcq.candidates.length > 0 && (
                      <>
                        <p className="text-[11px] font-heading font-semibold text-navy">
                          {entityMcq.phase === 'task' ? 'Pick a task' : 'Pick a class'}
                        </p>
                        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                          {entityMcq.candidates.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => void handlePickEntity(entityMcq.phase, c.id)}
                              disabled={isLoading}
                              className="text-left rounded-lg border border-border px-2.5 py-2 text-[12px] hover:bg-bg-gray transition disabled:opacity-50"
                            >
                              <span className="font-medium text-navy block">{c.label}</span>
                              <span className="text-light-blue text-[11px]">{c.subtitle}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleOtherEntity()}
                          disabled={isLoading || !entityMcq.hasMore}
                          title={
                            entityMcq.hasMore
                              ? 'Show more options'
                              : 'No more matches for this search'
                          }
                          className={
                            entityMcq.hasMore
                              ? 'w-full rounded-lg border border-dashed border-teal/50 py-2 text-[12px] font-medium text-teal hover:bg-teal/5 transition disabled:opacity-50'
                              : 'w-full rounded-lg border border-dashed border-border py-2 text-[12px] font-medium text-light-blue cursor-not-allowed opacity-70'
                          }
                        >
                          Other…
                        </button>
                      </>
                    )}
                  </div>
                )}

                <ChatContainerScrollAnchor />
              </ChatContainerContent>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                <ScrollButton />
              </div>
            </ChatContainerRoot>
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border bg-white px-4 py-3">
            {chatLocked && (
              <p className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-[11px] font-body text-amber-950">
                This chat is closed for new messages. Tap × and open Maxx again to start a new session.
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
                    ? 'Chat closed — open a new session…'
                    : 'Ask me anything… (Enter to send)'
                }
              />
              <PromptInputActions>
                <Button
                  variant="primary"
                  onClick={handleSend}
                  disabled={isLoading || chatLocked || !input.trim()}
                  className="w-16 h-9 text-sm rounded-lg shrink-0"
                >
                  Send
                </Button>
              </PromptInputActions>
            </PromptInput>
            <p className="mt-1.5 text-center text-[11px] font-body text-light-blue">
              {chatLocked
                ? 'Start a new chat from the widget to continue.'
                : 'Enter to send · Shift+Enter for new line'}
            </p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false)
            setSessionId(crypto.randomUUID())
            setOptimistic([])
            setEntityMcq(null)
            setEntityChoiceHistory([])
            setInput('')
          } else {
            setIsOpen(true)
          }
        }}
        aria-label={isOpen ? 'Close AI chat' : 'Open AI chat'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-navy shadow-lg hover:opacity-90 transition"
      >
        <MessageSquareIcon color="white" size={22} />
      </button>
    </div>
  )
}
