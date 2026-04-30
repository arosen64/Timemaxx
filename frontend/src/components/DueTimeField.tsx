/** Tint and slightly scale `::-webkit-calendar-picker-indicator` (WebKit/Blink). */
const TIME_CLOCK_ICON =
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:[transform:scale(1.15)] [&::-webkit-calendar-picker-indicator]:origin-right [&::-webkit-calendar-picker-indicator]:[filter:invert(68%)_sepia(18%)_saturate(520%)_hue-rotate(176deg)_brightness(82%)_contrast(92%)]";

export interface DueTimeFieldProps {
  variant: "modal" | "compact";
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onValueChange?: () => void;
}

export default function DueTimeField({
  variant,
  id,
  label,
  value,
  onChange,
  onValueChange,
}: DueTimeFieldProps) {
  const isModal = variant === "modal";

  return (
    <div className={isModal ? "shrink-0 sm:w-36" : "flex min-w-0 flex-col gap-1"}>
      <label
        className={
          isModal
            ? "mb-1 block font-body text-xs font-medium text-slate-blue"
            : "font-body text-xs font-medium text-slate-blue"
        }
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        type="time"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onValueChange?.();
        }}
        className={
          isModal
            ? `h-11 w-full rounded-md border border-border bg-bg-gray px-3 font-body text-sm text-navy outline-none focus:border-sky-blue ${TIME_CLOCK_ICON}`
            : `h-8 w-32 rounded-md border border-border bg-bg-gray px-2 font-body text-sm text-navy outline-none focus:border-sky-blue ${TIME_CLOCK_ICON}`
        }
      />
    </div>
  );
}
