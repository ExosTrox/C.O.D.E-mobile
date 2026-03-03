import { NavLink } from "react-router-dom";
import { Terminal, Layers, Box, Settings } from "lucide-react";
import { cn } from "../../lib/cn";

const navItems = [
  { to: "/terminal", label: "Terminal", icon: Terminal },
  { to: "/sessions", label: "Sessions", icon: Layers },
  { to: "/providers", label: "Providers", icon: Box },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface-1/80 backdrop-blur-xl safe-bottom md:hidden">
      <div className="flex items-center justify-around h-14">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "text-accent"
                  : "text-text-muted hover:text-text-secondary",
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
