import { useState, useEffect } from 'react'
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


export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Optimistic messages shown while streaming (not yet in DB)
  const [optimistic, setOptimistic] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])

  const token = useAuthToken()
  const history = useQuery(api.queries.chatMessages.getChatHistory, { limit: 50 }) ?? []

  // Clear optimistic messages once Convex history catches up
  useEffect(() => {
    if (optimistic.length === 0) return
    const lastSaved = history[history.length - 1]
    const lastOptimistic = optimistic[optimistic.length - 1]
    if (lastSaved?.role === 'assistant' && lastSaved?.content === lastOptimistic?.content) {
      setOptimistic([])
    }
  }, [history, optimistic])

  const messages = [
    ...history,
    ...optimistic,
  ]

  const showSuggestions = messages.length === 0 && !isLoading

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)
    setOptimistic([{ role: 'user', content: text }])

    try {
      const res = await fetch(
        `${import.meta.env.VITE_CONVEX_SITE_URL}/api/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: text }),
        }
      )

      if (!res.ok) {
        const errText = await res.text().catch(() => '(no body)')
        throw new Error(`Chat request failed: ${res.status} ${errText}`)
      }

      const data = await res.json() as { text?: string }
      const aiText = data.text ?? ''
      setOptimistic([
        { role: 'user', content: text },
        { role: 'assistant', content: aiText },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ChatBot] error:', msg)
      setOptimistic((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${msg}` },
      ])
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
          <div className="flex h-14 shrink-0 items-center justify-between bg-navy px-5">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-teal" />
              <span className="font-heading text-[15px] font-semibold text-white">TimeMaxx AI</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 hover:bg-white/20 transition"
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
                          TimeMaxx AI
                        </span>
                        <MessageContent className="bg-white border border-border text-navy rounded-2xl rounded-tl-sm">
                          {msg.content}
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

                <ChatContainerScrollAnchor />
              </ChatContainerContent>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                <ScrollButton />
              </div>
            </ChatContainerRoot>
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border bg-white px-4 py-3">
            <PromptInput
              value={input}
              onValueChange={setInput}
              onSubmit={handleSend}
              isLoading={isLoading}
              disabled={isLoading}
            >
              <PromptInputTextarea placeholder="Ask me anything… (Enter to send)" />
              <PromptInputActions>
                <Button
                  variant="primary"
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="w-16 h-9 text-sm rounded-lg shrink-0"
                >
                  Send
                </Button>
              </PromptInputActions>
            </PromptInput>
            <p className="mt-1.5 text-center text-[11px] font-body text-light-blue">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Close AI chat' : 'Open AI chat'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-navy shadow-lg hover:opacity-90 transition"
      >
        {isOpen ? <XIcon color="white" size={16} /> : <MessageSquareIcon color="white" size={22} />}
      </button>
    </div>
  )
}
