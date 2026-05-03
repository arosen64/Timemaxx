import { CalendarIcon, XIcon } from "../icons";

type ModalButton = {
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary";
  disabled?: boolean;
};

type Props = {
  title: string;
  body: string;
  buttons: ModalButton[];
  onDismiss: () => void;
};

export default function NudgeModal({ title, body, buttons, onDismiss }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-white shadow-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2.5">
            <span className="text-info-emphasis">
              <CalendarIcon color="currentColor" size={20} />
            </span>
            <span className="font-heading text-base font-bold text-navy">{title}</span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-7 w-7 items-center justify-center rounded text-light-blue hover:bg-bg-gray hover:text-slate-blue transition"
            aria-label="Dismiss"
          >
            <XIcon color="currentColor" size={14} />
          </button>
        </div>

        <p className="px-5 pb-5 pt-3 font-body text-sm text-slate-blue">{body}</p>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-end gap-2.5 px-5 py-4">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.onClick}
              disabled={btn.disabled}
              className={
                btn.variant === "primary"
                  ? "flex h-10 items-center justify-center rounded-lg bg-navy px-4 font-heading text-sm font-semibold text-white hover:bg-navy/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  : "flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 font-heading text-sm font-semibold text-navy hover:bg-bg-gray transition"
              }
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
