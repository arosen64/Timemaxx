import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import Button from './ui/Button'
import { MessageSquareIcon, SpinnerIcon, XIcon } from './icons'

interface Message {
  role: 'user' | 'ai'
  content: string
}

const INITIAL_MESSAGE: Message = {
  role: 'ai',
  content: 'Hi! I\'m TimeMaxx AI. Ask me anything about your study schedule, tasks, or deadlines.',
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsLoading(true)

    try {
      // TODO: wire up to Convex action (e.g. api.actions.chat.sendMessage)
      await new Promise((r) => setTimeout(r, 800))
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'I\'m still learning! Chat backend coming soon.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Overlay panel */}
      {isOpen && (
        <div className="w-[380px] h-[560px] flex flex-col bg-white border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-14 bg-navy rounded-t-xl shrink-0">
            <span className="font-heading text-[15px] font-semibold text-white">TimeMaxx AI</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="flex items-center justify-center w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 transition"
            >
              <XIcon color="white" size={12} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4 bg-bg-gray">
            {messages.map((msg, i) =>
              msg.role === 'ai' ? (
                <div
                  key={i}
                  className="flex flex-col gap-1 max-w-[80%] bg-white border border-border rounded-xl px-3.5 py-2.5"
                >
                  <span className="font-heading text-[11px] font-semibold text-teal">
                    TimeMaxx AI
                  </span>
                  <p className="font-body text-[13px] text-navy leading-relaxed m-0">{msg.content}</p>
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] bg-navy rounded-xl px-3.5 py-2.5">
                    <p className="font-body text-[13px] text-white leading-relaxed m-0">{msg.content}</p>
                  </div>
                </div>
              )
            )}
            {isLoading && (
              <div className="flex flex-col gap-1 max-w-[80%] bg-white border border-border rounded-xl px-3.5 py-2.5">
                <span className="font-heading text-[11px] font-semibold text-teal">TimeMaxx AI</span>
                <div className="flex items-center gap-1.5 py-0.5">
                  <SpinnerIcon color="#86C8BC" size={14} />
                  <span className="font-body text-[13px] text-light-blue">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="flex items-center gap-2.5 h-16 px-3 bg-white border-t border-border shrink-0">
            <div className="flex flex-1 items-center h-10 bg-bg-gray border border-border rounded-lg px-3.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything…"
                disabled={isLoading}
                className="flex-1 bg-transparent font-body text-[13px] text-navy placeholder:text-light-blue outline-none disabled:cursor-not-allowed"
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="w-[72px] h-10 text-sm rounded-lg shrink-0"
            >
              Send
            </Button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Close AI chat' : 'Open AI chat'}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-navy shadow-lg hover:opacity-90 transition"
      >
        <MessageSquareIcon color="white" size={22} />
      </button>
    </div>
  )
}
