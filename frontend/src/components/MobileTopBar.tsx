import { Link } from "react-router-dom";
import { BookOpenIcon, MenuIcon } from "./icons";

export default function MobileTopBar({ onOpen }: { onOpen: () => void }) {
    return (
        <header className="flex md:hidden items-center justify-between h-14 px-4 bg-navy shrink-0">
            <button
                onClick={onOpen}
                aria-label="Open navigation menu"
                className="flex items-center justify-center w-9 h-9 text-white rounded hover:bg-white/10"
            >
                <MenuIcon color="white" size={20} />
            </button>

            <Link to="/dashboard" className="flex items-center gap-2">
                <div className="flex items-center justify-center h-7 w-7 text-navy bg-teal rounded">
                    <BookOpenIcon size={16} />
                </div>
                <span className="font-heading text-base font-bold text-white">Timemaxx</span>
            </Link>

            {/* Spacer to balance hamburger and keep logo centered */}
            <div className="w-9" />
        </header>
    );
}
