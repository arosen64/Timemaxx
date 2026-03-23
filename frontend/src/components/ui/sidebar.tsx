import { Link, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../backend/convex/_generated/api";
import { DashboardIcon, TasksIcon, ScheduleIcon, UserIcon, ClassesIcon } from "../icons/icons";
import { BrandLogo, Avatar } from '.'


export default function Sidebar() {
    const { pathname } = useLocation();
    const user = useQuery(api.queries.users.getCurrUser);

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
                <BrandLogo size="sm" />

                {/* Nav Menu */}
                <nav className="flex flex-col gap-1">
                    {navItem("/dashboard", <DashboardIcon />, "Dashboard")}
                    {navItem("/classes", <ClassesIcon />, "Classes")}
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
                <Avatar user={user} size="sm" theme="dark" />
                <div className="flex flex-col gap-0.5">
                    {user === undefined ? (
                        <>
                            <div className="h-3.5 w-24 bg-white/20 rounded animate-pulse" />
                            <div className="h-3 w-32 bg-white/10 rounded animate-pulse" />
                        </>
                    ) : (
                        <>
                            <span className="font-heading text-sm font-semibold text-white">{user?.name}</span>
                            <span className="font-body text-xs text-sky-blue">{user?.email}</span>
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
}


