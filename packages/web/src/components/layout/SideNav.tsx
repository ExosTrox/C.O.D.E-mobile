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
    <aside className="hidden md:flex flex-col w-56 border-r border-white/[0.04] bg-surface-0 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-white/[0.04]">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center border border-accent/10">
          <Terminal className="h-3.5 w-3.5 text-accent" />
        </div>
        <span className="font-semibold text-text-primary text-sm tracking-tight">
          CODE <span className="text-accent font-bold">Mobile</span>
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-accent/8 text-accent"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-2/50",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    "h-4 w-4 transition-all",
                    isActive ? "text-accent" : "text-text-dimmed group-hover:text-text-muted",
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span>{label}</span>
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-accent accent-dot-glow" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Version */}
      <div className="px-5 py-3 border-t border-white/[0.04]">
        <p className="text-[10px] text-text-dimmed tracking-wide">v0.0.1</p>
      </div>
    </aside>
  );
}
