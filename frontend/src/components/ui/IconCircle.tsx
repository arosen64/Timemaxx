import { type ReactNode } from 'react'

interface IconCircleProps {
  /** Tailwind bg and text color classes, e.g. 'bg-urgent-tint text-urgent-red' */
  className?: string
  children: ReactNode
}

export default function IconCircle({ className = '', children }: IconCircleProps) {
  return (
    <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-full ${className}`}>
      {children}
    </div>
  )
}
