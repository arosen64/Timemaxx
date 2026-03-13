interface AvatarProps {
  user: { image?: string; name?: string } | null | undefined
  /** 'sm' = 36px (sidebar); 'lg' = 72px (profile page) */
  size?: 'sm' | 'lg'
  /** 'dark' = on navy background (loading uses bg-white/20); 'light' = on white (loading uses bg-border) */
  theme?: 'dark' | 'light'
}

export default function Avatar({ user, size = 'sm', theme = 'light' }: AvatarProps) {
  const dim = size === 'lg' ? 'h-[72px] w-[72px]' : 'h-9 w-9'
  const textSize = size === 'lg' ? 'text-2xl' : 'text-sm'
  const loadingBg = theme === 'dark' ? 'bg-white/20' : 'bg-border'

  if (user === undefined) {
    return <div className={`flex-shrink-0 ${dim} ${loadingBg} rounded-full animate-pulse`} />
  }

  if (user?.image) {
    return (
      <img
        src={user.image}
        alt="Profile"
        referrerPolicy="no-referrer"
        className={`flex-shrink-0 ${dim} rounded-full object-cover`}
      />
    )
  }

  return (
    <div className={`flex flex-shrink-0 items-center justify-center ${dim} bg-sky-blue rounded-full`}>
      <span className={`font-heading ${textSize} font-bold text-navy`}>
        {user?.name?.charAt(0).toUpperCase() ?? '?'}
      </span>
    </div>
  )
}
