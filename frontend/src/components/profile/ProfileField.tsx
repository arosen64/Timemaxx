interface ProfileFieldProps {
  label: string;
  value?: string;
  loading?: boolean;
}

export default function ProfileField({ label, value, loading }: ProfileFieldProps) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      {loading ? (
        <>
          <div className="h-3 w-16 bg-border rounded animate-pulse" />
          <div className="h-5 w-36 bg-border rounded animate-pulse" />
        </>
      ) : (
        <>
          <span className="font-body text-xs font-semibold text-slate-blue">{label}</span>
          <span className="font-heading text-base font-medium text-navy">{value}</span>
        </>
      )}
    </div>
  );
}
