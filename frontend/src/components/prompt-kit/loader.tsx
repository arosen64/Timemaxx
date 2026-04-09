import { cn } from '../../utils/cn'

/** Typing dots loader — three dots pulsing in sequence */
function Loader({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)} aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-light-blue animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

export { Loader }
