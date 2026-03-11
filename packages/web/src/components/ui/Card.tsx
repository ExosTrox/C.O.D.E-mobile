import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl bg-gradient-to-br from-surface-1/80 to-surface-1/40 border border-white/[0.05] p-4",
        interactive &&
          "cursor-pointer card-hover active:scale-[0.98] transition-all duration-200",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
