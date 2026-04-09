import { useState } from 'react'
import { ChatContainerRoot, ChatContainerContent, ChatContainerScrollAnchor } from './prompt-kit/chat-container'
import { Message, MessageAvatar, MessageContent } from './prompt-kit/message'
import { PromptInput, PromptInputTextarea, PromptInputActions } from './prompt-kit/prompt-input'
import { ScrollButton } from './prompt-kit/scroll-button'
import { Loader } from './prompt-kit/loader'
import { MessageSquareIcon, XIcon } from './icons'
import Button from './ui/Button'

interface ChatMessage {
  role: 'user' | 'ai'
  content: string
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: 'ai',
    content: "Hi! I'm TimeMaxx AI. Ask me anything about your study schedule, tasks, or deadlines.",
  },
]

const SUGGESTIONS = [
  'How many study hours do I have left?',
  'What tasks are due this week?',
  'Help me prioritize my workload',
]

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsLoading(true)

    try {
      // TODO: wire up to Convex action (e.g. api.actions.chat.sendMessage)
      await new Promise((r) => setTimeout(r, 900))
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: "I'm still learning! Chat backend coming soon." },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const showSuggestions = messages.length === 1 && !isLoading

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

                {messages.map((msg, i) =>
                  msg.role === 'ai' ? (
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

                {isLoading && (
                  <Message className="items-start">
                    <MessageAvatar fallback="AI" />
                    <MessageContent className="bg-white border border-border rounded-2xl rounded-tl-sm">
                      <Loader />
                    </MessageContent>
                  </Message>
                )}

                {/* Suggestions — only shown on empty conversation */}
                {showSuggestions && (
                  <div className="flex flex-wrap gap-2 pt-1">
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

              {/* ScrollButton must be inside ChatContainerRoot to access StickToBottom context */}
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
        {isOpen ? (
          <XIcon color="white" size={16} />
        ) : (
          <MessageSquareIcon color="white" size={22} />
        )}
      </button>
    </div>
  )
}
