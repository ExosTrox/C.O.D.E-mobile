// ── PWA Install Prompt ──────────────────────────────────────
// Non-intrusive bottom banner for PWA install.

import { useState, useEffect, useCallback } from "react";
import { X, Download, Share } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";

// Extend window for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "code-mobile-install-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Already installed or dismissed this session
    if (isStandalone()) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    if (isIOS()) {
      // No beforeinstallprompt on iOS — show instructions
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (!dismissed) {
        setShowIOSInstructions(true);
        setShowBanner(true);
      }
      return;
    }

    function handlePrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
    if (showIOSInstructions) {
      localStorage.setItem(DISMISS_KEY, "1");
    }
  }, [showIOSInstructions]);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-16 md:bottom-4 left-4 right-4 z-[60] max-w-md mx-auto"
        >
          <div className="bg-surface-1 border border-border rounded-xl p-4 shadow-lg backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                {showIOSInstructions ? (
                  <Share className="h-5 w-5 text-accent" />
                ) : (
                  <Download className="h-5 w-5 text-accent" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  Install CODE Mobile
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {showIOSInstructions
                    ? "Tap Share \u2192 Add to Home Screen"
                    : "Install for a better experience"}
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!showIOSInstructions && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleInstall} className="flex-1">
                  Install
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDismiss}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
