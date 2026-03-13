import { type ReactNode } from 'react'
import Card from './Card'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-gray">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold font-heading text-navy">{title}</div>
          <div className="mt-1 text-sm text-slate-blue">{description}</div>
        </div>
      </div>
    </Card>
  )
}
