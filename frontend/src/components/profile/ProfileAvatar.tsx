interface ProfileAvatarProps {
  name?: string;
  email?: string;
  image?: string;
  loading?: boolean;
}

export default function ProfileAvatar({ name, email, image, loading }: ProfileAvatarProps) {
  return (
    <div className="flex items-center gap-5">
      {loading ? (
        <div className="flex-shrink-0 h-[72px] w-[72px] bg-border rounded-full animate-pulse" />
      ) : image ? (
        <img
          src={image}
          alt="Profile"
          referrerPolicy="no-referrer"
          className="flex-shrink-0 h-[72px] w-[72px] rounded-full object-cover"
        />
      ) : (
        <div className="flex flex-shrink-0 items-center justify-center h-[72px] w-[72px] bg-sky-blue rounded-full">
          <span className="font-heading text-2xl font-bold text-navy">
            {name?.charAt(0).toUpperCase() ?? "S"}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {loading ? (
          <>
            <div className="h-7 w-40 bg-border rounded animate-pulse" />
            <div className="h-4 w-52 bg-border rounded animate-pulse" />
          </>
        ) : (
          <>
            <span className="font-heading text-2xl font-bold text-navy">{name}</span>
            <span className="font-body text-sm text-slate-blue">{email}</span>
          </>
        )}
      </div>
    </div>
  );
}
