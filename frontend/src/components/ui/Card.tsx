import { type ReactNode } from 'react'

interface CardProps {
  variant?: 'default' | 'accent'
  className?: string
  children: ReactNode
}

export default function Card({ variant = 'default', className = '', children }: CardProps) {
  return (
    <div
      className={`rounded-[10px] ${
        variant === 'accent' ? 'bg-navy' : 'border border-border bg-white'
      } ${className}`}
    >
      {children}
    </div>
  )
}
