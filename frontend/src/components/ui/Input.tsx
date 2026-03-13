import { type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  icon?: ReactNode
}

export default function Input({ icon, ...props }: InputProps) {
  if (icon) {
    return (
      <div className="flex h-11 items-center justify-between rounded-md border border-border bg-bg-gray px-3.5">
        <input
          {...props}
          className="flex-1 border-none bg-transparent font-body text-sm text-navy outline-none placeholder:text-light-blue"
        />
        {icon}
      </div>
    )
  }
  return (
    <input
      {...props}
      className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
    />
  )
}
