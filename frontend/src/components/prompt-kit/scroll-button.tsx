import { cn } from "../../utils/cn";
import { ChevronDownIcon } from "../icons";
import { useStickToBottomContext } from "use-stick-to-bottom";

export type ScrollButtonProps = {
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

function ScrollButton({ className, ...props }: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    <button
      type="button"
      onClick={() => scrollToBottom()}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white shadow-md transition-all duration-150",
        !isAtBottom
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-4 scale-95 opacity-0",
        className
      )}
      aria-label="Scroll to bottom"
      {...props}
    >
      <ChevronDownIcon color="#4E6A8C" size={16} />
    </button>
  );
}

export { ScrollButton };
