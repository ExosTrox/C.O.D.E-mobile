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

  // Hide bottom nav on terminal pages — terminal has its own header + toolbar
  if (location.pathname.startsWith("/terminal/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-bottom">
      {/* Glass background with top border glow */}
      <div className="absolute inset-0 bg-surface-0/80 backdrop-blur-2xl border-t border-white/[0.04]" />

      <div className="relative flex items-center justify-around h-14">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center gap-1 px-4 py-1.5 text-xs transition-all duration-300",
                isActive
                  ? "text-accent"
                  : "text-text-muted hover:text-text-secondary",
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator line */}
                {isActive && (
                  <span className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-accent accent-line-glow" />
                )}
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all duration-300",
                    isActive && "nav-glow",
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive && "text-accent",
                )}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
