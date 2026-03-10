import { NavLink } from "react-router-dom";
import { Layers, Box, BarChart3, Settings } from "lucide-react";
import { cn } from "../../lib/cn";

const navItems = [
  { to: "/sessions", label: "Sessions", icon: Layers },
  { to: "/providers", label: "Providers", icon: Box },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-surface-1/80 backdrop-blur-xl safe-bottom md:hidden">
      <style>{`
        .nav-glow {
          filter: drop-shadow(0 0 6px currentColor) drop-shadow(0 0 12px currentColor);
        }
      `}</style>
      <div className="flex items-center justify-around h-14">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-all duration-200",
                isActive
                  ? "text-accent"
                  : "text-text-muted hover:text-text-secondary",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-accent" />
                )}
                <Icon className={cn("h-5 w-5", isActive && "nav-glow")} />
                <span className={cn("text-[10px] font-medium", isActive && "text-accent")}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
