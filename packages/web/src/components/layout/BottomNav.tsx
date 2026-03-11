import { NavLink, useLocation } from "react-router-dom";
import { Layers, Box, BarChart3, Settings } from "lucide-react";
import { cn } from "../../lib/cn";

const navItems = [
  { to: "/sessions", label: "Sessions", icon: Layers },
  { to: "/providers", label: "Providers", icon: Box },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const location = useLocation();

  // Hide bottom nav on terminal pages
  if (location.pathname.startsWith("/terminal/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-bottom px-4 pb-2" aria-label="Main navigation">
      {/* Floating pill container */}
      <div className="glass-surface rounded-2xl border border-white/[0.06] shadow-xl shadow-black/30">
        <div className="flex items-center justify-around h-14">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-all duration-200",
                  isActive
                    ? "text-accent"
                    : "text-text-muted hover:text-text-secondary",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-accent accent-line-glow" />
                  )}
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-all duration-200",
                      isActive && "nav-glow",
                    )}
                    strokeWidth={isActive ? 2.2 : 1.6}
                  />
                  <span className={cn(
                    "text-[10px] font-semibold transition-colors",
                    isActive ? "text-accent" : "text-text-muted",
                  )}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
