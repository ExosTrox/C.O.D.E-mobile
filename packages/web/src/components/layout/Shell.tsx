import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { OfflineBanner } from "./OfflineBanner";
import { InstallPrompt } from "./InstallPrompt";
import { NotificationPrompt } from "./NotificationPrompt";
import { useWs } from "../../hooks/use-ws";
import { cn } from "../../lib/cn";

export function Shell() {
  // Auto-connect WebSocket when shell mounts (user is authenticated)
  useWs();

  const location = useLocation();
  const isTerminal = location.pathname.startsWith("/terminal/");

  return (
    <div className="flex min-h-screen bg-surface-0">
      <SideNav />
      <main className={cn("flex-1 flex flex-col min-h-screen md:pb-0", !isTerminal && "pb-14")}>
        <OfflineBanner />
        <Outlet />
      </main>
      <BottomNav />
      <InstallPrompt />
      <NotificationPrompt />
    </div>
  );
}
