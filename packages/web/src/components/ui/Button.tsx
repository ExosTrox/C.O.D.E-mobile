import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const variants = {
  primary:
    "bg-accent hover:bg-accent-hover text-white font-medium shadow-sm shadow-accent/10 hover:shadow-accent/20",
  secondary:
    "bg-surface-2/60 hover:bg-surface-2/80 text-text-primary border border-white/[0.04] hover:border-white/[0.06]",
  ghost: "hover:bg-surface-2/50 text-text-secondary hover:text-text-primary",
  danger:
    "bg-error/8 hover:bg-error/15 text-error border border-error/15 hover:border-error/25",
} as const;

const sizes = {
  sm: "h-8 px-3 text-xs rounded-xl gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2.5",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        "disabled:opacity-30 disabled:pointer-events-none",
        "active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled}
      {...props}
    />
  ),
);
Button.displayName = "Button";
