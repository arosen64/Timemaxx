import { type ReactNode } from 'react'

function IconBase({
  children,
  color = 'currentColor',
  size = 16,
}: {
  children: ReactNode
  color?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  )
}

export function BookOpenIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </IconBase>
  )
}

export function DashboardIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </IconBase>
  )
}

export function TasksIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </IconBase>
  )
}

export function CalendarIcon({ color = '#8FA6C2', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </IconBase>
  )
}

export function UserIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </IconBase>
  )
}

export function PlusIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </IconBase>
  )
}

export function PencilIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </IconBase>
  )
}

export function ChevronDownIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <polyline points="6 9 12 15 18 9" />
    </IconBase>
  )
}

export function ChevronLeftIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <polyline points="15 18 9 12 15 6" />
    </IconBase>
  )
}

export function ChevronRightIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <polyline points="9 18 15 12 9 6" />
    </IconBase>
  )
}

export function TrashIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </IconBase>
  )
}

export function WarningIcon({ color = '#CF4520', size = 20 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </IconBase>
  )
}

export function SpinnerIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="animate-spin"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

export function SparklesIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M9 3l1.7 4.3L15 9l-4.3 1.7L9 15l-1.7-4.3L3 9l4.3-1.7L9 3z" />
      <path d="M18 3l.8 2.1L21 6l-2.2.9L18 9l-.8-2.1L15 6l2.2-.9L18 3z" />
      <path d="M18 13l1 2.5L22 17l-3 1.2L18 21l-1-2.8L14 17l3-1.5L18 13z" />
    </IconBase>
  )
}

export function LogoutIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </IconBase>
  )
}

// GoogleIcon uses official brand colors and cannot use currentColor.
export function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  )
}

// SlidersHorizontalIcon is a custom icon that doesn't fit the currentColor scheme, so it has its own color prop.
export function SlidersHorizontalIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <line x1="21" y1="6" x2="3" y2="6" />
      <path d="M17 6a2 2 0 1 0-4 0 2 2 0 0 0 4 0z" />
      <line x1="21" y1="12" x2="3" y2="12" />
      <path d="M9 12a2 2 0 1 0-4 0 2 2 0 0 0 4 0z" />
      <line x1="21" y1="18" x2="3" y2="18" />
      <path d="M17 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0z" />
    </IconBase>
  )
}
export function FileIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </IconBase>
  )
}

export function UploadIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </IconBase>
  )
}

export function ClassesIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </IconBase>
  )
}

export function CheckCircleIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </IconBase>
  )
}

export function InfoIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </IconBase>
  )
}

export function RetryIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </IconBase>
  )
}

export function XIcon({ color = '#CF4520', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M1 1l12 12M13 1L1 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
