import { type ReactNode } from 'react'

interface ButtonProps {
  variant: 'primary' | 'destructive' | 'secondary'
  children: ReactNode
  onClick?: () => void
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  disabled?: boolean
  className?: string
}

export default function Button({ variant, children, onClick, icon, iconPosition = 'left', disabled, className }: ButtonProps) {
  const variantClass = variant === 'primary' ? 'bg-navy text-white' : variant === 'destructive' ? 'bg-urgent-red text-white' : 'border border-border bg-bg-gray text-slate-blue hover:border-navy/30'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 h-11 font-heading text-sm font-semibold rounded-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className ?? ''}`}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  )
}
