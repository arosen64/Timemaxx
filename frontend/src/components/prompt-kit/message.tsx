import { cn } from '../../utils/cn'

export type MessageProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

const Message = ({ children, className, ...props }: MessageProps) => (
  <div className={cn('flex gap-3', className)} {...props}>
    {children}
  </div>
)

export type MessageAvatarProps = {
  fallback: string
  className?: string
}

const MessageAvatar = ({ fallback, className }: MessageAvatarProps) => (
  <div
    className={cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-xs font-semibold font-heading text-white',
      className
    )}
  >
    {fallback}
  </div>
)

export type MessageContentProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      'rounded-2xl px-3.5 py-2.5 text-[13px] font-body leading-relaxed break-words',
      className
    )}
    {...props}
  >
    {children}
  </div>
)

export type MessageActionsProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

const MessageActions = ({ children, className, ...props }: MessageActionsProps) => (
  <div className={cn('flex items-center gap-1.5 mt-1', className)} {...props}>
    {children}
  </div>
)

export { Message, MessageAvatar, MessageContent, MessageActions }
