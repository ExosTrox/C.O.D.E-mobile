import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  displayValue?: string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, displayValue, id, ...props }, ref) => {
    const sliderId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-2">
        {(label || displayValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <label htmlFor={sliderId} className="text-xs font-semibold text-text-secondary">
                {label}
              </label>
            )}
            {displayValue && (
              <span className="text-xs font-mono text-text-muted">{displayValue}</span>
            )}
          </div>
        )}
        <input
          ref={ref}
          id={sliderId}
          type="range"
          className={cn(
            "w-full h-1.5 rounded-full appearance-none cursor-pointer",
            "bg-surface-3/60 accent-accent",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent",
            "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-0",
            "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-accent/20",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
Slider.displayName = "Slider";
