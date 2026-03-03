import { NavLink } from "react-router-dom";
import { Terminal, Layers, Box, BarChart3, Settings } from "lucide-react";
import { cn } from "../../lib/cn";

const navItems = [
  { to: "/sessions", label: "Sessions", icon: Layers },
  { to: "/providers", label: "Providers", icon: Box },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function SideNav() {
  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-surface-1 h-screen sticky top-0">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="h-7 w-7 rounded-lg bg-accent/20 flex items-center justify-center">
          <Terminal className="h-4 w-4 text-accent" />
        </div>
        <span className="font-semibold text-text-primary text-sm">
          CODE Mobile
        </span>
      </div>

      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-2",
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-text-dimmed">v0.0.1</p>
      </div>
    </aside>
  );
}
