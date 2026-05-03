import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileTopBar from "./MobileTopBar";
import ChatBot from "./ChatBot";

export default function AppLayout() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-bg-gray">
      {/* Mobile top bar — hidden on md+ */}
      <MobileTopBar onOpen={() => setIsOpen(true)} />

      {/* Mobile drawer backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer on mobile, persistent on md+ */}
      <div
        className={`fixed top-0 left-0 h-full z-50 transition-transform duration-300 md:static md:translate-x-0 md:z-auto md:h-screen ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onNavigate={() => setIsOpen(false)} />
      </div>

      {/* Page content */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>

      <ChatBot />
    </div>
  );
}
