import { type ReactNode } from 'react'

interface ButtonProps {
  variant?: 'primary' | 'ghost' | 'destructive'
  size?: 'lg' | 'sm' | 'nav'
  fullWidth?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
  children: ReactNode
}

const VARIANTS = {
  primary:     'bg-navy text-white hover:opacity-90',
  ghost:       'border border-border text-slate-blue hover:bg-bg-gray',
  destructive: 'bg-urgent-red text-white hover:opacity-90',
}

const SIZES = {
  lg:  'flex h-12 items-center justify-center gap-2 font-heading text-[15px] font-semibold',
  sm:  'flex h-10 items-center justify-center font-heading text-sm font-semibold',
  nav: 'px-5 py-2 font-medium text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  disabled,
  onClick,
  type = 'button',
  className = '',
  children,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}
