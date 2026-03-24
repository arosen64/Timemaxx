import { type ReactNode } from 'react'

interface DestructButtonProps {
  icon: ReactNode
  text: string
  onClick: () => void
  className?: string
}

export default function DestructButton({ icon, text, onClick, className }: DestructButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center h-11 gap-2 font-heading text-sm font-semibold text-white bg-dark-red rounded-lg transition hover:opacity-90 ${className ?? 'w-40'}`}
    >
      {icon}
      {text}
    </button>
  )
}
