type Indicator = {
  dotClass: string;
  text: string;
  textClass: string;
};

type StatCardProps = {
  label: string;
  value: string | number;
  indicator?: Indicator;
  variant?: "default" | "dark";
};

export default function StatCard({ label, value, indicator, variant = "default" }: StatCardProps) {
  const isDark = variant === "dark";
  return (
    <div
      className={`flex flex-1 flex-col gap-2 rounded-[10px] p-5 ${isDark ? "bg-navy" : "border border-border bg-white"}`}
    >
      <span className={`text-xs font-semibold ${isDark ? "text-sky-blue" : "text-slate-blue"}`}>
        {label}
      </span>
      <span
        className={`font-heading text-[36px] font-bold leading-none ${isDark ? "text-teal" : "text-navy"}`}
      >
        {value}
      </span>
      {indicator && (
        <div className="flex items-center gap-1">
          <div className={`h-2 w-2 shrink-0 rounded-full ${indicator.dotClass}`} />
          <span className={`text-xs ${indicator.textClass}`}>{indicator.text}</span>
        </div>
      )}
    </div>
  );
}
