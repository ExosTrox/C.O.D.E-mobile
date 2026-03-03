import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { OfflineBanner } from "./OfflineBanner";
import { InstallPrompt } from "./InstallPrompt";
import { NotificationPrompt } from "./NotificationPrompt";
import { useWs } from "../../hooks/use-ws";

export function Shell() {
  // Auto-connect WebSocket when shell mounts (user is authenticated)
  useWs();

  return (
    <div className="flex min-h-screen bg-surface-0">
      <SideNav />
      <main className="flex-1 flex flex-col min-h-screen pb-14 md:pb-0">
        <OfflineBanner />
        <Outlet />
      </main>
      <BottomNav />
      <InstallPrompt />
      <NotificationPrompt />
    </div>
  );
}
