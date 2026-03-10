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
        "rounded-xl bg-surface-1/50 border border-white/[0.04] p-4",
        interactive &&
          "cursor-pointer hover:bg-surface-1/80 hover:border-white/[0.06] active:scale-[0.98] transition-all duration-200",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
