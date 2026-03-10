import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const variants = {
  success: "bg-success/8 text-success border-success/15",
  warning: "bg-warning/8 text-warning border-warning/15",
  error: "bg-error/8 text-error border-error/15",
  info: "bg-info/8 text-info border-info/15",
  muted: "bg-surface-2/60 text-text-muted border-white/[0.04]",
} as const;

interface BadgeProps {
  variant?: keyof typeof variants;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = "muted", children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-lg border",
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-success": variant === "success",
            "bg-warning": variant === "warning",
            "bg-error": variant === "error",
            "bg-info": variant === "info",
            "bg-text-muted": variant === "muted",
          })}
        />
      )}
      {children}
    </span>
  );
}
