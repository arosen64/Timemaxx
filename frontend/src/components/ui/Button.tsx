import { type ReactNode } from 'react'

interface ButtonProps {
  variant: 'primary' | 'destructive'
  children: ReactNode
  onClick: () => void
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  className?: string
}

export default function Button({ variant, children, onClick, icon, iconPosition = 'left', className }: ButtonProps) {
  const variantClass = variant === 'primary' ? 'bg-navy' : 'bg-dark-red'

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 h-11 font-heading text-sm font-semibold text-white rounded-lg transition hover:opacity-90 ${variantClass} ${className ?? ''}`}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  )
}
