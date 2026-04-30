import { WarningIcon } from "../icons";

export default function DueDateWarningBadge() {
  return (
    <span
      className="flex items-center gap-1 px-2.5 py-1 font-heading text-xs font-semibold bg-urgent-red-light text-urgent-red rounded"
      aria-label="Not enough available time before this task is due"
      title="Not enough available time before this task is due"
    >
      <WarningIcon color="currentColor" size={11} />
      At Risk
    </span>
  );
}
