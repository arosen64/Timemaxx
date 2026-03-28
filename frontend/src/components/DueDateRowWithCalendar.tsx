import type { Ref } from 'react'
import { DueDateCalendarAnchor } from './DueDateCalendarAnchor'

export interface DueDateRowWithCalendarProps {
  variant: 'modal' | 'compact'
  /** Icon before (syllabus card) or after (task modal) the text field */
  calendarPosition: 'start' | 'end'
  datePickerRef: Ref<HTMLInputElement>
  textInputId: string
  dateTextValue: string
  onDateTextChange: (value: string) => void
  onDateTextBlur: () => void
  onDateTextFocus?: () => void
  placeholder: string
  datePickerValue: string
  datePickerMin?: string
  onIsoChange: (iso: string) => void
}

export default function DueDateRowWithCalendar({
  variant,
  calendarPosition,
  datePickerRef,
  textInputId,
  dateTextValue,
  onDateTextChange,
  onDateTextBlur,
  onDateTextFocus,
  placeholder,
  datePickerValue,
  datePickerMin,
  onIsoChange,
}: DueDateRowWithCalendarProps) {
  const isModal = variant === 'modal'

  const rowClass = isModal
    ? 'relative flex h-11 min-w-0 items-center justify-between rounded-md border border-border bg-bg-gray px-3.5'
    : 'flex h-8 min-w-0 items-center rounded-md border border-border bg-bg-gray px-2.5 gap-1.5'

  const textClass = isModal
    ? 'min-w-0 flex-1 border-none bg-transparent font-body text-sm text-navy outline-none placeholder:text-light-blue'
    : 'w-28 min-w-0 border-none bg-transparent font-body text-[13px] text-navy outline-none placeholder:text-light-blue'

  const anchor = (
    <DueDateCalendarAnchor
      datePickerRef={datePickerRef}
      value={datePickerValue}
      {...(datePickerMin !== undefined ? { min: datePickerMin } : {})}
      onIsoChange={onIsoChange}
      {...(!isModal ? { iconSize: 14 } : {})}
      wrapperClassName={calendarPosition === 'end' ? 'ml-2' : ''}
    />
  )

  const textInput = (
    <input
      id={textInputId}
      type="text"
      value={dateTextValue}
      onChange={(e) => onDateTextChange(e.target.value)}
      onBlur={onDateTextBlur}
      {...(onDateTextFocus ? { onFocus: onDateTextFocus } : {})}
      placeholder={placeholder}
      autoComplete="off"
      className={textClass}
    />
  )

  return (
    <div className={rowClass}>
      {calendarPosition === 'start' ? (
        <>
          {anchor}
          {textInput}
        </>
      ) : (
        <>
          {textInput}
          {anchor}
        </>
      )}
    </div>
  )
}
