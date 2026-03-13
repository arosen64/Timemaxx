import { type ReactNode } from 'react'

interface FormFieldProps {
  label: string
  children: ReactNode
}

export default function FormField({ label, children }: FormFieldProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label className="font-heading text-[13px] font-semibold text-navy">{label}</label>
      {children}
    </div>
  )
}
