import type { Ref } from "react";
import { CalendarIcon } from "./icons";

function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  const picker = input as HTMLInputElement & { showPicker?: () => void };
  picker.showPicker?.() ?? input.click();
}

export interface DueDateRowWithCalendarProps {
  variant: "modal" | "compact";
  /** Icon before (syllabus card) or after (task modal) the text field */
  calendarPosition: "start" | "end";
  datePickerRef: Ref<HTMLInputElement>;
  textInputId: string;
  dateTextValue: string;
  onDateTextChange: (value: string) => void;
  onDateTextBlur: () => void;
  onDateTextFocus?: () => void;
  placeholder: string;
  datePickerValue: string;
  datePickerMin?: string;
  onIsoChange: (iso: string) => void;
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
  const isModal = variant === "modal";

  const rowClass = isModal
    ? "relative flex h-11 min-w-0 items-center justify-between rounded-md border border-border bg-bg-gray px-3.5"
    : "flex h-8 min-w-0 items-center rounded-md border border-border bg-bg-gray px-2.5 gap-1.5";

  const textClass = isModal
    ? "min-w-0 flex-1 border-none bg-transparent font-body text-sm text-navy outline-none placeholder:text-light-blue"
    : "w-28 min-w-0 border-none bg-transparent font-body text-sm text-navy outline-none placeholder:text-light-blue";

  const calendarButtonClass = !isModal
    ? "relative z-20 flex cursor-pointer items-center justify-center rounded p-0.5 text-light-blue outline-none hover:text-navy focus-visible:ring-2 focus-visible:ring-navy/30"
    : "relative z-20 cursor-pointer rounded p-1 text-light-blue outline-none hover:text-navy focus-visible:ring-2 focus-visible:ring-navy/30";

  const anchor = (
    <div
      className={`relative inline-flex shrink-0 ${calendarPosition === "end" ? "ml-2" : ""}`.trim()}
    >
      <input
        ref={datePickerRef}
        type="date"
        className="absolute inset-0 z-10 opacity-0 pointer-events-none -translate-x-75"
        tabIndex={-1}
        aria-hidden
        value={datePickerValue}
        {...(datePickerMin !== undefined ? { min: datePickerMin } : {})}
        onChange={(e) => onIsoChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => {
          if (!datePickerRef || typeof datePickerRef === "function") return;
          openNativeDatePicker(datePickerRef.current);
        }}
        className={calendarButtonClass}
        aria-label="Open calendar"
      >
        {!isModal ? <CalendarIcon size={14} /> : <CalendarIcon />}
      </button>
    </div>
  );

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
  );

  return (
    <div className={rowClass}>
      {calendarPosition === "start" ? (
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
  );
}
