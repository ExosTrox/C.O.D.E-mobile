// ── Notification Permission Prompt ──────────────────────────
// Shown after first session creation to request push notification permission.

import { useState, useEffect, useCallback } from "react";
import { X, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "../ui/Button";
import { useAuthStore } from "../../stores/auth.store";

const NOTIF_DISMISSED_KEY = "code-mobile-notif-dismissed";
const NOTIF_ASKED_KEY = "code-mobile-notif-asked";

function supportsNotifications(): boolean {
  return "Notification" in window && "serviceWorker" in navigator;
}

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const serverUrl = useAuthStore((s) => s.serverUrl);

  useEffect(() => {
    if (!supportsNotifications()) return;
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem(NOTIF_DISMISSED_KEY)) return;
    if (localStorage.getItem(NOTIF_ASKED_KEY)) return;

    // Show after a short delay
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        // Subscribe to push
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            // VAPID public key — the daemon generates this on first run
            // For now, we try to fetch it from the server
            await fetchVapidKey(serverUrl),
          ),
        });

        // Send subscription to daemon
        await fetch(`${serverUrl}/api/v1/notifications/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });

        toast.success("Notifications enabled");
      }
    } catch {
      toast.error("Could not enable notifications");
    }

    localStorage.setItem(NOTIF_ASKED_KEY, "1");
    setShow(false);
  }, [serverUrl]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    sessionStorage.setItem(NOTIF_DISMISSED_KEY, "1");
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-16 md:top-4 left-4 right-4 z-[60] max-w-md mx-auto"
        >
          <div className="bg-surface-1 border border-border rounded-xl p-4 shadow-lg backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-info" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  Enable Notifications
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Get alerts when sessions need attention
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleEnable} className="flex-1">
                <Bell className="h-3.5 w-3.5" />
                Enable
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                Not Now
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function fetchVapidKey(serverUrl: string): Promise<string> {
  try {
    const res = await fetch(`${serverUrl}/api/v1/notifications/vapid-key`);
    const data = await res.json();
    return data.data?.publicKey ?? "";
  } catch {
    return "";
  }
}
