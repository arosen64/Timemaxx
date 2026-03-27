import { type ReactNode } from 'react'

interface ButtonProps {
  variant: 'primary' | 'destructive'
  children: ReactNode
  onClick: () => void
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  className?: string
  disabled?: boolean
}

export default function Button({ variant, children, onClick, icon, iconPosition = 'left', className, disabled }: ButtonProps) {
  const variantClass = variant === 'primary' ? 'bg-navy' : 'bg-urgent-red'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 h-11 font-heading text-sm font-semibold text-white rounded-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${variantClass} ${className ?? ''}`}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  )
}
