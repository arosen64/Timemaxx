import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
    const { pathname } = useLocation();

    const navItem = (to: string, icon: React.ReactNode, label: string) => {
        const active = pathname === to;
        return (
            <Link
                to={to}
                className={`flex items-center h-11 w-full gap-2.5 px-3.5 rounded-lg ${active
                        ? "text-navy bg-white"
                        : "text-sky-blue hover:bg-white/10"
                    }`}
            >
                {icon}
                <span className={`font-heading text-sm ${active ? "font-semibold" : "font-normal"}`}>
                    {label}
                </span>
            </Link>
        );
    };

    return (
        <aside className="flex flex-shrink-0 flex-col justify-between h-full w-64 py-8 px-6 bg-navy">
            {/* Top: Logo + Nav */}
            <div className="flex flex-col gap-8">
                {/* Logo Row */}
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center h-8 w-8 text-navy bg-teal rounded">
                        <BookOpenIcon />
                    </div>
                    <span className="font-heading text-lg font-bold text-white">Timemaxx</span>
                </div>

                {/* Nav Menu */}
                <nav className="flex flex-col gap-1">
                    {navItem("/dashboard", <DashboardIcon />, "Dashboard")}
                    <div className="flex items-center h-11 w-full gap-2.5 px-3.5 text-sky-blue rounded-lg">
                        <TasksIcon />
                        <span className="font-heading text-sm font-normal">Tasks</span>
                    </div>
                    <div className="flex items-center h-11 w-full gap-2.5 px-3.5 text-sky-blue rounded-lg">
                        <ScheduleIcon />
                        <span className="font-heading text-sm font-normal">Schedule</span>
                    </div>
                    {navItem("/profile", <UserIcon />, "Profile")}
                </nav>
            </div>

            {/* Footer: User Info */}
            <div className="flex items-center gap-2.5">
                <div className="flex flex-shrink-0 items-center justify-center h-9 w-9 bg-sky-blue rounded-full">
                    <span className="font-heading text-sm font-bold text-navy">AJ</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="font-heading text-sm font-semibold text-white">Alex Johnson</span>
                    <span className="font-body text-xs text-sky-blue">alex@jhu.edu</span>
                </div>
            </div>
        </aside>
    );
}

export function BookOpenIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    );
}

export function DashboardIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
        </svg>
    );
}

export function TasksIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
    );
}

export function ScheduleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    );
}

export function UserIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}


