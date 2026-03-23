import { type ReactNode } from 'react'

interface DestructButtonProps {
  icon: ReactNode
  text: string
  onClick: () => void
}

export default function DestructButton({ icon, text, onClick }: DestructButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center h-11 w-40 gap-2 font-heading text-sm font-semibold text-white bg-dark-red rounded-lg transition hover:opacity-90"
    >
      {icon}
      {text}
    </button>
  )
}
