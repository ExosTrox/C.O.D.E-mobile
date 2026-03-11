import { useEffect, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Content */}
          <motion.div
            className={cn(
              "relative z-10 w-full max-h-[85dvh] overflow-y-auto",
              "bg-gradient-to-b from-surface-1 to-surface-0 border border-white/[0.06] shadow-2xl",
              "rounded-t-3xl md:rounded-2xl",
              "md:max-w-lg md:mx-4",
              className,
            )}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 md:hidden">
              <div className="w-8 h-1 rounded-full bg-surface-3" />
            </div>

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h2 className="text-base font-bold text-text-primary tracking-tight">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 -mr-1 rounded-lg hover:bg-surface-2/50 text-text-dimmed hover:text-text-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
