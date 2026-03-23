import { type TextareaHTMLAttributes } from 'react'

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>

export default function Textarea(props: TextareaProps) {
  return (
    <textarea
      {...props}
      className="h-24 w-full resize-none rounded-md border border-border bg-bg-gray px-3.5 py-2.5 font-body text-sm leading-normal text-navy outline-none placeholder:text-light-blue"
    />
  )
}
