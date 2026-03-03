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
        "rounded-xl bg-surface-1 border border-border p-4",
        interactive && "cursor-pointer hover:bg-surface-2 hover:border-border-hover active:scale-[0.98] transition-all",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
