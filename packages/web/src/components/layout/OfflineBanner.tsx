// ── Offline Banner ──────────────────────────────────────────
// Shows "Connecting to server..." when browser is offline.

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-warning/10 border-b border-warning/20 overflow-hidden"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-2">
            <WifiOff className="h-3.5 w-3.5 text-warning" />
            <span className="text-xs text-warning font-medium">
              Connecting to server...
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
