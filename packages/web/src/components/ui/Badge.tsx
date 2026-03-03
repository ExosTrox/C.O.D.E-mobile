import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const variants = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  error: "bg-error/10 text-error border-error/20",
  info: "bg-info/10 text-info border-info/20",
  muted: "bg-surface-3 text-text-muted border-border",
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
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border",
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
